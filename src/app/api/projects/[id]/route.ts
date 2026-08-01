import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ==============================================================
// 1. LẤY THÔNG TIN CHI TIẾT DỰ ÁN
// ==============================================================
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const resolvedParams = await params;
        
        const project = await prisma.project.findUnique({
            where: { id: resolvedParams.id },
            include: {
                team: { select: { name: true } },
            }
        });

        if (!project) {
            return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
        }

        return NextResponse.json(project);

    } catch (error) {
        console.error("LỖI FETCH PROJECT DETAIL:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// ==============================================================
// 2. CẬP NHẬT DỰ ÁN & LƯU BẢN VẼ QUY TRÌNH
// ==============================================================
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        // 🚀 BỔ SUNG: Chốt chặn an toàn cho hàm sửa Dự án
        const currentUser = session.user as any;
        const hasPermission = currentUser.permissions?.includes("MENU_PROJECTS") || currentUser.role === "ADMIN";

        if (!hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền sửa dự án!" }, { status: 403 });
        }

        const body = await req.json();
        const resolvedParams = await params;

        // Xử lý dữ liệu Bảng vẽ (JSON Parse)
        let parsedNodes = undefined;
        let parsedEdges = undefined;

        if (body.workflowNodes) {
            parsedNodes = typeof body.workflowNodes === 'string' ? JSON.parse(body.workflowNodes) : body.workflowNodes;
        }
        if (body.workflowEdges) {
            parsedEdges = typeof body.workflowEdges === 'string' ? JSON.parse(body.workflowEdges) : body.workflowEdges;
        }

        // Update dữ liệu vào DB
        const updatedProject = await prisma.project.update({
            where: { id: resolvedParams.id },
            data: {
                ...(body.name && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.teamId && { teamId: body.teamId }),
                ...(body.supervisorId && { supervisorId: body.supervisorId }),
                ...(body.channelId !== undefined && { channelId: body.channelId || null }),
                ...(body.status && { status: body.status }),
                ...(parsedNodes !== undefined && { workflowNodes: parsedNodes }),
                ...(parsedEdges !== undefined && { workflowEdges: parsedEdges }),
                ...(body.criteria && { criteria: JSON.parse(body.criteria) }),
            }
        });

        return NextResponse.json(updatedProject);

    } catch (error) {
        console.error("LỖI CẬP NHẬT PROJECT & WORKFLOW:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// ==============================================================
// 3. XÓA DỰ ÁN
// ==============================================================
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const currentUser = session.user as any;

        // 🚀 ĐÃ SỬA: Đọc quyền động từ biến permissions thay vì fix cứng Role
        const hasPermission = currentUser.permissions?.includes("MENU_PROJECTS") || currentUser.role === "ADMIN";

        if (!hasPermission) {
            return NextResponse.json({ error: "Không có quyền xóa dự án!" }, { status: 403 });
        }

        const resolvedParams = await params;
        const projectId = resolvedParams.id;
        
        await prisma.project.delete({
            where: { id: projectId }
        });

        return NextResponse.json({ success: true, message: "Đã xóa dự án thành công" });

    } catch (error) {
        console.error("LỖI XÓA PROJECT:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}