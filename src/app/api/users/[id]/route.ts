import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

// Bắt buộc để Next.js không cache API này
export const dynamic = "force-dynamic";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = id;
        
        // 1. Lấy dữ liệu gửi lên từ giao diện
        const body = await request.json();
        const { fullName, role, teamId, password } = body;

        // 2. Chuẩn bị giỏ dữ liệu để update (những trường cơ bản)
        const updateData: any = {
            fullName,
            role,
            avatarUrl: body.avatarUrl || null, // Nếu không có avatar mới thì giữ nguyên hoặc set về null
            teamId: teamId || null, // Nếu không chọn team thì cho về null
        };

        // 3. XỬ LÝ MẬT KHẨU (Cực kỳ quan trọng)
        // Nếu sếp có gõ mật khẩu mới vào form -> Băm nó ra và nhét vào giỏ update
        // Nếu bỏ trống -> Mặc kệ, giữ nguyên mật khẩu cũ trong DB
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.passwordHash = hashedPassword;
        }

        // 4. Lệnh cho Prisma thực thi cập nhật
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            // (Tuỳ chọn) Không trả về passwordHash để bảo mật lúc trả data về Frontend
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                teamId: true,
                createdAt: true,
                avatarUrl: true,
            }
        });

        // 5. Trả về kết quả xanh rờn
        return NextResponse.json(
            { message: "Cập nhật hồ sơ nhân sự thành công!", user: updatedUser },
            { status: 200 }
        );

    } catch (error: any) {
        console.error(">>> [API UPDATE USER ERROR]:", error);

        // Bắt chính xác lỗi Prisma khi sếp truyền một cái ID không tồn tại
        if (error.code === 'P2025') {
            return NextResponse.json(
                { error: "Không tìm thấy nhân sự này trong cơ sở dữ liệu!" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: "Lỗi hệ thống! Không thể cập nhật thông tin." },
            { status: 500 }
        );
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. KIỂM TRA ĐĂNG NHẬP (Ai đang gọi API này?)
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const currentUser = session.user as any;
        const { id } = await params; // ID của user cần lấy thông tin
        const targetUserId = id;

        // 2. PHÂN QUYỀN (RBAC - Role-Based Access Control)
        // - Luật 1: Quản lý (ADMIN, HR, BAN_GIAM_DOC, LEADER) được xem hồ sơ của tất cả mọi người.
        // - Luật 2: Nhân viên bình thường CHỈ được xem hồ sơ của chính mình.
        const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR", "LEADER"].includes(currentUser.role);
        const isSelf = currentUser.id === targetUserId;

        if (!isManager && !isSelf) {
            console.log(`[CẢNH BÁO BẢO MẬT] User ${currentUser.username} cố tình truy cập hồ sơ của ${targetUserId}`);
            return NextResponse.json({ error: "Bạn không có quyền xem thông tin của người này!" }, { status: 403 });
        }

        // 3. CHỌC VÀO DB LẤY DATA (Tuyệt đối không lấy passwordHash)
        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                teamId: true,
                avatarUrl: true, // Nếu sếp đã làm tính năng avatar
                createdAt: true,
                // Có thể include thêm thông tin Team nếu cần:
                // team: { select: { name: true } } 
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Không tìm thấy nhân sự này!" }, { status: 404 });
        }

        return NextResponse.json(user, { status: 200 });

    } catch (error) {
        console.error(">>> [API GET USER BY ID ERROR]:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi lấy thông tin nhân sự." }, { status: 500 });
    }
}