// /api/requests/approvers/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 🚀 Bổ sung: Lấy ID của người đang thao tác
    const currentUserId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
    }

    const approvers = await prisma.user.findMany({
      where: {
        isActive: true,
        // 🚀 BỔ SUNG CỰC QUAN TRỌNG: Loại trừ chính bản thân người đang tạo đơn
        id: { not: currentUserId },
        OR: [
          { teamId: teamId, role: "LEADER" }, 
          { role: "BAN_GIAM_DOC" },
          // 🚀 TỐI ƯU: Dùng thẳng Enum Role, không tìm theo Text rủi ro nữa
          { role: "HR" } 
        ]
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        teamId: true,
        team: { select: { name: true } }
      },
      orderBy: { role: "asc" }, 
    });

    return NextResponse.json(approvers);
  } catch (error) {
    console.error("❌ Lỗi API lấy người duyệt:", error);
    return NextResponse.json({ error: "Lỗi tải danh sách người phê duyệt" }, { status: 500 });
  }
}