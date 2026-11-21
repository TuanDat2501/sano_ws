import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 🚀 HÀM TÍNH TUẦN CHUẨN CẮT BIÊN THÁNG (Đồng bộ tuyệt đối với Lịch Việt Nam: Thứ 2 - Chủ Nhật, ép múi giờ +07:00)
function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const totalDays = new Date(year, month, 0, 12, 0, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();

    const isFirstDaySunday = startDayOfWeek === 0;

    let startDay = isFirstDaySunday ? 2 : 1;
    let endDay = isFirstDaySunday ? 8 : 1 + (7 - startDayOfWeek);

    if (weekNumber > 1) {
        const firstWeekEnd = isFirstDaySunday ? 8 : 1 + (7 - startDayOfWeek);
        startDay = firstWeekEnd + (weekNumber - 2) * 7 + 1;
        endDay = startDay + 6;
    }

    endDay = Math.min(endDay, totalDays);

    const pad = (num: number) => num.toString().padStart(2, '0');

    const startOfWeek = new Date(`${year}-${pad(month)}-${pad(startDay)}T00:00:00+07:00`);
    const endOfWeek = new Date(`${year}-${pad(month)}-${pad(endDay)}T23:59:59.999+07:00`);

    return { start: startOfWeek, end: endOfWeek };
}

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

        // TẦNG 2: THAM SỐ LỊCH CHO HR & KPI (Ép cứng +07:00 giống /api/kpi)
        const kpiMonth = parseInt(searchParams.get("kpiM") || (new Date().getMonth() + 1).toString());
        const kpiYear = parseInt(searchParams.get("kpiY") || new Date().getFullYear().toString());
        const kpiWeek = parseInt(searchParams.get("kpiW") || "0");
        const teamId = searchParams.get("team") || "ALL";

        let kpiStartDate: Date;
        let kpiEndDate: Date;

        if (kpiWeek > 0) {
            const { start, end } = getWeekDateRangeByMonth(kpiYear, kpiMonth, kpiWeek);
            kpiStartDate = start;
            kpiEndDate = end;
        } else {
            kpiStartDate = getWeekDateRangeByMonth(kpiYear, kpiMonth, 1).start;
            kpiEndDate = getWeekDateRangeByMonth(kpiYear, kpiMonth, 5).end;
        }

        const teamFilter = teamId !== "ALL" ? { teamId } : {};
        const kpiWhere: any = { month: kpiMonth, year: kpiYear, user: { ...teamFilter } };
        if (kpiWeek > 0) kpiWhere.weekNumber = kpiWeek;

        // BẮN MULTI-QUERY VỚI 2 LUỒNG NGÀY ĐỘC LẬP
        const [
            teams, usersRaw, allChannels,
            revenuesPeriod,
            taskLogsPeriod, kpisPeriod, evaluationsPeriod, projects, taskStatusCounts,
            taskLogsRevenuePeriod
        ] = await Promise.all([
            prisma.team.findMany({ select: { id: true, name: true } }),
            prisma.user.findMany({
                where: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] } },
                select: {
                    id: true, fullName: true, role: true, isActive: true, createdAt: true, teamId: true,
                    team: { select: { name: true } },
                    channelMemberships: { select: { channelId: true, roleOnChannel: true } }
                }
            }),
            prisma.channel.findMany({ where: teamFilter, include: { team: { select: { name: true } } } }),

            prisma.dailyRevenue.findMany({
                where: { date: { gte: startDate, lte: endDate }, channel: teamFilter },
                include: { channel: { include: { team: { select: { name: true } } } } }
            }),

            // 🚀 ĐÃ BỔ SUNG: duration, isRework, isReject để đồng bộ tính KPI theo phút và lọc Reject
            prisma.taskLog.findMany({
                where: {
                    createdAt: { gte: kpiStartDate, lte: kpiEndDate },
                    user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] } }
                },
                select: {
                    id: true, action: true, details: true, jobCategory: true, createdAt: true, taskId: true, userId: true,
                    user: { select: { role: true } },
                    task: {
                        select: {
                            id: true, duration: true, isRework: true, isReject: true, channelId: true
                        }
                    }
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

        // Loại bỏ nhân sự thuộc team Nhân sự / HR giống /api/kpi
        const users = usersRaw.filter(u => u.team?.name !== "Nhân sự" && u.team?.name !== "HR");

        // KHỐI 1: DOANH THU & LƯỢT XEM
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

        const topChannelsByViews = Object.entries(channelViewsMap)
            .map(([name, views]) => ({ name, views: Number(views) }))
            .sort((a: any, b: any) => b.views - a.views)
            .slice(0, 5);

        const monetMap: any = { DA_BAT: "Đã bật ($)", DA_DU_DIEU_KIEN: "Đủ ĐK", CHO_DUYET: "Chờ duyệt", CHUA_DAT: "Chưa đạt", TAT_KIEM_TIEN: "Tắt kiếm tiền" };
        const monetStatusMap: any = {
            DA_BAT: { name: "Đã bật ($)", fill: "#10b981", value: 0 },
            DA_DU_DIEU_KIEN: { name: "Đủ ĐK", fill: "#3b82f6", value: 0 },
            CHO_DUYET: { name: "Chờ duyệt", fill: "#f59e0b", value: 0 },
            CHUA_DAT: { name: "Chưa đạt", fill: "#94a3b8", value: 0 },
            TAT_KIEM_TIEN: { name: "Tắt kiếm tiền", fill: "#ef4444", value: 0 },
        };

        const channelGrid = allChannels.map((c: any) => {
            if (monetStatusMap[c.monetization]) monetStatusMap[c.monetization].value++;
            const cRevs = revenuesPeriod.filter((r: any) => r.channelId === c.id);
            const totalRev = cRevs.reduce((sum: number, r: any) => sum + r.amount, 0);
            const totalV = cRevs.reduce((sum: number, r: any) => sum + r.views, 0);
            return {
                id: c.id, name: c.name, team: c.team?.name || "Chưa nhóm", monetization: c.monetization,
                monetizationLabel: monetMap[c.monetization] || c.monetization,
                revenue: totalRev, views: totalV, rpm: totalV > 0 ? (totalRev / totalV) * 1000 : 0
            };
        }).sort((a: any, b: any) => b.revenue - a.revenue);

        // KHỐI 2: XỬ LÝ VẬN HÀNH & CHẤT LƯỢNG
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

        const isDoneLog = (l: any) =>
            l.action === "PUBLISH_VIDEO" ||
            (l.action === "UPDATE_STATUS" && l.details?.includes("sang [DONE]"));

        const totalOutput = new Set(taskLogsRevenuePeriod.filter(isDoneLog).map((l: any) => l.taskId)).size;

        const statusMapVi: any = { BACKLOG: "Kho Ý Tưởng", TODO: "Cần Làm", DOING: "Đang Làm", REVIEW: "Chờ Duyệt", DONE: "Hoàn Thành" };
        const funnelOrder = ["BACKLOG", "TODO", "DOING", "REVIEW", "DONE"];
        const rawFunnel: any = { BACKLOG: 0, TODO: 0, DOING: 0, REVIEW: 0, DONE: 0 };
        taskStatusCounts.forEach((t: any) => { if (rawFunnel[t.status] !== undefined) rawFunnel[t.status] = t._count.id; });
        const taskFunnel = funnelOrder.map(status => ({ name: statusMapVi[status], value: rawFunnel[status] }));

        // ========================================================
        // 🚀 KHỐI 3: TÍNH KPI NHÂN SỰ ĐỒNG BỘ 100% VỚI /api/kpi
        // ========================================================
        const detectJobCategory = (log: any) => {
            if (log.jobCategory) return log.jobCategory;
            const txt = String(log.details || "").toLowerCase();
            if (txt.includes("gán thủ công")) return "MANUAL";
            if (txt.includes("kịch bản") || txt.includes("bố cục")) return "CONTENT";
            if (txt.includes("prj thô") || txt.includes("link project") || txt.includes("audio") || txt.includes("âm thanh") || txt.includes("video render")) return "EDIT";
            if (txt.includes("chuyển động")) return "ANIMATION";
            if (txt.includes("đã đăng") || txt.includes("thumbnail")) return "PUBLISH";
            return "GENERAL";
        };

        const calculateUserWeekKpi = (userId: string, targetWeek: number) => {
            const { start, end } = getWeekDateRangeByMonth(kpiYear, kpiMonth, targetWeek);
            const kpiRecord = kpisPeriod.find(k => k.userId === userId && k.weekNumber === targetWeek);
            const rawUserLogs = taskLogsPeriod.filter(l => {
                if (l.userId !== userId) return false;
                const t = new Date(l.createdAt).getTime();
                return t >= start.getTime() && t <= end.getTime();
            });

            // 1. Lọc bỏ các bài bị Reject
            const rejectedLogs = rawUserLogs.filter(log =>
                ["REJECT_TASK", "REJECT_CONTENT", "REJECT_ANIMATION", "REJECT_EDIT"].includes(String(log.action || "").toUpperCase())
            );

            const rejectedTaskJobs = new Set<string>();
            rejectedLogs.forEach(rLog => {
                let rJobCategory = rLog.jobCategory;
                if (!rJobCategory) {
                    if (rLog.action === "REJECT_CONTENT") rJobCategory = "CONTENT";
                    else if (rLog.action === "REJECT_ANIMATION") rJobCategory = "ANIMATION";
                    else if (rLog.action === "REJECT_EDIT") rJobCategory = "EDIT";
                    else rJobCategory = "GENERAL";
                }
                rejectedTaskJobs.add(`${rLog.taskId}_${rJobCategory}`);
            });

            const validUserLogs = rawUserLogs.filter(log => {
                if (String(log.action || "").toUpperCase() !== "DAILY_REPORT") return false;
                if (log.task?.isReject) return false;

                const currentJob = detectJobCategory(log);
                if (rejectedTaskJobs.has(`${log.taskId}_${currentJob}`) || rejectedTaskJobs.has(`${log.taskId}_GENERAL`)) {
                    return false;
                }
                return true;
            });

            // 2. Chống đếm trùng + tách riêng MANUAL
            const uniqueTasks = new Map<string, any>();
            validUserLogs.forEach(log => {
                if (!log.task) return;
                const jobCategory = detectJobCategory(log);
                if (jobCategory && jobCategory !== "GENERAL") {
                    const uniqueKey = jobCategory === "MANUAL" ? `${log.id}_MANUAL` : `${log.taskId}_${jobCategory}`;
                    if (!uniqueTasks.has(uniqueKey)) {
                        uniqueTasks.set(uniqueKey, log.task);
                    }
                }
            });

            const targetValue = kpiRecord?.targetValue || 0;
            let targetDetails: any[] = [];
            try {
                if (kpiRecord?.targetDetails) {
                    targetDetails = typeof kpiRecord.targetDetails === "string"
                        ? JSON.parse(kpiRecord.targetDetails)
                        : kpiRecord.targetDetails;
                }
            } catch (e) {}

            let totalTargetMinutes = 0;
            let totalActualMinutes = 0;
            const actualCount = uniqueTasks.size;

            if (targetDetails && targetDetails.length > 0) {
                targetDetails.forEach(t => {
                    totalTargetMinutes += (Number(t.targetCount) || 0) * (Number(t.duration) || 0);
                });

                uniqueTasks.forEach(task => {
                    totalActualMinutes += Math.max(0, Number(task.duration) || 0);
                });
            }

            return { targetValue, actualCount, totalTargetMinutes, totalActualMinutes };
        };

        const weeksToCalc = kpiWeek > 0 ? [kpiWeek] : [1, 2, 3, 4, 5];

        const hrGrid = users
            .filter(u => u.isActive)
            .map(u => {
                let target = 0;
                let output = 0;
                let totalTargetMinutes = 0;
                let totalActualMinutes = 0;

                weeksToCalc.forEach(w => {
                    const res = calculateUserWeekKpi(u.id, w);
                    target += res.targetValue;
                    output += res.actualCount;
                    totalTargetMinutes += res.totalTargetMinutes;
                    totalActualMinutes += res.totalActualMinutes;
                });

                let kpiPercent = 0;
                if (totalTargetMinutes > 0) {
                    kpiPercent = Math.round((totalActualMinutes / totalTargetMinutes) * 100);
                } else if (target > 0) {
                    kpiPercent = Math.round((output / target) * 100);
                }

                return {
                    id: u.id,
                    name: u.fullName,
                    role: u.role,
                    target,
                    output,
                    kpi: kpiPercent,
                    totalTargetMinutes,
                    totalActualMinutes,
                    avgScore: userScoreMap[u.id] ? (userScoreMap[u.id].total / userScoreMap[u.id].count).toFixed(1) : "-",
                    status: u.isActive ? "Active" : "Nghỉ việc"
                };
            })
            .sort((a, b) => b.kpi - a.kpi || b.output - a.output);

        // 🚀 ĐỒNG BỘ stats.avgKpi: Trung bình % KPI của các nhân sự có giao chỉ tiêu trong kỳ
        const usersWithTarget = hrGrid.filter(u => u.target > 0 || u.totalTargetMinutes > 0);
        const avgKpi = usersWithTarget.length > 0
            ? Math.round(usersWithTarget.reduce((sum, u) => sum + u.kpi, 0) / usersWithTarget.length)
            : 0;

        return NextResponse.json({
            teams,
            stats: {
                totalOutput,
                avgKpi,
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