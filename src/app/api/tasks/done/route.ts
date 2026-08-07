import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");

        if (!teamId) return NextResponse.json({ error: "Thiếu teamId" }, { status: 400 });

        // 🚀 Chỉ lấy các Task đã DONE của Team, không bị giới hạn phân trang
        const tasks = await prisma.task.findMany({
            where: {
                teamId: teamId,
                status: "DONE"
            },
            select: {
                id: true,
                title: true,
                publishLink: true,
                videoLink: true,
                scriptLink: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(tasks);
    } catch (error) {
        console.error("LỖI API LẤY TASK DONE:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}