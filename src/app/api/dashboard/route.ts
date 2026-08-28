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

        // 🚀 ĐÃ NÂNG CẤP: Nhận thêm biến channelMemberships để map Role theo từng Kênh
        const calculateKpiForUser = (userLogs: any[], targetValue: number, targetDetailsRaw: any, userRole: string, channelMemberships: any[] = []) => {
            const dailyReportTracker = new Set<string>();
            const validUserLogs: any[] = [];
            
            userLogs.forEach(log => {
                const actionStr = String(log.action || "").toUpperCase();
                if (actionStr === "DAILY_REPORT") {
                    validUserLogs.push(log);
                }
            });

            const uniqueTasks = new Map<string, any>();
            
            validUserLogs.forEach(log => {
                if (!log.task) return;
                
                let isKpiQualifying = false; 
                const text = String(log.details || "").toLowerCase();

                // 🚀 XÁC ĐỊNH ROLE THỰC TẾ (EFFECTIVE ROLE) CHO TASK NÀY
                let effectiveRole = userRole; 
                if (log.task.channelId && channelMemberships.length > 0) {
                    const channelRoleObj = channelMemberships.find((cm: any) => cm.channelId === log.task.channelId);
                    if (channelRoleObj) {
                        effectiveRole = channelRoleObj.roleOnChannel; 
                    }
                }

                if (text.includes("gán thủ công")) {
                    isKpiQualifying = true; 
                } else {
                    // 🚀 CHẤM KPI THEO ROLE THỰC TẾ TRÊN KÊNH
                    switch (effectiveRole) {
                        case "LEADER":
                        case "PUBLISHER":
                        case "CHANNEL_MANAGER":
                            if (text.includes("video render") || text.includes("video đã đăng") || text.includes("đã đăng") || text.includes("thumbnail")) isKpiQualifying = true;
                            break;
                        case "EDITOR":
                            if (text.includes("video render") || text.includes("prj thô") || text.includes("audio") || text.includes("âm thanh")) isKpiQualifying = true;
                            break;
                        case "CONTENT":
                            if (text.includes("kịch bản") || text.includes("chuyển động")) isKpiQualifying = true;
                            break;
                        case "ANIMATOR":
                        case "ANIMATION":
                            if (text.includes("chuyển động")) isKpiQualifying = true;
                            break;
                        case "SEO":
                            if (text.includes("đã đăng") || text.includes("thumbnail")) isKpiQualifying = true;
                            break;
                        case "VOICE":
                            if (text.includes("audio") || text.includes("âm thanh")) isKpiQualifying = true;
                            break;
                        default:
                            isKpiQualifying = true; 
                    }
                }
                
                log.isCounted = false; 

                if (isKpiQualifying) {
                    if (!uniqueTasks.has(log.taskId)) {
                        uniqueTasks.set(log.taskId, log.task);
                        log.isCounted = true; 
                    }
                }
            });

            let targetDetails: any[] = [];
            try { if (targetDetailsRaw) targetDetails = typeof targetDetailsRaw === 'string' ? JSON.parse(targetDetailsRaw) : targetDetailsRaw; } catch(e) {}

            let percent = 0;
            let actualCount = uniqueTasks.size;

            if (targetDetails && targetDetails.length > 0) {
                let totalTargetMinutes = 0;
                let totalActualMinutes = 0;
                const bucketMins: Record<string, number> = {};
                const bucketTaskCount: Record<string, number> = {};

                uniqueTasks.forEach(task => {
                    const key = `${task.channel?.id || 'no_channel'}_${task.isRework ? 'rework' : 'new'}`;
                    bucketMins[key] = (bucketMins[key] || 0) + Number(task.duration || 0);
                    bucketTaskCount[key] = (bucketTaskCount[key] || 0) + 1; 
                });

                const specificTargets: Record<string, any[]> = {};
                const anyTargets: Record<string, any[]> = {};

                targetDetails.forEach(t => {
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
                    let remainingMins = 0, remainingTasks = 0;
                    Object.keys(bucketMins).forEach(bKey => {
                        if (bKey.endsWith(`_${reworkKey}`)) {
                            remainingMins += bucketMins[bKey];
                            remainingTasks += bucketTaskCount[bKey];
                            bucketMins[bKey] = 0; bucketTaskCount[bKey] = 0;
                        }
                    });
                    const res = distributeToTargets(anyTargets[reworkKey], remainingMins, remainingTasks);
                    totalActualMinutes += res.assignedMinsTotal;
                });

                percent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
            } else {
                percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
            }

            return { percent, actualCount, targetDetails };
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
                teamId: teamId 
            };

            const userCondition = isTopManagement ? {} : { userId: { in: teamUserIds } };

            const [
                countChoKichBan,
                countDuyetKichBan,
                countDangDung,
                countChoDang,
                countHoanThanh,
                managerLogs7DaysRaw,
                kpiRecords
            ] = await Promise.all([
                prisma.task.count({ where: { ...taskFilter, isClosed: false, status: { in: ["TODO", "CONTENT_DOING"] } } }),
                prisma.task.count({ where: { ...taskFilter, isClosed: false, status: "CONTENT_REVIEW" } }),
                prisma.task.count({ where: { ...taskFilter, isClosed: false, status: { in: ["EDIT_DOING"] } } }),
                prisma.task.count({ where: { ...taskFilter, isClosed: false, status: { in: ["EDIT_REVIEW"] } } }),
                prisma.task.count({ where: { ...taskFilter, isClosed: false, status: "DONE" } }),
                prisma.taskLog.findMany({
                    where: {
                        createdAt: { gte: sevenDaysAgo },
                        ...userCondition
                    },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, action: true, details: true, createdAt: true, taskId: true, userId: true,
                        user: { select: { fullName: true } },
                        task: { select: { id: true, title: true, duration: true, channelId: true, isRework: true, channel: { select: { id: true } } } }
                    }
                }),
                // 🚀 BƠM DATA: Gọi lấy channelMemberships từ bảng User để nạp đạn cho logic KPI
                prisma.weeklyKPI.findMany({
                    where: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum,
                        ...userCondition
                    },
                    include: { 
                        user: { 
                            select: { 
                                fullName: true, 
                                role: true,
                                channelMemberships: {
                                    select: { channelId: true, roleOnChannel: true }
                                }
                            } 
                        } 
                    }
                })
            ]);
            
            const validLogs7Days: any[] = [];
            const dailyReportTracker7Days = new Set<string>();
            managerLogs7DaysRaw.forEach((log: any) => { // (Nếu ở khối else thì là myLogs7DaysRaw)
                const actionStr = String(log.action || "").toUpperCase();
                if (actionStr === "DAILY_REPORT") {
                    validLogs7Days.push(log);
                }
            });

            const logsThisWeek = validLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);

            let sumPercent = 0;
            let validKpiUsers = 0;

            kpiRecords.forEach((k: any) => {
                const userLogs = logsThisWeek.filter(log => log.userId === k.userId);
                // 🚀 ĐẨY CHANNEL MEMBERSHIPS VÀO HÀM TÍNH TOÁN
                const channelMemberships = k.user?.channelMemberships || [];
                const kpiRes = calculateKpiForUser(userLogs, k.targetValue || 0, k.targetDetails, k.user?.role || "CONTENT", channelMemberships);
                
                if (k.targetValue > 0 || (kpiRes.targetDetails && kpiRes.targetDetails.length > 0)) {
                    sumPercent += kpiRes.percent;
                    validKpiUsers++;
                }
            });

            const avgKpiPercent = validKpiUsers > 0 ? Math.round(sumPercent / validKpiUsers) : 0;

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
                return { ...log, typeStr: "Báo cáo ngày", isCounted: !!log.isCounted };
            });

            return NextResponse.json({
                role: "MANAGER",
                dbRole: role,
                isTopManagement,
                stats: {
                    choKichBan: countChoKichBan,
                    duyetKichBan: countDuyetKichBan,
                    dangDung: countDangDung,
                    choDang: countChoDang,
                    hoanThanh: countHoanThanh,
                    kpiPercent: avgKpiPercent
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
                myKpiThisWeek,
                myChannelMemberships // 🚀 BƠM DATA: Gọi thêm data Membership cho User nhân viên
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
                        userId: userId
                    },
                    select: { taskId: true, action: true, createdAt: true, details: true }
                }),
                prisma.taskLog.findMany({
                    where: {
                        userId: userId,
                        createdAt: { gte: sevenDaysAgo }
                    },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, action: true, details: true, createdAt: true, taskId: true, userId: true,
                        task: { select: { id: true, title: true, duration: true, channelId: true, isRework: true, channel: { select: { id: true } } } }
                    }
                }),
                prisma.weeklyKPI.findFirst({
                    where: {
                        userId: userId,
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum
                    }
                }),
                prisma.channelMember.findMany({
                    where: { userId: userId },
                    select: { channelId: true, roleOnChannel: true }
                })
            ]);

            const validLogs7Days: any[] = [];
            const dailyReportTracker7Days = new Set<string>();
            myLogs7DaysRaw.forEach(log => {
                const actionStr = String(log.action || "").toUpperCase();
                
                if (actionStr !== "DAILY_REPORT") return;
                
                const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
                const uniqueKey = `${log.taskId}_${dateStr}`;
                if (!dailyReportTracker7Days.has(uniqueKey)) {
                    dailyReportTracker7Days.add(uniqueKey);
                    validLogs7Days.push(log);
                }
            });

            const logsThisWeek = validLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);

            // 🚀 ĐẨY CHANNEL MEMBERSHIPS VÀO HÀM TÍNH TOÁN
            const kpiRes = calculateKpiForUser(logsThisWeek, myKpiThisWeek?.targetValue || 0, myKpiThisWeek?.targetDetails, role, myChannelMemberships);

            const uniqueTasksAllTime = new Set();
            myLogsAllTimeRaw.forEach((log: any) => {
                const actionStr = String(log.action || "").toUpperCase();
                if (actionStr === "DAILY_REPORT") {
                    uniqueTasksAllTime.add(log.taskId);
                }
            });

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
                return { ...log, typeStr: "Báo cáo ngày", isCounted: !!log.isCounted };
            });

            return NextResponse.json({
                role: "EMPLOYEE",
                dbRole: role,
                stats: {
                    pendingTasks: myActiveTasks, 
                    lifetimeLogs: uniqueTasksAllTime.size,
                    kpiPercent: kpiRes.percent,
                    targetThisWeek: myKpiThisWeek?.targetValue || 0,
                    actualThisWeek: kpiRes.actualCount,
                    targetDetails: kpiRes.targetDetails 
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