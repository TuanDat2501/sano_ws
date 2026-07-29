import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// LẤY DANH SÁCH NGƯỜI DUYỆT VÀ DANH SÁCH NHÂN SỰ ĐỂ CHỌN
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Lấy danh sách người duyệt cấp 2 hiện tại
        const level2Approvers = await prisma.level2Approver.findMany({
            include: {
                user: {
                    select: { id: true, fullName: true, username: true, role: true, avatarUrl: true, team: { select: { name: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Lấy danh sách toàn bộ user đang hoạt động (để đổ vào Dropdown thêm mới)
        const allActiveUsers = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, fullName: true, username: true, role: true, team: { select: { name: true } } },
            orderBy: { fullName: 'asc' }
        });

        return NextResponse.json({ level2Approvers, allActiveUsers }, { status: 200 });
    } catch (error) {
        console.error(">>> [API GET LEVEL2 APPROVERS ERROR]:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// THÊM NGƯỜI DUYỆT MỚI
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { userId } = await req.json();
        if (!userId) return NextResponse.json({ error: "Thiếu thông tin User ID" }, { status: 400 });

        const newApprover = await prisma.level2Approver.create({
            data: { userId },
            include: {
                user: { select: { id: true, fullName: true, username: true, role: true, avatarUrl: true, team: { select: { name: true } } } }
            }
        });

        return NextResponse.json(newApprover, { status: 201 });
    } catch (error: any) {
        console.error(">>> [API POST LEVEL2 APPROVER ERROR]:", error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Nhân sự này đã nằm trong danh sách Duyệt Cấp 2!" }, { status: 400 });
        }
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// XÓA NGƯỜI DUYỆT (Gửi id qua body)
export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: "Thiếu ID để xóa" }, { status: 400 });

        await prisma.level2Approver.delete({
            where: { id }
        });

        return NextResponse.json({ message: "Xóa thành công" }, { status: 200 });
    } catch (error) {
        console.error(">>> [API DELETE LEVEL2 APPROVER ERROR]:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}