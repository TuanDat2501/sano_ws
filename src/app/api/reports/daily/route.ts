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
                action: 'DAILY_REPORT' // 🚀 Chỉ định chính xác 1 action này
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
                        animationLink: true,
                        channel: { select: { name: true } }
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
            // ĐÃ SỬA: Thêm kpiCount?: number vào định nghĩa kiểu dữ liệu
            const dailyReports: Record<string, { hasReported: boolean, kpiCount?: number, links: { name: string, url: string, channelName: string, taskId: string }[] }> = {};
            
            userLogs.forEach(log => {
                const detail = log.details || "";
                
                if (detail.includes("gỡ/xóa")) return;

                const offset = log.createdAt.getTimezoneOffset() * 60000;
                const localISOTime = new Date(log.createdAt.getTime() - offset).toISOString().split('T')[0];
                const dateKey = localISOTime;

                if (!dailyReports[dateKey]) {
                    dailyReports[dateKey] = { hasReported: true, links: [] };
                }

                const t = log.task;
                if (!t) return;

                const channelName = t.channel?.name || "Chưa chọn kênh";

                const isRejectAction = ['REJECT_TASK', 'REJECT_CONTENT', 'REJECT_ANIMATION', 'REJECT_EDIT'].includes(log.action);

                if (log.action === 'DAILY_REPORT' || log.action === 'UPDATE_LINK' || isRejectAction) {
                    let linkName = "";
                    let linkUrl:any = "";

                    // Nếu là hành động Reject, luôn lấy toàn bộ link đang có trong task để trưởng nhóm/nhân sự check
                    if (isRejectAction) {
                        linkName = `[Làm lại] ${t.title}`;
                        linkUrl = t.videoLink || t.roughProjectLink || t.animationLink || t.scriptLink || `/tasks?taskId=${t.id}`;
                    }
                    // Nếu là Báo cáo bình thường (Logic cũ)
                    else {
                        // KIỂM TRA THEO TỪ KHÓA TRONG DETAILS TRƯỚC
                        if (detail.includes("Text ENG")) { linkName = `[Text ENG] ${t.title}`; linkUrl = t.englishScriptLink; }
                        else if (detail.includes("Audio")) { linkName = `[Audio] ${t.title}`; linkUrl = t.audioLink; }
                        else if (detail.includes("Bố Cục")) { linkName = `[Bố cục] ${t.title}`; linkUrl = t.storyboardLink; }
                        else if (detail.includes("Thumb") || detail.includes("Thumbnail")) { linkName = `[Thumb] ${t.title}`; linkUrl = t.thumbnailLink; }
                        else if (detail.includes("PRJ Thô")) { linkName = `[PRJ Thô] ${t.title}`; linkUrl = t.roughProjectLink; }
                        else if (detail.includes("Dựng Chính") || detail.includes("Project")) { linkName = `[PRJ Chính] ${t.title}`; linkUrl = t.linkProject; }
                        else if (detail.includes("Chuyển Động")) { linkName = `[Chuyển động] ${t.title}`; linkUrl = t.animationLink; }
                        else if (detail.includes("Video Render")) { linkName = `[Video] ${t.title}`; linkUrl = t.videoLink; }
                        else if (detail.includes("Đã Đăng")) { linkName = `[Đã đăng] ${t.title}`; linkUrl = t.publishLink; }
                        else if (detail.includes("Kịch Bản")) { linkName = `[Kịch bản] ${t.title}`; linkUrl = t.scriptLink; }
                        
                        // NẾU KHÔNG CÓ TỪ KHÓA NÀO, LẤY THEO TRƯỜNG JOBCATEGORY ĐỂ LÀM MỐC
                        else if (log.jobCategory === 'CONTENT') { linkName = `[Kịch bản] ${t.title}`; linkUrl = t.scriptLink || t.storyboardLink || t.videoLink; }
                        else if (log.jobCategory === 'EDIT') { linkName = `[Video] ${t.title}`; linkUrl = t.videoLink || t.roughProjectLink || t.audioLink; }
                        else if (log.jobCategory === 'ANIMATION') { linkName = `[Chuyển động] ${t.title}`; linkUrl = t.animationLink || t.videoLink; }
                        else if (log.jobCategory === 'PUBLISH') { linkName = `[Đã đăng] ${t.title}`; linkUrl = t.publishLink || t.thumbnailLink; }
                        
                        // CÁC TRƯỜNG HỢP CÒN LẠI
                        else if (detail.includes("trạng thái") || detail.includes("ghi chú")) { linkName = `[Ghi chú] ${t.title}`; linkUrl = `/tasks?taskId=${t.id}`; }
                        else if (detail.includes("Nguồn")) { linkName = `[Nguồn] ${t.title}`; linkUrl = t.linkContent; }
                        else { linkName = `[Cập nhật] ${t.title}`; linkUrl = `/tasks?taskId=${t.id}`; } 
                    }

                    if (!linkUrl || linkUrl.trim() === "") {
                        linkUrl = `/tasks?taskId=${t.id}`;
                    }

                    dailyReports[dateKey].links.push({ name: linkName, url: linkUrl, channelName, taskId: t.id });
                } else {
                    let linkName = "";
                    let linkUrl:any = "";
                    
                    if (log.action === 'SUBMIT_SCRIPT') { linkName = `[Kịch bản] ${t.title}`; linkUrl = t.scriptLink; }
                    else if (log.action === 'SUBMIT_VIDEO') { linkName = `[Video] ${t.title}`; linkUrl = t.videoLink; }
                    else if (log.action === 'PUBLISH_VIDEO') { linkName = `[Đã đăng] ${t.title}`; linkUrl = t.publishLink; }

                    if (linkName) {
                        if (!linkUrl || linkUrl.trim() === "") linkUrl = `/tasks?taskId=${t.id}`;
                        dailyReports[dateKey].links.push({ name: linkName, url: linkUrl, channelName, taskId: t.id });
                    }
                }
            });

            Object.keys(dailyReports).forEach(dateKey => {
                // Vẫn lọc trùng link để trả về chi tiết khi click vào xem
                const uniqueLinks = Array.from(new Set(dailyReports[dateKey].links.map(l => JSON.stringify(l)))).map(l => JSON.parse(l));
                dailyReports[dateKey].links = uniqueLinks;

                // 🚀 TÍNH TOÁN SỐ LƯỢNG KPI THEO TASK & JOB CATEGORY
                const kpiCounter = new Set(); 
                
                uniqueLinks.forEach((link: any) => {
                    // Dựa vào linkName để phân loại lại jobCategory tương đối cho báo cáo
                    let impliedJob = 'GENERAL';
                    const nameLower = (link.name || "").toLowerCase();
                    
                    if (nameLower.includes('kịch bản') || nameLower.includes('bố cục')) impliedJob = 'CONTENT';
                    else if (nameLower.includes('video') || nameLower.includes('prj') || nameLower.includes('audio') || nameLower.includes('eng')) impliedJob = 'EDIT';
                    else if (nameLower.includes('chuyển động')) impliedJob = 'ANIMATION';
                    else if (nameLower.includes('đã đăng') || nameLower.includes('thumb') || nameLower.includes('làm lại')) impliedJob = 'PUBLISH';
                    
                    // Ghép taskId và impliedJob thành 1 key duy nhất. 
                    // Nghĩa là: 1 Task + 1 Khâu = 1 KPI.
                    kpiCounter.add(`${link.taskId}_${impliedJob}`);
                });

                // Trả về số lượng đếm được theo chuẩn KPI
                dailyReports[dateKey].kpiCount = kpiCounter.size; 
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