import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const actualStart = startOfWeek < firstDayOfMonth ? firstDayOfMonth : startOfWeek;
    const actualEnd = endOfWeek > lastDayOfMonth ? lastDayOfMonth : endOfWeek;

    actualStart.setHours(0, 0, 0, 0);
    actualEnd.setHours(23, 59, 59, 999);

    return { start: actualStart, end: actualEnd };
}

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const targetUserId = resolvedParams.id; 
        const currentUser = session.user as any;

        if (["CONTENT", "EDITOR", "PUBLISHER"].includes(currentUser.role)) {
            if (targetUserId !== currentUser.id) {
                return NextResponse.json({ error: "Truy cập bị từ chối. Bạn chỉ có thể xem KPI của chính mình!" }, { status: 403 });
            }
        } else if (currentUser.role === "LEADER") {
            const targetUser = await prisma.user.findUnique({ 
                where: { id: targetUserId }, 
                select: { teamId: true } 
            });
            if (targetUser?.teamId !== currentUser.teamId) {
                return NextResponse.json({ error: "Chỉ được phép xem KPI của nhân sự trong Team mình!" }, { status: 403 });
            }
        }

        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);

        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, fullName: true, role: true, avatarUrl: true }
        });

        if (!user) return NextResponse.json({ error: "User không tồn tại" }, { status: 404 });

        const kpiRecord = await prisma.weeklyKPI.findUnique({
            where: { user_time_unique: { userId: targetUserId, year, month, weekNumber: weekIndex } }
        });

        // Chỉ lấy những LOG thực sự đã nộp/báo cáo
        const userLogs = await prisma.taskLog.findMany({
            where: {
                userId: targetUserId,
                createdAt: { gte: start, lte: end },
                action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] }
            },
            include: { 
                task: { 
                    select: { 
                        title: true, status: true, duration: true, isRework: true,
                        channel: { select: { id: true, name: true } }
                    } 
                } 
            },
            orderBy: { createdAt: "desc" }
        });

        // 🚀 ĐÃ XÓA: Bỏ toàn bộ logic query `activeTasks` và mảng `pendingLogs` (Chờ nộp link)

        const validUserLogs: any[] = [];
        const dailyReportTracker = new Set<string>();

        userLogs.forEach(log => {
            if (log.action === "DAILY_REPORT") {
                const dateString = new Date(log.createdAt).toISOString().split('T')[0];
                const uniqueKey = `${log.taskId}_${dateString}`;
                
                if (!dailyReportTracker.has(uniqueKey)) {
                    dailyReportTracker.add(uniqueKey);
                    validUserLogs.push(log);
                }
            } else {
                validUserLogs.push(log);
            }
        });

        const mappedLogs = validUserLogs.map(log => {
            let typeStr = "Khác";
            if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
            else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
            else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
            else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
            else if (log.action === "DAILY_REPORT") typeStr = "Báo cáo ngày";
            return { ...log, typeStr };
        });

        // 🚀 ĐÃ SỬA: allUserLogs giờ chỉ chứa danh sách đã nộp (mappedLogs)
        const allUserLogs = [...mappedLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const targetValue = kpiRecord?.targetValue || 0;
        
        const targetDetailsRaw = kpiRecord?.targetDetails;
        let targetDetails: any[] = [];
        try {
            if (targetDetailsRaw) targetDetails = typeof targetDetailsRaw === 'string' ? JSON.parse(targetDetailsRaw) : targetDetailsRaw;
        } catch(e) {}

        let actualCount = 0;
        let percent = 0;
        let totalTargetMinutes = 0;
        let totalActualMinutes = 0;

        if (targetDetails && targetDetails.length > 0) {
            let totalEquivalentVideos = 0;

            targetDetails.forEach(detail => {
                const logsOfChannel = validUserLogs.filter(log => {
                    const isMatchChannel = log.task?.channel?.id === detail.channelId;
                    if (!isMatchChannel) return false;
                    return detail.isRework ? log.task?.isRework === true : log.task?.isRework !== true;
                });
                
                const uniqueTaskIds = new Set<string>();
                let actualMinutes = 0;
                logsOfChannel.forEach(log => {
                    if (!uniqueTaskIds.has(log.taskId)) {
                        uniqueTaskIds.add(log.taskId);
                        actualMinutes += Number(log.task?.duration || 0);
                    }
                });
                
                detail.actualMinutes = actualMinutes;
                
                const equivalent = detail.duration > 0 ? actualMinutes / detail.duration : actualMinutes;
                const equivalentRounded = Math.round(equivalent * 10) / 10;
                
                detail.actualCount = equivalentRounded;
                totalEquivalentVideos += equivalentRounded;
                totalTargetMinutes += (Number(detail.targetCount) * Number(detail.duration));
                
                totalActualMinutes += actualMinutes; 
            });

            const logsOutside = validUserLogs.filter(log => {
                const isCovered = targetDetails.some(d => {
                    const isMatchChannel = d.channelId === log.task?.channel?.id;
                    const isMatchRework = d.isRework ? log.task?.isRework === true : log.task?.isRework !== true;
                    return isMatchChannel && isMatchRework;
                });
                return !isCovered;
            });
            
            const uniqueOutsideTaskIds = new Set<string>();
            logsOutside.forEach(log => uniqueOutsideTaskIds.add(log.taskId));
            totalEquivalentVideos += uniqueOutsideTaskIds.size;

            actualCount = Math.round(totalEquivalentVideos * 10) / 10;
            percent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
        } else {
            actualCount = validUserLogs.length; 
            percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
        }

        const kpiData = {
            userId: user.id, fullName: user.fullName, role: user.role, avatarUrl: user.avatarUrl,
            targetValue, actualValue: actualCount, percent, logs: allUserLogs,
            targetDetails, totalTargetMinutes, totalActualMinutes
        };

        return NextResponse.json(kpiData);

    } catch (error) {
        console.error(">>> LỖI GET KPI DETAILS:", error);
        return NextResponse.json({ error: "Lỗi máy chủ khi lấy dữ liệu KPI." }, { status: 500 });
    }
}