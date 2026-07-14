import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// 🚀 ĐÃ ĐỒNG BỘ THUẬT TOÁN TÍNH LỊCH CHUẨN XÁC
function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const actualStart = startOfWeek < firstDayOfMonth ? firstDayOfMonth : startOfWeek;
    const actualEnd = endOfWeek > lastDayOfMonth ? lastDayOfMonth : endOfWeek;

    actualStart.setHours(0, 0, 0, 0);
    actualEnd.setHours(23, 59, 59, 999);

    return { start: actualStart, end: actualEnd };
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUserRole = (session.user as any)?.role;
        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        let userWhere: any = { isActive: true };

        if (currentUserRole === "ADMIN") {
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } else if (currentUserRole === "BAN_GIAM_DOC" || currentUserRole === "HR") {
            userWhere.role = { not: "ADMIN" };
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } else {
            if (!teamId || teamId === "ALL") return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
            userWhere.teamId = teamId;
        }

        // 1. QUERY 1: LẤY 50 USERS
        const users = await prisma.user.findMany({
            where: userWhere,
            select: { id: true, fullName: true, role: true, avatarUrl: true }
        });

        if (users.length === 0) return NextResponse.json({ weekData: { year, month, weekIndex }, kpiList: [] });

        const userIds = users.map(u => u.id);
        const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);

        // 🚀 TỐI ƯU N+1: GOM 3 CÂU QUERY LỚN
        const [allKpis, allLogs, allActiveTasks] = await Promise.all([
            prisma.weeklyKPI.findMany({
                where: { userId: { in: userIds }, year, month, weekNumber: weekIndex }
            }),
            prisma.taskLog.findMany({
                where: {
                    userId: { in: userIds },
                    createdAt: { gte: start, lte: end },
                    action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] } 
                },
                include: { task: { select: { title: true, status: true } } }
            }),
            prisma.task.findMany({
                where: {
                    OR: [ { contentId: { in: userIds } }, { editorId: { in: userIds } }, { publisherId: { in: userIds } } ],
                    isClosed: false,
                    createdAt: { gte: start, lte: end }
                },
                select: { 
                    id: true, title: true, status: true, 
                    contentId: true, editorId: true, publisherId: true,
                    scriptLink: true, videoLink: true, publishLink: true, createdAt: true 
                }
            })
        ]);

        // 🚀 MAP DATA
        const kpiData = users.map(user => {
            const kpiRecord = allKpis.find(k => k.userId === user.id);
            const rawUserLogs = allLogs.filter(l => l.userId === user.id);
            const validUserLogs: typeof rawUserLogs = [];
            const dailyReportTracker = new Set<string>();

            // Lọc dữ liệu chống hack (Chỉ tính 1 điểm báo cáo / 1 task / 1 ngày)
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

            // 🚀 ĐÃ SỬA: Map dữ liệu từ mảng ĐÃ LỌC thay vì mảng GỐC
            const mappedLogs = validUserLogs.map(log => {
                let typeStr = "Khác";
                if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                else if ((log.action as string) === "DAILY_REPORT") typeStr = "Báo cáo";
                return { ...log, typeStr }; 
            });

            const userActiveTasks = allActiveTasks.filter(t => t.contentId === user.id || t.editorId === user.id || t.publisherId === user.id);
            const pendingLogs: any[] = [];
            
            userActiveTasks.forEach(task => {
                if (task.contentId === user.id && (!task.scriptLink || task.scriptLink.trim() === "")) {
                    pendingLogs.push({ id: `pending-script-${task.id}`, task, typeStr: "Script", action: "PENDING", createdAt: task.createdAt });
                }
                if (task.editorId === user.id && (!task.videoLink || task.videoLink.trim() === "")) {
                    pendingLogs.push({ id: `pending-edit-${task.id}`, task, typeStr: "Edit", action: "PENDING", createdAt: task.createdAt });
                }
                if (task.publisherId === user.id && (!task.publishLink || task.publishLink.trim() === "")) {
                    pendingLogs.push({ id: `pending-pub-${task.id}`, task, typeStr: "Publish", action: "PENDING", createdAt: task.createdAt });
                }
            });

            const allUserLogs = [...mappedLogs, ...pendingLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            // 🚀 ĐÃ SỬA: Đếm số lượng từ mảng ĐÃ LỌC
            const targetValue = kpiRecord?.targetValue || 0;
            const actualCount = validUserLogs.length; 
            const percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;

            return {
                userId: user.id, fullName: user.fullName, role: user.role,
                targetValue, actualValue: actualCount, percent, logs: allUserLogs, avatarUrl: (user as any).avatarUrl || null
            };
        });

        kpiData.sort((a, b) => a.percent - b.percent);

        return NextResponse.json({ weekData: { year, month, weekIndex, startDate: start, endDate: end }, kpiList: kpiData });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        if (!["LEADER", "BAN_GIAM_DOC", "ADMIN"].includes(role)) return NextResponse.json({ error: "Chỉ Quản lý mới được giao KPI" }, { status: 403 });

        const body = await req.json();
        const { userId, year, month, weekNumber, targetValue } = body;
        
        const pYear = parseInt(year);
        const pMonth = parseInt(month);
        const pWeek = parseInt(weekNumber);
        const pTarget = parseInt(targetValue);

        if (!userId || !pYear || !pMonth || !pWeek || isNaN(pTarget)) return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });

        const kpiRecord = await prisma.weeklyKPI.upsert({
            where: { user_time_unique: { userId: userId, year: pYear, month: pMonth, weekNumber: pWeek } },
            update: { targetValue: pTarget },
            create: { userId, year: pYear, month: pMonth, weekNumber: pWeek, targetValue: pTarget }
        });
        
        return NextResponse.json({ message: "Giao KPI thành công", data: kpiRecord }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}