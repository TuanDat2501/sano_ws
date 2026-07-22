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
                // 🚀 Lấy kèm danh sách thành viên để hiển thị lên form sửa
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

        const body = await req.json();
        const resolvedParams = await params;
        const channelId = resolvedParams.id;
        
        // 🚀 MỚI: Bổ sung trường category vào payload destructuring
        const { name, link, topic, teamId, avatarUrl, status, monetization, category, members } = body;

        // 🚀 CẬP NHẬT KÊNH VÀ LÀM MỚI DANH SÁCH NHÂN SỰ
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
                category, // 🚀 MỚI: Truyền category xuống Database để cập nhật
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

// ==============================================================
// 3. XÓA KÊNH (DELETE)
// ==============================================================
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const channelId = resolvedParams.id;

        // 🚀 BƯỚC 1: Xóa sạch dữ liệu doanh thu (DailyRevenue) gắn với kênh này
        await prisma.dailyRevenue.deleteMany({
            where: { channelId: channelId }
        });

        // 🚀 BƯỚC 2: Ngắt liên kết kênh ra khỏi các Dự án (Project)
        // Set channelId về null để giữ lại Project, chỉ tháo Kênh ra thôi
        await prisma.project.updateMany({
            where: { channelId: channelId },
            data: { channelId: null }
        });

        // 🚀 BƯỚC 3: Xóa kênh (Bảng ChannelMember đã set Cascade nên sẽ tự động bay theo)
        await prisma.channel.delete({ 
            where: { id: channelId } 
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("LỖI XÓA KÊNH:", error); // In ra log để sếp dễ bắt bệnh nếu có lỗi khác
        return NextResponse.json({ error: "Lỗi xóa kênh" }, { status: 500 });
    }
}