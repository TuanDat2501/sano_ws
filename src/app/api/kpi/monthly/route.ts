import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

        if (!teamId) return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });

        const users = await prisma.user.findMany({
            where: { teamId, isActive: true },
            select: { id: true, fullName: true, role: true }
        });

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        const monthlyData = await Promise.all(users.map(async (user) => {
            // 1. LẤY MỤC TIÊU CẢ 4 TUẦN
            const weeklyKPIs = await prisma.weeklyKPI.findMany({
                where: { userId: user.id, year, month }
            });

            // 2. LẤY LOG HOÀN THÀNH TRONG THÁNG
            const logs = await prisma.taskLog.findMany({
                where: {
                    userId: user.id,
                    createdAt: { gte: startOfMonth, lte: endOfMonth },
                    action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"] }
                }
            });

            // 3. LẤY VIỆC TỒN ĐỌNG (CHƯA NỘP) TRONG THÁNG
            const activeTasks = await prisma.task.findMany({
                where: {
                    OR: [{ contentId: user.id }, { editorId: user.id }, { publisherId: user.id }],
                    isClosed: false,
                    createdAt: { gte: startOfMonth, lte: endOfMonth }
                }
            });

            let pendingCount = 0;
            activeTasks.forEach(task => {
                if (task.contentId === user.id && (!task.scriptLink || task.scriptLink.trim() === "")) pendingCount++;
                if (task.editorId === user.id && (!task.videoLink || task.videoLink.trim() === "")) pendingCount++;
                if (task.publisherId === user.id && (!task.publishLink || task.publishLink.trim() === "")) pendingCount++;
            });

            // 4. BIẾN THỐNG KÊ CHI TIẾT
            let scriptCount = 0;
            let editCount = 0;
            let publishCount = 0;
            let otherCount = 0;

            const weeksData = {
                1: { target: 0, actual: 0 },
                2: { target: 0, actual: 0 },
                3: { target: 0, actual: 0 },
                4: { target: 0, actual: 0 },
            };

            // Nhồi Target vào từng tuần
            weeklyKPIs.forEach(kpi => {
                if (weeksData[kpi.weekNumber as keyof typeof weeksData]) {
                    weeksData[kpi.weekNumber as keyof typeof weeksData].target = kpi.targetValue;
                }
            });

            // Nhồi Actual vào từng tuần và Phân loại công việc
            logs.forEach(log => {
                let w = Math.ceil(new Date(log.createdAt).getDate() / 7);
                if (w > 4) w = 4; // Ép về 4 tuần
                weeksData[w as keyof typeof weeksData].actual += 1;

                if (log.action === "SUBMIT_SCRIPT") scriptCount++;
                else if (log.action === "SUBMIT_VIDEO") editCount++;
                else if (log.action === "PUBLISH_VIDEO") publishCount++;
                else otherCount++;
            });

            // Tính Tổng Tháng
            let totalTarget = 0;
            let totalActual = 0;
            for (let i = 1; i <= 4; i++) {
                totalTarget += weeksData[i as keyof typeof weeksData].target;
                totalActual += weeksData[i as keyof typeof weeksData].actual;
            }

            const avgPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
            
            // XẾP LOẠI
            let evaluation = "Yếu";
            if (avgPercent >= 100) evaluation = "Xuất sắc";
            else if (avgPercent >= 85) evaluation = "Khá";
            else if (avgPercent >= 70) evaluation = "Trung bình";

            const p1 = weeksData[1].target > 0 ? Math.round((weeksData[1].actual / weeksData[1].target) * 100) : 0;
            const p2 = weeksData[2].target > 0 ? Math.round((weeksData[2].actual / weeksData[2].target) * 100) : 0;
            const p3 = weeksData[3].target > 0 ? Math.round((weeksData[3].actual / weeksData[3].target) * 100) : 0;
            const p4 = weeksData[4].target > 0 ? Math.round((weeksData[4].actual / weeksData[4].target) * 100) : 0;

            // 🚀 TRẢ VỀ OBJECT EXCEL SIÊU CHI TIẾT
            return {
                "Họ và Tên": user.fullName,
                "Vị trí": user.role,
                
                "Chỉ tiêu T1": weeksData[1].target,
                "Thực đạt T1": weeksData[1].actual,
                "Tỷ lệ T1 (%)": p1,

                "Chỉ tiêu T2": weeksData[2].target,
                "Thực đạt T2": weeksData[2].actual,
                "Tỷ lệ T2 (%)": p2,

                "Chỉ tiêu T3": weeksData[3].target,
                "Thực đạt T3": weeksData[3].actual,
                "Tỷ lệ T3 (%)": p3,

                "Chỉ tiêu T4": weeksData[4].target,
                "Thực đạt T4": weeksData[4].actual,
                "Tỷ lệ T4 (%)": p4,

                "TỔNG CHỈ TIÊU": totalTarget,
                "TỔNG THỰC ĐẠT": totalActual,
                "TỶ LỆ THÁNG (%)": avgPercent,
                
                "Chi tiết: Kịch bản": scriptCount,
                "Chi tiết: Dựng Video": editCount,
                "Chi tiết: Đăng Kênh": publishCount,
                "Chi tiết: Khác": otherCount,
                "Việc Tồn đọng (Chưa nộp)": pendingCount,
                
                "ĐÁNH GIÁ": evaluation
            };
        }));

        return NextResponse.json(monthlyData);
    } catch (error) {
        console.error("LỖI XUẤT EXCEL:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}