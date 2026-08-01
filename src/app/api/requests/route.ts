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
        
        // 🚀 ĐÃ SỬA: Dùng quyền duyệt đơn (ACTION_APPROVE_REQUEST) hoặc Role Quản lý để quyết định luồng đi của đơn
        const isLeader = user.permissions?.includes("ACTION_APPROVE_REQUEST") || ["LEADER", "ADMIN", "BAN_GIAM_DOC"].includes(user.role);

        const body = await req.json();
        
        const { type, teamId, contentData, firstApproverId, secondApproverId, status } = body;

        const targetDate = contentData.date ? new Date(contentData.date) : null;
        const startDate = contentData.startDate ? new Date(contentData.startDate) : null;
        const endDate = contentData.endDate ? new Date(contentData.endDate) : null;
        const amount = contentData.amount ? Number(contentData.amount) : null;
        const itemName = contentData.itemName || null;
        const reason = contentData.reason || null;

        if (!type || !contentData || !teamId) {
            return NextResponse.json({ error: "Thiếu thông tin cơ bản của đơn" }, { status: 400 });
        }

        if (isLeader) {
            if (!secondApproverId) {
                return NextResponse.json({ error: "Vui lòng chọn người duyệt (Ban Giám Đốc)" }, { status: 400 });
            }
        } else {
            if (!firstApproverId) {
                return NextResponse.json({ error: "Vui lòng chọn Quản lý Cấp 1 để duyệt đơn" }, { status: 400 });
            }
        }

        const newRequest = await prisma.request.create({
            data: {
                type,
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

        if (isLeader || status === "PENDING_2") {
            await prisma.notification.create({
                data: {
                    title: "Đơn từ mới cần duyệt gấp (Từ Quản lý)",
                    message: `Quản lý vừa tạo một đề xuất ${type} và đang chờ bạn phê duyệt.`,
                    type: "info",
                    userId: secondApproverId,
                    requestId: newRequest.id
                }
            });
        } else {
            await prisma.notification.create({
                data: {
                    title: "Đơn từ mới cần duyệt",
                    message: `Bạn vừa nhận được một đề xuất ${type} mới cần phê duyệt.`,
                    type: "info",
                    userId: firstApproverId,
                    requestId: newRequest.id
                }
            });
            
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

        // 🚀 ĐÃ SỬA: Đọc quyền động từ biến permissions (MENU_TEAMS) để cho phép xem đơn toàn công ty
        const canViewAll = user.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC"].includes(user.role);

        let whereClause: any = {};

        if (tab === "NEED_APPROVAL") {
            whereClause = {
                OR: [
                    { firstApproverId: user.id, status: "PENDING_1" },
                    { secondApproverId: user.id, status: "PENDING_2" }
                ]
            };
        } else if (tab === "ALL_REQUESTS") {
            if (!canViewAll) {
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