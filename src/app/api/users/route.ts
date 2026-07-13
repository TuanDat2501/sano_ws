import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);

        const page = Number(searchParams.get("page")) || 1;
        const limit = Number(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        const searchKeyword = searchParams.get("search") || "";
        const teamFilter = searchParams.get("teamId") || "ALL";
        
        // 🚀 NHẬN THÊM PARAM BỘ LỌC TỪ FRONTEND
        const roleFilter = searchParams.get("role") || "ALL";
        const statusFilter = searchParams.get("status") || "ALL";

        let whereClause: any = {};

        // Lọc theo Team
        if (teamFilter === "NO_TEAM") {
            whereClause.teamId = null;
        } else if (teamFilter !== "ALL") {
            whereClause.teamId = teamFilter;
        }

        // 🚀 LỌC THEO VỊ TRÍ (ROLE)
        if (roleFilter !== "ALL") {
            whereClause.role = roleFilter;
        }

        // 🚀 LỌC THEO TRẠNG THÁI HOẠT ĐỘNG
        if (statusFilter === "ACTIVE") {
            whereClause.isActive = true;
        } else if (statusFilter === "INACTIVE") {
            whereClause.isActive = false;
        }

        // Lọc theo từ khóa tìm kiếm (Tên, Username, hoặc Mã nhân viên)
        if (searchKeyword.trim() !== "") {
            whereClause.OR = [
                { fullName: { contains: searchKeyword.trim() } },
                { username: { contains: searchKeyword.trim() } },
                { employeeCode: { contains: searchKeyword.trim() } } // Hỗ trợ HR tìm theo mã NV luôn
            ];
        }

        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where: whereClause,
                include: {
                    team: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip
            }),
            prisma.user.count({ where: whereClause })
        ]);

        return NextResponse.json({
            users,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            currentPage: page
        });

    } catch (error) {
        console.error("❌ Lỗi API Lấy danh sách User:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username, password, fullName, role, teamId } = body;

        const existingUser = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUser) {
            return NextResponse.json({ error: "Tên đăng nhập đã tồn tại!" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username,
                passwordHash: hashedPassword,
                fullName,
                role,
                teamId,
            }
        });

        return NextResponse.json({ message: "Tạo user thành công!", user: newUser }, { status: 201 });

    } catch (error) {
        console.error(">>> [API USERS ERROR]:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi tạo user" }, { status: 500 });
    }
}