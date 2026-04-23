import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        
        // 🚀 API TIỆN ÍCH LẤY DATA CHO DROPDOWN
        if (searchParams.get('action') === 'get_options') {
            const teams = await prisma.team.findMany({ select: { id: true, name: true } });
            // Lấy danh sách user (có mang theo teamId để UI lọc)
            const users = await prisma.user.findMany({
                where: { isActive: true },
                select: { id: true, fullName: true, username: true, avatarUrl: true, teamId: true }
            });
            return NextResponse.json({ teams, users });
        }

        // LẤY DANH SÁCH KÊNH
        const channels = await prisma.channel.findMany({
            include: {
                team: { select: { name: true } },
                members: true // 🚀 Bắt buộc include members để UI render số lượng nhân sự
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(channels);
    } catch (error) {
        console.error("LỖI FETCH CHANNELS:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { name, link, topic, teamId, avatarUrl, status, monetization, members } = body;

        // 🚀 TẠO KÊNH VÀ GÁN NHÂN SỰ CÙNG LÚC (Nested Create)
        const newChannel = await prisma.channel.create({
            data: {
                name, link, topic, teamId, avatarUrl, status, monetization,
                members: {
                    create: members?.map((m: any) => ({
                        userId: m.userId,
                        roleOnChannel: m.roleOnChannel
                    })) || []
                }
            }
        });

        return NextResponse.json({ success: true, channel: newChannel });
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: "Tên kênh đã tồn tại!" }, { status: 400 });
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}