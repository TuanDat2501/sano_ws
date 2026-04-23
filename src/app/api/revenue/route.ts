import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 1. LẤY DANH SÁCH KÊNH & DOANH THU THEO KHOẢNG THỜI GIAN
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Lấy tất cả Kênh kèm theo doanh thu trong mốc thời gian
        const channels = await prisma.channel.findMany({
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
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// 2. LƯU HOẶC CẬP NHẬT DOANH THU (UPSERT)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { channelId, date, revenue, views } = await req.json();
        const parsedDate = new Date(date);

        const result = await prisma.dailyRevenue.upsert({
            where: { channelId_date: { channelId, date: parsedDate } },
            update: {
                // Chỉ cập nhật nếu giá trị được gửi lên là số
                ...(revenue !== undefined && { revenue: Number(revenue) }),
                ...(views !== undefined && { views: Number(views) }),
                updaterId: (session.user as any).id
            },
            create: {
                channelId,
                date: parsedDate,
                amount: Number(revenue || 0),
                views: Number(views || 0),
                updaterId: (session.user as any).id
            }
        });

        return NextResponse.json({ success: true, result });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}