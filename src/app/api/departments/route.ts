import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // 🚀 Dùng alias @/ cho sạch code sếp nhé
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


// 1. LẤY DANH SÁCH TEAM
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const departments = await prisma.department.findMany({
            // 🚀 SỬA Ở ĐÂY: Phòng ban thì đếm số Team trực thuộc nó
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

// 2. TẠO DEPARTMENT MỚI (CHỈ ADMIN/BGD)
export async function POST(req: Request) {
  try {
    // 🚀 KIỂM TRA QUYỀN HẠN
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || !["ADMIN", "BAN_GIAM_DOC"].includes(userRole)) {
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