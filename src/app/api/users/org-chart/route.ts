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

        const { start, end } = getContinuousWeekRange(year, month, currentWeekNumber);
        
        const startOfWeek = new Date(start);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(end);
        endOfWeek.setHours(23, 59, 59, 999);

        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                fullName: true,
                username: true,
                role: true,
                avatarUrl: true,
                teamId: true,
                team: { select: { name: true } }, 
                isActive: true,
                channelMemberships: {
                    select: {
                        channelId: true,
                        roleOnChannel: true
                    }
                },
                weeklyKPIs: {
                    where: { year: year, month: month, weekNumber: currentWeekNumber },
                    take: 1
                }
            }
        });

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

        const surplusTasks = await prisma.task.findMany({
            where: {
                isClosed: false,
                OR: [{ publishLink: null }, { publishLink: "" }],
                status: { not: "BACKLOG" }
            },
            select: {
                id: true, title: true, 
                channelId: true, // 🚀 ĐÃ BỔ SUNG: Truy vấn thêm channelId ở gốc
                contentId: true, editorId: true, animatorId: true, duration: true,
                coContentUsers: { select: { id: true } },
                coEditorUsers: { select: { id: true } },
                coAnimatorUsers: { select: { id: true } },
                scriptLink: true, animationLink: true, roughProjectLink: true, videoLink: true,
                channel: { select: { name: true, avatarUrl: true } } 
            }
        });

        const userSurplusDetails: Record<string, Record<number, number>> = {};
        const userSurplusList: Record<string, any[]> = {}; 
        
        surplusTasks.forEach(t => {
            const hasScript = t.scriptLink && t.scriptLink.trim() !== "";
            const hasAnim = t.animationLink && t.animationLink.trim() !== "";
            const hasRough = t.roughProjectLink && t.roughProjectLink.trim() !== "";
            const hasVideo = t.videoLink && t.videoLink.trim() !== "";
            const duration = t.duration || 0;
            
            const involvedIds = new Set<string>();
            
            if (hasScript) {
                if (t.contentId) involvedIds.add(t.contentId);
                t.coContentUsers.forEach(u => involvedIds.add(u.id));
            }
            if (hasAnim) {
                if (t.animatorId) involvedIds.add(t.animatorId);
                t.coAnimatorUsers.forEach(u => involvedIds.add(u.id));
            }
            if (hasRough || hasVideo) {
                if (t.editorId) involvedIds.add(t.editorId);
                t.coEditorUsers.forEach(u => involvedIds.add(u.id));
            }
            
            involvedIds.forEach(id => {
                if (!userSurplusDetails[id]) userSurplusDetails[id] = {};
                userSurplusDetails[id][duration] = (userSurplusDetails[id][duration] || 0) + 1;

                if (!userSurplusList[id]) userSurplusList[id] = [];
                userSurplusList[id].push({
                    id: t.id,
                    title: t.title,
                    duration: duration,
                    channelId: t.channelId, // 🚀 ĐÃ BỔ SUNG: Nạp channelId vào List để Frontend lọc
                    channelName: t.channel?.name || "Chưa phân kênh",
                    channelAvatar: t.channel?.avatarUrl || null 
                });
            });
        });

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

            // Tính bài dư tổng hợp (cho Leader / Role nằm ngoài kênh)
            const sData = userSurplusDetails[user.id] || {};
            const surplusDetails = Object.entries(sData)
                .map(([dur, count]) => ({ duration: Number(dur), count: count as number }))
                .sort((a, b) => b.duration - a.duration); 

            return {
                id: user.id,
                fullName: user.fullName,
                username: user.username,
                role: user.role,
                avatarUrl: user.avatarUrl,
                teamId: user.teamId,
                teamName: user.team?.name || null,
                isActive: user.isActive,
                channelMemberships: user.channelMemberships,
                surplusDetails: surplusDetails, // Dùng cho Leader / Nhân sự tự do
                surplusTaskList: userSurplusList[user.id] || [], // Dùng để LỌC THEO KÊNH trên UI
                currentWeekStats: {
                    target: targetValue,
                    actual: actualCount
                }
            };
        });

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