import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 🚀 SỬA KIỂU DỮ LIỆU: params bây giờ là một Promise
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 🚀 SỬA LỖI Ở ĐÂY: Await toàn bộ params trước rồi mới lấy id
        const resolvedParams = await params;
        const requestId = resolvedParams.id;

        if (!requestId) return NextResponse.json({ error: "Thiếu ID đề xuất" }, { status: 400 });

        const requestDetail = await prisma.request.findUnique({
            where: { id: requestId },
            include: {
                requester: { select: { fullName: true } },
                team: { select: { name: true } },
                firstApprover: { select: { fullName: true } },
                secondApprover: { select: { fullName: true } }
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