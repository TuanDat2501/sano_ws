import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 🚀 THÊM HÀM TÍNH TUẦN CHUẨN XÁC GIỐNG HỆT FRONTEND
function getCurrentWeekNumber(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth(); 
    const firstDayOfMonth = new Date(year, month, 1);
    
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month, 1 + diffToMonday);

    const targetTime = date.getTime();

    for (let w = 1; w <= 5; w++) {
        const startOfWeek = new Date(startOfFirstWeek);
        startOfWeek.setDate(startOfFirstWeek.getDate() + (w - 1) * 7);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        if (targetTime >= startOfWeek.getTime() && targetTime <= endOfWeek.getTime()) {
            return w > 4 ? 4 : w; // Max là tuần 4 theo cấu hình của bạn
        }
    }
    return 1;
}

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

        const isTopManagement = ["ADMIN", "BAN_GIAM_DOC"].includes(role);
        const isLeader = role === "LEADER";
        const isManager = isTopManagement || isLeader;

        // Tính chính xác thứ Hai tuần này (00:00:00)
        const today = new Date();
        const startOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(today.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // 🚀 TÍNH RA SỐ TUẦN HIỆN TẠI ĐỂ QUERY DATABASE
        const currentWeekNum = getCurrentWeekNumber(today);

        // ==========================================
        // 👑 LUỒNG DATA CHO QUẢN LÝ (BGD / ADMIN / LEADER)
        // ==========================================
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
                    { publisherId: { in: teamUserIds } }
                ]
            };

            const userCondition = isTopManagement ? {} : { userId: { in: teamUserIds } };

            const [
                totalActiveTasks,
                totalPendingTasks,
                totalOverdueTasks,
                logsThisWeek,
                kpiRecords
            ] = await Promise.all([
                prisma.task.count({ where: { ...taskFilter, isClosed: false } }),
                
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        OR: [
                            // 🚀 ĐÃ SỬA: Dùng toán tử AND để kết hợp 2 điều kiện
                            { AND: [{ scriptLink: { not: null } }, { scriptLink: { not: "" } }] },
                            { AND: [{ videoLink: { not: null } }, { videoLink: { not: "" } }] },
                            { AND: [{ publishLink: { not: null } }, { publishLink: { not: "" } }] }
                        ]
                    }
                }),
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        OR: [ { scriptLink: { equals: "" } }, { scriptLink: null } ],
                        AND: [
                            { OR: [{ videoLink: { equals: "" } }, { videoLink: null }] },
                            { OR: [{ publishLink: { equals: "" } }, { publishLink: null }] }
                        ]
                    }
                }),

                prisma.taskLog.findMany({
                    where: {
                        createdAt: { gte: startOfWeek },
                        ...userCondition, 
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] }
                    },
                    include: { user: { select: { fullName: true } } }
                }),

                prisma.weeklyKPI.findMany({
                    where: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum, // 🚀 ÁP DỤNG WEEK NUM ĐÃ FIX
                        ...userCondition 
                    },
                    include: { user: { select: { fullName: true, role: true } } }
                })
            ]);

            // Tính điểm thực tế áp dụng Smart Filter chống hack
            let totalTarget = 0;
            kpiRecords.forEach((k: any) => totalTarget += k.targetValue);
            
            let totalActual = 0;
            const dailyReportTrackerManager = new Set<string>();
            logsThisWeek.forEach((log: any) => {
                if (log.action === "DAILY_REPORT") {
                    const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
                    const uniqueKey = `${log.userId}_${log.taskId}_${dateStr}`;
                    if (!dailyReportTrackerManager.has(uniqueKey)) {
                        dailyReportTrackerManager.add(uniqueKey);
                        totalActual++;
                    }
                } else {
                    totalActual++;
                }
            });
            
            const avgKpiPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

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
                kpis: kpiRecords
            });
        }

        // ==========================================
        // 👷 LUỒNG DATA CHO NHÂN VIÊN (CONTENT / EDITOR / PUBLISHER)
        // ==========================================
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
                            { contentId: userId, OR: [{scriptLink: {equals: ""}}, {scriptLink: null}] },
                            { editorId: userId, OR: [{videoLink: {equals: ""}}, {videoLink: null}] },
                            { publisherId: userId, OR: [{publishLink: {equals: ""}}, {publishLink: null}] }
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
                    include: { task: { select: { title: true } } }
                }),

                prisma.weeklyKPI.findFirst({
                    where: {
                        userId: userId,
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum // 🚀 ÁP DỤNG WEEK NUM ĐÃ FIX
                    }
                })
            ]);

            // BỘ LỌC CHỐNG HACK CHO 7 NGÀY
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
            const actualThisWeek = logsThisWeek.length;
            
            const target = myKpiThisWeek?.targetValue || 0;
            const kpiPercent = target > 0 ? Math.round((actualThisWeek / target) * 100) : 0;

            let myLogsAllTime = 0;
            const dailyReportTrackerAllTime = new Set<string>();
            myLogsAllTimeRaw.forEach(log => {
                if (log.action === "DAILY_REPORT") {
                    const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
                    const uniqueKey = `${log.taskId}_${dateStr}`;
                    if (!dailyReportTrackerAllTime.has(uniqueKey)) {
                        dailyReportTrackerAllTime.add(uniqueKey);
                        myLogsAllTime++;
                    }
                } else {
                    myLogsAllTime++;
                }
            });

            const chartDataMap: Record<string, number> = {};
            validLogs7Days.forEach(log => {
                const dateStr = new Date(log.createdAt).toLocaleDateString('vi-VN', { 
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' 
                }).replace('/', '-');
                
                if (!chartDataMap[dateStr]) chartDataMap[dateStr] = 0;
                chartDataMap[dateStr]++;
            });

            const chartDataArray = Object.keys(chartDataMap).map(date => ({
                date: date,
                done: chartDataMap[date]
            })).reverse();

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
                    targetThisWeek: target,
                    actualThisWeek: actualThisWeek
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