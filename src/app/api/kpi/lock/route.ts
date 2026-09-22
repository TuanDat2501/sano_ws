import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        // CHỈ BAN GIÁM ĐỐC, ADMIN, HR ĐƯỢC KHÓA/MỞ KHÓA
        if (!["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser?.role)) {
            return NextResponse.json({ error: "Chỉ Admin/HR mới có quyền khóa KPI" }, { status: 403 });
        }

        const { teamId, year, month, weekNumber, isLocked } = await req.json();

        // 1. Lấy danh sách User bị ảnh hưởng
        let userWhere: any = { 
            isActive: true,
            role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] }
        };

        if (teamId && teamId !== "ALL") {
            userWhere.teamId = teamId;
        }

        const users = await prisma.user.findMany({ where: userWhere, select: { id: true } });
        const userIds = users.map(u => u.id);

        if (userIds.length === 0) return NextResponse.json({ success: true });

        // 2. Cập nhật hàng loạt (Nếu chưa có bản ghi WeeklyKPI thì tạo mới với target=0)
        await prisma.$transaction(async (tx) => {
            const existingKpis = await tx.weeklyKPI.findMany({
                where: { userId: { in: userIds }, year, month, weekNumber }
            });
            const existingUserIds = existingKpis.map(k => k.userId);

            // Update những user đã có bản ghi
            if (existingUserIds.length > 0) {
                await tx.weeklyKPI.updateMany({
                    where: { userId: { in: existingUserIds }, year, month, weekNumber },
                    data: { isLocked: Boolean(isLocked) }
                });
            }

            // Tạo mới cho những user chưa có bản ghi (để áp lệnh khóa)
            const missingUserIds = userIds.filter(id => !existingUserIds.includes(id));
            if (missingUserIds.length > 0) {
                const newData = missingUserIds.map(userId => ({
                    userId, year, month, weekNumber,
                    targetValue: 0,
                    isLocked: Boolean(isLocked)
                }));
                await tx.weeklyKPI.createMany({ data: newData });
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("LỖI KHÓA KPI:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}