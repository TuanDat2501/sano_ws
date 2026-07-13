import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// [GET] - LẤY CHI TIẾT ĐỀ XUẤT
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 Await toàn bộ params trước rồi mới lấy id
        const resolvedParams = await params;
        const requestId = resolvedParams.id;

        if (!requestId) return NextResponse.json({ error: "Thiếu ID đề xuất" }, { status: 400 });

        const requestDetail = await prisma.request.findUnique({
            where: { id: requestId },
            include: {
                requester: { select: { fullName: true } },
                team: { select: { name: true } },
                firstApprover: { select: { fullName: true } },
                secondApprover: { select: { fullName: true } },
                // 🚀 BỔ SUNG: Kéo thêm bảng logs để lấy lịch sử duyệt và lời phê
                logs: {
                    include: { approver: { select: { fullName: true, role: true } } },
                    orderBy: { createdAt: 'asc' } // Sắp xếp theo thời gian duyệt
                }
            }
        });

        if (!requestDetail) {
            return NextResponse.json({ error: "Không tìm thấy đề xuất" }, { status: 404 });
        }

        return NextResponse.json(requestDetail);
    } catch (error) {
        console.error("LỖI LẤY CHI TIẾT ĐƠN TỪ:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// 🚀 [PATCH] - HỦY (XÓA) ĐỀ XUẤT CHO NGƯỜI TẠO (GIỮ NGUYÊN)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const requestId = resolvedParams.id;

        if (!requestId) return NextResponse.json({ error: "Thiếu ID đề xuất" }, { status: 400 });

        // 1. Lấy thông tin đơn ra để check quyền
        const existingRequest = await prisma.request.findUnique({
            where: { id: requestId },
            select: { requesterId: true, status: true }
        });

        if (!existingRequest) return NextResponse.json({ error: "Không tìm thấy đề xuất" }, { status: 404 });

        // 2. Kiểm tra xem có phải chính chủ tạo đơn không
        if (existingRequest.requesterId !== currentUser.id) {
            return NextResponse.json({ error: "Bạn không có quyền hủy đề xuất của người khác" }, { status: 403 });
        }

        // 3. Chỉ cho phép hủy khi đơn vẫn đang ở trạng thái chờ duyệt (PENDING)
        if (!["PENDING_1", "PENDING_2"].includes(existingRequest.status)) {
            return NextResponse.json({ error: "Không thể hủy! Đơn này đã được xử lý hoặc đã hủy từ trước." }, { status: 400 });
        }

        // 4. Cập nhật trạng thái thành CANCELLED thay vì xóa bản ghi
        const updatedRequest = await prisma.request.update({
            where: { id: requestId },
            data: { status: "CANCELLED" }
        });

        return NextResponse.json({ message: "Đã hủy đề xuất thành công", data: updatedRequest }, { status: 200 });

    } catch (error) {
        console.error("LỖI HỦY ĐƠN TỪ:", error);
        return NextResponse.json({ error: "Lỗi Server khi hủy đề xuất" }, { status: 500 });
    }
}