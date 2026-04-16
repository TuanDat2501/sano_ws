import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // 🚀 Dùng alias @/ cho sạch code sếp nhé
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
// 1. LẤY DANH SÁCH TEAM
export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        _count: { select: { users: true } },
        users: {
          select: { id: true, fullName: true, role: true, avatarUrl: true }
        }
      },

      // 🚀 Sắp xếp A-Z để vào Form chọn cho dễ nhìn
      orderBy: { name: "asc" },
    });
    return NextResponse.json(teams);
  } catch (error) {
    console.error("❌ Lỗi GET Team:", error);
    return NextResponse.json({ error: "Không thể tải danh sách Team" }, { status: 500 });
  }
}

// 2. TẠO TEAM MỚI (CHỈ ADMIN/BGD)
export async function POST(req: Request) {
  try {
    // 🚀 KIỂM TRA QUYỀN HẠN
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || !["ADMIN", "BAN_GIAM_DOC"].includes(userRole)) {
      return NextResponse.json({ error: "Bạn không có quyền tạo Team mới!" }, { status: 403 });
    }

    const { name, description, departmentId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Tên Team không được để trống" }, { status: 400 });
    }

    // 🚀 KIỂM TRA TRÙNG TÊN TRƯỚC KHI TẠO
    const existingTeam = await prisma.team.findUnique({ where: { name } });
    if (existingTeam) {
      return NextResponse.json({ error: "Tên Team này đã tồn tại trên hệ thống" }, { status: 400 });
    }

    const newTeam = await prisma.team.create({
      data: {
        name,
        description,
        // 🚀 Bổ sung thêm dòng này để Team biết nó thuộc Phòng nào
        departmentId: departmentId || null,
      }
    });

    return NextResponse.json(newTeam, { status: 201 });
  } catch (error) {
    console.error("❌ Lỗi POST Team:", error);
    return NextResponse.json({ error: "Lỗi Server khi tạo Team" }, { status: 500 });
  }
}