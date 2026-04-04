import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    
    // Lấy 20 thông báo mới nhất của user này
    const notifs = await prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(notifs);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi tải thông báo" }, { status: 500 });
  }
}