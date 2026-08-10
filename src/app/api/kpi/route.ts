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
    
    // Nếu Thứ 5 của tuần đầu rơi vào tháng trước -> Dịch tuần 1 sang tuần sau
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
                    createdAt: { gte: start, lte: end },
                    action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] } 
                },
                include: { 
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

            rawUserLogs.forEach(log => {
                if ((log.action as string) === "DAILY_REPORT") {
                    const dateString = new Date(log.createdAt).toISOString().split('T')[0];
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
                if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                else if ((log.action as string) === "DAILY_REPORT") typeStr = "Báo cáo";
                return { ...log, typeStr }; 
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
            let actualCount = 0;

            const uniqueTasks = new Map<string, any>();
            validUserLogs.forEach(log => {
                if (log.task && !uniqueTasks.has(log.taskId)) {
                    uniqueTasks.set(log.taskId, log.task);
                }
            });

            const bucketMins: Record<string, number> = {};
            uniqueTasks.forEach(task => {
                const key = `${task.channel?.id || 'no_channel'}_${task.isRework ? 'rework' : 'new'}`;
                bucketMins[key] = (bucketMins[key] || 0) + Number(task.duration || 0);
            });

            if (targetDetails && targetDetails.length > 0) {
                let totalEquivalentVideos = 0;

                const targetsByBucket: Record<string, any[]> = {};
                targetDetails.forEach(d => {
                    const key = `${d.channelId}_${d.isRework ? 'rework' : 'new'}`;
                    if (!targetsByBucket[key]) targetsByBucket[key] = [];
                    targetsByBucket[key].push(d);
                });

                Object.keys(targetsByBucket).forEach(key => {
                    const targets = targetsByBucket[key];
                    let minsLeft = bucketMins[key] || 0; 

                    targets.forEach((t, index) => {
                        const tMins = Number(t.targetCount) * Number(t.duration); 
                        totalTargetMinutes += tMins;

                        let assignedMins = 0;
                        if (index === targets.length - 1) {
                            assignedMins = minsLeft;
                        } else {
                            assignedMins = Math.min(minsLeft, tMins);
                        }
                        minsLeft -= assignedMins; 

                        t.actualMinutes = assignedMins;
                        const eq = t.duration > 0 ? assignedMins / t.duration : assignedMins;
                        t.actualCount = Math.round(eq * 10) / 10;
                        
                        totalEquivalentVideos += t.actualCount;
                        totalActualMinutes += assignedMins;
                    });
                });

                const uniqueOutsideTaskIds = new Set<string>();
                const logsOutside = validUserLogs.filter(log => {
                    const isCovered = targetDetails.some(d => {
                        const isMatchChannel = d.channelId === log.task?.channel?.id;
                        const isMatchRework = d.isRework ? log.task?.isRework === true : log.task?.isRework !== true;
                        return isMatchChannel && isMatchRework;
                    });
                    return !isCovered;
                });
                
                logsOutside.forEach(log => uniqueOutsideTaskIds.add(log.taskId));
                totalEquivalentVideos += uniqueOutsideTaskIds.size;

                actualCount = Math.round(totalEquivalentVideos * 10) / 10;
                percent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
            } else {
                actualCount = uniqueTasks.size;
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

        if (!userId || !pYear || !pMonth || !pWeek || isNaN(pTarget)) return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });

        const targetDetailsJson = targetDetails ? targetDetails : [];

        const kpiRecord = await prisma.weeklyKPI.upsert({
            where: { user_time_unique: { userId: userId, year: pYear, month: pMonth, weekNumber: pWeek } },
            update: { 
                targetValue: pTarget,
                targetDetails: targetDetailsJson 
            },
            create: { 
                userId, year: pYear, month: pMonth, weekNumber: pWeek, 
                targetValue: pTarget,
                targetDetails: targetDetailsJson
            }
        });
        
        return NextResponse.json({ message: "Giao KPI thành công", data: kpiRecord }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}