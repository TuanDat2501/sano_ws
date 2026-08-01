import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        const userId = currentUser.id;
        const teamId = currentUser.teamId;
        const role = currentUser.role?.toUpperCase();

        // 🚀 ĐÃ SỬA: Phân quyền động cho việc xuất Excel, đồng bộ với logic xem danh sách Task
        const canViewAll = currentUser.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC"].includes(role);
        const isLeader = role === "LEADER" || currentUser.permissions?.includes("DEPARTMENT_LEADER");

        let whereClause: any = {};
        
        if (canViewAll) {
            whereClause = {};
        } else if (isLeader) {
            whereClause = { teamId: teamId };
        } else {
            // Nhân sự thường chỉ xuất được Task của chính mình tham gia
            whereClause = { 
                OR: [
                    { contentId: userId }, 
                    { editorId: userId }, 
                    { animatorId: userId }, 
                    { creatorId: userId }
                ] 
            };
        }

        const tasks = await prisma.task.findMany({
            where: whereClause,
            include: {
                contentUser: { select: { fullName: true } },
                editorUser: { select: { fullName: true } },
                animatorUser: { select: { fullName: true } }, // Animator mới thêm
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