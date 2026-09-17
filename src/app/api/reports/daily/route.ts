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

        // 2. Lấy toàn bộ Log báo cáo trong dải thời gian
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
            const userLogs = dailyLogs.filter(log => log.userId === user.id);
            const dailyReports: Record<string, { hasReported: boolean, links: { name: string, url: string }[] }> = {};
            
            userLogs.forEach(log => {
                const detail = log.details || "";
                
                // 🚀 CHẶN BÁO CÁO ẢO: Bỏ qua các log "Đã gỡ/xóa" link
                if (detail.includes("gỡ/xóa")) return;

                const offset = log.createdAt.getTimezoneOffset() * 60000;
                const localISOTime = new Date(log.createdAt.getTime() - offset).toISOString().split('T')[0];
                const dateKey = localISOTime;

                if (!dailyReports[dateKey]) {
                    dailyReports[dateKey] = { hasReported: true, links: [] };
                }

                const t = log.task;
                if (!t) return;

                // 🚀 TỐI ƯU HIỂN THỊ LINK & CÓ BẢO HIỂM TRỞ VỀ TASK NẾU LINK RỖNG
                if (log.action === 'DAILY_REPORT' || log.action === 'UPDATE_LINK') {
                    let linkName = "";
                    let linkUrl:any = "";

                    if (detail.includes("Kịch Bản")) { linkName = `[Kịch bản] ${t.title}`; linkUrl = t.scriptLink; }
                    else if (detail.includes("Text ENG")) { linkName = `[Text ENG] ${t.title}`; linkUrl = t.englishScriptLink; }
                    else if (detail.includes("Audio")) { linkName = `[Audio] ${t.title}`; linkUrl = t.audioLink; }
                    else if (detail.includes("Bố Cục")) { linkName = `[Bố cục] ${t.title}`; linkUrl = t.storyboardLink; }
                    else if (detail.includes("Thumb") || detail.includes("Thumbnail")) { linkName = `[Thumb] ${t.title}`; linkUrl = t.thumbnailLink; }
                    else if (detail.includes("Video Render")) { linkName = `[Video] ${t.title}`; linkUrl = t.videoLink; }
                    else if (detail.includes("Dựng Chính") || detail.includes("Project")) { linkName = `[PRJ Chính] ${t.title}`; linkUrl = t.linkProject; }
                    else if (detail.includes("PRJ Thô")) { linkName = `[PRJ Thô] ${t.title}`; linkUrl = t.roughProjectLink; }
                    else if (detail.includes("Chuyển Động")) { linkName = `[Chuyển động] ${t.title}`; linkUrl = t.animationLink; }
                    else if (detail.includes("Đã Đăng")) { linkName = `[Đã đăng] ${t.title}`; linkUrl = t.publishLink; }
                    else if (detail.includes("trạng thái") || detail.includes("ghi chú")) { linkName = `[Ghi chú] ${t.title}`; linkUrl = `/tasks?taskId=${t.id}`; }
                    else if (detail.includes("Nguồn")) { linkName = `[Nguồn] ${t.title}`; linkUrl = t.linkContent; }
                    else { linkName = `[Cập nhật] ${t.title}`; linkUrl = `/tasks?taskId=${t.id}`; } // Gom các trường hợp ngoại lệ

                    // Lớp bảo hiểm: Nếu không tìm thấy URL thực tế, gán url về chi tiết task
                    if (!linkUrl || linkUrl.trim() === "") {
                        linkUrl = `/tasks?taskId=${t.id}`;
                    }

                    dailyReports[dateKey].links.push({ name: linkName, url: linkUrl });
                } else {
                    let linkName = "";
                    let linkUrl:any = "";
                    
                    if (log.action === 'SUBMIT_SCRIPT') { linkName = `[Kịch bản] ${t.title}`; linkUrl = t.scriptLink; }
                    else if (log.action === 'SUBMIT_VIDEO') { linkName = `[Video] ${t.title}`; linkUrl = t.videoLink; }
                    else if (log.action === 'PUBLISH_VIDEO') { linkName = `[Đã đăng] ${t.title}`; linkUrl = t.publishLink; }

                    if (linkName) {
                        if (!linkUrl || linkUrl.trim() === "") linkUrl = `/tasks?taskId=${t.id}`;
                        dailyReports[dateKey].links.push({ name: linkName, url: linkUrl });
                    }
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
                dailyReports: dailyReports
            };
        });

        return NextResponse.json(reportData, { status: 200 });

    } catch (error) {
        console.error(">>> [DAILY REPORT ERROR]:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}