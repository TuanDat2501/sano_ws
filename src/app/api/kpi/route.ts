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

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const weekIndex = parseInt(searchParams.get("week") || "1");

        let userWhere: any = {
            isActive: true,
            role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"] }
        };

        const canFilterTeam = currentUser.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(currentUser.role);

        if (currentUser.role === "ADMIN" || canFilterTeam || currentUser.role === "LEADER") {
            if (teamId && teamId !== "ALL") userWhere.teamId = teamId;
        } else {
            if (!teamId || teamId === "ALL") return NextResponse.json({ error: "Thiếu Team ID" }, { status: 400 });
            userWhere.teamId = teamId;
        }

        const usersRaw = await prisma.user.findMany({
            where: userWhere,
            select: {
                id: true, fullName: true, role: true, avatarUrl: true,
                team: { select: { name: true } },
                channelMemberships: { select: { channelId: true, roleOnChannel: true } }
            }
        });

        const users = usersRaw.filter(u => u.team?.name !== "Nhân sự" && u.team?.name !== "HR");
        if (users.length === 0) return NextResponse.json({ weekData: { year, month, weekIndex }, kpiList: [] });

        const userIds = users.map(u => u.id);

        const calculateKpiForWeek = async (targetWeek: number) => {
            const { start, end } = getWeekDateRangeByMonth(year, month, targetWeek);

            const [allKpis, allLogs] = await Promise.all([
                prisma.weeklyKPI.findMany({
                    where: { userId: { in: userIds }, year, month, weekNumber: targetWeek }
                }),
                prisma.taskLog.findMany({
                    where: {
                        userId: { in: userIds },
                        createdAt: { gte: start, lte: end }
                    },
                    select: {
                        id: true, action: true, details: true, jobCategory: true, createdAt: true, taskId: true, userId: true,
                        task: {
                            select: {
                                id: true, title: true, status: true, duration: true, isRework: true, channelId: true,
                                scriptLink: true, englishScriptLink: true, storyboardLink: true, audioLink: true, thumbnailLink: true, videoLink: true, publishLink: true, roughProjectLink: true,
                                channel: { select: { id: true, name: true } }
                            }
                        }
                    }
                })
            ]);

            return users.map(user => {
                const kpiRecord = allKpis.find(k => k.userId === user.id);
                const rawUserLogs = allLogs.filter(l => l.userId === user.id);

                const validUserLogs = rawUserLogs.filter(log => String(log.action || "").toUpperCase() === "DAILY_REPORT");
                const mappedLogs = validUserLogs.map(log => ({ ...log, typeStr: "Báo cáo", isCounted: false }));

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
                let targetDetails: any[] = [];
                try { if (kpiRecord?.targetDetails) targetDetails = typeof kpiRecord.targetDetails === 'string' ? JSON.parse(kpiRecord.targetDetails) : kpiRecord.targetDetails; } catch (e) { }

                let percent = 0;
                let totalTargetMinutes = 0;
                let totalActualMinutes = 0;
                let actualCount = uniqueTasks.size;

                if (targetDetails && targetDetails.length > 0) {
                    // 1. Tính tổng số phút mục tiêu (Target)
                    targetDetails.forEach(t => {
                        t.actualCount = 0;
                        t.actualMinutes = 0;
                        totalTargetMinutes += (Number(t.targetCount) || 0) * (Number(t.duration) || 0);
                    });

                    // 2. Quét tất cả các task đã làm
                    // 2. Quét tất cả các task đã làm
            uniqueTasks.forEach((task, uniqueKey) => {
                const jobCategory = uniqueKey.split('_').pop() || 'CONTENT'; 
                const channelId = task.channel?.id;
                
                // 🚀 ĐÃ BỔ SUNG: Nhận diện task này là bài mới hay bài sửa
                const isReworkTask = (jobCategory === 'PUBLISH') ? false : Boolean(task.isRework);

                // Tìm Target khớp TUYỆT ĐỐI (Kênh + Khâu + Loại bài Mới/Sửa)
                let matchedTarget = targetDetails.find(t => 
                    (t.channelId === channelId || (!t.channelId && !channelId)) && 
                    (t.jobCategory || 'CONTENT') === jobCategory &&
                    Boolean(t.isRework) === isReworkTask // Bắt buộc phải cùng loại bài
                );

                // Nếu không thấy Target cho kênh cụ thể, tìm Target dùng chung (Khâu + Loại bài Mới/Sửa)
                if (!matchedTarget) {
                    matchedTarget = targetDetails.find(t => 
                        (!t.channelId || t.channelId === "") &&
                        (t.jobCategory || 'CONTENT') === jobCategory &&
                        Boolean(t.isRework) === isReworkTask // Bắt buộc phải cùng loại bài
                    );
                }

                // Lấy thời lượng của bài (ưu tiên thời lượng trong chỉ tiêu, nếu không có thì lấy thời lượng thật của Task)
                const tDuration = Number(matchedTarget?.duration || task.duration || 0);

                // 🚀 CHỈ KHI KHỚP CHÍNH XÁC THÌ MỚI HIỂN THỊ VÀO BẢNG CHỈ TIÊU CHI TIẾT
                if (matchedTarget) {
                    matchedTarget.actualCount = (matchedTarget.actualCount || 0) + 1;
                    matchedTarget.actualMinutes = (matchedTarget.actualMinutes || 0) + tDuration;
                }

                // 🚀 TẤT CẢ CÁC BÀI (kể cả bài sửa không được giao) ĐỀU ĐƯỢC CỘNG VÀO TIẾN ĐỘ TỔNG HỢP
                totalActualMinutes += tDuration;
            });

                    // 3. Tính % KPI (Tổng tiến độ) = Lấy Tổng Thực Tế / Tổng Mục Tiêu
                    percent = totalTargetMinutes > 0 ? Math.round((totalActualMinutes / totalTargetMinutes) * 100) : 0;
                } else {
                    percent = targetValue > 0 ? Math.round((actualCount / targetValue) * 100) : 0;
                }

                return {
                    userId: user.id, fullName: user.fullName, role: user.role, teamName: user.team?.name || "Chưa có team",
                    targetValue, actualValue: actualCount, percent, logs: allUserLogs,
                    targetDetails, totalTargetMinutes, totalActualMinutes,
                    note: kpiRecord?.note || "", isLocked: kpiRecord?.isLocked || false,
                    oldTargetValue: kpiRecord?.oldTargetValue || null, avatarUrl: user.avatarUrl || null,
                    cappedActualMinutesForPercent: totalActualMinutes
                };
            });
        };

        if (weekIndex !== 0) {
            const kpiData = await calculateKpiForWeek(weekIndex);
            kpiData.sort((a, b) => b.percent - a.percent);
            const { start, end } = getWeekDateRangeByMonth(year, month, weekIndex);
            return NextResponse.json({ weekData: { year, month, weekIndex, startDate: start, endDate: end }, kpiList: kpiData });
        } else {
            const totalWeeksInMonth = [1, 2, 3, 4, 5];
            const allWeeksData = await Promise.all(totalWeeksInMonth.map(w => calculateKpiForWeek(w)));

            const monthlyKpiData = users.map(user => {
                let monthTargetValue = 0;
                let monthActualValue = 0;
                let monthTotalTargetMinutes = 0;
                let monthCappedActualMinutes = 0;
                let monthTotalActualMinutes = 0;
                let allLogs: any[] = [];
                let isAnyWeekLocked = false;

                let weeklyPercents: Record<number, number> = {};

                allWeeksData.forEach((weekData, index) => {
                    const weekNum = index + 1;
                    const userWeekKpi = weekData.find((k: any) => k.userId === user.id);
                    if (userWeekKpi) {
                        monthTargetValue += userWeekKpi.targetValue;
                        monthActualValue += userWeekKpi.actualValue;
                        monthTotalTargetMinutes += userWeekKpi.totalTargetMinutes;
                        monthCappedActualMinutes += userWeekKpi.cappedActualMinutesForPercent;
                        monthTotalActualMinutes += userWeekKpi.totalActualMinutes;
                        allLogs = [...allLogs, ...userWeekKpi.logs];
                        if (userWeekKpi.isLocked) isAnyWeekLocked = true;

                        weeklyPercents[weekNum] = userWeekKpi.percent;
                    } else {
                        weeklyPercents[weekNum] = 0;
                    }
                });

                allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                let monthPercent = 0;
                if (monthTotalTargetMinutes > 0) {
                    monthPercent = Math.round((monthTotalActualMinutes / monthTotalTargetMinutes) * 100);
                } else if (monthTargetValue > 0) {
                    monthPercent = Math.round((monthActualValue / monthTargetValue) * 100);
                }

                return {
                    userId: user.id, fullName: user.fullName, role: user.role, teamName: user.team?.name || "Chưa có team",
                    targetValue: monthTargetValue,
                    actualValue: monthActualValue,
                    percent: monthPercent,
                    logs: allLogs,
                    targetDetails: [],
                    totalTargetMinutes: monthTotalTargetMinutes,
                    totalActualMinutes: monthTotalActualMinutes,
                    note: "Hiển thị chế độ Tổng cả tháng",
                    isLocked: isAnyWeekLocked,
                    oldTargetValue: null,
                    avatarUrl: user.avatarUrl || null,
                    weeklyPercents
                };
            });

            monthlyKpiData.sort((a, b) => b.percent - a.percent);

            const monthStart = getWeekDateRangeByMonth(year, month, 1).start;
            const monthEnd = getWeekDateRangeByMonth(year, month, 5).end;

            return NextResponse.json({ weekData: { year, month, weekIndex: 0, startDate: monthStart, endDate: monthEnd }, kpiList: monthlyKpiData });
        }

    } catch (error) {
        console.error("LỖI API KPI GET:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const currentUser = session?.user as any;

        const hasPermission = currentUser?.permissions?.includes("MENU_KPI") || currentUser?.role === "ADMIN" || currentUser?.role === "LEADER";

        if (!hasPermission) {
            return NextResponse.json({ error: "Chỉ Quản lý mới được giao KPI" }, { status: 403 });
        }

        const body = await req.json();
        const { userId, year, month, weekNumber, targetValue, targetDetails, note } = body;

        const pYear = parseInt(year);
        const pMonth = parseInt(month);
        const pWeek = parseInt(weekNumber);
        const pTarget = parseInt(targetValue);

        if (!userId || !pYear || !pMonth || !pWeek || isNaN(pTarget)) {
            return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
        }

        if (pWeek === 0) {
            return NextResponse.json({ error: "Không thể gán chỉ tiêu cho chế độ xem Cả tháng. Vui lòng chọn từng tuần cụ thể." }, { status: 400 });
        }

        const existingKPI = await prisma.weeklyKPI.findFirst({
            where: {
                userId: userId,
                year: pYear,
                month: pMonth,
                weekNumber: pWeek
            }
        });

        const isAdminOrHR = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser?.role);
        if (existingKPI?.isLocked && !isAdminOrHR) {
            return NextResponse.json({ error: "Tuần này đã bị chốt KPI, không thể chỉnh sửa!" }, { status: 403 });
        }

        const targetDetailsJson = targetDetails ? targetDetails : [];
        let kpiRecord;
        let finalNote = note || "";

        if (existingKPI) {
            let oldTargetToSave = existingKPI.oldTargetValue;
            if (existingKPI.targetValue !== pTarget) {
                oldTargetToSave = existingKPI.targetValue;
            }

            // 🚀 BẮT ĐẦU LOGIC TRACKING TỰ ĐỘNG SINH GHI CHÚ
            try {
                const oldDetails = (typeof existingKPI.targetDetails === 'string')
                    ? JSON.parse(existingKPI.targetDetails)
                    : (existingKPI.targetDetails || []);

                const newDetails = targetDetailsJson;

                const oldMap = new Map();
                oldDetails.forEach((d: any) => {
                    const key = `${d.channelName || "Kênh chung"} (${d.jobCategory || "GENERAL"})`;
                    oldMap.set(key, (oldMap.get(key) || 0) + Number(d.targetCount));
                });

                const newMap = new Map();
                newDetails.forEach((d: any) => {
                    const key = `${d.channelName || "Kênh chung"} (${d.jobCategory || "GENERAL"})`;
                    newMap.set(key, (newMap.get(key) || 0) + Number(d.targetCount));
                });

                let changes: string[] = [];
                // Bóc tách sự thay đổi hoặc thêm mới
                newMap.forEach((newCount, key) => {
                    const oldCount = oldMap.get(key) || 0;
                    if (newCount !== oldCount) {
                        changes.push(`• ${key}: ${oldCount} ➔ ${newCount} bài`);
                    }
                });
                // Bóc tách dữ liệu bị xóa đi (0 bài)
                oldMap.forEach((oldCount, key) => {
                    if (!newMap.has(key)) {
                        changes.push(`• ${key}: ${oldCount} ➔ 0 bài`);
                    }
                });

                // Nếu có sự thay đổi, tự động tạo chuỗi Log và nối vào Ghi chú
                if (changes.length > 0) {
                    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
                    const editorName = currentUser?.fullName || "Hệ thống";
                    const autoLog = `[${timeStr} - ${editorName} sửa]:\n${changes.join('\n')}`;

                    finalNote = finalNote ? `${finalNote.trim()}\n\n${autoLog}` : autoLog;
                }
            } catch (e) {
                console.error("Lỗi track thay đổi KPI", e);
            }
            // 🚀 KẾT THÚC LOGIC TRACKING

            kpiRecord = await prisma.weeklyKPI.update({
                where: { id: existingKPI.id },
                data: {
                    targetValue: pTarget,
                    oldTargetValue: oldTargetToSave,
                    targetDetails: targetDetailsJson,
                    note: finalNote
                }
            });
        } else {
            kpiRecord = await prisma.weeklyKPI.create({
                data: {
                    userId, year: pYear, month: pMonth, weekNumber: pWeek,
                    targetValue: pTarget,
                    targetDetails: targetDetailsJson,
                    note: note || null
                }
            });
        }

        return NextResponse.json({ message: "Giao KPI thành công", data: kpiRecord }, { status: 200 });
    } catch (error) {
        console.error("LỖI GÁN KPI:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}