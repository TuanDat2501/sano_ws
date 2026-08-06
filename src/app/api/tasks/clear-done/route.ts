import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const user = session.user as any;
        // Chỉ cấp quyền cho cấp Quản lý
        if (!["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(user.role)) {
            return NextResponse.json({ error: "Không có quyền dọn dẹp bảng!" }, { status: 403 });
        }

        // Cập nhật tất cả task DONE thành isClosed = true
        const result = await prisma.task.updateMany({
            where: {
                status: 'DONE',
                isClosed: false
            },
            data: {
                isClosed: true
            }
        });

        return NextResponse.json({
            success: true,
            message: `Đã dọn dẹp ${result.count} task.`,
            count: result.count
        });

    } catch (error) {
        console.error("LỖI CLEAR TASKS:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}