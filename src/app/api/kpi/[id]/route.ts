import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// 🚀 HÀM TÍNH TUẦN CHUẨN CẮT BIÊN THÁNG (Đồng bộ với Frontend và Analytics)
function getWeekDateRangeByMonth(year: number, month: number, weekNumber: number) {
    const totalDays = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate(); 
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).getUTCDay(); 
    
    const diffToSunday = firstDayOfMonth === 0 ? 0 : 7 - firstDayOfMonth;
    const firstSunday = 1 + diffToSunday;

    let startDay = 1;
    let endDay = firstSunday;

    if (weekNumber > 1) {
        startDay = firstSunday + (weekNumber - 2) * 7 + 1;
        endDay = Math.min(startDay + 6, totalDays); 
    }

    const pad = (num: number) => num.toString().padStart(2, '0');

    const startOfWeek = new Date(`${year}-${pad(month)}-${pad(startDay)}T00:00:00+07:00`);
    const endOfWeek = new Date(`${year}-${pad(month)}-${pad(endDay)}T23:59:59.999+07:00`);

    return { start: startOfWeek, end: endOfWeek };
}

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: any) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await context.params;
        const requestedUserId = resolvedParams.id;

        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        const user = await prisma.user.findUnique({
            where: { id: requestedUserId },
            select: {
                id: true,
                fullName: true,
                role: true,
                avatarUrl: true,
                team: { select: { name: true } },
                channelMemberships: {
                    select: { channelId: true, roleOnChannel: true }
                }
            }
        });

        if (!user) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });

        const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);

        const [kpiRecord, allLogs] = await Promise.all([
            prisma.weeklyKPI.findFirst({
                where: { userId: user.id, year, month, weekNumber: weekIndex }
            }),
            prisma.taskLog.findMany({
                where: {
                    userId: user.id,
                    createdAt: { gte: start, lte: end }
                },
                select: {
                    id: true,
                    action: true,
                    details: true,
                    jobCategory: true, 
                    createdAt: true,
                    taskId: true,
                    userId: true,
                    task: {
                        select: {
                            // 🚀 CÓ isReject ĐỂ TRỪ KPI NGAY TỪ GỐC
                            id: true, title: true, status: true, duration: true, isRework: true, channelId: true, isReject: true,
                            scriptLink: true, englishScriptLink: true, storyboardLink: true, audioLink: true, thumbnailLink: true, videoLink: true, publishLink: true, roughProjectLink: true, animationLink: true,
                            channel: { select: { id: true, name: true } }
                        }
                    }
                }
            })
        ]);

        // ========================================================
        // 🚀 BƯỚC 1: LỌC BỎ CÁC BÀI BỊ REJECT HOẶC YÊU CẦU LÀM LẠI
        // ========================================================
        const rejectedLogs = allLogs.filter(log =>
            ["REJECT_TASK", "REJECT_CONTENT", "REJECT_ANIMATION", "REJECT_EDIT"].includes(String(log.action || "").toUpperCase())
        );

        const rejectedTaskJobs = new Set<string>();
        rejectedLogs.forEach(rLog => {
            let rJobCategory = rLog.jobCategory;
            if (!rJobCategory) {
                if (rLog.action === "REJECT_CONTENT") rJobCategory = "CONTENT";
                else if (rLog.action === "REJECT_ANIMATION") rJobCategory = "ANIMATION";
                else if (rLog.action === "REJECT_EDIT") rJobCategory = "EDIT";
                else rJobCategory = "GENERAL";
            }
            rejectedTaskJobs.add(`${rLog.taskId}_${rJobCategory}`);
        });

        const validUserLogs = allLogs.filter(log => {
            if (String(log.action || "").toUpperCase() !== "DAILY_REPORT") return false;
            
            // 🚀 Chặn ngay lập tức nếu Task đã bị đánh cờ Reject
            if (log.task?.isReject) return false;

            let currentJob = log.jobCategory;
            if (!currentJob) {
                const txt = String(log.details || "").toLowerCase();
                if (txt.includes("gán thủ công")) currentJob = "MANUAL";
                else if (txt.includes("kịch bản") || txt.includes("bố cục")) currentJob = "CONTENT";
                else if (txt.includes("prj thô") || txt.includes("link project") || txt.includes("audio") || txt.includes("âm thanh") || txt.includes("video render")) currentJob = "EDIT";
                else if (txt.includes("chuyển động")) currentJob = "ANIMATION";
                else if (txt.includes("đã đăng") || txt.includes("thumbnail")) currentJob = "PUBLISH";
                else currentJob = "GENERAL";
            }

            if (rejectedTaskJobs.has(`${log.taskId}_${currentJob}`) || rejectedTaskJobs.has(`${log.taskId}_GENERAL`)) {
                return false;
            }
            return true;
        });

        const mappedLogs = validUserLogs.map(log => {
            return { ...log, typeStr: "Báo cáo", isCounted: false };
        });

        const uniqueTasks = new Map<string, any>();
            
        mappedLogs.forEach(log => {
            if (!log.task) return;

            let jobCategory = (log as any).jobCategory;

            if (!jobCategory) {
                const combinedText = String(log.details || "").toLowerCase();
                if (combinedText.includes("gán thủ công")) jobCategory = "MANUAL";
                else if (combinedText.includes("kịch bản") || combinedText.includes("bố cục")) jobCategory = "CONTENT";
                else if (combinedText.includes("prj thô") || combinedText.includes("link project") || combinedText.includes("audio") || combinedText.includes("âm thanh") || combinedText.includes("video render")) jobCategory = "EDIT";
                else if (combinedText.includes("chuyển động")) jobCategory = "ANIMATION";
                else if (combinedText.includes("đã đăng") || combinedText.includes("thumbnail")) jobCategory = "PUBLISH";
                else jobCategory = "GENERAL";
            }

            if (jobCategory && jobCategory !== 'GENERAL') {
                const uniqueKey = jobCategory === 'MANUAL' ? `${log.id}_MANUAL` : `${log.taskId}_${jobCategory}`; 
                
                if (!uniqueTasks.has(uniqueKey)) {
                    uniqueTasks.set(uniqueKey, log.task);
                    log.isCounted = true;
                }
            }
        });

        const allUserLogs = [...mappedLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const targetValue = kpiRecord?.targetValue || 0;
        const targetDetailsRaw = kpiRecord?.targetDetails;
        let targetDetails: any[] = [];
        try {
            if (targetDetailsRaw) targetDetails = typeof targetDetailsRaw === 'string' ? JSON.parse(targetDetailsRaw) : targetDetailsRaw;
        } catch (e) { }

        let percent = 0;
        let totalTargetMinutes = 0;
        let totalActualMinutes = 0;
        let actualCount = uniqueTasks.size;

        if (targetDetails && targetDetails.length > 0) {
            
            // ========================================================
            // 🚀 BƯỚC 2: TÍNH % KPI (CHIA THEO PHÚT) VÀ KHỚP VỚI CHỈ TIÊU CHI TIẾT
            // ========================================================
            
            targetDetails.forEach(t => {
                t.actualCount = 0;
                t.actualMinutes = 0;
                totalTargetMinutes += (Number(t.targetCount) || 0) * (Number(t.duration) || 0);
            });

            uniqueTasks.forEach((task, uniqueKey) => {
                const jobCategory = uniqueKey.split('_').pop() || 'CONTENT';
                const channelId = task.channel?.id;
                
                // Trả lại sự thật cho bài Quản lý kênh (không ép false nữa)
                const isReworkTask = Boolean(task.isRework);
                
                const actualTaskDuration = Number(task.duration) || 0;

                // 🚀 LỌC KPI THÔNG MINH (SMART FILTER CÂN CẢ 2 BÀI GIỐNG NHAU KHÁC PHÚT)
                const findSmartTarget = (isChannelSpecific: boolean) => {
                    const baseFilter = (t: any) => 
                        (isChannelSpecific ? (t.channelId === channelId) : (!t.channelId || t.channelId === "")) &&
                        (t.jobCategory || 'CONTENT') === jobCategory &&
                        Boolean(t.isRework) === isReworkTask;

                    let found = targetDetails.find(t => baseFilter(t) && Number(t.duration) === actualTaskDuration && (t.actualCount || 0) < Number(t.targetCount));
                    if (!found) found = targetDetails.find(t => baseFilter(t) && Number(t.duration) === actualTaskDuration);
                    if (!found) found = targetDetails.find(t => baseFilter(t) && (t.actualCount || 0) < Number(t.targetCount));
                    if (!found) found = targetDetails.find(t => baseFilter(t));
                    
                    return found;
                };

                let matchedTarget = findSmartTarget(true);
                if (!matchedTarget) {
                    matchedTarget = findSmartTarget(false);
                }

                // Lấy thời lượng của bài (ưu tiên thời lượng trong chỉ tiêu, nếu không có thì lấy thời lượng thật của Task)
                const tDuration = Number(matchedTarget?.duration || actualTaskDuration);

                // CHỈ ĐẾM SỐ LƯỢNG VÀO "CHỈ TIÊU CHI TIẾT" NẾU CÓ GIAO (Mới hiện lên UI chi tiết)
                if (matchedTarget) {
                    matchedTarget.actualCount = (matchedTarget.actualCount || 0) + 1;
                    matchedTarget.actualMinutes = (matchedTarget.actualMinutes || 0) + tDuration;
                }

                // BÀI LÀM THÊM (KHÔNG GIAO CHỈ TIÊU) VẪN ĐƯỢC CỘNG PHÚT VÀO TỔNG THỰC TẾ
                totalActualMinutes += tDuration;
            });

            // 3. Tính % KPI (Tổng tiến độ) = Lấy Tổng Thực Tế / Tổng Mục Tiêu
            percent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
        } else {
            percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
        }

        return NextResponse.json({
            userId: user.id,
            fullName: user.fullName,
            role: user.role,
            teamName: user.team?.name || "Chưa có team",
            targetValue, 
            actualValue: actualCount, 
            percent, 
            logs: allUserLogs,
            targetDetails, 
            totalTargetMinutes, 
            totalActualMinutes,
            avatarUrl: user.avatarUrl || null
        });

    } catch (error) {
        console.error("LỖI API KPI CÁ NHÂN:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}