import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";


// [PUT] CẬP NHẬT TÊN / MÔ TẢ PHÒNG BAN
export async function PUT(req: Request, context: any) {
    try {
        const params = await context.params;
        const deptId = params.id;
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        if (!currentUser || !["ADMIN", "BAN_GIAM_DOC"].includes(currentUser.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { name, description } = body;

        const updatedDept = await prisma.department.update({
            where: { id: deptId },
            data: { 
                name: name?.trim(), 
                description: description?.trim() 
            }
        });

        return NextResponse.json(updatedDept);
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: "Tên Phòng ban đã tồn tại!" }, { status: 400 });
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// [DELETE] XÓA PHÒNG BAN
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        if (!currentUser || !["ADMIN", "BAN_GIAM_DOC"].includes(currentUser.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 🚀 BƯỚC QUAN TRỌNG: 
        // Trước khi xóa Phòng, phải thả các Team bên trong ra ngoài (thành Team Độc lập)
        // để không bị lỗi khóa ngoại (Foreign Key Constraint) của Database
        await prisma.team.updateMany({
            where: { departmentId: params.id },
            data: { departmentId: null }
        });

        // Giờ thì an tâm Xóa phòng ban
        await prisma.department.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ message: "Đã xóa Phòng ban thành công!" });
    } catch (error) {
        console.error("DELETE Department Error:", error);
        return NextResponse.json({ error: "Lỗi Server khi xóa" }, { status: 500 });
    }
}