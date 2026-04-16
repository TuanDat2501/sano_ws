import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
// 🧠 HÀM PHỤ TRỢ: Tính Năm, Tháng và Tuần thứ mấy TRONG THÁNG (1, 2, 3, 4, 5)
function getYearMonthWeek(d: Date) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // JS đếm tháng từ 0-11 nên phải cộng 1

    // Tìm ngày mùng 1 của tháng này
    const firstDayOfMonth = new Date(year, d.getMonth(), 1);

    // Quy đổi offset để Thứ 2 là đầu tuần (T2: 0, T3: 1, ..., CN: 6)
    const firstDayOffset = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

    // Công thức tính số thứ tự tuần trong tháng
    const weekNumber = Math.ceil((d.getDate() + firstDayOffset) / 7);

    return { year, month, weekNumber };
}
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);

        // 1. Lấy thông số phân trang & bộ lọc
        const page = Number(searchParams.get("page")) || 1;
        const limit = Number(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        const searchKeyword = searchParams.get("search") || "";
        const teamFilter = searchParams.get("teamId") || "ALL";

        // 2. Xây dựng bộ lọc (Where Clause)
        let whereClause: any = {};

        // Lọc theo Team
        if (teamFilter === "NO_TEAM") {
            whereClause.teamId = null;
        } else if (teamFilter !== "ALL") {
            whereClause.teamId = teamFilter;
        }

        // Lọc theo từ khóa tìm kiếm (Tìm trong Tên hoặc Username)
        if (searchKeyword.trim() !== "") {
            whereClause.OR = [
                { fullName: { contains: searchKeyword.trim() } },
                { username: { contains: searchKeyword.trim() } }
            ];
        }

        // 3. Truy vấn song song (Lấy Data + Đếm tổng)
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
        // 1. Lấy dữ liệu từ Frontend gửi lên (từ form tạo user)
        const body = await req.json();
        const { username, password, fullName, role, teamId } = body;

        // 2. Kiểm tra xem user đã tồn tại chưa
        const existingUser = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "Tên đăng nhập đã tồn tại!" },
                { status: 400 } // Lỗi 400 Bad Request
            );
        }

        // 3. Băm mật khẩu (Bắt buộc dùng bcryptjs như lúc làm Auth)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Lưu vào Database
        const newUser = await prisma.user.create({
            data: {
                username,
                passwordHash: hashedPassword,
                fullName,
                role,
                teamId,
                // ... các trường khác tuỳ theo schema.prisma của sếp
            }
        });

        // 5. Trả về thành công
        return NextResponse.json(
            { message: "Tạo user thành công!", user: newUser },
            { status: 201 } // 201 Created
        );

    } catch (error) {
        console.error(">>> [API USERS ERROR]:", error);
        return NextResponse.json(
            { error: "Lỗi hệ thống khi tạo user" },
            { status: 500 }
        );
    }
}