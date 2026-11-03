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

        // 1. KHỬ MÚI GIỜ SERVER, ÉP CHUẨN GIỜ VIỆT NAM (UTC+7)
        const now = new Date();
        const localTime = now.getTime();
        const localOffset = now.getTimezoneOffset() * 60000;
        const vietnamTime = new Date(localTime + localOffset + (3600000 * 7));

        let year = vietnamTime.getFullYear();
        let month = vietnamTime.getMonth() + 1;
        const date = vietnamTime.getDate();

        const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
        const startDayOfWeek = firstDayOfMonth.getDay();
        
        const isFirstDaySunday = startDayOfWeek === 0;
        const firstWeekEnd = isFirstDaySunday ? 8 : 1 + (7 - startDayOfWeek);

        let currentWeekNum = 1;

        // 2. LOGIC ÉP TUẦN TƯƠNG TỰ BÊN FRONTEND (Mùng 1 Chủ Nhật -> Tính vào tháng trước)
        if (isFirstDaySunday && date === 1) {
            const prevMonthDate = new Date(year, month - 2, 1, 12, 0, 0);
            year = prevMonthDate.getFullYear();
            month = prevMonthDate.getMonth() + 1;
            
            const prevTotalDays = new Date(year, month, 0, 12, 0, 0).getDate();
            const prevFirstDayOfWeek = prevMonthDate.getDay();
            const prevIsFirstDaySunday = prevFirstDayOfWeek === 0;
            const prevFirstWeekEnd = prevIsFirstDaySunday ? 8 : 1 + (7 - prevFirstDayOfWeek);
            
            const remainingDays = prevTotalDays - prevFirstWeekEnd;
            currentWeekNum = 1 + (remainingDays > 0 ? Math.ceil(remainingDays / 7) : 0);
        } else if (date > firstWeekEnd) {
            currentWeekNum = 2 + Math.floor((date - firstWeekEnd - 1) / 7);
        }

        // 3. TÌM NGÀY THỨ 2 CỦA TUẦN HIỆN TẠI (ĐỂ LỌC KPI LOGS)
        const startOfWeek = new Date(vietnamTime);
        const currentDay = startOfWeek.getDay();
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        // Lùi 7 ngày chuẩn theo giờ Việt Nam
        const sevenDaysAgo = new Date(vietnamTime);
        sevenDaysAgo.setDate(vietnamTime.getDate() - 7); 
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // 4. GENERATE CHART KHÔNG BỊ LỆCH NGÀY
        const generateEmpty7DaysChart = () => {
            const chartTemplate = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(vietnamTime);
                d.setDate(vietnamTime.getDate() - i);
                const dateStr = d.toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
                }).replace('/', '-');
                chartTemplate.push({ date: dateStr, done: 0 }); 
            }
            return chartTemplate;
        };

        // 🚀 HÀM TÍNH TOÁN KPI ĐÃ ĐƯỢC ĐỒNG BỘ LOGIC KHOÁN SỐ PHÚT
        const calculateKpiForUser = (userLogs: any[], targetValue: number, targetDetailsRaw: any) => {
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

                let jobCategory = log.jobCategory;

                if (!jobCategory) {
                    const combinedText = String(log.details || "").toLowerCase();
                    if (combinedText.includes("gán thủ công")) jobCategory = "MANUAL";
                    else if (combinedText.includes("kịch bản") || combinedText.includes("bố cục")) jobCategory = "CONTENT";
                    else if (combinedText.includes("prj thô") || combinedText.includes("link project") || combinedText.includes("audio") || combinedText.includes("âm thanh") || combinedText.includes("video render")) jobCategory = "EDIT";
                    else if (combinedText.includes("chuyển động")) jobCategory = "ANIMATION";
                    else if (combinedText.includes("đã đăng") || combinedText.includes("thumbnail")) jobCategory = "PUBLISH";
                    else jobCategory = "GENERAL";
                }
                
                log.isCounted = false; 

                if (jobCategory && jobCategory !== 'GENERAL') {
                    const uniqueKey = jobCategory === 'MANUAL' ? `${log.id}_MANUAL` : `${log.taskId}_${jobCategory}`; 
                    if (!uniqueTasks.has(uniqueKey)) {
                        uniqueTasks.set(uniqueKey, log.task);
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
                let cappedActualMinutesForPercent = 0; // Đổi biến tương tự kpi route
                
                const bucketTaskCount: Record<string, number> = {};

                uniqueTasks.forEach((task, uniqueKey) => {
                    const jobCategory = uniqueKey.split('_').pop() || 'CONTENT'; 
                    const isReworkBucket = (jobCategory === 'PUBLISH') ? false : task.isRework;

                    const key = `${task.channel?.id || 'no_channel'}_${jobCategory}_${isReworkBucket ? 'rework' : 'new'}`;
                    bucketTaskCount[key] = (bucketTaskCount[key] || 0) + 1; 
                });

                const specificTargets: Record<string, any[]> = {};
                const anyTargets: Record<string, any[]> = {};

                targetDetails.forEach(t => {
                    t.actualCount = 0; 
                    t.actualMinutes = 0;

                    const targetJob = t.jobCategory || 'CONTENT';

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

                // 🚀 RÓT SỐ LƯỢNG VÀ NHÂN VỚI ĐƠN GIÁ CỦA TARGET
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

                Object.keys(specificTargets).forEach(key => {
                    const res = distributeToTargets(specificTargets[key], bucketTaskCount[key] || 0);
                    cappedActualMinutesForPercent += res.assignedMinsTotal;
                    bucketTaskCount[key] = 0;
                });

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
                        id: true, action: true, details: true, jobCategory: true, createdAt: true, taskId: true, userId: true,
                        user: { select: { fullName: true } },
                        task: { select: { id: true, title: true, duration: true, channelId: true, isRework: true, channel: { select: { id: true } } } }
                    }
                }),
                prisma.weeklyKPI.findMany({
                    where: {
                        year: year,               // Đã sửa
                        month: month,             // Đã sửa
                        weekNumber: currentWeekNum, // Đã sửa
                        ...userCondition
                    },
                    include: { 
                        user: { select: { fullName: true, role: true } } 
                    }
                })
            ]);
            
            const validLogs7Days: any[] = [];
            managerLogs7DaysRaw.forEach((log: any) => { 
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
                const kpiRes = calculateKpiForUser(userLogs, k.targetValue || 0, k.targetDetails);
                
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
                        action: "DAILY_REPORT"
                    },
                    select: { taskId: true, jobCategory: true, details: true }
                }),
                prisma.taskLog.findMany({
                    where: {
                        userId: userId,
                        createdAt: { gte: sevenDaysAgo }
                    },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, action: true, details: true, jobCategory: true, createdAt: true, taskId: true, userId: true,
                        task: { select: { id: true, title: true, duration: true, channelId: true, isRework: true, channel: { select: { id: true } } } }
                    }
                }),
                prisma.weeklyKPI.findFirst({
                    where: {
                        userId: userId,
                        year: year,               // Đã sửa
                        month: month,             // Đã sửa
                        weekNumber: currentWeekNum  // Đã sửa
                    }
                })
            ]);

            const validLogs7Days: any[] = [];
            myLogs7DaysRaw.forEach(log => {
                const actionStr = String(log.action || "").toUpperCase();
                if (actionStr === "DAILY_REPORT") {
                    validLogs7Days.push(log);
                }
            });

            const logsThisWeek = validLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);

            const kpiRes = calculateKpiForUser(logsThisWeek, myKpiThisWeek?.targetValue || 0, myKpiThisWeek?.targetDetails);

            const uniqueTasksAllTime = new Set();
            myLogsAllTimeRaw.forEach((log: any) => {
                let jobCat = log.jobCategory;
                if (!jobCat) {
                    const text = String(log.details || "").toLowerCase();
                    if (text.includes("kịch bản") || text.includes("bố cục")) jobCat = "CONTENT";
                    else if (text.includes("prj") || text.includes("âm thanh") || text.includes("audio") || text.includes("video render")) jobCat = "EDIT";
                    else if (text.includes("đã đăng") || text.includes("thumbnail")) jobCat = "PUBLISH";
                    else if (text.includes("chuyển động")) jobCat = "ANIMATION";
                }
                if (jobCat && jobCat !== 'GENERAL') {
                    uniqueTasksAllTime.add(`${log.taskId}_${jobCat}`);
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