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
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const currentUser = session.user as any;
        const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR", "LEADER"].includes(currentUser.role);

        if (!isManager) {
            return NextResponse.json(
                { error: "Forbidden: Chỉ cấp quản lý mới được lấy danh sách toàn bộ nhân sự!" },
                { status: 403 }
            );
        }
        const now = new Date();

        // 1. Tính toán mốc thời gian (Thứ 2 - Chủ Nhật) ĐỂ ĐẾM SỐ TASK THỰC TẾ
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + distanceToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const currentWeekCondition = { gte: startOfWeek, lte: endOfWeek };

        // 🚀 2. GỌI HÀM LẤY YEAR, MONTH, WEEK CHUẨN XÁC VỚI DB
        const { year: currentYear, month: currentMonth, weekNumber: currentWeek } = getYearMonthWeek(now);

        // 3. Lấy Data từ Database
        const users = await prisma.user.findMany({
            include: {
                team: true,
                _count: {
                    select: {
                        // Đếm task thì vẫn dùng mốc thời gian khoảng ngày (start -> end)
                        tasksContent: { where: { createdAt: currentWeekCondition } },
                        tasksEdited: { where: { createdAt: currentWeekCondition } },
                        tasksPub: { where: { createdAt: currentWeekCondition } },
                        assignedTasks: { where: { createdAt: currentWeekCondition } },
                    }
                },
                weeklyKPIs: {
                    // 🚀 SỬA LẠI ĐIỀU KIỆN TÌM KIẾM ĐÚNG 3 CỘT TRONG BẢNG CỦA SẾP
                    where: {
                        year: currentYear,
                        month: currentMonth,
                        weekNumber: currentWeek
                    },
                    take: 1
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // 4. Xử lý dữ liệu trả về
        const processedUsers = users.map(user => {
            const actual =
                (user._count?.tasksContent || 0) +
                (user._count?.tasksEdited || 0) +
                (user._count?.tasksPub || 0) +
                (user._count?.assignedTasks || 0);

            // Lấy TargetValue từ cục WeeklyKPI
            const kpiRecord = user.weeklyKPIs?.[0];
            const target = kpiRecord ? kpiRecord.targetValue : 0;

            return {
                ...user,
                currentWeekStats: {
                    actual: actual,
                    target: target
                }
            };
        });

        return NextResponse.json(processedUsers);
    } catch (error) {
        console.error("GET Users Error:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
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