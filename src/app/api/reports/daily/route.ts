import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        if (!["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        
        const targetDate = new Date();
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
        
        // 1. Lấy danh sách nhân sự phòng Sản xuất trước
        const productionUsers = await prisma.user.findMany({
            where: {
                isActive: true,
                team: { department: { name: { contains: "Sản xuất" } } }
            },
            select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                team: { select: { name: true } }
            }
        });

        // 2. Truy vết Log công việc trong ngày hôm nay
        const dailyLogs = await prisma.taskLog.findMany({
            where: {
                createdAt: { gte: startOfDay, lte: endOfDay },
                action: {
                    // 🚀 ĐÃ BỔ SUNG DAILY_REPORT
                    in: ['UPDATE_LINK', 'SUBMIT_SCRIPT', 'SUBMIT_VIDEO', 'PUBLISH_VIDEO', 'DAILY_REPORT']
                }
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        linkContent: true,
                        scriptLink: true,
                        englishScriptLink: true,
                        storyboardLink: true,
                        audioLink: true,
                        thumbnailLink: true,
                        videoLink: true,
                        publishLink: true
                    }
                }
            }
        });

        // 3. Khớp Log vào từng nhân sự
        const reportData = productionUsers.map(user => {
            const userLogs = dailyLogs.filter(log => log.userId === user.id);
            const links: { name: string, url: string }[] = [];
            
            userLogs.forEach(log => {
                const t = log.task;
                if (!t) return;

                // 🚀 XỬ LÝ LOGIC MỚI: Bóc tách loại link từ chuỗi 'details'
                if (log.action === 'DAILY_REPORT') {
                    const detail = log.details || "";
                    if (detail.includes("Kịch Bản") && t.scriptLink) links.push({ name: `[Kịch bản] ${t.title}`, url: t.scriptLink });
                    else if (detail.includes("ENG") && t.englishScriptLink) links.push({ name: `[Text ENG] ${t.title}`, url: t.englishScriptLink });
                    else if (detail.includes("Audio") && t.audioLink) links.push({ name: `[Audio] ${t.title}`, url: t.audioLink });
                    else if (detail.includes("Bố Cục") && t.storyboardLink) links.push({ name: `[Bố cục] ${t.title}`, url: t.storyboardLink });
                    else if (detail.includes("Thumbnail") && t.thumbnailLink) links.push({ name: `[Thumb] ${t.title}`, url: t.thumbnailLink });
                    else if (detail.includes("Video Render") && t.videoLink) links.push({ name: `[Video] ${t.title}`, url: t.videoLink });
                    else if (detail.includes("Đã Đăng") && t.publishLink) links.push({ name: `[Đã đăng] ${t.title}`, url: t.publishLink });
                    else if (detail.includes("trạng thái")) {
                        // Nếu chỉ là ghi chú text, trả về đường dẫn trỏ thẳng vào Task đó
                        links.push({ name: `[Ghi chú] ${t.title}`, url: `/tasks?taskId=${t.id}` });
                    }
                } 
                // Xử lý Fallback cho các logic cũ
                else {
                    if (log.action === 'UPDATE_LINK' && t.linkContent) links.push({ name: `[Nguồn] ${t.title}`, url: t.linkContent });
                    if (log.action === 'SUBMIT_SCRIPT' && t.scriptLink) links.push({ name: `[Kịch bản] ${t.title}`, url: t.scriptLink });
                    if (log.action === 'SUBMIT_VIDEO' && t.videoLink) links.push({ name: `[Video] ${t.title}`, url: t.videoLink });
                    if (log.action === 'PUBLISH_VIDEO' && t.publishLink) links.push({ name: `[Đã đăng] ${t.title}`, url: t.publishLink });
                }
            });

            // Loại bỏ các link trùng lặp (nếu một người update 1 link nhiều lần trong ngày)
            const uniqueLinks = Array.from(new Set(links.map(l => JSON.stringify(l)))).map(l => JSON.parse(l));

            return {
                id: user.id,
                fullName: user.fullName,
                teamName: user.team?.name || "N/A",
                avatarUrl: user.avatarUrl,
                // 🚀 CẬP NHẬT: Đếm trạng thái đã báo cáo dựa trên số lượng log, thay vì số lượng Link. 
                // Đảm bảo những người chỉ gõ Ghi chú cũng được tính là hoàn thành.
                hasReported: userLogs.length > 0,
                links: uniqueLinks
            };
        });

        return NextResponse.json(reportData, { status: 200 });

    } catch (error) {
        console.error(">>> [DAILY REPORT ERROR]:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}