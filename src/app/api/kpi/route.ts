import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// HÀM CHIA 4 TUẦN/THÁNG CỐ ĐỊNH
function getWeekDateRangeByMonth(year: number, month: number, weekIndex: number) {
    const safeWeekIndex = Math.min(Math.max(weekIndex, 1), 4);
    let startDay = 1 + (safeWeekIndex - 1) * 7;
    let endDay = startDay + 6;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    if (safeWeekIndex === 4) endDay = lastDayOfMonth;

    const start = new Date(year, month - 1, startDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, month - 1, endDay);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 Lấy Role của người đang truy cập
        const currentUserRole = (session.user as any)?.role;

        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        // 🚀 TẠO ĐIỀU KIỆN LỌC NHÂN SỰ DỰA TRÊN ROLE
        let userWhere: any = { isActive: true };

        if (currentUserRole === "ADMIN") {
            // 1. ADMIN: Thấy tất cả mọi người. Nếu có chọn team thì lọc theo team.
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } 
        else if (currentUserRole === "BAN_GIAM_DOC" || currentUserRole === "HR") {
            // 2. BGD & HR: Thấy tất cả mọi người NHƯNG TRỪ ADMIN. Có chọn team thì lọc theo team.
            userWhere.role = { not: "ADMIN" };
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } 
        else {
            // 3. CÁC ROLE CÒN LẠI (Leader, Editor...): Bắt buộc phải có TeamId mới cho xem
            if (!teamId || teamId === "ALL") {
                return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
            }
            userWhere.teamId = teamId;
        }

        const users = await prisma.user.findMany({
            where: userWhere,
            select: { id: true, fullName: true, role: true }
        });

        const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);

        const kpiData = await Promise.all(users.map(async (user) => {
            const kpiRecord = await prisma.weeklyKPI.findFirst({
                where: { userId: user.id, year, month, weekNumber: weekIndex }
            });

            // 1. LẤY CÁC CÔNG VIỆC ĐÃ HOÀN THÀNH (CÓ LOG TRONG TUẦN ĐÓ)
            const logs = await prisma.taskLog.findMany({
                where: {
                    userId: user.id,
                    createdAt: { gte: start, lte: end },
                    action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"] }
                },
                include: { task: { select: { title: true, status: true } } }
            });

            const actualCount = logs.length;
            
            const mappedLogs = logs.map(log => {
                let typeStr = "Khác";
                if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                
                return { ...log, typeStr }; 
            });

            // 2. LẤY CÁC CÔNG VIỆC ĐANG LÀM (CHỈ LỌC NHỮNG TASK ĐƯỢC GIAO TRONG TUẦN ĐÓ)
            const activeTasks = await prisma.task.findMany({
                where: {
                    OR: [
                        { contentId: user.id },
                        { editorId: user.id },
                        { publisherId: user.id }
                    ],
                    isClosed: false,
                    createdAt: { gte: start, lte: end }
                },
                select: { 
                    id: true, title: true, status: true, 
                    contentId: true, editorId: true, publisherId: true,
                    scriptLink: true, videoLink: true, publishLink: true, 
                    createdAt: true 
                }
            });

            const pendingLogs: any[] = [];
            activeTasks.forEach(task => {
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

            // 3. GỘP CHUNG VÀ SẮP XẾP LẠI (Mới nhất lên đầu)
            const allLogs = [...mappedLogs, ...pendingLogs].sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            const targetValue = kpiRecord?.targetValue || 0;
            const percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;

            return {
                userId: user.id,
                fullName: user.fullName,
                role: user.role,
                targetValue: targetValue,
                actualValue: actualCount,
                percent: percent,
                logs: allLogs
            };
        }));

        kpiData.sort((a, b) => a.percent - b.percent);

        return NextResponse.json({
            weekData: { year, month, weekIndex, startDate: start, endDate: end },
            kpiList: kpiData
        });

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

        if (!userId || !pYear || !pMonth || !pWeek || isNaN(pTarget)) {
            return NextResponse.json({ error: "Thiếu dữ liệu bắt buộc" }, { status: 400 });
        }

        const kpiRecord = await prisma.weeklyKPI.upsert({
            where: { 
                user_time_unique: { 
                    userId: userId, 
                    year: pYear, 
                    month: pMonth, 
                    weekNumber: pWeek 
                } 
            },
            update: { targetValue: pTarget },
            create: { userId, year: pYear, month: pMonth, weekNumber: pWeek, targetValue: pTarget }
        });
        
        return NextResponse.json({ message: "Giao KPI thành công", data: kpiRecord }, { status: 200 });
    } catch (error) {
        console.error("LỖI API POST KPI:", error); 
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}