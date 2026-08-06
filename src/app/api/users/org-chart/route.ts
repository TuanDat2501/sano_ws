import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getContinuousWeekRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. TÌM XEM HÔM NAY LÀ TUẦN MẤY
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const firstDayOfMonth = new Date(year, month - 1, 1);
        const dayOfWeek = firstDayOfMonth.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

        const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const startUTC = Date.UTC(startOfFirstWeek.getFullYear(), startOfFirstWeek.getMonth(), startOfFirstWeek.getDate());
        const diffDays = Math.floor((todayUTC - startUTC) / (24 * 60 * 60 * 1000));
        
        const currentWeekNumber = Math.floor(diffDays / 7) + 1;

        // 2. LẤY NGÀY ĐẦU VÀ CUỐI TUẦN
        const { start, end } = getContinuousWeekRange(year, month, currentWeekNumber);
        
        const startOfWeek = new Date(start);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(end);
        endOfWeek.setHours(23, 59, 59, 999);

        // 3. Query lấy User
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                fullName: true,
                username: true, // 🚀 BỔ SUNG LẤY TÀI KHOẢN
                role: true,
                avatarUrl: true,
                teamId: true,
                team: { select: { name: true } }, // 🚀 BỔ SUNG LẤY TÊN TEAM
                isActive: true,
                weeklyKPIs: {
                    where: { year: year, month: month, weekNumber: currentWeekNumber },
                    take: 1
                }
            }
        });

        // 4. Lấy Lịch sử làm việc (TaskLog)
        const taskLogs = await prisma.taskLog.findMany({
            where: {
                createdAt: { gte: startOfWeek, lte: endOfWeek },
                action: { 
                    in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] 
                }
            },
            include: {
                task: {
                    select: {
                        duration: true,
                        isRework: true,
                        channelId: true
                    }
                }
            }
        });

        const validTaskLogs: typeof taskLogs = [];
        const dailyReportTracker = new Set<string>();

        taskLogs.forEach(log => {
            if (log.action === "DAILY_REPORT") {
                const dateString = new Date(log.createdAt).toISOString().split('T')[0];
                const uniqueKey = `${log.userId}_${log.taskId}_${dateString}`;
                
                if (!dailyReportTracker.has(uniqueKey)) {
                    dailyReportTracker.add(uniqueKey);
                    validTaskLogs.push(log);
                }
            } else {
                validTaskLogs.push(log);
            }
        });

        // 5. Lắp ráp dữ liệu
        const formattedUsers = users.map(user => {
            const kpiRecord = user.weeklyKPIs.length > 0 ? user.weeklyKPIs[0] : null;
            const targetValue = kpiRecord?.targetValue || 0;
            const targetDetailsRaw = kpiRecord?.targetDetails;
            let targetDetails: any[] = [];
            
            try {
                if (targetDetailsRaw) targetDetails = typeof targetDetailsRaw === 'string' ? JSON.parse(targetDetailsRaw) : targetDetailsRaw;
            } catch(e) {}

            const userLogs = validTaskLogs.filter(log => log.userId === user.id);
            let actualCount = 0;

            if (targetDetails && targetDetails.length > 0) {
                let totalEquivalentVideos = 0;

                targetDetails.forEach(detail => {
                    const logsOfChannel = userLogs.filter(log => {
                        const isMatchChannel = log.task?.channelId === detail.channelId;
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
                    
                    const equivalent = detail.duration > 0 ? actualMinutes / detail.duration : actualMinutes;
                    const equivalentRounded = Math.round(equivalent * 10) / 10;
                    
                    totalEquivalentVideos += equivalentRounded;
                });

                const uniqueOutsideTaskIds = new Set<string>();
                const logsOutside = userLogs.filter(log => {
                    const isCovered = targetDetails.some(d => {
                        const isMatchChannel = d.channelId === log.task?.channelId;
                        const isMatchRework = d.isRework ? log.task?.isRework === true : log.task?.isRework !== true;
                        return isMatchChannel && isMatchRework;
                    });
                    return !isCovered;
                });
                
                logsOutside.forEach(log => uniqueOutsideTaskIds.add(log.taskId));
                totalEquivalentVideos += uniqueOutsideTaskIds.size;

                actualCount = Math.round(totalEquivalentVideos * 10) / 10;
            } else {
                const uniqueTasksCount = new Set(userLogs.map(l => l.taskId)).size;
                actualCount = uniqueTasksCount;
            }

            return {
                id: user.id,
                fullName: user.fullName,
                username: user.username, // 🚀 ĐÃ BỔ SUNG
                role: user.role,
                avatarUrl: user.avatarUrl,
                teamId: user.teamId,
                teamName: user.team?.name || null, // 🚀 ĐÃ BỔ SUNG
                isActive: user.isActive,
                currentWeekStats: {
                    target: targetValue,
                    actual: actualCount
                }
            };
        });

        // 🚀 SẮP XẾP LEADER LÊN ĐẦU DANH SÁCH RỒI MỚI TRẢ VỀ
        formattedUsers.sort((a, b) => {
            if (a.role === 'LEADER' && b.role !== 'LEADER') return -1;
            if (a.role !== 'LEADER' && b.role === 'LEADER') return 1;
            return 0;
        });

        return NextResponse.json(formattedUsers);

    } catch (error) {
        console.error("LỖI API ORG-CHART:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}