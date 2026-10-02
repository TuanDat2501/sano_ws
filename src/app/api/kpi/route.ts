import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// 🚀 HÀM TÍNH TUẦN CHUẨN CẮT BIÊN THÁNG (Đồng bộ với Frontend và Analytics)
// 🚀 HÀM CHUẨN XÁC 100% CHO CẢ 2 FILE API (ĐỒNG BỘ LOGIC VÀ ÉP CỨNG MÚI GIỜ VIỆT NAM)
function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    // 1. Dùng Date.UTC kết hợp 12h trưa để đảm bảo việc lấy ngày không bao giờ bị lệch qua hôm trước/hôm sau do timezone
    const totalDays = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate(); 
    const startDayOfWeek = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).getUTCDay(); 
    
    // 2. Tìm ngày Chủ Nhật đầu tiên của tháng (0 là Chủ Nhật)
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    let startDay = 1;
    let endDay = firstSunday;

    // 3. Nếu không phải tuần 1, tịnh tiến mỗi tuần 7 ngày
    if (weekNumber > 1) {
        startDay = firstSunday + (weekNumber - 2) * 7 + 1;
        endDay = Math.min(startDay + 6, totalDays); // Chặn biên không vượt quá ngày cuối tháng
    }

    const pad = (num: number) => num.toString().padStart(2, '0');

    // 4. Khởi tạo mốc thời gian bằng chuỗi ISO ép cứng múi giờ Việt Nam (+07:00)
    // VD: "2026-10-01T00:00:00+07:00". Prisma khi filter DB sẽ tự động đối chiếu rất chuẩn xác.
    const startOfWeek = new Date(`${year}-${pad(month)}-${pad(startDay)}T00:00:00+07:00`);
    const endOfWeek = new Date(`${year}-${pad(month)}-${pad(endDay)}T23:59:59.999+07:00`);

    return { start: startOfWeek, end: endOfWeek };
}

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: any) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const requestedUserId = context?.params ? (await context.params).id : null;

        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        let userWhere: any = { 
            isActive: true,
            role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] }
        };

        const currentUser = session.user as any;
        const canFilterTeam = currentUser.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(currentUser.role);

        if (requestedUserId) {
            userWhere = { id: requestedUserId };
        } else {
            if (currentUser.role === "ADMIN" || canFilterTeam || currentUser.role === "LEADER") {
                if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
            } else {
                if (!teamId || teamId === "ALL") return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
                userWhere.teamId = teamId;
            }
        }

        const usersRaw = await prisma.user.findMany({
            where: userWhere,
            select: { 
                id: true, fullName: true, role: true, avatarUrl: true,
                team: { select: { name: true } },
                channelMemberships: { select: { channelId: true, roleOnChannel: true } }
            }
        });

        const users = requestedUserId ? usersRaw : usersRaw.filter(u => u.team?.name !== "Nhân sự" && u.team?.name !== "HR");
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
                    createdAt: { gte: new Date(start.setHours(0,0,0,0)), lte: new Date(end.setHours(23,59,59,999)) }
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
            // Dùng để tính % thật (không lố)
            let cappedActualMinutesForPercent = 0;
            
            let actualCount = uniqueTasks.size;

            const bucketMins: Record<string, number> = {};
            const bucketTaskCount: Record<string, number> = {};

            uniqueTasks.forEach((task, uniqueKey) => {
                const jobCategory = uniqueKey.split('_').pop(); 
                const isReworkBucket = (jobCategory === 'PUBLISH') ? false : task.isRework;

                const key = `${task.channel?.id || 'no_channel'}_${isReworkBucket ? 'rework' : 'new'}`;
                bucketMins[key] = (bucketMins[key] || 0) + Number(task.duration || 0);
                bucketTaskCount[key] = (bucketTaskCount[key] || 0) + 1; 
            });

            if (targetDetails && targetDetails.length > 0) {
                const specificTargets: Record<string, any[]> = {};
                const anyTargets: Record<string, any[]> = {};

                targetDetails.forEach(t => {
                    t.actualMinutes = 0;
                    t.actualCount = 0; 
                    if (t.channelId) {
                        const key = `${t.channelId}_${t.isRework ? 'rework' : 'new'}`;
                        if (!specificTargets[key]) specificTargets[key] = [];
                        specificTargets[key].push(t);
                    } else {
                        const key = t.isRework ? 'rework' : 'new';
                        if (!anyTargets[key]) anyTargets[key] = [];
                        anyTargets[key].push(t);
                    }
                });

                const distributeToTargets = (targets: any[], minsLeft: number, tasksLeft: number) => {
                    let assignedMinsTotal = 0;
                    targets.forEach((t, index) => {
                        const tMins = Number(t.targetCount) * Number(t.duration);
                        totalTargetMinutes += tMins;

                        let assignedMins = 0;
                        let assignedTasks = 0;

                        if (index === targets.length - 1) {
                            assignedMins = minsLeft;
                            assignedTasks = tasksLeft;
                        } else {
                            assignedMins = Math.min(minsLeft, tMins);
                            assignedTasks = Math.min(tasksLeft, Number(t.targetCount));
                        }

                        minsLeft -= assignedMins;
                        tasksLeft -= assignedTasks;
                        assignedMinsTotal += assignedMins;

                        t.actualMinutes = (t.actualMinutes || 0) + assignedMins;
                        t.actualCount = (t.actualCount || 0) + assignedTasks; 
                    });
                    return { minsLeft, tasksLeft, assignedMinsTotal };
                };

                // 1. Phân bổ cho các Kênh cụ thể (Ví dụ: WOTA US)
                Object.keys(specificTargets).forEach(key => {
                    const targets = specificTargets[key];
                    const res = distributeToTargets(targets, bucketMins[key] || 0, bucketTaskCount[key] || 0);
                    
                    // Phút này là phút CẤP ĐÚNG QUOTA -> Dùng để tính %
                    cappedActualMinutesForPercent += res.assignedMinsTotal;
                    
                    // Nếu làm dư thừa TRÊN ĐÚNG KÊNH ĐÓ -> Ghi nhận vào chỉ tiêu để nhìn cho đẹp, nhưng KHÔNG CỘNG VÀO % TỔNG
                    if (res.minsLeft > 0) {
                        targets[targets.length - 1].actualCount += res.tasksLeft;
                        targets[targets.length - 1].actualMinutes += res.minsLeft;
                    }
                    
                    bucketMins[key] = 0;
                    bucketTaskCount[key] = 0;
                });

                // 2. Phân bổ cho các Kênh bất kỳ
                Object.keys(anyTargets).forEach(reworkKey => {
                    const targets = anyTargets[reworkKey];
                    let remainingMins = 0;
                    let remainingTasks = 0;
                    Object.keys(bucketMins).forEach(bKey => {
                        if (bKey.endsWith(`_${reworkKey}`)) {
                            remainingMins += bucketMins[bKey];
                            remainingTasks += bucketTaskCount[bKey];
                            bucketMins[bKey] = 0; 
                            bucketTaskCount[bKey] = 0;
                        }
                    });

                    const res = distributeToTargets(targets, remainingMins, remainingTasks);
                    cappedActualMinutesForPercent += res.assignedMinsTotal;
                    
                    // Với kênh bất kỳ, làm dư thừa cũng không cộng vào % tổng
                    if (res.minsLeft > 0) {
                        targets[targets.length - 1].actualCount += res.tasksLeft;
                        targets[targets.length - 1].actualMinutes += res.minsLeft;
                    }
                });

                // 🚀 ĐÃ XÓA logic cộng dồn remainingMinsGlobal (kênh rác) vào điểm tổng

                percent = totalTargetMinutes > 0 ? Math.round((cappedActualMinutesForPercent / totalTargetMinutes) * 100) : 0;
            } else {
                percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
            }

            // Tính tổng phút thực tế (Hiển thị UI: Khối lượng phút: X / Y)
            let totalVisualMinutes = 0;
            if (targetDetails && targetDetails.length > 0) {
                targetDetails.forEach(t => totalVisualMinutes += (t.actualMinutes || 0));
            }

            const responseData = {
                userId: user.id, fullName: user.fullName, role: user.role, teamName: user.team?.name || "Chưa có team", 
                targetValue, actualValue: actualCount, percent, logs: allUserLogs, 
                targetDetails, totalTargetMinutes, 
                totalActualMinutes: totalVisualMinutes, // Hiển thị 30/80 thay vì 120/80
                avatarUrl: user.avatarUrl || null
            };

            if (!requestedUserId) {
                return {
                    ...responseData,
                    note: kpiRecord?.note || "",
                    isLocked: kpiRecord?.isLocked || false,
                    oldTargetValue: kpiRecord?.oldTargetValue || null
                };
            }
            return responseData;
        });

        if (!requestedUserId) {
            kpiData.sort((a, b) => b.percent - a.percent);
            return NextResponse.json({ weekData: { year, month, weekIndex, startDate: start, endDate: end }, kpiList: kpiData });
        } else {
            return NextResponse.json(kpiData[0]);
        }

    } catch (error) {
        console.error("LỖI API KPI:", error);
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