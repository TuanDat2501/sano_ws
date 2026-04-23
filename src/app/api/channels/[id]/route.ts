import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const resolvedParams = await params;
        const channelId = resolvedParams.id;
        const { name, link, topic, teamId, avatarUrl, status, monetization, members } = body;

        // 🚀 CẬP NHẬT KÊNH VÀ LÀM MỚI DANH SÁCH NHÂN SỰ
        const updatedChannel = await prisma.channel.update({
            where: { id: channelId },
            data: {
                name, link, topic, teamId, avatarUrl, status, monetization,
                members: {
                    deleteMany: {}, // Xóa toàn bộ nhân sự cũ của kênh này
                    create: members?.map((m: any) => ({
                        userId: m.userId,
                        roleOnChannel: m.roleOnChannel
                    })) || [] // Nạp lại danh sách mới
                }
            }
        });

        return NextResponse.json({ success: true, channel: updatedChannel });
    } catch (error) {
        console.error("LỖI UPDATE CHANNEL:", error);
        return NextResponse.json({ error: "Lỗi cập nhật kênh" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const channelId = resolvedParams.id;
        // Bảng ChannelMember đã set onDelete: Cascade trong schema nên khi xóa kênh, nhân sự gán với kênh đó cũng tự động bay theo.
        await prisma.channel.delete({ where: { id: channelId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi xóa kênh" }, { status: 500 });
    }
}