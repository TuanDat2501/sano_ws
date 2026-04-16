import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        // 🚀 BẢO MẬT: Chặn xuất Excel lậu
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const currentUserRole = (session.user as any)?.role;

        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

        let userWhere: any = { isActive: true };
        
        // 🚀 SỬA LỖI teamId === "ALL" gây crash DB
        if (currentUserRole === "ADMIN") {
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } else if (currentUserRole === "BAN_GIAM_DOC" || currentUserRole === "HR") {
            userWhere.role = { not: "ADMIN" };
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } else {
            if (!teamId || teamId === "ALL") return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
            userWhere.teamId = teamId;
        }

        const users = await prisma.user.findMany({
            where: userWhere,
            select: { id: true, fullName: true, role: true }
        });

        if (users.length === 0) return NextResponse.json([]);

        const userIds = users.map(u => u.id);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        // 🚀 TỐI ƯU N+1 BẰNG BATCH FETCHING
        const [allWeeklyKPIs, allLogs, allActiveTasks] = await Promise.all([
            prisma.weeklyKPI.findMany({
                where: { userId: { in: userIds }, year, month }
            }),
            prisma.taskLog.findMany({
                where: {
                    userId: { in: userIds },
                    createdAt: { gte: startOfMonth, lte: endOfMonth },
                    action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"] }
                }
            }),
            prisma.task.findMany({
                where: {
                    OR: [{ contentId: { in: userIds } }, { editorId: { in: userIds } }, { publisherId: { in: userIds } }],
                    isClosed: false,
                    createdAt: { gte: startOfMonth, lte: endOfMonth }
                }
            })
        ]);

        const monthlyData = users.map(user => {
            const userKpis = allWeeklyKPIs.filter(k => k.userId === user.id);
            const userLogs = allLogs.filter(l => l.userId === user.id);
            const userActiveTasks = allActiveTasks.filter(t => t.contentId === user.id || t.editorId === user.id || t.publisherId === user.id);

            let pendingCount = 0;
            userActiveTasks.forEach(task => {
                if (task.contentId === user.id && (!task.scriptLink || task.scriptLink.trim() === "")) pendingCount++;
                if (task.editorId === user.id && (!task.videoLink || task.videoLink.trim() === "")) pendingCount++;
                if (task.publisherId === user.id && (!task.publishLink || task.publishLink.trim() === "")) pendingCount++;
            });

            let scriptCount = 0, editCount = 0, publishCount = 0, otherCount = 0;
            const weeksData = {
                1: { target: 0, actual: 0 }, 2: { target: 0, actual: 0 },
                3: { target: 0, actual: 0 }, 4: { target: 0, actual: 0 },
            };

            userKpis.forEach(kpi => {
                if (weeksData[kpi.weekNumber as keyof typeof weeksData]) {
                    weeksData[kpi.weekNumber as keyof typeof weeksData].target = kpi.targetValue;
                }
            });

            userLogs.forEach(log => {
                let w = Math.ceil(new Date(log.createdAt).getDate() / 7);
                if (w > 4) w = 4;
                weeksData[w as keyof typeof weeksData].actual += 1;

                if (log.action === "SUBMIT_SCRIPT") scriptCount++;
                else if (log.action === "SUBMIT_VIDEO") editCount++;
                else if (log.action === "PUBLISH_VIDEO") publishCount++;
                else otherCount++;
            });

            let totalTarget = 0, totalActual = 0;
            for (let i = 1; i <= 4; i++) {
                totalTarget += weeksData[i as keyof typeof weeksData].target;
                totalActual += weeksData[i as keyof typeof weeksData].actual;
            }

            const avgPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
            
            let evaluation = "Yếu";
            if (avgPercent >= 100) evaluation = "Xuất sắc";
            else if (avgPercent >= 85) evaluation = "Khá";
            else if (avgPercent >= 70) evaluation = "Trung bình";

            const p1 = weeksData[1].target > 0 ? Math.round((weeksData[1].actual / weeksData[1].target) * 100) : 0;
            const p2 = weeksData[2].target > 0 ? Math.round((weeksData[2].actual / weeksData[2].target) * 100) : 0;
            const p3 = weeksData[3].target > 0 ? Math.round((weeksData[3].actual / weeksData[3].target) * 100) : 0;
            const p4 = weeksData[4].target > 0 ? Math.round((weeksData[4].actual / weeksData[4].target) * 100) : 0;

            return {
                "Họ và Tên": user.fullName, "Vị trí": user.role,
                "Chỉ tiêu T1": weeksData[1].target, "Thực đạt T1": weeksData[1].actual, "Tỷ lệ T1 (%)": p1,
                "Chỉ tiêu T2": weeksData[2].target, "Thực đạt T2": weeksData[2].actual, "Tỷ lệ T2 (%)": p2,
                "Chỉ tiêu T3": weeksData[3].target, "Thực đạt T3": weeksData[3].actual, "Tỷ lệ T3 (%)": p3,
                "Chỉ tiêu T4": weeksData[4].target, "Thực đạt T4": weeksData[4].actual, "Tỷ lệ T4 (%)": p4,
                "TỔNG CHỈ TIÊU": totalTarget, "TỔNG THỰC ĐẠT": totalActual, "TỶ LỆ THÁNG (%)": avgPercent,
                "Chi tiết: Kịch bản": scriptCount, "Chi tiết: Dựng Video": editCount,
                "Chi tiết: Đăng Kênh": publishCount, "Chi tiết: Khác": otherCount,
                "Việc Tồn đọng": pendingCount, "ĐÁNH GIÁ": evaluation
            };
        });

        return NextResponse.json(monthlyData);
    } catch (error) {
        console.error("LỖI XUẤT EXCEL:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}