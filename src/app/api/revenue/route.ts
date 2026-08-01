import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 1. LẤY DANH SÁCH KÊNH & DOANH THU THEO KHOẢNG THỜI GIAN
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = session.user as any;
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let whereClause: any = {};

        // 🚀 ĐÃ SỬA: Dùng quyền MENU_TEAMS (hoặc BGD, Kế Toán, Admin) để xem toàn bộ hệ thống
        const canViewAll = user.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(user.role);

        if (!canViewAll) {
            // Nếu không được xem tất cả, chỉ cho xem kênh thuộc Team của mình
            if (user.teamId) {
                whereClause = { teamId: user.teamId };
            } else {
                // Nếu không có team, chỉ cho xem kênh mình là manager
                whereClause = { managerId: user.id };
            }
        }
        
        const channels = await prisma.channel.findMany({
            where: whereClause,
            include: {
                revenues: {
                    where: {
                        date: {
                            gte: startDate ? new Date(startDate) : undefined,
                            lte: endDate ? new Date(endDate) : undefined,
                        }
                    }
                },
                team: { select: { name: true } }
            },
            orderBy: { teamId: 'asc' }
        });

        return NextResponse.json(channels);
    } catch (error) {
        console.error("LỖI GET REVENUE:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// 2. LƯU HOẶC CẬP NHẬT DOANH THU (UPSERT)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = session.user as any;

        // 🚀 BỔ SUNG: Phân quyền chặt chẽ cho thao tác Sửa/Nhập Doanh thu
        const hasPermission = user.permissions?.includes("MENU_REVENUE") || user.role === "ADMIN";
        if (!hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền nhập dữ liệu doanh thu!" }, { status: 403 });
        }

        const { channelId, date, revenue, views } = await req.json();
        const parsedDate = new Date(date);

        const result = await prisma.dailyRevenue.upsert({
            where: { channelId_date: { channelId, date: parsedDate } },
            update: {
                ...(revenue !== undefined && { amount: Number(revenue) }),
                ...(views !== undefined && { views: Number(views) }),
                updaterId: user.id
            },
            create: {
                channelId,
                date: parsedDate,
                amount: Number(revenue || 0),
                views: Number(views || 0),
                updaterId: user.id
            }
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("LỖI POST REVENUE:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}