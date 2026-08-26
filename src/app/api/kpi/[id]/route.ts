import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

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

export async function GET(req: Request, context: any) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await context.params;
        const requestedUserId = resolvedParams.id;

        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        const user = await prisma.user.findUnique({
            where: { id: requestedUserId },
            select: { id: true, fullName: true, role: true, avatarUrl: true, team: { select: { name: true } } }
        });

        if (!user) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });

        const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);

        const [kpiRecord, allLogs] = await Promise.all([
            prisma.weeklyKPI.findFirst({
                where: { userId: user.id, year, month, weekNumber: weekIndex }
            }),
            prisma.taskLog.findMany({
                where: {
                    userId: user.id,
                    createdAt: { gte: start, lte: end }
                },
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

        const validUserLogs: typeof allLogs = [];
        const dailyReportTracker = new Set<string>();
        
        // 🚀 1. LỌC: CHỈ LẤY DUY NHẤT ACTION "DAILY_REPORT" VÀ ĐẢM BẢO 1 BÀI/NGÀY
        allLogs.forEach(log => {
            const actionStr = String(log.action || "").toUpperCase();
            
            if (actionStr !== "DAILY_REPORT") return; 

            const dateString = log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : "";
            const uniqueKey = `${log.taskId}_${dateString}`;
            
            if (!dailyReportTracker.has(uniqueKey)) {
                dailyReportTracker.add(uniqueKey);
                validUserLogs.push(log);
            }
        });

        // Đã lọc sạch rác, chỉ còn Báo Cáo nên gán cứng typeStr luôn
        const mappedLogs = validUserLogs.map(log => {
            return { ...log, typeStr: "Báo cáo", isCounted: false }; 
        });

        const uniqueTasks = new Map<string, any>();
        
        // 🚀 2. BỘ LỌC KỶ LUẬT (Không cần check actionStr nữa vì 100% là DAILY_REPORT)
        mappedLogs.forEach(log => {
            if (!log.task) return;

            let isKpiQualifying = true; 
            const combinedText = String(log.details || "").toLowerCase();

            if (!combinedText.includes("gán thủ công")) {
                    if (user.role === "LEADER") {
                        if (!combinedText.includes("video render")) isKpiQualifying = false;
                    } else if (user.role === "EDITOR") {
                        if (combinedText.includes("kịch bản") || combinedText.includes("chuyển động") || combinedText.includes("đã đăng") || combinedText.includes("thumbnail")) {
                            isKpiQualifying = false;
                        }
                    } else if (user.role === "CONTENT") {
                        if (combinedText.includes("video render") || combinedText.includes("prj thô") || combinedText.includes("audio") || combinedText.includes("âm thanh") || combinedText.includes("chuyển động") || combinedText.includes("đã đăng") || combinedText.includes("thumbnail")) {
                            isKpiQualifying = false;
                        }
                    } else if (user.role === "PUBLISHER" || user.role === "CHANNEL_MANAGER") {
                        if (combinedText.includes("kịch bản") || combinedText.includes("video render") || combinedText.includes("prj thô") || combinedText.includes("audio") || combinedText.includes("âm thanh") || combinedText.includes("chuyển động")) {
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
        let actualCount = uniqueTasks.size;

        const bucketMins: Record<string, number> = {};
        const bucketTaskCount: Record<string, number> = {};

        uniqueTasks.forEach(task => {
            const key = `${task.channel?.id || 'no_channel'}_${task.isRework ? 'rework' : 'new'}`;
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

            Object.keys(specificTargets).forEach(key => {
                const res = distributeToTargets(specificTargets[key], bucketMins[key] || 0, bucketTaskCount[key] || 0);
                totalActualMinutes += res.assignedMinsTotal;
                bucketMins[key] = res.minsLeft;
                bucketTaskCount[key] = res.tasksLeft;
            });

            Object.keys(anyTargets).forEach(reworkKey => {
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

                const res = distributeToTargets(anyTargets[reworkKey], remainingMins, remainingTasks);
                totalActualMinutes += res.assignedMinsTotal;
            });

            percent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
        } else {
            percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
        }

        return NextResponse.json({
            userId: user.id, 
            fullName: user.fullName, 
            role: user.role,
            teamName: user.team?.name || "Chưa có team", 
            targetValue, actualValue: actualCount, percent, logs: allUserLogs, 
            targetDetails, totalTargetMinutes, totalActualMinutes,
            avatarUrl: user.avatarUrl || null
        });

    } catch (error) {
        console.error("LỖI API KPI CÁ NHÂN:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}