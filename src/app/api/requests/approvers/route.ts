import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
    }
    const approvers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          // 1. CHỈ lấy Leader của Team đang được chọn
          { 
            teamId: teamId,
            role: "LEADER" 
          }, 
          // 2. VÀ lấy thêm Ban Giám Đốc (Quyền tối cao)
          { 
            role: "BAN_GIAM_DOC" 
          },
          // 🚀 3. VÀ lấy toàn bộ thành viên của phòng Hành chính - Nhân sự
          {
            team: {
              name: {
                contains: "Nhân sự", // Sếp nhớ đổi chữ này cho khớp với tên Team trong DB (VD: "HR", "Hành chính")
              }
            }
          }
        ]
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        teamId: true,
        // Lấy thêm tên Team để Frontend hiển thị cho rõ ràng
        team: {
          select: { name: true }
        }
      },
      orderBy: { role: "asc" }, 
    });

    return NextResponse.json(approvers);
  } catch (error) {
    console.error("❌ Lỗi API lấy người duyệt:", error);
    return NextResponse.json({ error: "Lỗi tải danh sách người phê duyệt" }, { status: 500 });
  }
}