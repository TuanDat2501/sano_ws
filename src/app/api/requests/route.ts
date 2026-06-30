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

        const userId = (session.user as any).id;
        const body = await req.json();

        const { type, teamId, contentData, firstApproverId, secondApproverId } = body;

        if (!type || !contentData || !firstApproverId || !teamId) {
            return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
        }

        // Bóc tách dữ liệu vào các cột vật lý mới để tối ưu performance
        const targetDate = contentData.date ? new Date(contentData.date) : null;
        const startDate = contentData.startDate ? new Date(contentData.startDate) : null;
        const endDate = contentData.endDate ? new Date(contentData.endDate) : null;
        const amount = contentData.amount ? Number(contentData.amount) : null;
        const itemName = contentData.itemName || null;
        const reason = contentData.reason || null;

        const newRequest = await prisma.request.create({
            data: {
                type,
                status: "PENDING_1",
                requesterId: userId,
                teamId,
                firstApproverId,
                secondApproverId: secondApproverId || null,
                startDate,
                endDate,
                targetDate,
                amount,
                itemName,
                reason,
                contentData // Vẫn lưu JSON dự phòng
            }
        });

        // Tạo thông báo cho người duyệt cấp 1
        await prisma.notification.create({
            data: {
                title: "Đơn từ mới cần duyệt",
                message: `Bạn vừa nhận được một đề xuất ${type} mới cần phê duyệt.`,
                type: "info",
                userId: firstApproverId,
                requestId: newRequest.id
            }
        });
        if (newRequest.secondApproverId) {
            await prisma.notification.create({
                data: {
                    userId: newRequest.secondApproverId,
                    title: "Có đơn từ sắp tới lượt duyệt",
                    message: `Một đề xuất ${newRequest.type} vừa được tạo. Sẽ tới lượt bạn sau khi Quản lý cấp 1 duyệt xong.`,
                    requestId: newRequest.id,
                    type: "info" // Để type là info cho nhẹ nhàng, không bị nhầm với đơn cần duyệt gấp
                }
            });
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
        // 🚀 Lấy từ khóa tìm kiếm
        const searchKeyword = searchParams.get("search") || "";

        const isAdmin = user.role === "ADMIN" || user.role === "BAN_GIAM_DOC" || user.role === "HR";

        let whereClause: any = {};

        if (tab === "NEED_APPROVAL") {
            whereClause = {
                OR: [
                    { firstApproverId: user.id, status: "PENDING_1" },
                    { secondApproverId: user.id, status: "PENDING_2" }
                ]
            };
        } else {
            whereClause = isAdmin ? {} : { requesterId: user.id };
        }

        // 🚀 NẾU CÓ TỪ KHÓA TÌM KIẾM, ĐÍNH KÈM VÀO BỘ LỌC
        if (searchKeyword.trim() !== "") {
            whereClause = {
                ...whereClause,
                id: {
                    startsWith: searchKeyword.trim() // Tìm các ID bắt đầu bằng chuỗi gõ vào
                }
            };
        }

        // Truy vấn song song: Lấy dữ liệu và Đếm tổng
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
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}