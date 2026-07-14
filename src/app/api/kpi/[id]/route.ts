import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getContinuousWeekRange } from "@/lib/utils";

// --- Hàm tiện ích tính toán ngày trong tuần ---
function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    // Tính ngày thứ Hai đầu tiên của tháng
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    // Tính khoảng thời gian của tuần được chọn
    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // Ép giới hạn không cho tràn ra ngoài tháng
    const actualStart = startOfWeek < firstDayOfMonth ? firstDayOfMonth : startOfWeek;
    const actualEnd = endOfWeek > lastDayOfMonth ? lastDayOfMonth : endOfWeek;

    // Đặt đúng chuẩn 00:00:00 đến 23:59:59
    actualStart.setHours(0, 0, 0, 0);
    actualEnd.setHours(23, 59, 59, 999);

    return { start: actualStart, end: actualEnd };
}
function getCurrentWeekNumber(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // Đưa ngày hiện tại về mốc 0h00 để so sánh cho chuẩn
    const todayTime = new Date(year, month - 1, date.getDate()).getTime();

    for (let w = 1; w <= 5; w++) {
        const range = getContinuousWeekRange(year, month, w);
        const startTime = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).getTime();
        const endTime = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate()).getTime();
        
        if (todayTime >= startTime && todayTime <= endTime) {
            // Giới hạn max là tuần 4 (Nếu sang tuần 5 thì vẫn gộp số liệu vào tuần 4)
            return w > 4 ? 4 : w; 
        }
    }
    return 1;
}
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const targetUserId = resolvedParams.id; // ID của user cần lấy KPI
        const currentUser = session.user as any;

        // ==========================================
        // 1. KIỂM TRA QUYỀN TRUY CẬP (RBAC)
        // ==========================================
        if (["CONTENT", "EDITOR", "PUBLISHER"].includes(currentUser.role)) {
            // Nhân viên chỉ được xem của chính mình
            if (targetUserId !== currentUser.id) {
                return NextResponse.json({ error: "Truy cập bị từ chối. Bạn chỉ có thể xem KPI của chính mình!" }, { status: 403 });
            }
        } else if (currentUser.role === "LEADER") {
            // Leader chỉ được xem người trong team
            const targetUser = await prisma.user.findUnique({ 
                where: { id: targetUserId }, 
                select: { teamId: true } 
            });
            if (targetUser?.teamId !== currentUser.teamId) {
                return NextResponse.json({ error: "Chỉ được phép xem KPI của nhân sự trong Team mình!" }, { status: 403 });
            }
        }

        // ==========================================
        // 2. LẤY THAM SỐ THỜI GIAN
        // ==========================================
        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);

        // ==========================================
        // 3. TRUY VẤN DỮ LIỆU TỪ DATABASE
        // ==========================================
        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, fullName: true, role: true, avatarUrl: true }
        });

        if (!user) return NextResponse.json({ error: "User không tồn tại" }, { status: 404 });

        // Lấy chỉ tiêu KPI (Target)
        const kpiRecord = await prisma.weeklyKPI.findUnique({
            where: { user_time_unique: { userId: targetUserId, year, month, weekNumber: weekIndex } }
        });

        // Lấy lịch sử công việc (Logs)
        const userLogs = await prisma.taskLog.findMany({
            where: {
                userId: targetUserId,
                createdAt: { gte: start, lte: end },
                action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] }
            },
            include: { task: { select: { title: true, status: true } } },
            orderBy: { createdAt: "desc" }
        });

        // Lấy các task đang xử lý (Active Tasks) để tìm Pending Logs
        const activeTasks = await prisma.task.findMany({
            where: {
                OR: [ { contentId: targetUserId }, { editorId: targetUserId }, { publisherId: targetUserId } ],
                isClosed: false,
                createdAt: { gte: start, lte: end }
            },
            select: { 
                id: true, title: true, status: true, 
                contentId: true, editorId: true, publisherId: true, 
                scriptLink: true, videoLink: true, publishLink: true, createdAt: true 
            }
        });

        // ==========================================
        // 4. XỬ LÝ LỌC LOG & CHỐNG HACK KPI
        // ==========================================
        const validUserLogs: any[] = [];
        const dailyReportTracker = new Set<string>();

        userLogs.forEach(log => {
            if (log.action === "DAILY_REPORT") {
                const dateString = new Date(log.createdAt).toISOString().split('T')[0];
                const uniqueKey = `${log.taskId}_${dateString}`;
                
                if (!dailyReportTracker.has(uniqueKey)) {
                    dailyReportTracker.add(uniqueKey);
                    validUserLogs.push(log);
                }
            } else {
                validUserLogs.push(log); // Các hành động nộp bài luôn được tính
            }
        });

        // Đổi action sang Tiếng Việt cho giao diện dễ đọc
        const mappedLogs = validUserLogs.map(log => {
            let typeStr = "Khác";
            if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
            else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
            else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
            else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
            else if (log.action === "DAILY_REPORT") typeStr = "Báo cáo ngày";
            return { ...log, typeStr };
        });

        // ==========================================
        // 5. TẠO CÁC PENDING LOGS (Task đang làm)
        // ==========================================
        const pendingLogs: any[] = [];
        activeTasks.forEach(task => {
            if (task.contentId === targetUserId && (!task.scriptLink || task.scriptLink.trim() === "")) {
                pendingLogs.push({ id: `pending-script-${task.id}`, task, typeStr: "Script", action: "PENDING", createdAt: task.createdAt });
            }
            if (task.editorId === targetUserId && (!task.videoLink || task.videoLink.trim() === "")) {
                pendingLogs.push({ id: `pending-edit-${task.id}`, task, typeStr: "Edit", action: "PENDING", createdAt: task.createdAt });
            }
            if (task.publisherId === targetUserId && (!task.publishLink || task.publishLink.trim() === "")) {
                pendingLogs.push({ id: `pending-pub-${task.id}`, task, typeStr: "Publish", action: "PENDING", createdAt: task.createdAt });
            }
        });

        // Gộp logs đã làm và logs đang chờ, sau đó sort theo thời gian mới nhất
        const allUserLogs = [...mappedLogs, ...pendingLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // ==========================================
        // 6. TÍNH TOÁN ĐIỂM SỐ
        // ==========================================
        const targetValue = kpiRecord?.targetValue || 0;
        const actualCount = validUserLogs.length; // 🚀 Tính theo danh sách đã lọc chống hack
        const percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;

        const kpiData = {
            userId: user.id, 
            fullName: user.fullName, 
            role: user.role, 
            avatarUrl: user.avatarUrl,
            targetValue, 
            actualValue: actualCount, 
            percent, 
            logs: allUserLogs
        };

        return NextResponse.json(kpiData);

    } catch (error) {
        console.error(">>> LỖI GET KPI DETAILS:", error);
        return NextResponse.json({ error: "Lỗi máy chủ khi lấy dữ liệu KPI." }, { status: 500 });
    }
}