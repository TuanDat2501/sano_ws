import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const user = session.user as any;
        // Check quyền (Bảo mật backend)
        if (!["ADMIN", "BAN_GIAM_DOC", "LEADER", "QLK"].includes(user.role)) {
             return NextResponse.json({ error: "Không có quyền chấm điểm!" }, { status: 403 });
        }

        const body = await req.json();
        const resolvedParams = await params;
        const { score, criteriaData, note } = body;

        const isPass = score >= 7;
        // 🚀 LOGIC TRẠNG THÁI: Pass thì sang DONE (hoặc READY), Fail thì lùi về DOING
        const newStatus = isPass ? "DONE" : "DOING"; 

        // 1. Dùng Transaction để thực thi 3 lệnh đồng thời, nếu 1 cái lỗi là hủy cả 3 (An toàn dữ liệu)
        const [evaluation, updatedTask, systemComment] = await prisma.$transaction([
            // Lệnh 1: Lưu phiếu chấm điểm
            prisma.evaluation.create({
                data: {
                    taskId: resolvedParams.id,
                    score: score,
                    criteria: criteriaData,
                    kaizenNote: note,
                    evaluatorId: user.id
                }
            }),
            // Lệnh 2: Cập nhật trạng thái Task
            prisma.task.update({
                where: { id: resolvedParams.id },
                data: { status: newStatus }
            }),
            // Lệnh 3: Tạo một tin nhắn hệ thống ghim vào Chat của Task
            prisma.taskComment.create({
                data: {
                    taskId: resolvedParams.id,
                    userId: user.id, // Dùng ID người chấm
                    text: isPass 
                          ? `✅ [SYSTEM] Video đã được duyệt với số điểm ${score}/10. Tuyệt vời!`
                          : `⚠️ [KAIZEN YÊU CẦU] Video chưa đạt (${score}/10). Lỗi: ${note}`
                }
            })
        ]);

        return NextResponse.json({ 
            success: true, 
            evaluation, 
            updatedTask, 
            systemComment 
        });

    } catch (error) {
        console.error("LỖI CHẤM ĐIỂM:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}