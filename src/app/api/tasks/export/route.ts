import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const teamId = (session.user as any).teamId;
        const role = (session.user as any).role;

        // Chỉ lọc theo Team nếu không phải Sếp tổng
        let whereClause: any = {};
        if (role !== "ADMIN" && role !== "BAN_GIAM_DOC") {
            whereClause.teamId = teamId;
        }

        const tasks = await prisma.task.findMany({
            where: whereClause,
            include: {
                contentUser: { select: { fullName: true } },
                editorUser: { select: { fullName: true } },
                animatorUser: { select: { fullName: true } }, // 🚀 Animator mới thêm
                channel: { select: { name: true } },
                project: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 🚀 Định dạng lại dữ liệu cho giống file Excel mẫu của sếp
        const excelData = tasks.map((t, idx) => ({
            "STT": idx + 1,
            "Key (Từ khóa)": t.keywords || "",
            "Tiêu đề Video": t.title,
            "Video tham khảo": t.linkContent,
            "Text ENG": t.englishScriptLink || "",
            "Bố cục": t.storyboardLink || "",
            "Thumbnail": t.thumbnailLink || "",
            "Nhân sự Content": t.contentUser?.fullName || "Chưa gán",
            "Link Audio (AI)": t.audioLink || "",
            "Nhân sự Chuyển động": t.animatorUser?.fullName || "Chưa gán",
            "Nhân sự Editor": t.editorUser?.fullName || "Chưa gán",
            "Video hoàn thành": t.videoLink || "",
            "Thuộc Kênh": t.channel?.name || "",
            "Dự án": t.project?.name || "",
            "Link Youtube (Pub)": t.publishLink || "",
            "Ngày đăng": t.publishDate ? new Date(t.publishDate).toLocaleDateString('vi-VN') : "",
            "Trạng thái": t.status,
            "Ghi chú": t.note || ""
        }));

        return NextResponse.json(excelData);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi xuất dữ liệu" }, { status: 500 });
    }
}