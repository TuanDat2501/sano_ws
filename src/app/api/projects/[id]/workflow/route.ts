import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// API GET: Tải dữ liệu quy trình cũ
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

// API PATCH: Lưu dữ liệu quy trình mới
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const projectId = resolvedParams.id;

        const { nodes, edges } = await req.json();
        
        // Lưu thẳng mảng JSON vào database
        await prisma.project.update({
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