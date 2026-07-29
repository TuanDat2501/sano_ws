import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getCurrentWeekNumber(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth(); 
    const firstDayOfMonth = new Date(year, month, 1);
    
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month, 1 + diffToMonday);

    const targetTime = date.getTime();

    for (let w = 1; w <= 5; w++) {
        const startOfWeek = new Date(startOfFirstWeek);
        startOfWeek.setDate(startOfFirstWeek.getDate() + (w - 1) * 7);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        if (targetTime >= startOfWeek.getTime() && targetTime <= endOfWeek.getTime()) {
            return w > 4 ? 4 : w; 
        }
    }
    return 1;
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const currentUser = session.user as any;
        const role = currentUser.role;
        const userId = currentUser.id;
        const teamId = currentUser.teamId;

        const isTopManagement = ["ADMIN", "BAN_GIAM_DOC"].includes(role);
        const isLeader = role === "LEADER";
        const isManager = isTopManagement || isLeader;

        const today = new Date();
        const startOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(today.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7); // Tính lùi 7 ngày cho query DB
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const currentWeekNum = getCurrentWeekNumber(today);

        // 🚀 THUẬT TOÁN TẠO SẴN KHUNG 7 NGÀY ĐẦY ĐỦ (Bao gồm cả hôm nay)
        const generateEmpty7DaysChart = () => {
            const chartTemplate = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const dateStr = d.toLocaleDateString('vi-VN', { 
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' 
                }).replace('/', '-');
                chartTemplate.push({ date: dateStr, done: 0 }); // Khởi tạo 0 bài
            }
            return chartTemplate;
        };

        // ==========================================
        // 👑 LUỒNG DATA CHO QUẢN LÝ (BGD / ADMIN / LEADER)
        // ==========================================
        if (isManager) {
            let teamUserIds: string[] = [];
            if (!isTopManagement) {
                const teamUsers = await prisma.user.findMany({ 
                    where: { teamId: teamId, isActive: true }, 
                    select: { id: true } 
                });
                teamUserIds = teamUsers.map(u => u.id);
            }

            const taskFilter = isTopManagement ? {} : {
                OR: [
                    { contentId: { in: teamUserIds } },
                    { editorId: { in: teamUserIds } },
                    { publisherId: { in: teamUserIds } },
                    { teamId: teamId } // Chặn thêm đầu rễ cho chắc chắn
                ]
            };

            const userCondition = isTopManagement ? {} : { userId: { in: teamUserIds } };

            // 🚀 ĐỊNH NGHĨA LẠI THẾ NÀO LÀ "TỒN ĐỌNG": Đã tạo quá 3 ngày mà chưa xong
            const threeDaysAgo = new Date(today);
            threeDaysAgo.setDate(today.getDate() - 3);

            const [
                totalActiveTasks,
                totalPendingTasks,
                totalOverdueTasks,
                managerLogs7DaysRaw,
                kpiRecords
            ] = await Promise.all([
                // 1. Task Đang Chạy: Tất cả task chưa chốt sổ
                prisma.task.count({ where: { ...taskFilter, isClosed: false } }),
                
                // 2. Cập nhật các trạng thái Review mới (Content, Animation, Edit)
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        status: { in: ["CONTENT_REVIEW", "ANIMATION_REVIEW", "EDIT_REVIEW", "DONE"] },
                        NOT: [
                            { videoLink: null },
                            { videoLink: "" }
                        ]
                    }
                }),
                
                // 3. Cập nhật các trạng thái Doing mới
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        status: { in: ["TODO", "CONTENT_DOING", "ANIMATION_DOING", "EDIT_DOING"] },
                        createdAt: { lt: threeDaysAgo } 
                    }
                }),

                prisma.taskLog.findMany({
                    where: {
                        createdAt: { gte: sevenDaysAgo }, 
                        ...userCondition, 
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT", "MERGE_VIDEO"] }
                    },
                    orderBy: { createdAt: 'desc' }, 
                    include: { user: { select: { fullName: true } } }
                }),

                prisma.weeklyKPI.findMany({
                    where: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum, 
                        ...userCondition 
                    },
                    include: { user: { select: { fullName: true, role: true } } }
                })
            ]);
            const validLogs7Days: any[] = [];
            const dailyReportTracker7Days = new Set<string>();
            managerLogs7DaysRaw.forEach((log: any) => {
                if (log.action === "DAILY_REPORT") {
                    const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
                    const uniqueKey = `${log.userId}_${log.taskId}_${dateStr}`;
                    if (!dailyReportTracker7Days.has(uniqueKey)) {
                        dailyReportTracker7Days.add(uniqueKey);
                        validLogs7Days.push(log);
                    }
                } else {
                    validLogs7Days.push(log);
                }
            });

            const logsThisWeek = validLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);
            
            // 🚀 CÔNG THỨC MỚI CHO QUẢN LÝ: Tính số task duy nhất của TỪNG NHÂN VIÊN, sau đó mới cộng dồn lại
            let totalActual = 0;
            const userTaskMap = new Map<string, Set<string>>(); // Bản đồ lưu userId -> Danh sách các taskId duy nhất
            
            logsThisWeek.forEach((log: any) => {
                if (!userTaskMap.has(log.userId)) {
                    userTaskMap.set(log.userId, new Set());
                }
                // Thêm taskId vào tập hợp (Set) của riêng nhân viên đó (Tự động lọc trùng)
                userTaskMap.get(log.userId)!.add(log.taskId); 
            });

            // Cộng dồn điểm KPI thực tế từ từng cá nhân để ra tổng của Team
            userTaskMap.forEach((uniqueTasks) => {
                totalActual += uniqueTasks.size; 
            });

            // Lấy tổng chỉ tiêu (Target) của cả Team
            let totalTarget = 0;
            kpiRecords.forEach((k: any) => totalTarget += k.targetValue);
            
            // Tỷ lệ hoàn thành = (Tổng bài thực làm / Tổng chỉ tiêu) * 100
            const avgKpiPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

            // 🚀 BẢO ĐẢM BIỂU ĐỒ LUÔN CÓ ĐỦ 7 NGÀY
            const chartDataArray = generateEmpty7DaysChart();
            validLogs7Days.forEach(log => {
                const dateStr = new Date(log.createdAt).toLocaleDateString('vi-VN', { 
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' 
                }).replace('/', '-');
                
                // Tìm ngày tương ứng trong khung và cộng điểm
                const existingDay = chartDataArray.find(d => d.date === dateStr);
                if (existingDay) {
                    existingDay.done++;
                }
            });

            const mappedLogsThisWeek = logsThisWeek.map((log: any) => {
                let typeStr = "Khác";
                if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                else if (log.action === "DAILY_REPORT") typeStr = "Báo cáo ngày";
                return { ...log, typeStr };
            });

            return NextResponse.json({
                role: "MANAGER", 
                dbRole: role,    
                isTopManagement,
                stats: {
                    activeTasks: totalActiveTasks,
                    kpiPercent: avgKpiPercent,
                    pendingQC: totalPendingTasks,
                    overdue: totalOverdueTasks
                },
                logs: mappedLogsThisWeek,
                kpis: kpiRecords,
                chartData: chartDataArray
            });
        }

        // ==========================================
        // 👷 LUỒNG DATA CHO NHÂN VIÊN (CONTENT / EDITOR / PUBLISHER)
        // ==========================================
        else {
            const [
                myActiveTasks,
                myLogsAllTimeRaw,
                myLogs7DaysRaw,
                myKpiThisWeek
            ] = await Promise.all([
                prisma.task.findMany({
                    where: {
                        isClosed: false,
                        OR: [
                            { contentId: userId, OR: [{scriptLink: {equals: ""}}, {scriptLink: null}] },
                            { editorId: userId, OR: [{videoLink: {equals: ""}}, {videoLink: null}] },
                            { publisherId: userId, OR: [{publishLink: {equals: ""}}, {publishLink: null}] }
                        ]
                    },
                    select: { id: true, title: true, createdAt: true }
                }),

                prisma.taskLog.findMany({
                    where: { 
                        userId: userId,
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] }
                    },
                    select: { taskId: true, action: true, createdAt: true }
                }),

                prisma.taskLog.findMany({
                    where: {
                        userId: userId,
                        createdAt: { gte: sevenDaysAgo },
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK", "DAILY_REPORT"] }
                    },
                    orderBy: { createdAt: 'desc' },
                    include: { task: { select: { title: true } } }
                }),

                prisma.weeklyKPI.findFirst({
                    where: {
                        userId: userId,
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: currentWeekNum
                    }
                })
            ]);

            const validLogs7Days: any[] = [];
            const dailyReportTracker7Days = new Set<string>();
            myLogs7DaysRaw.forEach(log => {
                if (log.action === "DAILY_REPORT") {
                    const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
                    const uniqueKey = `${log.taskId}_${dateStr}`;
                    if (!dailyReportTracker7Days.has(uniqueKey)) {
                        dailyReportTracker7Days.add(uniqueKey);
                        validLogs7Days.push(log);
                    }
                } else {
                    validLogs7Days.push(log);
                }
            });

            const logsThisWeek = validLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);
            
            // 🚀 CÔNG THỨC MỚI (TUẦN) CHO NHÂN VIÊN: Đếm số Task duy nhất trong tuần
            const uniqueTasksThisWeek = new Set(logsThisWeek.map((log: any) => log.taskId));
            const actualThisWeek = uniqueTasksThisWeek.size;
            
            const target = myKpiThisWeek?.targetValue || 0;
            const kpiPercent = target > 0 ? Math.round((actualThisWeek / target) * 100) : 0;

            // 🚀 CÔNG THỨC MỚI (ALL TIME) CHO NHÂN VIÊN: Đếm tổng số Task duy nhất từ trước đến nay
            const uniqueTasksAllTime = new Set(myLogsAllTimeRaw.map((log: any) => log.taskId));
            const myLogsAllTime = uniqueTasksAllTime.size;

            // 🚀 BẢO ĐẢM BIỂU ĐỒ LUÔN CÓ ĐỦ 7 NGÀY (NHÂN VIÊN)
            const chartDataArray = generateEmpty7DaysChart();
            validLogs7Days.forEach(log => {
                const dateStr = new Date(log.createdAt).toLocaleDateString('vi-VN', { 
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' 
                }).replace('/', '-');
                
                const existingDay = chartDataArray.find(d => d.date === dateStr);
                if (existingDay) {
                    existingDay.done++;
                }
            });

            const mappedRecentLogs = validLogs7Days.map((log: any) => {
                let typeStr = "Khác";
                if (log.action === "SUBMIT_SCRIPT") typeStr = "Script";
                else if (log.action === "SUBMIT_VIDEO") typeStr = "Edit";
                else if (log.action === "PUBLISH_VIDEO") typeStr = "Publish";
                else if (log.action === "COMPLETE_TASK") typeStr = "Nghiệm thu";
                else if (log.action === "DAILY_REPORT") typeStr = "Báo cáo ngày";
                return { ...log, typeStr };
            });

            return NextResponse.json({
                role: "EMPLOYEE", 
                dbRole: role,     
                stats: {
                    pendingTasks: myActiveTasks.length, // Lấy an toàn số lượng Task đang xử lý
                    lifetimeLogs: myLogsAllTime,
                    kpiPercent: kpiPercent,
                    targetThisWeek: target,
                    actualThisWeek: actualThisWeek
                },
                recentLogs: mappedRecentLogs, 
                chartData: chartDataArray 
            });
        }
    } catch (error) {
        console.error("LỖI API DASHBOARD:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}