import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, context: any) {
    try {
        const params = await context.params;
        const teamId = params.id;

        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        // 🚀 ĐÃ SỬA: Đọc quyền động từ biến permissions thay vì fix cứng Role
        const hasPermission = currentUser?.permissions?.includes("MENU_TEAMS") || currentUser?.role === "ADMIN";

        if (!currentUser || !hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền xóa Team!" }, { status: 403 });
        }

        const teamToCheck = await prisma.team.findUnique({
            where: { id: teamId }
        });

        if (!teamToCheck) return NextResponse.json({ error: "Team không tồn tại" }, { status: 404 });

        await prisma.$transaction([
            prisma.user.updateMany({
                where: { teamId: teamId },
                data: { teamId: null }
            }),
            
            prisma.task.updateMany({
                where: { teamId: teamId },
                data: { teamId: null }
            }),

            prisma.project.updateMany({
                where: { teamId: teamId },
                data: { teamId: null }
            }),

            prisma.team.delete({
                where: { id: teamId }
            })
        ]);

        return NextResponse.json({ message: "Xóa Team và giải phóng nhân sự, dự án thành công!" });

    } catch (error: any) {
        console.error("DELETE Team Error:", error);
        
        if (error.code === 'P2003') {
            return NextResponse.json({ error: "Không thể xóa! Vẫn còn dữ liệu quan trọng đang liên kết chặt với Team này." }, { status: 400 });
        }
        
        return NextResponse.json({ error: "Lỗi hệ thống khi xóa Team" }, { status: 500 });
    }
}

export async function PUT(req: Request, context: any) {
    try {
        const params = await context.params;
        const teamId = params.id;

        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        // 🚀 ĐÃ SỬA: Đọc quyền động từ biến permissions thay vì fix cứng Role
        const hasPermission = currentUser?.permissions?.includes("MENU_TEAMS") || currentUser?.role === "ADMIN";

        if (!currentUser || !hasPermission) {
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
                    where: { isActive: true }, 
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                        teamId: true
                    }
                },
                channels: true 
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