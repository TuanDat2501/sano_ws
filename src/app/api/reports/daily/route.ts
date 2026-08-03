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
        
        // 🚀 ĐÃ SỬA: Lấy tham số ngày từ URL (Nếu không có thì lấy ngày hiện tại)
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get("date");
        const targetDate = dateParam ? new Date(dateParam) : new Date();
        
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
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

        const dailyLogs = await prisma.taskLog.findMany({
            where: {
                // Lọc log theo khoảng thời gian của ngày được chọn
                createdAt: { gte: startOfDay, lte: endOfDay },
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
            }
        });

        const reportData = productionUsers.map(user => {
            const userLogs = dailyLogs.filter(log => log.userId === user.id);
            const links: { name: string, url: string }[] = [];
            
            userLogs.forEach(log => {
                const t = log.task;
                if (!t) return;

                if (log.action === 'DAILY_REPORT') {
                    const detail = log.details || "";
                    
                    if (detail.includes("Kịch Bản") && t.scriptLink) links.push({ name: `[Kịch bản] ${t.title}`, url: t.scriptLink });
                    else if (detail.includes("Text ENG") && t.englishScriptLink) links.push({ name: `[Text ENG] ${t.title}`, url: t.englishScriptLink });
                    else if (detail.includes("Audio") && t.audioLink) links.push({ name: `[Audio] ${t.title}`, url: t.audioLink });
                    else if (detail.includes("Bố Cục") && t.storyboardLink) links.push({ name: `[Bố cục] ${t.title}`, url: t.storyboardLink });
                    else if (detail.includes("Thumbnail") && t.thumbnailLink) links.push({ name: `[Thumb] ${t.title}`, url: t.thumbnailLink });
                    else if (detail.includes("Video Render") && t.videoLink) links.push({ name: `[Video] ${t.title}`, url: t.videoLink });
                    else if (detail.includes("Dựng Chính") && t.linkProject) links.push({ name: `[PRJ Chính] ${t.title}`, url: t.linkProject });
                    else if (detail.includes("PRJ Thô") && t.roughProjectLink) links.push({ name: `[PRJ Thô] ${t.title}`, url: t.roughProjectLink });
                    else if (detail.includes("Chuyển Động") && t.animationLink) links.push({ name: `[Chuyển động] ${t.title}`, url: t.animationLink });
                    else if (detail.includes("Đã Đăng") && t.publishLink) links.push({ name: `[Đã đăng] ${t.title}`, url: t.publishLink });
                    else if (detail.includes("trạng thái")) {
                        links.push({ name: `[Ghi chú] ${t.title}`, url: `/tasks?taskId=${t.id}` });
                    }
                } 
                else {
                    if (log.action === 'UPDATE_LINK' && t.linkContent) links.push({ name: `[Nguồn] ${t.title}`, url: t.linkContent });
                    if (log.action === 'SUBMIT_SCRIPT' && t.scriptLink) links.push({ name: `[Kịch bản] ${t.title}`, url: t.scriptLink });
                    if (log.action === 'SUBMIT_VIDEO' && t.videoLink) links.push({ name: `[Video] ${t.title}`, url: t.videoLink });
                    if (log.action === 'PUBLISH_VIDEO' && t.publishLink) links.push({ name: `[Đã đăng] ${t.title}`, url: t.publishLink });
                }
            });

            const uniqueLinks = Array.from(new Set(links.map(l => JSON.stringify(l)))).map(l => JSON.parse(l));

            return {
                id: user.id,
                fullName: user.fullName,
                teamName: user.team?.name || "N/A",
                avatarUrl: user.avatarUrl,
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