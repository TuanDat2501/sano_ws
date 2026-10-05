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
            select: {
                id: true,
                fullName: true,
                role: true,
                avatarUrl: true,
                team: { select: { name: true } },
                channelMemberships: {
                    select: { channelId: true, roleOnChannel: true }
                }
            }
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
                    // 🚀 ĐÃ SỬA: Dùng trực tiếp start, end. Tuyệt đối không dùng setHours
                    createdAt: { gte: start, lte: end }
                },
                select: {
                    id: true,
                    action: true,
                    details: true,
                    jobCategory: true, 
                    createdAt: true,
                    taskId: true,
                    userId: true,
                    task: {
                        select: {
                            id: true, title: true, status: true, duration: true, isRework: true, channelId: true,
                            channel: { select: { id: true, name: true } }
                        }
                    }
                }
            })
        ]);

        const validUserLogs: typeof allLogs = [];

        allLogs.forEach(log => {
            const actionStr = String(log.action || "").toUpperCase();
            if (actionStr === "DAILY_REPORT") {
                validUserLogs.push(log);
            }
        });

        const mappedLogs = validUserLogs.map(log => {
            return { ...log, typeStr: "Báo cáo", isCounted: false };
        });

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
        } catch (e) { }

        let percent = 0;
        let totalTargetMinutes = 0;
        let cappedActualMinutesForPercent = 0;
        let actualCount = uniqueTasks.size;

        // 🚀 BƯỚC 1: Chỉ đếm số lượng bài (Task Count)
        const bucketTaskCount: Record<string, number> = {};

        uniqueTasks.forEach((task, uniqueKey) => {
            const jobCategory = uniqueKey.split('_').pop(); 
            const isReworkBucket = (jobCategory === 'PUBLISH') ? false : task.isRework;

            const key = `${task.channel?.id || 'no_channel'}_${isReworkBucket ? 'rework' : 'new'}`;
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

            // 🚀 BƯỚC 2: Rót Số lượng bài vào Target -> Tính Phút = Số Bài x Đơn giá Target
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
                const res = distributeToTargets(specificTargets[key], bucketTaskCount[key] || 0);
                cappedActualMinutesForPercent += res.assignedMinsTotal;
                bucketTaskCount[key] = 0;
            });

            // Phân bổ Kênh Bất kỳ
            Object.keys(anyTargets).forEach(reworkKey => {
                let remainingTasks = 0;
                Object.keys(bucketTaskCount).forEach(bKey => {
                    if (bKey.endsWith(`_${reworkKey}`)) {
                        remainingTasks += bucketTaskCount[bKey];
                        bucketTaskCount[bKey] = 0;
                    }
                });

                const res = distributeToTargets(anyTargets[reworkKey], remainingTasks);
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

        return NextResponse.json({
            userId: user.id,
            fullName: user.fullName,
            role: user.role,
            teamName: user.team?.name || "Chưa có team",
            targetValue, 
            actualValue: actualCount, 
            percent, 
            logs: allUserLogs,
            targetDetails, 
            totalTargetMinutes, 
            totalActualMinutes: totalVisualMinutes,
            avatarUrl: user.avatarUrl || null
        });

    } catch (error) {
        console.error("LỖI API KPI CÁ NHÂN:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}