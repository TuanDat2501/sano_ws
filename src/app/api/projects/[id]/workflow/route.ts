import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 🚀 SỬA KIỂU DỮ LIỆU: params bây giờ là một Promise
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 SỬA LỖI Ở ĐÂY: Await toàn bộ params trước rồi mới lấy id
        const resolvedParams = await params;
        const projectId = resolvedParams.id;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { workflowNodes: true, workflowEdges: true, name: true }
        });
        
        return NextResponse.json(project);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi tải quy trình" }, { status: 500 });
    }
}

// 🚀 SỬA KIỂU DỮ LIỆU TƯƠNG TỰ CHO HÀM PATCH
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 AWAIT PARAMS
        const resolvedParams = await params;
        const projectId = resolvedParams.id;

        const { nodes, edges } = await req.json();
        
        const updatedProject = await prisma.project.update({
            where: { id: projectId },
            data: {
                workflowNodes: nodes,
                workflowEdges: edges
            }
        });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi lưu quy trình" }, { status: 500 });
    }
}