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
        
        const hasPermission = currentUser.permissions?.includes("MENU_DAILY_REPORT") || 
                              ["ADMIN", "BAN_GIAM_DOC"].includes(currentUser.role);

        if (!hasPermission) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        
        // 🚀 ĐÃ SỬA: Hứng tham số startDate và endDate từ Frontend gửi lên
        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");
        
        const startDate = startDateParam ? new Date(startDateParam) : new Date();
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = endDateParam ? new Date(endDateParam) : new Date();
        endDate.setHours(23, 59, 59, 999);
        
        // 1. Lấy danh sách nhân sự khối Sản xuất
        const productionUsers = await prisma.user.findMany({
            where: {
                isActive: true,
                team: { department: { name: { contains: "Sản xuất" } } }
            },
            select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                team: { select: { name: true } },
                role: true
            }
        });

        // 2. Lấy toàn bộ Log báo cáo trong dải thời gian (cả tháng)
        const dailyLogs = await prisma.taskLog.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                action: {
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
                        publishLink: true,
                        linkProject: true, 
                        roughProjectLink: true,
                        animationLink: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // 3. Xử lý và phân cụm dữ liệu theo Từng User -> Từng Ngày
        const reportData = productionUsers.map(user => {
            // Lọc log của riêng User này
            const userLogs = dailyLogs.filter(log => log.userId === user.id);
            
            // Object lưu trữ báo cáo theo từng ngày "YYYY-MM-DD"
            const dailyReports: Record<string, { hasReported: boolean, links: { name: string, url: string }[] }> = {};
            
            userLogs.forEach(log => {
                // Xác định ngày của Log (Đồng bộ theo Local Timezone để tránh lệch ngày)
                const offset = log.createdAt.getTimezoneOffset() * 60000;
                const localISOTime = new Date(log.createdAt.getTime() - offset).toISOString().split('T')[0];
                const dateKey = localISOTime;

                // Nếu ngày này chưa có data thì khởi tạo
                if (!dailyReports[dateKey]) {
                    dailyReports[dateKey] = { hasReported: true, links: [] };
                }

                const t = log.task;
                if (!t) return;

                // Phân tích nội dung Link đưa vào mảng của ngày tương ứng
                if (log.action === 'DAILY_REPORT') {
                    const detail = log.details || "";
                    if (detail.includes("Kịch Bản") && t.scriptLink) dailyReports[dateKey].links.push({ name: `[Kịch bản] ${t.title}`, url: t.scriptLink });
                    else if (detail.includes("Text ENG") && t.englishScriptLink) dailyReports[dateKey].links.push({ name: `[Text ENG] ${t.title}`, url: t.englishScriptLink });
                    else if (detail.includes("Audio") && t.audioLink) dailyReports[dateKey].links.push({ name: `[Audio] ${t.title}`, url: t.audioLink });
                    else if (detail.includes("Bố Cục") && t.storyboardLink) dailyReports[dateKey].links.push({ name: `[Bố cục] ${t.title}`, url: t.storyboardLink });
                    else if (detail.includes("Thumbnail") && t.thumbnailLink) dailyReports[dateKey].links.push({ name: `[Thumb] ${t.title}`, url: t.thumbnailLink });
                    else if (detail.includes("Video Render") && t.videoLink) dailyReports[dateKey].links.push({ name: `[Video] ${t.title}`, url: t.videoLink });
                    else if (detail.includes("Dựng Chính") && t.linkProject) dailyReports[dateKey].links.push({ name: `[PRJ Chính] ${t.title}`, url: t.linkProject });
                    else if (detail.includes("PRJ Thô") && t.roughProjectLink) dailyReports[dateKey].links.push({ name: `[PRJ Thô] ${t.title}`, url: t.roughProjectLink });
                    else if (detail.includes("Chuyển Động") && t.animationLink) dailyReports[dateKey].links.push({ name: `[Chuyển động] ${t.title}`, url: t.animationLink });
                    else if (detail.includes("Đã Đăng") && t.publishLink) dailyReports[dateKey].links.push({ name: `[Đã đăng] ${t.title}`, url: t.publishLink });
                    else if (detail.includes("trạng thái")) {
                        dailyReports[dateKey].links.push({ name: `[Ghi chú] ${t.title}`, url: `/tasks?taskId=${t.id}` });
                    }
                } else {
                    if (log.action === 'UPDATE_LINK' && t.linkContent) dailyReports[dateKey].links.push({ name: `[Nguồn] ${t.title}`, url: t.linkContent });
                    if (log.action === 'SUBMIT_SCRIPT' && t.scriptLink) dailyReports[dateKey].links.push({ name: `[Kịch bản] ${t.title}`, url: t.scriptLink });
                    if (log.action === 'SUBMIT_VIDEO' && t.videoLink) dailyReports[dateKey].links.push({ name: `[Video] ${t.title}`, url: t.videoLink });
                    if (log.action === 'PUBLISH_VIDEO' && t.publishLink) dailyReports[dateKey].links.push({ name: `[Đã đăng] ${t.title}`, url: t.publishLink });
                }
            });

            // Lọc trùng lặp Link trong từng ngày
            Object.keys(dailyReports).forEach(dateKey => {
                const uniqueLinks = Array.from(new Set(dailyReports[dateKey].links.map(l => JSON.stringify(l)))).map(l => JSON.parse(l));
                dailyReports[dateKey].links = uniqueLinks;
            });

            return {
                id: user.id,
                fullName: user.fullName,
                role: user.role,
                teamName: user.team?.name || "N/A",
                avatarUrl: user.avatarUrl,
                dailyReports: dailyReports // 🚀 Bổ sung object chứa tiến độ báo cáo hằng ngày
            };
        });

        return NextResponse.json(reportData, { status: 200 });

    } catch (error) {
        console.error(">>> [DAILY REPORT ERROR]:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}