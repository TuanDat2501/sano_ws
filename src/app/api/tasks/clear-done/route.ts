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

        // 🚀 TẠO ĐIỀU KIỆN MẶC ĐỊNH
        let whereClause: any = {
            status: 'DONE',
            isClosed: false
        };

        // 🚀 LỌC RIÊNG CHO LEADER: Chỉ được phép clear task của Team mình
        if (user.role === "LEADER") {
            if (!user.teamId) {
                return NextResponse.json({ error: "Leader chưa được gán Team, không thể dọn dẹp!" }, { status: 400 });
            }
            whereClause.teamId = user.teamId;
        }

        // Cập nhật các task DONE thành isClosed = true theo điều kiện
        const result = await prisma.task.updateMany({
            where: whereClause,
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