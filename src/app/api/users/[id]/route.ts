// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const targetUserId = id;

        // 1. 🚀 CHỐT CHẶN BẢO MẬT TỐI CAO
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const currentUser = session.user as any;
        const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser.role);
        const isSelf = currentUser.id === targetUserId;

        if (!isManager && !isSelf) {
            return NextResponse.json({ error: "Sếp không có quyền sửa thông tin người này!" }, { status: 403 });
        }

        // 2. LẤY DỮ LIỆU TỪ FORM (Frontend)
        const body = await request.json();
        const { username, fullName, role, teamId, password, isActive, avatarUrl } = body;

        // 3. CHUẨN BỊ GIỎ DỮ LIỆU UPDATE
        const updateData: any = {};
        
        if (fullName) updateData.fullName = fullName;
        if (username) updateData.username = username;
        if (avatarUrl) updateData.avatarUrl = avatarUrl;
        // Xử lý mật khẩu (Chỉ băm nếu sếp có gõ pass mới)
        if (password && password.trim() !== "") {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        // 🚀 ĐẶC QUYỀN CỦA QUẢN LÝ: Chỉ Quản lý mới được phép đổi Role, Team và Khóa tài khoản
        if (isManager) {
            if (role) updateData.role = role;
            updateData.teamId = teamId || null; // Nếu rỗng thì gán null
            if (isActive !== undefined) updateData.isActive = isActive; // BẮT ĐƯỢC LỆNH KHÓA/MỞ KHÓA TỪ FE
        }

        // 4. LỆNH CHO PRISMA THỰC THI
        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: updateData,
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                avatarUrl: true,
                teamId: true,
                isActive: true, // Trả về trạng thái khóa
                createdAt: true,
                team: { select: { name: true } }
            }
        });

        return NextResponse.json(updatedUser, { status: 200 });

    } catch (error: any) {
        console.error(">>> [API UPDATE USER ERROR]:", error);

        // Bắt lỗi User đã tồn tại (VD: Trùng username)
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Tên đăng nhập này đã có người sử dụng!" }, { status: 400 });
        }
        
        if (error.code === 'P2025') {
            return NextResponse.json({ error: "Không tìm thấy nhân sự này!" }, { status: 404 });
        }

        return NextResponse.json({ error: "Lỗi Server không thể cập nhật!" }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const currentUser = session.user as any;
        const { id } = await params;
        const targetUserId = id;

        const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR", "LEADER"].includes(currentUser.role);
        const isSelf = currentUser.id === targetUserId;

        if (!isManager && !isSelf) {
            return NextResponse.json({ error: "Bạn không có quyền xem thông tin của người này!" }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                teamId: true,
                isActive: true, // 🚀 Bổ sung thêm isActive
                createdAt: true,
                team: { select: { name: true } } // 🚀 Lấy luôn tên Team
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Không tìm thấy nhân sự này!" }, { status: 404 });
        }

        return NextResponse.json(user, { status: 200 });

    } catch (error) {
        console.error(">>> [API GET USER ERROR]:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi lấy thông tin nhân sự." }, { status: 500 });
    }
}