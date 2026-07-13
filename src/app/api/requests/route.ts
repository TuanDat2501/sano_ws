import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        }

        const user = session.user as any;
        const userId = user.id;
        const userRole = user.role; // Lấy role của user
        const isLeader = userRole === "LEADER";

        const body = await req.json();
        const { type, teamId, contentData, firstApproverId, secondApproverId } = body;

        // Bóc tách dữ liệu
        const targetDate = contentData.date ? new Date(contentData.date) : null;
        const startDate = contentData.startDate ? new Date(contentData.startDate) : null;
        const endDate = contentData.endDate ? new Date(contentData.endDate) : null;
        const amount = contentData.amount ? Number(contentData.amount) : null;
        const itemName = contentData.itemName || null;
        const reason = contentData.reason || null;

        // 🚀 LOGIC XỬ LÝ NẾU LÀ LEADER
        let finalFirstApproverId = firstApproverId;
        let finalSecondApproverId = secondApproverId;
        let initialStatus = "PENDING_1";

        if (isLeader) {
            // Leader tạo: Tự động pass cấp 1 (gán mình là cấp 1), đẩy người duyệt lên cấp 2
            initialStatus = "PENDING_2";
            finalFirstApproverId = userId; // Leader tự là cấp 1 của chính mình
            // Người duyệt Leader chọn từ UI sẽ được gán vào cấp 2
            finalSecondApproverId = body.approverId; 
        }

        // Validate
        if (!type || !contentData || !teamId || (!isLeader && !finalFirstApproverId) || (isLeader && !finalSecondApproverId)) {
            return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
        }

        const newRequest = await prisma.request.create({
            data: {
                type,
                status: initialStatus as any, // Gán PENDING_1 hoặc PENDING_2
                requesterId: userId,
                teamId,
                firstApproverId: finalFirstApproverId,
                secondApproverId: finalSecondApproverId || null,
                startDate,
                endDate,
                targetDate,
                amount,
                itemName,
                reason,
                contentData
            }
        });

        // 🚀 TẠO THÔNG BÁO LINH HOẠT
        if (isLeader) {
            // Nếu là Leader, bắn thẳng thông báo cho cấp 2 (Admin/BGD) duyệt ngay
            await prisma.notification.create({
                data: {
                    title: "Đơn từ mới cần duyệt gấp (Từ Leader)",
                    message: `Leader vừa tạo một đề xuất ${type} và đang chờ bạn phê duyệt.`,
                    type: "info",
                    userId: finalSecondApproverId,
                    requestId: newRequest.id
                }
            });
        } else {
            // Nhân viên bình thường: Bắn cho cấp 1 trước
            await prisma.notification.create({
                data: {
                    title: "Đơn từ mới cần duyệt",
                    message: `Bạn vừa nhận được một đề xuất ${type} mới cần phê duyệt.`,
                    type: "info",
                    userId: finalFirstApproverId,
                    requestId: newRequest.id
                }
            });
            // Báo trước cho cấp 2 (nếu có)
            if (finalSecondApproverId) {
                await prisma.notification.create({
                    data: {
                        userId: finalSecondApproverId,
                        title: "Có đơn từ sắp tới lượt duyệt",
                        message: `Một đề xuất ${type} vừa được tạo. Sẽ tới lượt bạn sau khi Quản lý cấp 1 duyệt.`,
                        requestId: newRequest.id,
                        type: "info"
                    }
                });
            }
        }

        return NextResponse.json(newRequest, { status: 201 });
    } catch (error) {
        console.error("❌ Lỗi API Tạo đơn:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = session.user as any;
        const { searchParams } = new URL(req.url);

        const page = Number(searchParams.get("page")) || 1;
        const limit = Number(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        const tab = searchParams.get("tab") || "MY_REQUESTS";
        const searchKeyword = searchParams.get("search") || "";

        // 🚀 CẬP NHẬT PHÂN QUYỀN: Xác định rõ role nào được xem "Tất cả"
        const isAdminOrHR = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(user.role);

        let whereClause: any = {};

        // 🚀 LOGIC PHÂN TÁCH TAB
        if (tab === "NEED_APPROVAL") {
            // Chỉ lấy đơn đang đợi mình duyệt
            whereClause = {
                OR: [
                    { firstApproverId: user.id, status: "PENDING_1" },
                    { secondApproverId: user.id, status: "PENDING_2" }
                ]
            };
        } else if (tab === "ALL_REQUESTS") {
            // Chỉ Admin/BGD/HR mới được vào tab này
            if (!isAdminOrHR) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            // Không set thêm điều kiện gì (lấy tất cả)
            whereClause = {};
        } else {
            // Mặc định tab MY_REQUESTS: Chỉ lấy đơn của chính user đó
            whereClause = { requesterId: user.id };
        }

        // Đính kèm tìm kiếm nếu có
        if (searchKeyword.trim() !== "") {
            whereClause = {
                ...whereClause,
                id: { startsWith: searchKeyword.trim() }
            };
        }

        const [requests, totalCount] = await Promise.all([
            prisma.request.findMany({
                where: whereClause,
                include: {
                    requester: { select: { fullName: true } },
                    team: { select: { name: true } },
                    firstApprover: { select: { fullName: true } },
                    secondApprover: { select: { fullName: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip
            }),
            prisma.request.count({ where: whereClause })
        ]);

        return NextResponse.json({
            requests,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            currentPage: page
        });

    } catch (error) {
        console.error("❌ Lỗi API Requests:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}