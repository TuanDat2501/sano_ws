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

        // Lấy Tháng/Năm hiện tại để fetch đúng Mục tiêu
        const startObj = startDate ? new Date(startDate) : new Date();
        const year = startObj.getFullYear();
        const month = startObj.getMonth() + 1;

        let whereClause: any = {
            status: { not: "DUNG_HOAT_DONG" } // 🚀 LỌC: Bỏ qua kênh đã dừng hoạt động
        };

        const canViewAll = user.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(user.role);

        if (!canViewAll) {
            if (user.teamId) {
                whereClause.teamId = user.teamId;
            } else {
                whereClause.managerId = user.id;
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
                revenueTargets: {
                    where: { year, month } // 🚀 BỔ SUNG: Kéo kèm mục tiêu của tháng
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

// 2. LƯU HOẶC CẬP NHẬT DOANH THU HẰNG NGÀY (UPSERT)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = session.user as any;
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

// 3. LƯU MỤC TIÊU THÁNG (PUT)
export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = session.user as any;
        const hasPermission = user.permissions?.includes("MENU_REVENUE") || user.role === "ADMIN";
        if (!hasPermission) return NextResponse.json({ error: "Bạn không có quyền!" }, { status: 403 });

        const { channelId, year, month, target } = await req.json();

        const result = await prisma.channelRevenueTarget.upsert({
            where: { channelId_year_month: { channelId, year, month } },
            update: { target: Number(target) },
            create: { channelId, year, month, target: Number(target) }
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("LỖI PUT REVENUE TARGET:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}