import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
// 🚀 Đổi tham số thứ 2 thành context để dễ xử lý Promise
export async function DELETE(req: Request, context: any) {
    try {
        // 🚀 BƯỚC QUAN TRỌNG: Giải mã params cho Next.js bản mới
        const params = await context.params;
        const teamId = params.id;

        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        if (!currentUser || !["ADMIN", "BAN_GIAM_DOC"].includes(currentUser.role)) {
            return NextResponse.json({ error: "Bạn không có quyền xóa Team!" }, { status: 403 });
        }

        const teamToCheck = await prisma.team.findUnique({
            // 🚀 Dùng biến teamId đã giải mã ở trên
            where: { id: teamId },
            include: { 
                _count: { select: { users: true, tasks: true } } 
            }
        });

        if (!teamToCheck) return NextResponse.json({ error: "Team không tồn tại" }, { status: 404 });

        if (teamToCheck._count.users > 0) {
            return NextResponse.json({ error: `Không thể xóa! Đang có ${teamToCheck._count.users} nhân sự trong team này.` }, { status: 400 });
        }
        if (teamToCheck._count.tasks > 0) {
            return NextResponse.json({ error: `Không thể xóa! Team này đang có ${teamToCheck._count.tasks} task trên hệ thống.` }, { status: 400 });
        }

        await prisma.team.delete({
            // 🚀 Dùng biến teamId
            where: { id: teamId }
        });

        return NextResponse.json({ message: "Xóa Team thành công!" });

    } catch (error) {
        console.error("DELETE Team Error:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi xóa Team" }, { status: 500 });
    }
}

// [PUT] CẬP NHẬT/ĐIỀU CHUYỂN TEAM
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

        // Cập nhật Database
        const updatedTeam = await prisma.team.update({
            where: { id: teamId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() }),
                // 🚀 Nếu FE truyền lên null, nghĩa là đẩy team ra hoạt động độc lập
                departmentId: departmentId === null ? null : departmentId
            }
        });

        return NextResponse.json(updatedTeam);
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: "Tên Team đã tồn tại!" }, { status: 400 });
        return NextResponse.json({ error: "Lỗi hệ thống khi cập nhật Team" }, { status: 500 });
    }
}