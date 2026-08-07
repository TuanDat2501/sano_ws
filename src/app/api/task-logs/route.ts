import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        if (!userId) return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });

        const logs = await prisma.taskLog.findMany({
            where: { 
                userId: userId,
                action: { in: ["DAILY_REPORT", "UPDATE_LINK"] } 
            },
            include: {
                task: { select: { title: true, channel: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(logs);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        if (!["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(currentUser?.role)) {
            return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
        }

        const body = await req.json();
        const { id, type } = body; 

        if (!id) return NextResponse.json({ error: "Thiếu ID log" }, { status: 400 });

        if (type === 'DELETE') {
            await prisma.taskLog.delete({ where: { id } });
            return NextResponse.json({ success: true, message: "Đã xóa log" });
        }

        return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}