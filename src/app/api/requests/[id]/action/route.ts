// /api/requests/[id]/action/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const requestId = resolvedParams.id;

        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        
        const userId = (session.user as any).id;

        const body = await req.json();
        const { action, comment } = body; 

        // Validate chặt chẽ: Từ chối thì bắt buộc phải có lý do (không được chỉ nhập khoảng trắng)
        if (!action || (action === 'REJECT' && (!comment || !comment.trim()))) {
            return NextResponse.json({ error: "Thiếu hành động hoặc lý do từ chối" }, { status: 400 });
        }

        const request = await prisma.request.findUnique({ 
            where: { id: requestId },
            select: { id: true, status: true, type: true, requesterId: true, firstApproverId: true, secondApproverId: true }
        });
        
        if (!request) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });

        let nextStatus = request.status;
        let actionLog = "";
        const notificationQueries = [];

        // Thông báo cho người làm đơn
        notificationQueries.push(
            prisma.notification.create({
                data: {
                    title: action === 'APPROVE' ? "Đơn đã được duyệt" : "Đơn bị từ chối",
                    message: action === 'APPROVE' 
                        ? `Đơn ${request.type} của bạn đã được phê duyệt.` 
                        : `Đơn của bạn đã bị từ chối với lý do: ${comment}`,
                    type: action === 'APPROVE' ? "success" : "error",
                    userId: request.requesterId,
                    requestId: request.id
                }
            })
        );
        
        if (action === "REJECT") {
            if (request.firstApproverId !== userId && request.secondApproverId !== userId) {
                return NextResponse.json({ error: "Bạn không có quyền từ chối đơn này" }, { status: 403 });
            }
            nextStatus = "REJECTED";
            actionLog = "REJECTED";
        } else if (action === "APPROVE") {
            if (request.status === "PENDING_1" && request.firstApproverId === userId) {
                nextStatus = request.secondApproverId ? "PENDING_2" : "APPROVED";
                actionLog = "APPROVED_LEVEL_1";

                if (request.secondApproverId) {
                    notificationQueries.push(
                        prisma.notification.create({
                            data: {
                                title: "Đơn từ mới chờ chốt hạ",
                                message: `Quản lý cấp 1 vừa duyệt một đề xuất ${request.type}, đang chờ bạn phê duyệt cuối cùng.`,
                                type: "info",
                                userId: request.secondApproverId,
                                requestId: request.id
                            }
                        })
                    );
                }
            } 
            else if (request.status === "PENDING_2" && request.secondApproverId === userId) {
                nextStatus = "APPROVED";
                actionLog = "APPROVED_LEVEL_2";
            } else {
                return NextResponse.json({ error: "Đơn không ở trạng thái chờ bạn duyệt" }, { status: 403 });
            }
        } else {
            return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
        }

        // 🚀 CẬP NHẬT DATABASE BẰNG TRANSACTION ĐỂ LƯU LỜI PHÊ VÀO BẢNG APPROVAL LOG
        await prisma.$transaction([
            prisma.request.update({
                where: { id: requestId },
                data: { status: nextStatus }
            }),
            prisma.approvalLog.create({
                data: {
                    action: actionLog as any,
                    comment: comment?.trim() || null, // 🚀 LƯU LỜI PHÊ VÀO ĐÂY
                    requestId: requestId,
                    approverId: userId
                }
            }),
            ...notificationQueries
        ]);
        // 🚀TODO (RT-01): Bắn trigger Pusher (WebSockets) ở đây để App/Web nảy chuông ngay lập tức!
        // VD: await pusher.trigger(`user-${request.requesterId}`, 'new-notification', { message: '...' });
        return NextResponse.json({ message: "Xử lý thành công", status: nextStatus });

    } catch (error) {
        console.error("❌ Lỗi API Action:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}