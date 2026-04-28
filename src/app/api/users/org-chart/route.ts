import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContinuousWeekRange } from "@/lib/utils";

export const dynamic = "force-dynamic";


export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 2. TÌM XEM HÔM NAY LÀ TUẦN MẤY THEO LOGIC CỦA SẾP
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const firstDayOfMonth = new Date(year, month - 1, 1);
        const dayOfWeek = firstDayOfMonth.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

        // Đổi sang UTC để trừ ngày không bị lệch do Timezone/Daylight saving
        const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const startUTC = Date.UTC(startOfFirstWeek.getFullYear(), startOfFirstWeek.getMonth(), startOfFirstWeek.getDate());
        const diffDays = Math.floor((todayUTC - startUTC) / (24 * 60 * 60 * 1000));
        
        const currentWeekNumber = Math.floor(diffDays / 7) + 1;

        // 🚀 3. LẤY NGÀY ĐẦU VÀ CUỐI TUẦN TỪ HÀM CỦA SẾP
        const { start, end } = getContinuousWeekRange(year, month, currentWeekNumber);
        
        // Fix cứng giờ phút giây để query Database chuẩn xác 100%
        const startOfWeek = new Date(start);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(end);
        endOfWeek.setHours(23, 59, 59, 999);

        // 4. Query lấy User kèm theo Target KPI của tuần (Đã có cả year, month, weekNumber)
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                fullName: true,
                role: true,
                avatarUrl: true,
                teamId: true,
                isActive: true,
                weeklyKPIs: {
                    // 🚀 Fetch chính xác KPI theo Tháng và Tuần của Sếp
                    where: { year: year, month: month, weekNumber: currentWeekNumber },
                    take: 1
                }
            }
        });

        // 5. Lấy Lịch sử làm việc (TaskLog) trong mốc thời gian của Sếp để tính Actual
        const taskLogs = await prisma.taskLog.findMany({
            where: {
                createdAt: { gte: startOfWeek, lte: endOfWeek },
                action: { 
                    in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"] 
                }
            },
            select: { userId: true, taskId: true }
        });

        // Dùng Set để lọc trùng (1 video làm nhiều lần vẫn tính là 1 task hoàn thành)
        const userActuals: Record<string, Set<string>> = {};
        taskLogs.forEach(log => {
            if (!userActuals[log.userId]) userActuals[log.userId] = new Set();
            userActuals[log.userId].add(log.taskId); 
        });

        // 6. Lắp ráp dữ liệu chuẩn Form Frontend cần
        const formattedUsers = users.map(user => {
            const target = user.weeklyKPIs.length > 0 ? user.weeklyKPIs[0].targetValue : 0;
            const actual = userActuals[user.id] ? userActuals[user.id].size : 0;

            return {
                id: user.id,
                fullName: user.fullName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                teamId: user.teamId,
                isActive: user.isActive,
                currentWeekStats: {
                    target: target,
                    actual: actual
                }
            };
        });

        return NextResponse.json(formattedUsers);

    } catch (error) {
        console.error("LỖI API ORG-CHART:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}