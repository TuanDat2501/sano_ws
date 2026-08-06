import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getContinuousWeekRange, getCurrentWeekNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const currentUser = session.user as any;
        const role = currentUser.role;
        const userId = currentUser.id;
        const teamId = currentUser.teamId;

        const isTopManagement = ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"].includes(role);
        const isLeader = role === "LEADER";
        const isManager = isTopManagement || isLeader;

        const today = new Date();
        const currentWeekNum = getCurrentWeekNumber(today);
        const weekRange = getContinuousWeekRange(today.getFullYear(), today.getMonth() + 1, currentWeekNum);
        const startOfWeek = weekRange.start;
        startOfWeek.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(today.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7); 
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const generateEmpty7DaysChart = () => {
            const chartTemplate = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const dateStr = d.toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
                }).replace('/', '-');
                chartTemplate.push({ date: dateStr, done: 0 }); 
            }
            return chartTemplate;
        };

        if (isManager) {
            let teamUserIds: string[] = [];
            if (!isTopManagement) {
                const teamUsers = await prisma.user.findMany({
                    where: { teamId: teamId, isActive: true },
                    select: { id: true }
                });
                teamUserIds = teamUsers.map(u => u.id);
            }

            const taskFilter = isTopManagement ? {} : {
                OR: [
                    { contentId: { in: teamUserIds } },
                    { editorId: { in: teamUserIds } },
                    { animatorId: { in: teamUserIds } },
                    { publisherId: { in: teamUserIds } },
                    { teamId: teamId } 
                ]
            };

            const userCondition = isTopManagement ? {} : { userId: { in: teamUserIds } };

            const threeDaysAgo = new Date(today);
            threeDaysAgo.setDate(today.getDate() - 3);

            const [
                totalActiveTasks,
                totalPendingTasks,
                totalOverdueTasks,
                managerLogs7DaysRaw,
                kpiRecords
            ] = await Promise.all([
                prisma.task.count({ where: { ...taskFilter, isClosed: false } }),
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        status: { in: ["CONTENT_REVIEW", "ANIMATION_REVIEW", "EDIT_REVIEW", "DONE"] },
                        NOT: [{ videoLink: null }, { videoLink: "" }]
                    }
                }),
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        status: { in: ["TODO", "CONTENT_DOING", "ANIMATION_DOING", "EDIT_DOING"] },
                        createdAt: { lt: threeDaysAgo }
                    }
                }),
                prisma.taskLog.findMany({
                    where: {
                        createdAt: { gte: sevenDaysAgo },
                        ...userCondition,
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT", "MERGE_VIDEO"] }
                    },
                    orderBy: { createdAt: 'desc' },
                    include: { 
                        user: { select: { fullName: true } },
                        task: { select: { id: true, duration: true, channelId: true, isRework: true } }
                    }
                }),
                prisma.weeklyKPI.findMany({
                    where: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum,
                        ...userCondition
                    },
                    include: { user: { select: { fullName: true, role: true } } }
                })
            ]);
            
            const validLogs7Days: any[] = [];
            const dailyReportTracker7Days = new Set<string>();
            managerLogs7DaysRaw.forEach((log: any) => {
                if (log.action === "DAILY_REPORT") {
                    const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
                    const uniqueKey = `${log.userId}_${log.taskId}_${dateStr}`;
                    if (!dailyReportTracker7Days.has(uniqueKey)) {
                        dailyReportTracker7Days.add(uniqueKey);
                        validLogs7Days.push(log);
                    }
                } else {
                    validLogs7Days.push(log);
                }
            });

            const logsThisWeek = validLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);

            let totalActualPoint = 0;
            let totalTargetPoint = 0;

            const userLogsMap = new Map<string, any[]>();
            logsThisWeek.forEach((log: any) => {
                if (!userLogsMap.has(log.userId)) userLogsMap.set(log.userId, []);
                userLogsMap.get(log.userId)!.push(log);
            });

            kpiRecords.forEach((k: any) => {
                let targetDetails: any[] = [];
                try {
                    if (k.targetDetails) targetDetails = typeof k.targetDetails === 'string' ? JSON.parse(k.targetDetails) : k.targetDetails;
                } catch(e) {}

                const userLogs = userLogsMap.get(k.userId) || [];
                let userTargetMinutes = 0;
                let userActualMinutes = 0;

                if (targetDetails && targetDetails.length > 0) {
                    targetDetails.forEach(detail => {
                        // 🚀 SỬA LỖI: Bắt buộc cùng Kênh trước, sau đó mới xét Xào Lại / Làm mới
                        const logsOfChannel = userLogs.filter(log => {
                            const isMatchChannel = log.task?.channelId === detail.channelId;
                            if (!isMatchChannel) return false;
                            return detail.isRework ? log.task?.isRework === true : log.task?.isRework !== true;
                        });
                        
                        const uniqueTaskIds = new Set<string>();
                        let actualMinutes = 0;
                        logsOfChannel.forEach(log => {
                            if (!uniqueTaskIds.has(log.taskId)) {
                                uniqueTaskIds.add(log.taskId);
                                actualMinutes += Number(log.task?.duration || 0);
                            }
                        });
                        
                        userTargetMinutes += (Number(detail.targetCount) * Number(detail.duration));
                        userActualMinutes += actualMinutes; 
                    });

                    if (userTargetMinutes > 0) {
                       totalTargetPoint += 100;
                       totalActualPoint += Math.round((userActualMinutes / userTargetMinutes) * 100);
                    }
                } else {
                    const uniqueTasksCount = new Set(userLogs.map(l => l.taskId)).size;
                    const targetVal = k.targetValue || 0;
                    if (targetVal > 0) {
                        totalTargetPoint += 100;
                        totalActualPoint += Math.round((uniqueTasksCount / targetVal) * 100);
                    }
                }
            });

            const avgKpiPercent = totalTargetPoint > 0 ? Math.round((totalActualPoint / totalTargetPoint) * 100) : 0;

            const chartDataArray = generateEmpty7DaysChart();
            validLogs7Days.forEach(log => {
                const dateStr = new Date(log.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
                }).replace('/', '-');

                const existingDay = chartDataArray.find(d => d.date === dateStr);
                if (existingDay) {
                    existingDay.done++;
                }
            });

            const mappedLogsThisWeek = logsThisWeek.map((log: any) => {
                let typeStr = "Khác";
                if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                else if (log.action === "DAILY_REPORT") typeStr = "Báo cáo ngày";
                return { ...log, typeStr };
            });

            return NextResponse.json({
                role: "MANAGER",
                dbRole: role,
                isTopManagement,
                stats: {
                    activeTasks: totalActiveTasks,
                    kpiPercent: avgKpiPercent,
                    pendingQC: totalPendingTasks,
                    overdue: totalOverdueTasks
                },
                logs: mappedLogsThisWeek,
                kpis: kpiRecords,
                chartData: chartDataArray
            });
        }

        else {
            const [
                myActiveTasks,
                myLogsAllTimeRaw,
                myLogs7DaysRaw,
                myKpiThisWeek
            ] = await Promise.all([
                prisma.task.findMany({
                    where: {
                        isClosed: false,
                        OR: [
                            { contentId: userId, OR: [{ scriptLink: { equals: "" } }, { scriptLink: null }] },
                            { editorId: userId, OR: [{ videoLink: { equals: "" } }, { videoLink: null }] },
                            { animatorId: userId, OR: [{ animationLink: { equals: "" } }, { animationLink: null }] },
                            { publisherId: userId, OR: [{ publishLink: { equals: "" } }, { publishLink: null }] }
                        ]
                    },
                    select: { id: true, title: true, createdAt: true }
                }),
                prisma.taskLog.findMany({
                    where: {
                        userId: userId,
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] }
                    },
                    select: { taskId: true, action: true, createdAt: true }
                }),
                prisma.taskLog.findMany({
                    where: {
                        userId: userId,
                        createdAt: { gte: sevenDaysAgo },
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] }
                    },
                    orderBy: { createdAt: 'desc' },
                    include: { 
                        task: { select: { id: true, title: true, duration: true, channelId: true, isRework: true } } 
                    }
                }),
                prisma.weeklyKPI.findFirst({
                    where: {
                        userId: userId,
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum
                    }
                })
            ]);

            const validLogs7Days: any[] = [];
            const dailyReportTracker7Days = new Set<string>();
            myLogs7DaysRaw.forEach(log => {
                if (log.action === "DAILY_REPORT") {
                    const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
                    const uniqueKey = `${log.taskId}_${dateStr}`;
                    if (!dailyReportTracker7Days.has(uniqueKey)) {
                        dailyReportTracker7Days.add(uniqueKey);
                        validLogs7Days.push(log);
                    }
                } else {
                    validLogs7Days.push(log);
                }
            });

            const logsThisWeek = validLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);

            const targetValue = myKpiThisWeek?.targetValue || 0;
            const targetDetailsRaw = myKpiThisWeek?.targetDetails;
            let targetDetails: any[] = [];
            try {
                if (targetDetailsRaw) targetDetails = typeof targetDetailsRaw === 'string' ? JSON.parse(targetDetailsRaw) : targetDetailsRaw;
            } catch(e) {}

            let actualCount = 0;
            let kpiPercent = 0;

            if (targetDetails && targetDetails.length > 0) {
                let totalTargetMinutes = 0;
                let totalActualMinutes = 0;
                let totalEquivalentVideos = 0;

                targetDetails.forEach(detail => {
                    // 🚀 SỬA LỖI: Bắt buộc cùng Kênh trước, sau đó mới xét Xào Lại / Làm mới
                    const logsOfChannel = logsThisWeek.filter(log => {
                         const isMatchChannel = log.task?.channelId === detail.channelId;
                         if (!isMatchChannel) return false;
                         return detail.isRework ? log.task?.isRework === true : log.task?.isRework !== true;
                    });
                    
                    const uniqueTaskIds = new Set<string>();
                    let actualMinutes = 0;
                    logsOfChannel.forEach(log => {
                        if (!uniqueTaskIds.has(log.taskId)) {
                            uniqueTaskIds.add(log.taskId);
                            actualMinutes += Number(log.task?.duration || 0);
                        }
                    });
                    
                    const equivalent = detail.duration > 0 ? actualMinutes / detail.duration : actualMinutes;
                    const equivalentRounded = Math.round(equivalent * 10) / 10;
                    
                    totalEquivalentVideos += equivalentRounded;
                    totalTargetMinutes += (Number(detail.targetCount) * Number(detail.duration));
                    detail.actualCount = equivalentRounded;

                    totalActualMinutes += actualMinutes; 
                });

                // Các task lọt ra ngoài vùng target
                const uniqueOutsideTaskIds = new Set<string>();
                const logsOutside = logsThisWeek.filter(log => {
                    // 🚀 SỬA LỖI: Xem log này có nằm trong ĐÚNG kênh + ĐÚNG trạng thái rework của bất kỳ target nào không
                    const isCovered = targetDetails.some(d => {
                        const isMatchChannel = d.channelId === log.task?.channelId;
                        const isMatchRework = d.isRework ? log.task?.isRework === true : log.task?.isRework !== true;
                        return isMatchChannel && isMatchRework;
                    });
                    return !isCovered;
                });
                
                logsOutside.forEach(log => uniqueOutsideTaskIds.add(log.taskId));
                totalEquivalentVideos += uniqueOutsideTaskIds.size;

                actualCount = Math.round(totalEquivalentVideos * 10) / 10;
                kpiPercent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
            } else {
                const uniqueTasksThisWeek = new Set(logsThisWeek.map((log: any) => log.taskId));
                actualCount = uniqueTasksThisWeek.size;
                kpiPercent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
            }

            const uniqueTasksAllTime = new Set(myLogsAllTimeRaw.map((log: any) => log.taskId));
            const myLogsAllTime = uniqueTasksAllTime.size;

            const chartDataArray = generateEmpty7DaysChart();
            validLogs7Days.forEach(log => {
                const dateStr = new Date(log.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
                }).replace('/', '-');

                const existingDay = chartDataArray.find(d => d.date === dateStr);
                if (existingDay) {
                    existingDay.done++;
                }
            });

            const mappedRecentLogs = validLogs7Days.map((log: any) => {
                let typeStr = "Khác";
                if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                else if (log.action === "DAILY_REPORT") typeStr = "Báo cáo ngày";
                return { ...log, typeStr };
            });

            return NextResponse.json({
                role: "EMPLOYEE",
                dbRole: role,
                stats: {
                    pendingTasks: myActiveTasks, 
                    lifetimeLogs: myLogsAllTime,
                    kpiPercent: kpiPercent,
                    targetThisWeek: targetValue,
                    actualThisWeek: actualCount,
                    targetDetails: targetDetails 
                },
                recentLogs: mappedRecentLogs,
                chartData: chartDataArray
            });
        }
    } catch (error) {
        console.error("LỖI API DASHBOARD:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}