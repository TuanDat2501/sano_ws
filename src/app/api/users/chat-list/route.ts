import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; 

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        // 1. Kiểm tra đăng nhập (Chỉ cần đăng nhập là được gọi, không xét Role)
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        // 2. Query tối ưu: Chỉ Select ĐÚNG những trường FloatingChat cần
        const chatUsers = await prisma.user.findMany({
            select: {
                fullName: true,
                username: true,
                role: true,
                avatarUrl: true, // Lấy thêm avatar để sau này sếp gắn ảnh vào list chat cho đẹp
            },
            orderBy: {
                fullName: 'asc' // Sắp xếp theo bảng chữ cái cho dễ tìm
            }
        });

        // 3. Trả data về
        return NextResponse.json(chatUsers, { status: 200 });

    } catch (error) {
        console.error(">>> [API CHAT-LIST ERROR]:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi lấy danh sách chat" }, { status: 500 });
    }
}