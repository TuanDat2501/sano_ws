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
        // Chúng ta tìm các hành động dán link: UPDATE_LINK, SUBMIT_SCRIPT, SUBMIT_VIDEO, PUBLISH_VIDEO
        const dailyLogs = await prisma.taskLog.findMany({
            where: {
                createdAt: { gte: startOfDay, lte: endOfDay },
                action: {
                    in: ['UPDATE_LINK', 'SUBMIT_SCRIPT', 'SUBMIT_VIDEO', 'PUBLISH_VIDEO']
                }
            },
            include: {
                task: {
                    select: {
                        title: true,
                        linkContent: true,
                        scriptLink: true,
                        videoLink: true,
                        publishLink: true
                    }
                }
            }
        });

        // 3. Khớp Log vào từng nhân sự
        const reportData = productionUsers.map(user => {
            // Lọc các log thuộc về user này
            const userLogs = dailyLogs.filter(log => log.userId === user.id);
            
            const links: { name: string, url: string }[] = [];
            
            userLogs.forEach(log => {
                const t = log.task;
                // Tùy vào hành động trong Log mà ta lấy link tương ứng
                if (log.action === 'UPDATE_LINK' && t.linkContent) 
                    links.push({ name: `[Nguồn] ${t.title}`, url: t.linkContent });
                if (log.action === 'SUBMIT_SCRIPT' && t.scriptLink) 
                    links.push({ name: `[Kịch bản] ${t.title}`, url: t.scriptLink });
                if (log.action === 'SUBMIT_VIDEO' && t.videoLink) 
                    links.push({ name: `[Video] ${t.title}`, url: t.videoLink });
                if (log.action === 'PUBLISH_VIDEO' && t.publishLink) 
                    links.push({ name: `[Đã đăng] ${t.title}`, url: t.publishLink });
            });

            // Loại bỏ các link trùng lặp (nếu một người update 1 link nhiều lần trong ngày)
            const uniqueLinks = Array.from(new Set(links.map(l => JSON.stringify(l)))).map(l => JSON.parse(l));

            return {
                id: user.id,
                fullName: user.fullName,
                teamName: user.team?.name || "N/A",
                avatarUrl: user.avatarUrl,
                hasReported: uniqueLinks.length > 0,
                links: uniqueLinks
            };
        });

        return NextResponse.json(reportData, { status: 200 });

    } catch (error) {
        console.error(">>> [DAILY REPORT ERROR]:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}