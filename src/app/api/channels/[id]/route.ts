import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ==============================================================
// 1. LẤY CHI TIẾT KÊNH (GET)
// ==============================================================
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const channelId = resolvedParams.id;

        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            include: {
                members: true,
                team: { select: { name: true } }
            }
        });

        if (!channel) {
            return NextResponse.json({ error: "Không tìm thấy kênh" }, { status: 404 });
        }

        return NextResponse.json(channel);
    } catch (error) {
        console.error("LỖI LẤY THÔNG TIN KÊNH:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}

// ==============================================================
// 2. CẬP NHẬT KÊNH (PUT)
// ==============================================================
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 BỔ SUNG: Kiểm tra quyền động từ mảng permissions
        const currentUser = session.user as any;
        const hasPermission = currentUser.permissions?.includes("MENU_CHANNELS") || currentUser.role === "ADMIN";

        if (!hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền sửa Kênh!" }, { status: 403 });
        }

        const body = await req.json();
        const resolvedParams = await params;
        const channelId = resolvedParams.id;
        
        const { name, link, topic, teamId, avatarUrl, status, monetization, category, members } = body;

        const updatedChannel = await prisma.channel.update({
            where: { id: channelId },
            data: {
                name, 
                link, 
                topic, 
                teamId, 
                avatarUrl, 
                status, 
                monetization,
                category,
                members: {
                    deleteMany: {}, 
                    create: members?.map((m: any) => ({
                        userId: m.userId,
                        roleOnChannel: m.roleOnChannel
                    })) || [] 
                }
            }
        });

        return NextResponse.json({ success: true, channel: updatedChannel });
    } catch (error) {
        console.error("LỖI UPDATE CHANNEL:", error);
        return NextResponse.json({ error: "Lỗi cập nhật kênh" }, { status: 500 });
    }
}

// ==============================================================
// 3. XÓA KÊNH (DELETE)
// ==============================================================
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 BỔ SUNG: Kiểm tra quyền động từ mảng permissions
        const currentUser = session.user as any;
        const hasPermission = currentUser.permissions?.includes("MENU_CHANNELS") || currentUser.role === "ADMIN";

        if (!hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền xóa Kênh!" }, { status: 403 });
        }

        const resolvedParams = await params;
        const channelId = resolvedParams.id;

        await prisma.dailyRevenue.deleteMany({
            where: { channelId: channelId }
        });

        await prisma.project.updateMany({
            where: { channelId: channelId },
            data: { channelId: null }
        });

        await prisma.channel.delete({ 
            where: { id: channelId } 
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("LỖI XÓA KÊNH:", error); 
        return NextResponse.json({ error: "Lỗi xóa kênh" }, { status: 500 });
    }
}