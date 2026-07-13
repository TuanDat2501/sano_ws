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

    const currentUserId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    
    // 🚀 THÊM MỚI: Bắt tham số lv (level)
    const lv = searchParams.get("lv");

    if (!teamId) {
      return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
    }

    // 🚀 XỬ LÝ LOGIC ĐIỀU KIỆN THEO LEVEL
    let roleConditions: any[] = [];

    if (lv === "1") {
      // Nếu lv = 1: Chỉ lấy Leader của chính Team đó
      roleConditions.push({ teamId: teamId, role: "LEADER" });
    } else if (lv === "2") {
      // Nếu lv = 2: Chỉ lấy Ban Giám Đốc và Hành Chính Nhân Sự
      roleConditions.push({ role: "BAN_GIAM_DOC" }, { role: "HR" });
    } else {
      // (Dự phòng) Nếu không có lv truyền lên, lấy tất cả như cũ
      roleConditions.push(
        { teamId: teamId, role: "LEADER" }, 
        { role: "BAN_GIAM_DOC" },
        { role: "HR" }
      );
    }

    const approvers = await prisma.user.findMany({
      where: {
        isActive: true,
        // Loại trừ chính bản thân người đang tạo đơn
        id: { not: currentUserId },
        // 🚀 Truyền mảng điều kiện linh hoạt vào đây
        OR: roleConditions
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