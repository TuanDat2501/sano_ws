import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma"; 

export const dynamic = "force-dynamic";

// 1. LẤY DANH SÁCH PHÒNG BAN
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const departments = await prisma.department.findMany({
            include: {
                _count: {
                    select: { teams: true }
                }
            },
            orderBy: {
                name: "asc"
            }
        });

        return NextResponse.json(departments);
    } catch (error) {
        console.error("GET Departments Error:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi lấy danh sách Phòng ban" }, { status: 500 });
    }
}

// 2. TẠO DEPARTMENT MỚI
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const currentUser = session?.user as any;

    // 🚀 ĐÃ SỬA: Đọc quyền động từ biến permissions thay vì fix cứng Role
    const hasPermission = currentUser?.permissions?.includes("MENU_TEAMS") || currentUser?.role === "ADMIN";

    if (!currentUser || !hasPermission) {
      return NextResponse.json({ error: "Bạn không có quyền tạo Department mới!" }, { status: 403 });
    }

    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Tên Department không được để trống" }, { status: 400 });
    }

    // 🚀 KIỂM TRA TRÙNG TÊN TRƯỚC KHI TẠO
    const existingDepartment = await prisma.department.findUnique({ where: { name } });
    if (existingDepartment) {
      return NextResponse.json({ error: "Tên Department này đã tồn tại trên hệ thống" }, { status: 400 });
    }

    const newDepartment = await prisma.department.create({
      data: { 
        name, 
        description 
      },
    });

    return NextResponse.json(newDepartment, { status: 201 });
  } catch (error) {
    console.error("❌ Lỗi POST Department:", error);
    return NextResponse.json({ error: "Lỗi Server khi tạo Department" }, { status: 500 });
  }
}