import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 🚀 ĐỒNG BỘ 1: Lấy tuần hiện tại theo Chuẩn ISO-8601 (Khớp 100% với trang KPI)
function getCurrentWeekInfo() {
    const d = new Date();
    d.setHours(0,0,0,0);
    const dayOfWeek = d.getDay();
    const diffToThursday = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + diffToThursday);
    
    const targetYear = thursday.getFullYear();
    const targetMonth = thursday.getMonth() + 1;
    
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const diffToMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
    const startOfFirstWeek = new Date(targetYear, targetMonth - 1, 1 + diffToMonday);
    
    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    if (thursdayOfFirstWeek.getMonth() !== targetMonth - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }
    
    const diffTime = d.getTime() - startOfFirstWeek.getTime();
    const weekNumber = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    return { year: targetYear, month: targetMonth, week: weekNumber > 0 ? weekNumber : 1 };
}

function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    
    if (thursdayOfFirstWeek.getMonth() !== month - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }

    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    startOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setHours(23, 59, 59, 999);

    return { start: startOfWeek, end: endOfWeek };
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Sử dụng mốc thời gian chuẩn ISO
        const currentInfo = getCurrentWeekInfo();
        const year = currentInfo.year;
        const month = currentInfo.month;
        const currentWeekNumber = currentInfo.week;

        const { start: startOfWeek, end: endOfWeek } = getWeekDateRangeByMonth(year, month, currentWeekNumber);

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
                // Load Target theo đúng Năm-Tháng-Tuần của chuẩn ISO
                weeklyKPIs: {
                    where: { year: year, month: month, weekNumber: currentWeekNumber },
                    take: 1
                }
            }
        });

        // 🚀 ĐỒNG BỘ 2: Gom đầy đủ các Action được cho phép trong KPI
        const taskLogs = await prisma.taskLog.findMany({
            where: {
                createdAt: { gte: startOfWeek, lte: endOfWeek },
                action: { 
                    in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT", "UPDATE_TASK", "UPDATE", "UPDATE_LINK"] 
                }
            },
            include: {
                task: {
                    select: {
                        id: true,
                        duration: true,
                        isRework: true,
                        channelId: true
                    }
                }
            }
        });

        // Query Dữ liệu Bài Dư (Vẫn giữ nguyên logic xịn sò sếp mới yêu cầu)
        const surplusTasks = await prisma.task.findMany({
            where: {
                isClosed: false,
                OR: [{ publishLink: null }, { publishLink: "" }],
                status: { not: "BACKLOG" }
            },
            select: {
                id: true, title: true, 
                channelId: true,
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
                    channelId: t.channelId, 
                    channelName: t.channel?.name || "Chưa phân kênh",
                    channelAvatar: t.channel?.avatarUrl || null 
                });
            });
        });

        const formattedUsers = users.map(user => {
            const kpiRecord = user.weeklyKPIs.length > 0 ? user.weeklyKPIs[0] : null;
            const targetValue = kpiRecord?.targetValue || 0;
            
            const userLogs = taskLogs.filter(log => log.userId === user.id);
            const uniqueTasks = new Map<string, any>();

            // 🚀 ĐỒNG BỘ 3: Áp dụng Lọc Kỷ Luật (Blacklist) y hệt bên Dashboard KPI
            userLogs.forEach(log => {
                if (!log.task) return;

                let isKpiQualifying = true; 
                const actionStr = String(log.action || "").toUpperCase();
                const combinedText = String(log.details || "").toLowerCase();

                if (["DAILY_REPORT", "UPDATE_TASK", "UPDATE", "UPDATE_LINK"].includes(actionStr)) {
                    if (user.role === "EDITOR") {
                        if (combinedText.includes("prj thô") || combinedText.includes("âm thanh") || combinedText.includes("audio")) {
                            isKpiQualifying = false;
                        }
                    } else if (user.role === "CONTENT") {
                        if (combinedText.includes("ý tưởng") && !combinedText.includes("kịch bản")) {
                            isKpiQualifying = false;
                        }
                    }
                }

                if (isKpiQualifying) {
                    if (!uniqueTasks.has(log.taskId)) {
                        uniqueTasks.set(log.taskId, log.task);
                    }
                }
            });

            // 🚀 ĐỒNG BỘ 4: Tính tiến độ bằng cách đếm số Task nguyên (không tính thập phân)
            const actualCount = uniqueTasks.size;

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
                surplusDetails: surplusDetails, 
                surplusTaskList: userSurplusList[user.id] || [],
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