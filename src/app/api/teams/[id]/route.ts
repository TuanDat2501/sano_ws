import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, context: any) {
    try {
        // Giải mã params cho Next.js bản mới
        const params = await context.params;
        const teamId = params.id;

        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        if (!currentUser || !["ADMIN", "BAN_GIAM_DOC"].includes(currentUser.role)) {
            return NextResponse.json({ error: "Bạn không có quyền xóa Team!" }, { status: 403 });
        }

        const teamToCheck = await prisma.team.findUnique({
            where: { id: teamId },
            include: { 
                // Bỏ đếm users vì chúng ta sẽ giải phóng họ, chỉ giữ lại đếm tasks
                _count: { select: { tasks: true } } 
            }
        });

        if (!teamToCheck) return NextResponse.json({ error: "Team không tồn tại" }, { status: 404 });

        // Vẫn chặn xóa nếu Team đang chứa Tasks (theo logic cũ của bạn)
        if (teamToCheck._count.tasks > 0) {
            return NextResponse.json({ error: `Không thể xóa! Team này đang có ${teamToCheck._count.tasks} task trên hệ thống.` }, { status: 400 });
        }

        // Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
        await prisma.$transaction([
            // Bước 1: Giải phóng toàn bộ user trong team (Set teamId = null)
            prisma.user.updateMany({
                where: { teamId: teamId },
                data: { teamId: null }
            }),
            // Bước 2: Xóa Team
            prisma.team.delete({
                where: { id: teamId }
            })
        ]);

        return NextResponse.json({ message: "Xóa Team và giải phóng nhân sự thành công!" });

    } catch (error) {
        console.error("DELETE Team Error:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi xóa Team" }, { status: 500 });
    }
}

// [PUT] CẬP NHẬT/ĐIỀU CHUYỂN TEAM (Giữ nguyên như cũ)
export async function PUT(req: Request, context: any) {
    try {
        const params = await context.params;
        const teamId = params.id;

        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        if (!currentUser || !["ADMIN", "BAN_GIAM_DOC"].includes(currentUser.role)) {
            return NextResponse.json({ error: "Bạn không có quyền sửa Team!" }, { status: 403 });
        }

        const body = await req.json();
        const { name, description, departmentId } = body;

        const updatedTeam = await prisma.team.update({
            where: { id: teamId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() }),
                departmentId: departmentId === null ? null : departmentId
            }
        });

        return NextResponse.json(updatedTeam);
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: "Tên Team đã tồn tại!" }, { status: 400 });
        return NextResponse.json({ error: "Lỗi hệ thống khi cập nhật Team" }, { status: 500 });
    }
}

// BỔ SUNG HÀM GET ĐỂ LẤY CHI TIẾT TEAM KÈM DANH SÁCH USER VÀ KÊNH
export async function GET(req: Request, context: any) {
    try {
        const params = await context.params;
        const teamId = params.id;

        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                users: {
                    where: { isActive: true }, // Chỉ lấy user đang hoạt động
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                        teamId: true
                    }
                },
                channels: true // 🚀 BỔ SUNG: Lấy toàn bộ kênh thuộc sở hữu của Team này
            }
        });

        if (!team) {
            return NextResponse.json({ error: "Team không tồn tại" }, { status: 404 });
        }

        return NextResponse.json(team);

    } catch (error) {
        console.error("GET Team Error:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi lấy thông tin Team" }, { status: 500 });
    }
}