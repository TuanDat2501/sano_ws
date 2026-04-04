import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";


export async function POST(req: Request,context: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await context.params;
        const requestId = resolvedParams.id;

        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        
        const userId = (session.user as any).id;

        const body = await req.json();
        const { action, comment } = body; // action: 'APPROVE' hoặc 'REJECT'

        if (!action || (action === 'REJECT' && !comment)) {
            return NextResponse.json({ error: "Thiếu hành động hoặc lý do từ chối" }, { status: 400 });
        }

        // 1. Lấy thông tin đơn ra kiểm tra
        const request = await prisma.request.findUnique({ where: { id: requestId } });
        if (!request) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });

        // 2. Xác định quyền duyệt và Trạng thái tiếp theo
        let nextStatus = request.status;
        let actionLog = "";
        const notificationQueries = [];

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
        if (action === 'APPROVE' && request.status === "PENDING_1" && request.secondApproverId) {
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

        if (action === "REJECT") {
            // Nếu ai đó chê, đơn chết luôn tại chỗ
            if (request.firstApproverId !== userId && request.secondApproverId !== userId) {
                return NextResponse.json({ error: "Bạn không có quyền từ chối đơn này" }, { status: 403 });
            }
            nextStatus = "REJECTED";
            actionLog = "REJECTED";
        } else if (action === "APPROVE") {
            // Đang chờ Cấp 1, và người bấm là Cấp 1
            if (request.status === "PENDING_1" && request.firstApproverId === userId) {
                nextStatus = request.secondApproverId ? "PENDING_2" : "APPROVED";
                actionLog = "APPROVED_LEVEL_1";
            } 
            // Đang chờ Cấp 2, và người bấm là Cấp 2
            else if (request.status === "PENDING_2" && request.secondApproverId === userId) {
                nextStatus = "APPROVED";
                actionLog = "APPROVED_LEVEL_2";
            } else {
                return NextResponse.json({ error: "Đơn không ở trạng thái chờ bạn duyệt" }, { status: 403 });
            }
        }

        // 3. Cập nhật Database (Dùng Transaction để đảm bảo tính toàn vẹn)
        await prisma.$transaction([
            prisma.request.update({
                where: { id: requestId },
                data: { status: nextStatus }
            }),
            prisma.approvalLog.create({
                data: {
                    action: actionLog as any,
                    comment: comment || "",
                    requestId: requestId,
                    approverId: userId
                }
            }),
            // 🚀 BUNG TOÀN BỘ QUERRY THÔNG BÁO VÀO ĐÂY
            ...notificationQueries
        ]);

        return NextResponse.json({ message: "Xử lý thành công", status: nextStatus });

    } catch (error) {
        console.error("❌ Lỗi API Action:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}