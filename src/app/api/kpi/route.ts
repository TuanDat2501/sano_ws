import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// 🚀 HÀM TÍNH TUẦN CHUẨN CẮT BIÊN THÁNG (Đồng bộ với Frontend và Analytics)
function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const totalDays = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate(); 
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).getUTCDay(); 
    
    const diffToSunday = firstDayOfMonth === 0 ? 0 : 7 - firstDayOfMonth;
    const firstSunday = 1 + diffToSunday;

    let startDay = 1;
    let endDay = firstSunday;

    if (weekNumber > 1) {
        startDay = firstSunday + (weekNumber - 2) * 7 + 1;
        endDay = Math.min(startDay + 6, totalDays); 
    }

    const pad = (num: number) => num.toString().padStart(2, '0');

    const startOfWeek = new Date(`${year}-${pad(month)}-${pad(startDay)}T00:00:00+07:00`);
    const endOfWeek = new Date(`${year}-${pad(month)}-${pad(endDay)}T23:59:59.999+07:00`);

    return { start: startOfWeek, end: endOfWeek };
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        let userWhere: any = { 
            isActive: true,
            role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] }
        };

        const canFilterTeam = currentUser.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(currentUser.role);

        if (currentUser.role === "ADMIN" || canFilterTeam || currentUser.role === "LEADER") {
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } else {
            if (!teamId || teamId === "ALL") return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
            userWhere.teamId = teamId;
        }

        const usersRaw = await prisma.user.findMany({
            where: userWhere,
            select: { 
                id: true, fullName: true, role: true, avatarUrl: true,
                team: { select: { name: true } },
                channelMemberships: { select: { channelId: true, roleOnChannel: true } }
            }
        });

        const users = usersRaw.filter(u => u.team?.name !== "Nhân sự" && u.team?.name !== "HR");
        if (users.length === 0) return NextResponse.json({ weekData: { year, month, weekIndex }, kpiList: [] });

        const userIds = users.map(u => u.id);
        const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);

        const [allKpis, allLogs] = await Promise.all([
            prisma.weeklyKPI.findMany({
                where: { userId: { in: userIds }, year, month, weekNumber: weekIndex }
            }),
            prisma.taskLog.findMany({
                where: {
                    userId: { in: userIds },
                    createdAt: { gte: start, lte: end } 
                },
                select: {
                    id: true, action: true, details: true, jobCategory: true, createdAt: true, taskId: true, userId: true,
                    task: { 
                        select: { id: true, title: true, status: true, duration: true, isRework: true, channelId: true, channel: { select: { id: true, name: true } } } 
                    } 
                }
            })
        ]);

        const kpiData = users.map(user => {
            const kpiRecord = allKpis.find(k => k.userId === user.id);
            const rawUserLogs = allLogs.filter(l => l.userId === user.id);
            
            const validUserLogs = rawUserLogs.filter(log => String(log.action || "").toUpperCase() === "DAILY_REPORT");
            const mappedLogs = validUserLogs.map(log => ({ ...log, typeStr: "Báo cáo", isCounted: false }));

            const uniqueTasks = new Map<string, any>();
            
            mappedLogs.forEach(log => {
                if (!log.task) return;
                let jobCategory = (log as any).jobCategory;

                if (!jobCategory) {
                    const combinedText = String(log.details || "").toLowerCase();
                    if (combinedText.includes("gán thủ công")) jobCategory = "MANUAL";
                    else if (combinedText.includes("kịch bản") || combinedText.includes("bố cục")) jobCategory = "CONTENT";
                    else if (combinedText.includes("prj thô") || combinedText.includes("link project") || combinedText.includes("audio") || combinedText.includes("âm thanh") || combinedText.includes("video render")) jobCategory = "EDIT";
                    else if (combinedText.includes("chuyển động")) jobCategory = "ANIMATION";
                    else if (combinedText.includes("đã đăng") || combinedText.includes("thumbnail")) jobCategory = "PUBLISH";
                    else jobCategory = "GENERAL";
                }

                if (jobCategory && jobCategory !== 'GENERAL') {
                    const uniqueKey = jobCategory === 'MANUAL' ? `${log.id}_MANUAL` : `${log.taskId}_${jobCategory}`; 
                    if (!uniqueTasks.has(uniqueKey)) {
                        uniqueTasks.set(uniqueKey, log.task);
                        log.isCounted = true;
                    }
                }
            });
            const allUserLogs = [...mappedLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            const targetValue = kpiRecord?.targetValue || 0;
            const targetDetailsRaw = kpiRecord?.targetDetails;
            let targetDetails: any[] = [];
            try {
                if (targetDetailsRaw) targetDetails = typeof targetDetailsRaw === 'string' ? JSON.parse(targetDetailsRaw) : targetDetailsRaw;
            } catch(e) {}

            let percent = 0;
            let totalTargetMinutes = 0;
            let cappedActualMinutesForPercent = 0;
            let actualCount = uniqueTasks.size;

            const bucketTaskCount: Record<string, number> = {};

            uniqueTasks.forEach((task, uniqueKey) => {
                const jobCategory = uniqueKey.split('_').pop() || 'CONTENT'; 
                const isReworkBucket = (jobCategory === 'PUBLISH') ? false : task.isRework;

                // 🚀 BƯỚC 1: Gom bài dư với chìa khóa chứa jobCategory
                const key = `${task.channel?.id || 'no_channel'}_${jobCategory}_${isReworkBucket ? 'rework' : 'new'}`;
                bucketTaskCount[key] = (bucketTaskCount[key] || 0) + 1; 
            });

            if (targetDetails && targetDetails.length > 0) {
                const specificTargets: Record<string, any[]> = {};
                const anyTargets: Record<string, any[]> = {};

                // 🚀 BƯỚC 2: Phân nhóm Target theo jobCategory mới được gán từ Frontend
                targetDetails.forEach(t => {
                    t.actualMinutes = 0;
                    t.actualCount = 0; 
                    
                    const targetJob = t.jobCategory || 'CONTENT'; // Fallback nếu bản ghi cũ chưa có

                    if (t.channelId) {
                        const key = `${t.channelId}_${targetJob}_${t.isRework ? 'rework' : 'new'}`;
                        if (!specificTargets[key]) specificTargets[key] = [];
                        specificTargets[key].push(t);
                    } else {
                        const key = `${targetJob}_${t.isRework ? 'rework' : 'new'}`;
                        if (!anyTargets[key]) anyTargets[key] = [];
                        anyTargets[key].push(t);
                    }
                });

                const distributeToTargets = (targets: any[], tasksLeft: number) => {
                    let assignedMinsTotal = 0;
                    
                    targets.forEach((t, index) => {
                        const tDuration = Number(t.duration) || 0; 
                        const tMins = Number(t.targetCount) * tDuration; 
                        totalTargetMinutes += tMins;

                        let assignedTasks = 0;

                        if (index === targets.length - 1) {
                            assignedTasks = tasksLeft;
                        } else {
                            assignedTasks = Math.min(tasksLeft, Number(t.targetCount));
                        }

                        tasksLeft -= assignedTasks;
                        
                        const calculatedMins = assignedTasks * tDuration;
                        assignedMinsTotal += calculatedMins;

                        t.actualCount = (t.actualCount || 0) + assignedTasks; 
                        t.actualMinutes = (t.actualMinutes || 0) + calculatedMins; 
                    });
                    
                    return { tasksLeft, assignedMinsTotal };
                };

                // Phân bổ Kênh Cụ thể
                Object.keys(specificTargets).forEach(key => {
                    const targets = specificTargets[key];
                    const res = distributeToTargets(targets, bucketTaskCount[key] || 0);
                    
                    cappedActualMinutesForPercent += res.assignedMinsTotal;
                    bucketTaskCount[key] = 0; 
                });

                // Phân bổ Kênh Bất kỳ
                Object.keys(anyTargets).forEach(reworkKey => { // reworkKey lúc này là: jobCategory_rework/new
                    const targets = anyTargets[reworkKey];
                    let remainingTasks = 0;
                    Object.keys(bucketTaskCount).forEach(bKey => {
                        // bKey có định dạng: channelId_jobCategory_rework/new
                        // So khớp phần đuôi để lấy chính xác loại Khâu và Trạng thái
                        if (bKey.endsWith(`_${reworkKey}`)) {
                            remainingTasks += bucketTaskCount[bKey];
                            bucketTaskCount[bKey] = 0; 
                        }
                    });

                    const res = distributeToTargets(targets, remainingTasks);
                    cappedActualMinutesForPercent += res.assignedMinsTotal;
                });

                percent = totalTargetMinutes > 0 ? Math.round((cappedActualMinutesForPercent / totalTargetMinutes) * 100) : 0;
            } else {
                percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
            }

            let totalVisualMinutes = 0;
            if (targetDetails && targetDetails.length > 0) {
                targetDetails.forEach(t => totalVisualMinutes += (t.actualMinutes || 0));
            }

            return {
                userId: user.id, fullName: user.fullName, role: user.role, teamName: user.team?.name || "Chưa có team", 
                targetValue, actualValue: actualCount, percent, logs: allUserLogs, 
                targetDetails, totalTargetMinutes, 
                totalActualMinutes: totalVisualMinutes, 
                note: kpiRecord?.note || "",
                isLocked: kpiRecord?.isLocked || false,
                oldTargetValue: kpiRecord?.oldTargetValue || null,
                avatarUrl: user.avatarUrl || null
            };
        });

        kpiData.sort((a, b) => b.percent - a.percent);

        return NextResponse.json({ weekData: { year, month, weekIndex, startDate: start, endDate: end }, kpiList: kpiData });
    } catch (error) {
        console.error("LỖI API KPI GET:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        const hasPermission = currentUser?.permissions?.includes("MENU_KPI") || currentUser?.role === "ADMIN" || currentUser?.role === "LEADER";
        
        if (!hasPermission) {
            return NextResponse.json({ error: "Chỉ Quản lý mới được giao KPI" }, { status: 403 });
        }

        const body = await req.json();
        const { userId, year, month, weekNumber, targetValue, targetDetails, note } = body;
        
        const pYear = parseInt(year);
        const pMonth = parseInt(month);
        const pWeek = parseInt(weekNumber);
        const pTarget = parseInt(targetValue);

        if (!userId || !pYear || !pMonth || !pWeek || isNaN(pTarget)) {
            return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
        }

        const existingKPI = await prisma.weeklyKPI.findFirst({
            where: {
                userId: userId,
                year: pYear,
                month: pMonth,
                weekNumber: pWeek
            }
        });

        const isAdminOrHR = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser?.role);
        if (existingKPI?.isLocked && !isAdminOrHR) {
            return NextResponse.json({ error: "Tuần này đã bị chốt KPI, không thể chỉnh sửa!" }, { status: 403 });
        }

        const targetDetailsJson = targetDetails ? targetDetails : [];
        let kpiRecord;

        if (existingKPI) {
            let oldTargetToSave = existingKPI.oldTargetValue;
            if (existingKPI.targetValue !== pTarget) {
                oldTargetToSave = existingKPI.targetValue;
            }

            kpiRecord = await prisma.weeklyKPI.update({
                where: { id: existingKPI.id },
                data: { 
                    targetValue: pTarget,
                    oldTargetValue: oldTargetToSave, 
                    targetDetails: targetDetailsJson,
                    note: note || null 
                }
            });
        } else {
            kpiRecord = await prisma.weeklyKPI.create({
                data: { 
                    userId, year: pYear, month: pMonth, weekNumber: pWeek, 
                    targetValue: pTarget,
                    targetDetails: targetDetailsJson,
                    note: note || null 
                }
            });
        }
        
        return NextResponse.json({ message: "Giao KPI thành công", data: kpiRecord }, { status: 200 });
    } catch (error) {
        console.error("LỖI GÁN KPI:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}