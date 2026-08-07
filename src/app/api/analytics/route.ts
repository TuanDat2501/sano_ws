import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        
        // TẦNG 1: THAM SỐ NGÀY CHO DOANH THU KÊNH
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
            const firstDayOfMonth = new Date(kpiYear, kpiMonth - 1, 1);
            const dayOfWeek = firstDayOfMonth.getDay(); 
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const startOfFirstWeek = new Date(kpiYear, kpiMonth - 1, 1 + diffToMonday);

            const startOfWeek = new Date(startOfFirstWeek);
            startOfWeek.setDate(startOfFirstWeek.getDate() + (kpiWeek - 1) * 7);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            kpiStartDate = startOfWeek;
            kpiEndDate = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate(), 23, 59, 59);
        }

        const teamFilter = teamId !== "ALL" ? { teamId } : {};
        const kpiWhere: any = { month: kpiMonth, year: kpiYear, user: { ...teamFilter } };
        if (kpiWeek > 0) kpiWhere.weekNumber = kpiWeek;

        // BẮN MULTI-QUERY VỚI 2 LUỒNG NGÀY ĐỘC LẬP (ĐÃ GỠ LỎNG LEAD TIME TASKS)
        const [
            teams, users, allChannels,
            revenuesPeriod, 
            taskLogsPeriod, kpisPeriod, evaluationsPeriod, projects, taskStatusCounts
        ] = await Promise.all([
            prisma.team.findMany({ select: { id: true, name: true } }),
            prisma.user.findMany({
                where: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR","KE_TOAN"] } },
                select: { id: true, fullName: true, role: true, isActive: true, createdAt: true, teamId: true }
            }),
            prisma.channel.findMany({ where: teamFilter, include: { team: { select: { name: true } } } }),
            
            prisma.dailyRevenue.findMany({ 
                where: { date: { gte: startDate, lte: endDate }, channel: teamFilter },
                include: { channel: { include: { team: { select: { name: true } } } } } 
            }),

            prisma.taskLog.findMany({
                where: { 
                    createdAt: { gte: kpiStartDate, lte: kpiEndDate }, 
                    user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] } }, 
                    action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "UPDATE_STATUS"] } 
                },
                include: { user: { select: { role: true } } }
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
            prisma.task.groupBy({ by: ['status'], where: teamFilter, _count: { id: true } })
        ]);

        // KHỐI 1: XỬ LÝ DOANH THU & KÊNH
        let totalRevenue = 0;
        let totalViews = 0;
        const channelViewsMap: Record<string, number> = {};
        const teamRevByDay: Record<string, Record<string, number>> = {};
        const activeTeams = new Set<string>();
        const channelRevByDay: Record<string, Record<string, number>> = {};
        const channelViewsByDay: Record<string, Record<string, number>> = {};
        const activeChannels = new Set<string>();
        const dailyOverallTrend: Record<string, { revenue: number, views: number }> = {};
        
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
            activeTeamNames.forEach(team => { dayDataTeam[team] = teamRevByDay[dayKey]?.[team] || 0; });
            revenueTrend.push(dayDataTeam);

            const dayDataChannelRev: any = { date: dayKey };
            const dayDataChannelView: any = { date: dayKey };
            activeChannelNames.forEach(channel => { 
                dayDataChannelRev[channel] = channelRevByDay[dayKey]?.[channel] || 0; 
                dayDataChannelView[channel] = channelViewsByDay[dayKey]?.[channel] || 0; 
            });
            channelRevenueTrend.push(dayDataChannelRev);
            channelViewsTrend.push(dayDataChannelView);

            overallTrend.push({ date: dayKey, revenue: dailyOverallTrend[dayKey]?.revenue || 0, views: dailyOverallTrend[dayKey]?.views || 0 });
            loopDate.setDate(loopDate.getDate() + 1);
        }

        const topChannelsByViews = Object.entries(channelViewsMap).map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views).slice(0, 5);

        const monetMap: any = { DA_BAT: "Đã bật ($)", DA_DU_DIEU_KIEN: "Đủ ĐK", CHO_DUYET: "Chờ duyệt", CHUA_DAT: "Chưa đạt", TAT_KIEM_TIEN: "Tắt kiếm tiền" };
        const monetStatusMap: Record<string, any> = {
            DA_BAT: { name: "Đã bật ($)", fill: "#10b981", value: 0 }, DA_DU_DIEU_KIEN: { name: "Đủ ĐK", fill: "#3b82f6", value: 0 },
            CHO_DUYET: { name: "Chờ duyệt", fill: "#f59e0b", value: 0 }, CHUA_DAT: { name: "Chưa đạt", fill: "#94a3b8", value: 0 }, TAT_KIEM_TIEN: { name: "Tắt kiếm tiền", fill: "#ef4444", value: 0 },
        };

        const channelGrid = allChannels.map((c: any) => {
            if(monetStatusMap[c.monetization]) monetStatusMap[c.monetization].value++;
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
        const userScoreMap: Record<string, { total: number, count: number }> = {};
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
        }).sort((a,b) => b.progress - a.progress);

        const isDoneLog = (l: any) => ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"].includes(l.action) || (l.action === "UPDATE_STATUS" && l.details?.includes("sang [DONE]"));
        let totalOutput = new Set(taskLogsPeriod.filter(isDoneLog).map((l:any) => l.taskId)).size;

        const userKpiMap: Record<string, { target: number, actualTasks: Set<string> }> = {};
        kpisPeriod.forEach((kpi:any) => { if (!userKpiMap[kpi.userId]) userKpiMap[kpi.userId] = { target: 0, actualTasks: new Set() }; userKpiMap[kpi.userId].target += kpi.targetValue; });
        taskLogsPeriod.forEach((log:any) => { if (isDoneLog(log) && userKpiMap[log.userId]) userKpiMap[log.userId].actualTasks.add(log.taskId); });

        const statusMapVi: any = { BACKLOG: "Kho Ý Tưởng", TODO: "Cần Làm", DOING: "Đang Làm", REVIEW: "Chờ Duyệt", DONE: "Hoàn Thành" };
        const funnelOrder = ["BACKLOG", "TODO", "DOING", "REVIEW", "DONE"];
        const rawFunnel: any = { BACKLOG: 0, TODO: 0, DOING: 0, REVIEW: 0, DONE: 0 };
        taskStatusCounts.forEach((t: any) => { if (rawFunnel[t.status] !== undefined) rawFunnel[t.status] = t._count.id; });
        const taskFunnel = funnelOrder.map(status => ({ name: statusMapVi[status], value: rawFunnel[status] }));

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
            monetizationStatus: Object.values(monetStatusMap).filter(m => m.value > 0),
            hrGrid: users.map(u => {
                const target = kpisPeriod.filter(k => k.userId === u.id).reduce((sum, k) => sum + k.targetValue, 0);
                const output = new Set(taskLogsPeriod.filter(l => l.userId === u.id && isDoneLog(l)).map(l => l.taskId)).size;
                
                return {
                    id: u.id, 
                    name: u.fullName, 
                    role: u.role,
                    target: target,
                    output: output,
                    kpi: target > 0 ? Math.round((output / target) * 100) : 0,
                    avgScore: userScoreMap[u.id] ? (userScoreMap[u.id].total / userScoreMap[u.id].count).toFixed(1) : "-",
                    status: u.isActive ? "Active" : "Nghỉ việc"
                };
            }).sort((a, b) => b.output - a.output)
        });

    } catch (error) {
        console.error("Analytics API Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}