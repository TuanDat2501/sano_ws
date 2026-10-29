import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || "0");
        const month = parseInt(searchParams.get("month") || "0");
        const week = parseInt(searchParams.get("week") || "0");
        const teamId = searchParams.get("teamId") || "ALL";

        if (!year || !month || !week) return NextResponse.json({ error: "Thiếu tham số thời gian" }, { status: 400 });

        // 🚀 CHỈ LẤY KÊNH CÒN HOẠT ĐỘNG
        const channelWhere: any = {
            status: { notIn: ["BAY_KENH", "DUNG_HOAT_DONG"] }
        };
        if (teamId !== "ALL") channelWhere.teamId = teamId;

        const [channels, surpluses] = await Promise.all([
            prisma.channel.findMany({
                where: channelWhere,
                include: { team: { select: { name: true } } },
                orderBy: { name: 'asc' }
            }),
            prisma.weeklyChannelSurplus.findMany({
                where: { year, month, weekNumber: week }
            })
        ]);

        const mappedData = channels.map(channel => {
            const surplusRecord = surpluses.find(s => s.channelId === channel.id);
            let details: any[] = [];
            
            if (surplusRecord && surplusRecord.surplusData) {
                try {
                    const parsed = typeof surplusRecord.surplusData === 'string' ? JSON.parse(surplusRecord.surplusData) : surplusRecord.surplusData;
                    if (Array.isArray(parsed)) {
                        details = parsed.map((p, idx) => ({
                            rowId: `saved_${channel.id}_${idx}`,
                            jobCategory: p.jobCategory || "CONTENT",
                            duration: p.duration || 10,
                            count: p.count || 1
                        }));
                    }
                } catch (e) {}
            }

            return {
                channelId: channel.id,
                channelName: channel.name,
                channelAvatar: channel.avatarUrl,
                teamName: channel.team?.name || "Chưa phân team",
                details
            };
        });

        return NextResponse.json({ data: mappedData }, { status: 200 });

    } catch (error) {
        console.error("LỖI API LẤY BÀI DƯ KÊNH:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { year, month, week, surplusData } = body; 
        // surplusData dạng: [{ channelId, details: [...] }]

        if (!year || !month || !week || !surplusData) {
            return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
        }

        // Dùng transaction để Upsert nhiều kênh cùng lúc
        const upsertPromises = surplusData.map((item: any) => {
            return prisma.weeklyChannelSurplus.upsert({
                where: {
                    channel_surplus_time_unique: {
                        channelId: item.channelId,
                        year,
                        month,
                        weekNumber: week
                    }
                },
                update: {
                    surplusData: item.details
                },
                create: {
                    channelId: item.channelId,
                    year,
                    month,
                    weekNumber: week,
                    surplusData: item.details
                }
            });
        });

        await prisma.$transaction(upsertPromises);

        return NextResponse.json({ message: "Lưu thành công" }, { status: 200 });
    } catch (error) {
        console.error("LỖI API LƯU BÀI DƯ KÊNH:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}