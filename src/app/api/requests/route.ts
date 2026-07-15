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
        const userRole = user.role; 
        const isLeader = userRole === "LEADER";

        const body = await req.json();
        
        // 🚀 Bóc tách dữ liệu y hệt như payload frontend gửi lên
        const { type, teamId, contentData, firstApproverId, secondApproverId, status } = body;

        // Xử lý dữ liệu contentData
        const targetDate = contentData.date ? new Date(contentData.date) : null;
        const startDate = contentData.startDate ? new Date(contentData.startDate) : null;
        const endDate = contentData.endDate ? new Date(contentData.endDate) : null;
        const amount = contentData.amount ? Number(contentData.amount) : null;
        const itemName = contentData.itemName || null;
        const reason = contentData.reason || null;

        // 🚀 VALIDATE DỮ LIỆU CHẶT CHẼ THEO PHÂN QUYỀN
        if (!type || !contentData || !teamId) {
            return NextResponse.json({ error: "Thiếu thông tin cơ bản của đơn" }, { status: 400 });
        }

        if (isLeader) {
            // Leader tạo thì bắt buộc phải có người duyệt cấp 2 (Giám đốc / Admin)
            if (!secondApproverId) {
                return NextResponse.json({ error: "Vui lòng chọn người duyệt (Ban Giám Đốc)" }, { status: 400 });
            }
        } else {
            // Nhân viên tạo thì bắt buộc phải có quản lý cấp 1
            if (!firstApproverId) {
                return NextResponse.json({ error: "Vui lòng chọn Quản lý Cấp 1 để duyệt đơn" }, { status: 400 });
            }
        }

        // 🚀 TẠO ĐƠN TRONG DATABASE
        const newRequest = await prisma.request.create({
            data: {
                type,
                // Lấy status từ FE gửi (PENDING_2 cho leader, PENDING_1 cho NV), nếu rỗng thì fallback
                status: status || (isLeader ? "PENDING_2" : "PENDING_1"), 
                requesterId: userId,
                teamId,
                firstApproverId: firstApproverId,
                secondApproverId: secondApproverId || null,
                startDate,
                endDate,
                targetDate,
                amount,
                itemName,
                reason,
                contentData
            }
        });

        // 🚀 TẠO THÔNG BÁO CHO NGƯỜI DUYỆT
        if (isLeader || status === "PENDING_2") {
            // Đơn của Leader đẩy thẳng thông báo cho cấp 2 (Vì cấp 1 là chính họ rồi)
            await prisma.notification.create({
                data: {
                    title: "Đơn từ mới cần duyệt gấp (Từ Leader)",
                    message: `Leader vừa tạo một đề xuất ${type} và đang chờ bạn phê duyệt.`,
                    type: "info",
                    userId: secondApproverId,
                    requestId: newRequest.id
                }
            });
        } else {
            // Đơn của nhân viên đẩy cho cấp 1
            await prisma.notification.create({
                data: {
                    title: "Đơn từ mới cần duyệt",
                    message: `Bạn vừa nhận được một đề xuất ${type} mới cần phê duyệt.`,
                    type: "info",
                    userId: firstApproverId,
                    requestId: newRequest.id
                }
            });
            
            // Nếu nhân viên có chọn cấp 2 thì báo trước cho cấp 2 biết để chuẩn bị tinh thần
            if (secondApproverId) {
                await prisma.notification.create({
                    data: {
                        userId: secondApproverId,
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

        const isAdminOrHR = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(user.role);

        let whereClause: any = {};

        if (tab === "NEED_APPROVAL") {
            whereClause = {
                OR: [
                    { firstApproverId: user.id, status: "PENDING_1" },
                    { secondApproverId: user.id, status: "PENDING_2" }
                ]
            };
        } else if (tab === "ALL_REQUESTS") {
            if (!isAdminOrHR) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            whereClause = {};
        } else {
            whereClause = { requesterId: user.id };
        }

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