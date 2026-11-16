import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;
        
        if (!currentUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Await params để lấy ID trong Next.js 15+
        const resolvedParams = await params;
        const requestId = resolvedParams.id;
        const { action, comment } = await req.json();

        if (!requestId || !action) {
            return NextResponse.json({ error: "Thiếu dữ liệu bắt buộc" }, { status: 400 });
        }

        // 1. Lấy thông tin đơn hiện tại
        const existingRequest = await prisma.request.findUnique({
            where: { id: requestId }
        });

        if (!existingRequest) {
            return NextResponse.json({ error: "Không tìm thấy đề xuất" }, { status: 404 });
        }

        // 2. Xác định quyền của người đang thao tác
        const isFirstApprover = existingRequest.firstApproverId === currentUser.id;
        const isSecondApprover = existingRequest.secondApproverId === currentUser.id;
        const isLeader = currentUser.role === "LEADER" && currentUser.isTeamLeader === true;
        const isManagerOrHR = ["ADMIN", "HR", "BAN_GIAM_DOC"].includes(currentUser.role) || currentUser.permissions?.includes("ACTION_MANAGE_REQUESTS") || isLeader;

        let newStatus = existingRequest.status;
        let logAction = "";

        // ==========================================
        // 3. XỬ LÝ THEO TỪNG HÀNH ĐỘNG (ACTION)
        // ==========================================
        if (action === "APPROVE") {
            if (existingRequest.status === "PENDING_1" && isFirstApprover) {
                // Nếu duyệt Cấp 1, kiểm tra xem có Cấp 2 không. Có thì chuyển PENDING_2, không thì chốt APPROVED
                newStatus = existingRequest.secondApproverId ? "PENDING_2" : "APPROVED";
                logAction = "APPROVED_LEVEL_1";
            } else if (existingRequest.status === "PENDING_2" && isSecondApprover) {
                // Nếu duyệt Cấp 2 thì chốt luôn APPROVED
                newStatus = "APPROVED";
                logAction = "APPROVED_LEVEL_2";
            } else {
                return NextResponse.json({ error: "Bạn không có quyền duyệt đề xuất này ở bước hiện tại" }, { status: 403 });
            }
        } 
        
        else if (action === "REJECT") {
            if (!comment || comment.trim() === "") {
                return NextResponse.json({ error: "Vui lòng nhập lý do từ chối" }, { status: 400 });
            }

            if ((existingRequest.status === "PENDING_1" && isFirstApprover) || 
                (existingRequest.status === "PENDING_2" && isSecondApprover)) {
                newStatus = "REJECTED";
                logAction = "REJECTED";
            } else {
                return NextResponse.json({ error: "Bạn không có quyền từ chối đề xuất này" }, { status: 403 });
            }
        } 
        
        // 🚀 LUỒNG MỚI: ADMIN HOẶC HR HỦY ĐƠN VÌ LÝ DO BẤT KỲ
        else if (action === "ADMIN_CANCEL") {
            if (!isManagerOrHR) {
                return NextResponse.json({ error: "Bạn không có quyền Hủy đơn của người khác" }, { status: 403 });
            }
            if (!comment || comment.trim() === "") {
                return NextResponse.json({ error: "Vui lòng nhập lý do hủy đơn!" }, { status: 400 });
            }

            newStatus = "CANCELLED";
            logAction = "CANCELLED";
        } 
        
        else {
            return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
        }

        // ==========================================
        // 4. LƯU VÀO DATABASE THÔNG QUA TRANSACTION
        // ==========================================
        const updatedRequest = await prisma.$transaction(async (tx) => {
            // Cập nhật trạng thái đơn
            const reqUpdate = await tx.request.update({
                where: { id: requestId },
                data: { status: newStatus }
            });

            // 🚀 BẮT LỖI TẠI ĐÂY: Phải là tx.approvalLog.create (vì trong schema của sếp tên model là ApprovalLog chứ KHÔNG PHẢI RequestLog)
            // Sếp nhìn lại đoạn schema sếp gửi xem: model ApprovalLog { ... }
            await tx.approvalLog.create({
                data: {
                    requestId,
                    approverId: currentUser.id,
                    action: logAction as any,
                    comment: comment?.trim() || null,
                }
            });

            return reqUpdate;
        });

        return NextResponse.json({ message: "Xử lý thành công", data: updatedRequest }, { status: 200 });

    } catch (error) {
        console.error("LỖI XỬ LÝ ACTION ĐƠN TỪ:", error);
        return NextResponse.json({ error: "Lỗi Server khi xử lý đề xuất" }, { status: 500 });
    }
}