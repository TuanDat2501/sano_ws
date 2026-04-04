import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const body = await req.json();
        
        // 🚀 ĐÃ HỨNG THÊM TEAM ID TỪ FRONTEND
        const { type, teamId, contentData, firstApproverId, secondApproverId } = body;

        // 1. Lớp phòng thủ chặt chẽ hơn
        if (!type || !contentData || !firstApproverId || !teamId) {
            return NextResponse.json({ error: "Thiếu thông tin bắt buộc (Loại đơn, Team, Nội dung, Sếp duyệt)" }, { status: 400 });
        }

        // 2. Tạo Đơn mới trong Database
        const newRequest = await prisma.request.create({
            data: {
                type: type,
                status: "PENDING_1", 
                contentData: contentData, 
                requesterId: userId,
                // 🚀 LƯU THẲNG TEAM ID VÀO DATABASE
                teamId: teamId, 
                firstApproverId: firstApproverId,
                secondApproverId: secondApproverId || null,
            }
        });
        await prisma.notification.create({
            data: {
                title: "Đơn từ mới cần duyệt",
                message: `Bạn vừa nhận được một đề xuất ${type} mới cần phê duyệt.`,
                type: "info", // Có thể dùng info, success, warning theo db của sếp
                userId: firstApproverId, // Gửi đích danh cho sếp cấp 1
                requestId: newRequest.id
            }
        });
        // 3. (Tùy chọn) Ghi luôn 1 dòng Log lịch sử
        await prisma.approvalLog.create({
            data: {
                action: "APPROVED_LEVEL_1", 
                comment: "Đã tạo đơn và gửi phê duyệt",
                requestId: newRequest.id,
                approverId: userId
            }
        });

        return NextResponse.json(newRequest, { status: 201 });

    } catch (error) {
        console.error("❌ Lỗi API Tạo đơn:", error);
        return NextResponse.json({ error: "Lỗi Server không thể tạo đơn" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const { searchParams } = new URL(req.url);
        
        // 🚀 LẤY PARAM TAB TỪ FRONTEND ĐỂ BIẾT CẦN LỌC ĐƠN GÌ
        const tab = searchParams.get("tab") || "MY_REQUESTS";

        let whereClause = {};

        if (tab === "MY_REQUESTS") {
            // Lấy các đơn do chính mình tạo
            whereClause = { requesterId: userId };
        } else if (tab === "NEED_APPROVAL") {
            // Lấy các đơn đang chờ mình duyệt (Đúng cấp, đúng trạng thái)
            whereClause = {
                OR: [
                    { firstApproverId: userId, status: "PENDING_1" },
                    { secondApproverId: userId, status: "PENDING_2" }
                ]
            };
        }

        const requests = await prisma.request.findMany({
            where: whereClause,
            include: {
                requester: { select: { fullName: true } },
                team: { select: { name: true } },
                firstApprover: { select: { fullName: true } },
                secondApprover: { select: { fullName: true } }
            },
            orderBy: { createdAt: 'desc' } // Đơn mới nhất lên đầu
        });

        return NextResponse.json(requests);

    } catch (error) {
        console.error("❌ Lỗi API Lấy danh sách đơn:", error);
        return NextResponse.json({ error: "Lỗi Server không thể lấy dữ liệu" }, { status: 500 });
    }
}