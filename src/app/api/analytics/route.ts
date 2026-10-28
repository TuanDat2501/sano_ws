import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

// 🚀 BỔ SUNG: Hàm tính KPI tiêu chuẩn (Gắn JobCategory, quy đổi phút)
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

        if (jobCategory && jobCategory !== 'GENERAL') {
            const uniqueKey = jobCategory === 'MANUAL' ? `${log.id}_MANUAL` : `${log.taskId}_${jobCategory}`; 
            if (!uniqueTasks.has(uniqueKey)) {
                uniqueTasks.set(uniqueKey, log.task);
            }
        }
    });

    let targetDetails: any[] = [];
    try { if (targetDetailsRaw) targetDetails = typeof targetDetailsRaw === 'string' ? JSON.parse(targetDetailsRaw) : targetDetailsRaw; } catch(e) {}

    let percent = 0;
    let actualCount = uniqueTasks.size;

    if (targetDetails && targetDetails.length > 0) {
        let totalTargetMinutes = 0;
        let cappedActualMinutesForPercent = 0;
        
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

    return { percent, actualCount };
};

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;

        const userPermission = await prisma.permission.findFirst({
            where: {
                role: currentUser.role,
                moduleId: "MENU_ANALYTICS",
                isAllowed: true
            }
        });

        if (currentUser.role !== "ADMIN" && currentUser.role !== "BAN_GIAM_DOC" && !userPermission) {
            return NextResponse.json({ error: "Bạn không có quyền truy cập dữ liệu này", status: 403 }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);

        // TẦNG 1: THAM SỐ NGÀY CHO DOANH THU & SẢN LƯỢNG TỔNG
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");
        const endDate = endParam ? new Date(endParam) : new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = startParam ? new Date(startParam) : new Date(new Date().setDate(endDate.getDate() - 28));
        startDate.setHours(0, 0, 0, 0);

        // TẦNG 2: THAM SỐ LỊCH CHO HR & KPI
        const kpiMonth = parseInt(searchParams.get("kpiM") || (new Date().getMonth() + 1).toString());
        const kpiYear = parseInt(searchParams.get("kpiY") || new Date().getFullYear().toString());
        const kpiWeek = parseInt(searchParams.get("kpiW") || "0");
        const teamId = searchParams.get("team") || "ALL";

        let kpiStartDate = new Date(kpiYear, kpiMonth - 1, 1);
        let kpiEndDate = new Date(kpiYear, kpiMonth, 0, 23, 59, 59);

        if (kpiWeek > 0) {
            const { start, end } = getWeekDateRangeByMonth(kpiYear, kpiMonth, kpiWeek);
            kpiStartDate = start;
            kpiEndDate = end;
        }

        const teamFilter = teamId !== "ALL" ? { teamId } : {};
        const kpiWhere: any = { month: kpiMonth, year: kpiYear, user: { ...teamFilter } };
        if (kpiWeek > 0) kpiWhere.weekNumber = kpiWeek;

        // BẮN MULTI-QUERY VỚI 2 LUỒNG NGÀY ĐỘC LẬP
        const [
            teams, users, allChannels,
            revenuesPeriod,
            taskLogsPeriod, kpisPeriod, evaluationsPeriod, projects, taskStatusCounts,
            taskLogsRevenuePeriod
        ] = await Promise.all([
            prisma.team.findMany({ select: { id: true, name: true } }),
            prisma.user.findMany({
                where: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] } },
                select: {
                    id: true, fullName: true, role: true, isActive: true, createdAt: true, teamId: true,
                    channelMemberships: { select: { channelId: true, roleOnChannel: true } }
                }
            }),
            prisma.channel.findMany({ 
                where: { 
                    ...teamFilter,
                    status: { notIn: ["BAY_KENH", "DUNG_HOAT_DONG"] }
                }, 
                include: { team: { select: { name: true } } } 
            }),

            prisma.dailyRevenue.findMany({
                where: { date: { gte: startDate, lte: endDate }, channel: teamFilter },
                include: { channel: { include: { team: { select: { name: true } } } } }
            }),

            prisma.taskLog.findMany({
                where: {
                    createdAt: { gte: kpiStartDate, lte: kpiEndDate },
                    user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] } }
                },
                include: {
                    user: { select: { role: true } },
                    task: { select: { channelId: true, isRework: true } }
                }
            }),
            prisma.weeklyKPI.findMany({ where: kpiWhere }),
            prisma.evaluation.findMany({
                where: { createdAt: { gte: kpiStartDate, lte: kpiEndDate }, task: teamFilter },
                include: { task: { select: { contentId: true, editorId: true } } }
            }),
            prisma.project.findMany({
                where: teamFilter,
                include: { tasks: { select: { status: true } }, supervisor: { select: { fullName: true } } }
            }),
            prisma.task.groupBy({ by: ['status'], where: teamFilter, _count: { id: true } }),
            
            prisma.taskLog.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] } }
                },
                select: { taskId: true, action: true, details: true }
            })
        ]);

        let totalRevenue = 0;
        let totalViews = 0;
        const channelViewsMap: any = {};
        const teamRevByDay: any = {};
        const activeTeams = new Set();
        const channelRevByDay: any = {};
        const channelViewsByDay: any = {};
        const activeChannels = new Set();
        const dailyOverallTrend: any = {};
        
        revenuesPeriod.forEach((r: any) => {
            totalRevenue += r.amount;
            totalViews += r.views;

            const dayKey = `${new Date(r.date).getDate().toString().padStart(2, '0')}/${(new Date(r.date).getMonth() + 1).toString().padStart(2, '0')}`;

            const teamName = r.channel?.team?.name || "Khác";
            activeTeams.add(teamName);
            if (!teamRevByDay[dayKey]) teamRevByDay[dayKey] = {};
            teamRevByDay[dayKey][teamName] = (teamRevByDay[dayKey][teamName] || 0) + r.amount;

            const channelName = r.channel?.name || "Khác";
            activeChannels.add(channelName);
            if (!channelRevByDay[dayKey]) channelRevByDay[dayKey] = {};
            channelRevByDay[dayKey][channelName] = (channelRevByDay[dayKey][channelName] || 0) + r.amount;

            if (!channelViewsByDay[dayKey]) channelViewsByDay[dayKey] = {};
            channelViewsByDay[dayKey][channelName] = (channelViewsByDay[dayKey][channelName] || 0) + r.views;

            if (!dailyOverallTrend[dayKey]) dailyOverallTrend[dayKey] = { revenue: 0, views: 0 };
            dailyOverallTrend[dayKey].revenue += r.amount;
            dailyOverallTrend[dayKey].views += r.views;

            channelViewsMap[channelName] = (channelViewsMap[channelName] || 0) + r.views;
        });

        const revenueTrend = [];
        const channelRevenueTrend = [];
        const channelViewsTrend = [];
        const overallTrend = [];
        const activeTeamNames = Array.from(activeTeams);
        const activeChannelNames = Array.from(activeChannels);

        const loopDate = new Date(startDate);
        loopDate.setHours(0, 0, 0, 0);

        while (loopDate <= endDate) {
            const dayKey = `${loopDate.getDate().toString().padStart(2, '0')}/${(loopDate.getMonth() + 1).toString().padStart(2, '0')}`;

            const dayDataTeam: any = { date: dayKey };
            activeTeamNames.forEach((team: any) => { dayDataTeam[team] = teamRevByDay[dayKey]?.[team] || 0; });
            revenueTrend.push(dayDataTeam);

            const dayDataChannelRev: any = { date: dayKey };
            const dayDataChannelView: any = { date: dayKey };
            activeChannelNames.forEach((channel: any) => {
                dayDataChannelRev[channel] = channelRevByDay[dayKey]?.[channel] || 0;
                dayDataChannelView[channel] = channelViewsByDay[dayKey]?.[channel] || 0;
            });
            channelRevenueTrend.push(dayDataChannelRev);
            channelViewsTrend.push(dayDataChannelView);

            overallTrend.push({ date: dayKey, revenue: dailyOverallTrend[dayKey]?.revenue || 0, views: dailyOverallTrend[dayKey]?.views || 0 });
            loopDate.setDate(loopDate.getDate() + 1);
        }

        const topChannelsByViews = Object.entries(channelViewsMap).map(([name, views]) => ({ name, views: Number(views) })).sort((a: any, b: any) => b.views - a.views).slice(0, 5);

        const monetMap: any = { DA_BAT: "Đã bật ($)", DA_DU_DIEU_KIEN: "Đủ ĐK", CHO_DUYET: "Chờ duyệt", CHUA_DAT: "Chưa đạt", TAT_KIEM_TIEN: "Tắt kiếm tiền" };
        const monetStatusMap: any = {
            DA_BAT: { name: "Đã bật ($)", fill: "#10b981", value: 0 }, DA_DU_DIEU_KIEN: { name: "Đủ ĐK", fill: "#3b82f6", value: 0 },
            CHO_DUYET: { name: "Chờ duyệt", fill: "#f59e0b", value: 0 }, CHUA_DAT: { name: "Chưa đạt", fill: "#94a3b8", value: 0 }, TAT_KIEM_TIEN: { name: "Tắt kiếm tiền", fill: "#ef4444", value: 0 },
        };

        const channelGrid = allChannels.map((c: any) => {
            if (monetStatusMap[c.monetization]) monetStatusMap[c.monetization].value++;
            const cRevs = revenuesPeriod.filter((r: any) => r.channelId === c.id);
            const totalRev = cRevs.reduce((sum: number, r: any) => sum + r.amount, 0);
            const totalV = cRevs.reduce((sum: number, r: any) => sum + r.views, 0);
            return {
                id: c.id, name: c.name, team: c.team?.name || "Chưa nhóm", monetization: c.monetization, monetizationLabel: monetMap[c.monetization] || c.monetization,
                revenue: totalRev, views: totalV, rpm: totalV > 0 ? (totalRev / totalV) * 1000 : 0
            };
        }).sort((a: any, b: any) => b.revenue - a.revenue);

        // KHỐI 2: XỬ LÝ VẬN HÀNH & KPI
        let totalScoreSum = 0;
        const userScoreMap: any = {};
        evaluationsPeriod.forEach((e: any) => {
            totalScoreSum += e.score;
            const cid = e.task?.contentId; const eid = e.task?.editorId;
            if (cid) { userScoreMap[cid] = userScoreMap[cid] || { total: 0, count: 0 }; userScoreMap[cid].total += e.score; userScoreMap[cid].count++; }
            if (eid) { userScoreMap[eid] = userScoreMap[eid] || { total: 0, count: 0 }; userScoreMap[eid].total += e.score; userScoreMap[eid].count++; }
        });
        const avgQualityScore = evaluationsPeriod.length > 0 ? (totalScoreSum / evaluationsPeriod.length) : 0;

        const projectHealth = projects.map((p: any) => {
            const total = p.tasks.length; const done = p.tasks.filter((t: any) => t.status === "DONE").length;
            return { id: p.id, name: p.name, supervisor: p.supervisor?.fullName || "Chưa gán", status: p.status, progress: total > 0 ? Math.round((done / total) * 100) : 0, totalTasks: total, doneTasks: done };
        }).sort((a, b) => b.progress - a.progress);

        const isDoneLog = (l: any) => l.action === "PUBLISH_VIDEO" || (l.action === "UPDATE_STATUS" && l.details?.includes("sang [DONE]"));
        let totalOutput = new Set(taskLogsRevenuePeriod.filter(isDoneLog).map((l: any) => l.taskId)).size;

        const statusMapVi: any = { BACKLOG: "Kho Ý Tưởng", TODO: "Cần Làm", DOING: "Đang Làm", REVIEW: "Chờ Duyệt", DONE: "Hoàn Thành" };
        const funnelOrder = ["BACKLOG", "TODO", "DOING", "REVIEW", "DONE"];
        const rawFunnel: any = { BACKLOG: 0, TODO: 0, DOING: 0, REVIEW: 0, DONE: 0 };
        taskStatusCounts.forEach((t: any) => { if (rawFunnel[t.status] !== undefined) rawFunnel[t.status] = t._count.id; });
        const taskFunnel = funnelOrder.map(status => ({ name: statusMapVi[status], value: rawFunnel[status] }));

        // 🚀 ĐÃ FIX: Tính toán phần trăm KPI với thuật toán tính thời lượng
        const hrGrid = users
            .filter(u => u.isActive)
            .map(u => {
                const userKpis = kpisPeriod.filter(k => k.userId === u.id);
                const userLogs = taskLogsPeriod.filter((l: any) => l.userId === u.id);

                let combinedTargetValue = 0;
                let combinedTargetDetails: any[] = [];

                userKpis.forEach(k => {
                    combinedTargetValue += (k.targetValue || 0);
                    if (k.targetDetails) {
                        try {
                            const parsed = typeof k.targetDetails === 'string' ? JSON.parse(k.targetDetails) : k.targetDetails;
                            if (Array.isArray(parsed)) {
                                parsed.forEach(p => {
                                    const existing = combinedTargetDetails.find(c => 
                                        c.channelId === p.channelId && 
                                        c.jobCategory === p.jobCategory && 
                                        c.isRework === p.isRework
                                    );
                                    if (existing) {
                                        existing.targetCount += Number(p.targetCount || 0);
                                    } else {
                                        combinedTargetDetails.push({...p});
                                    }
                                });
                            }
                        } catch(e) {}
                    }
                });

                // Chạy hàm tính toán chuẩn xác
                const kpiResult = calculateKpiForUser(userLogs, combinedTargetValue, combinedTargetDetails);

                return {
                    id: u.id,
                    name: u.fullName,
                    role: u.role,
                    target: combinedTargetValue,
                    output: kpiResult.actualCount,
                    kpi: kpiResult.percent,
                    avgScore: userScoreMap[u.id] ? (userScoreMap[u.id].total / userScoreMap[u.id].count).toFixed(1) : "-",
                    status: u.isActive ? "Active" : "Nghỉ việc"
                };
            }).sort((a, b) => b.output - a.output);

        return NextResponse.json({
            teams,
            stats: {
                totalOutput,
                avgKpi: kpisPeriod.length > 0 ? Math.round((totalOutput / kpisPeriod.reduce((a, b) => a + b.targetValue, 0)) * 100) : 0,
                totalRevenue,
                totalViews,
                avgQualityScore,
                currentHeadcount: users.filter(u => u.isActive).length
            },
            overallTrend, topChannelsByViews, revenueTrend, activeTeamNames, channelRevenueTrend, channelViewsTrend, activeChannelNames, channelGrid, projectHealth, taskFunnel,
            monetizationStatus: Object.values(monetStatusMap).filter((m: any) => m.value > 0),
            hrGrid
        });

    } catch (error) {
        console.error("Analytics API Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
