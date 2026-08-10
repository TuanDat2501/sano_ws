import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// 🚀 LOGIC CHUẨN ISO 8601
function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    
    if (thursdayOfFirstWeek.getMonth() !== month - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }

    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    startOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setHours(23, 59, 59, 999);

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
                id: true, 
                fullName: true, 
                role: true, 
                avatarUrl: true,
                team: { select: { name: true } }
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
                // 🚀 ĐÃ SỬA CHUẨN: Chỉ lấy trường "details" vì TaskLog không có trường "note"
                select: {
                    id: true,
                    action: true,
                    details: true,
                    createdAt: true,
                    taskId: true,
                    userId: true,
                    task: { 
                        select: { 
                            id: true, title: true, status: true, duration: true, isRework: true,
                            channel: { select: { id: true, name: true } }
                        } 
                    } 
                }
            })
        ]);

        const kpiData = users.map(user => {
            const kpiRecord = allKpis.find(k => k.userId === user.id);
            const rawUserLogs = allLogs.filter(l => l.userId === user.id);
            const validUserLogs: typeof rawUserLogs = [];
            const dailyReportTracker = new Set<string>();

            // Lọc log an toàn trên RAM
            rawUserLogs.forEach(log => {
                const actionStr = String(log.action || "").toUpperCase();
                if (!["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT", "UPDATE_TASK", "UPDATE"].includes(actionStr)) {
                    return; 
                }

                if (actionStr === "DAILY_REPORT") {
                    const dateString = log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : "";
                    const uniqueKey = `${log.taskId}_${dateString}`;
                    if (!dailyReportTracker.has(uniqueKey)) {
                        dailyReportTracker.add(uniqueKey);
                        validUserLogs.push(log);
                    }
                } else {
                    validUserLogs.push(log);
                }
            });

            const mappedLogs = validUserLogs.map(log => {
                let typeStr = "Khác";
                const act = String(log.action || "").toUpperCase();
                if (act === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (act === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (act === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (act === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                else if (act === "DAILY_REPORT") typeStr = "Báo cáo";
                else if (act === "UPDATE_TASK" || act === "UPDATE") typeStr = "Cập nhật";
                return { ...log, typeStr, isCounted: false }; 
            });

            // BỘ LỌC KỶ LUẬT THÔNG MINH (BLACKLIST - Mặc định cho qua)
            const uniqueTasks = new Map<string, any>();
            
            mappedLogs.forEach(log => {
                if (!log.task) return;

                let isKpiQualifying = true; 
                
                const actionStr = String(log.action || "").toUpperCase();
                
                // 🚀 ĐÃ SỬA: Chỉ kiểm tra theo nội dung trường "details"
                const combinedText = String(log.details || "").toLowerCase();

                // Quét cờ Blacklist để trừ các báo cáo nháp không liên quan đến vai trò
                if (actionStr === "DAILY_REPORT" || actionStr === "UPDATE_TASK" || actionStr === "UPDATE") {
                    if (user.role === "EDITOR") {
                        if (combinedText.includes("prj thô") || combinedText.includes("âm thanh") || combinedText.includes("audio")) {
                            isKpiQualifying = false;
                        }
                    } else if (user.role === "CONTENT") {
                        if (combinedText.includes("ý tưởng") && !combinedText.includes("kịch bản")) {
                            isKpiQualifying = false;
                        }
                    }
                }

                if (isKpiQualifying) {
                    if (!uniqueTasks.has(log.taskId)) {
                        uniqueTasks.set(log.taskId, log.task);
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
            let totalActualMinutes = 0;
            
            // ACTUAL COUNT TỔNG: LUÔN LÀ SỐ BÀI THỰC TẾ
            let actualCount = uniqueTasks.size;

            const bucketMins: Record<string, number> = {};
            const bucketTaskCount: Record<string, number> = {};

            uniqueTasks.forEach(task => {
                const key = `${task.channel?.id || 'no_channel'}_${task.isRework ? 'rework' : 'new'}`;
                bucketMins[key] = (bucketMins[key] || 0) + Number(task.duration || 0);
                bucketTaskCount[key] = (bucketTaskCount[key] || 0) + 1; 
            });

            // THUẬT TOÁN PHÂN BỔ KPI CHÍNH XÁC (SỐ NGUYÊN)
            if (targetDetails && targetDetails.length > 0) {
                const specificTargets: Record<string, any[]> = {};
                const anyTargets: Record<string, any[]> = {};

                targetDetails.forEach(t => {
                    t.actualMinutes = 0;
                    t.actualCount = 0; // Reset

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
                            // Target cuối ôm trọn phần dư thừa của bucket
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

                // 1. Phân bổ cho Target có ĐÚNG KÊNH
                Object.keys(specificTargets).forEach(key => {
                    const targets = specificTargets[key];
                    const res = distributeToTargets(targets, bucketMins[key] || 0, bucketTaskCount[key] || 0);
                    totalActualMinutes += res.assignedMinsTotal;
                    
                    bucketMins[key] = res.minsLeft;
                    bucketTaskCount[key] = res.tasksLeft;
                });

                // 2. Phân bổ phần còn dư cho Target "DÙNG CHUNG KÊNH" (Nguồn hở)
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
                    totalActualMinutes += res.assignedMinsTotal;
                });

                percent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
            } else {
                percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
            }

            return {
                userId: user.id, 
                fullName: user.fullName, 
                role: user.role,
                teamName: user.team?.name || "Chưa có team", 
                targetValue, actualValue: actualCount, percent, logs: allUserLogs, 
                targetDetails, totalTargetMinutes, totalActualMinutes,
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
        const { userId, year, month, weekNumber, targetValue, targetDetails } = body;
        
        const pYear = parseInt(year);
        const pMonth = parseInt(month);
        const pWeek = parseInt(weekNumber);
        const pTarget = parseInt(targetValue);

        if (!userId || !pYear || !pMonth || !pWeek || isNaN(pTarget)) {
            return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
        }

        const targetDetailsJson = targetDetails ? targetDetails : [];

        const existingKPI = await prisma.weeklyKPI.findFirst({
            where: {
                userId: userId,
                year: pYear,
                month: pMonth,
                weekNumber: pWeek
            }
        });

        let kpiRecord;

        if (existingKPI) {
            kpiRecord = await prisma.weeklyKPI.update({
                where: { id: existingKPI.id },
                data: { 
                    targetValue: pTarget,
                    targetDetails: targetDetailsJson 
                }
            });
        } else {
            kpiRecord = await prisma.weeklyKPI.create({
                data: { 
                    userId, 
                    year: pYear, 
                    month: pMonth, 
                    weekNumber: pWeek, 
                    targetValue: pTarget,
                    targetDetails: targetDetailsJson
                }
            });
        }
        
        return NextResponse.json({ message: "Giao KPI thành công", data: kpiRecord }, { status: 200 });
    } catch (error) {
        console.error("LỖI GÁN KPI:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}