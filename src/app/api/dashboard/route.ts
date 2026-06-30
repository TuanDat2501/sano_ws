import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
export const dynamic = "force-dynamic";

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

        // Lấy thời gian mốc (Tuần hiện tại & 7 ngày qua)
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Lùi về Thứ 2
        startOfWeek.setHours(0, 0, 0, 0);
        
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

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
                    { publisherId: { in: teamUserIds } }
                ]
            };

            const userCondition = isTopManagement ? {} : { userId: { in: teamUserIds } };

            const [
                totalActiveTasks,
                totalPendingTasks,
                totalOverdueTasks,
                logsThisWeek,
                kpiRecords
            ] = await Promise.all([
                prisma.task.count({ where: { ...taskFilter, isClosed: false } }),
                
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        OR: [
                            { scriptLink: { not: null } },
                            { videoLink: { not: null } },
                            { publishLink: { not: null } }
                        ]
                    }
                }),

                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        scriptLink: { equals: "" },
                        videoLink: { equals: "" },
                        publishLink: { equals: "" }
                    }
                }),

                prisma.taskLog.findMany({
                    where: {
                        createdAt: { gte: startOfWeek },
                        ...userCondition, 
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO"] }
                    },
                    include: { user: { select: { fullName: true } } }
                }),

                prisma.weeklyKPI.findMany({
                    where: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: Math.ceil(today.getDate() / 7) > 4 ? 4 : Math.ceil(today.getDate() / 7),
                        ...userCondition 
                    },
                    include: { user: { select: { fullName: true, role: true } } }
                })
            ]);

            // 🚀 ĐÃ FIX: Tính tổng số Task độc nhất (Lọc trùng Task ID)
            let totalTarget = 0;
            kpiRecords.forEach((k: any) => totalTarget += k.targetValue);
            
            const uniqueTasksManager = new Set(logsThisWeek.map((log: any) => log.taskId));
            const totalActual = uniqueTasksManager.size; // Đếm size của Set thay vì length của mảng
            
            const avgKpiPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

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
                logs: logsThisWeek,
                kpis: kpiRecords
            });
        }

        // ==========================================
        // 👷 LUỒNG DATA CHO NHÂN VIÊN (CONTENT / EDITOR / PUBLISHER)
        // ==========================================
        else {
            const [
                myActiveTasks,
                myLogsAllTime,
                myLogs7Days,
                myKpiThisWeek
            ] = await Promise.all([
                prisma.task.findMany({
                    where: {
                        isClosed: false,
                        OR: [
                            { contentId: userId, scriptLink: { equals: "" } },
                            { editorId: userId, videoLink: { equals: "" } },
                            { publisherId: userId, publishLink: { equals: "" } }
                        ]
                    },
                    select: { id: true, title: true, createdAt: true }
                }),

                // 🚀 ĐÃ FIX: Góc thành tựu đếm theo số lượng TASK, không phải số lượng LOG
                prisma.taskLog.findMany({
                    where: { 
                        userId: userId,
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"] }
                    },
                    select: { taskId: true } // Chỉ lấy taskId cho nhẹ
                }).then(logs => new Set(logs.map(l => l.taskId)).size),

                prisma.taskLog.findMany({
                    where: {
                        userId: userId,
                        createdAt: { gte: sevenDaysAgo },
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"] }
                    },
                    orderBy: { createdAt: 'desc' },
                    include: { task: { select: { title: true } } }
                }),

                prisma.weeklyKPI.findFirst({
                    where: {
                        userId: userId,
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: Math.ceil(today.getDate() / 7) > 4 ? 4 : Math.ceil(today.getDate() / 7)
                    }
                })
            ]);

            // 🚀 ĐÃ FIX: Tính số bài làm được tuần này (Lọc trùng Task ID)
            const logsThisWeek = myLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek);
            const actualThisWeek = new Set(logsThisWeek.map((log: any) => log.taskId)).size;
            
            const target = myKpiThisWeek?.targetValue || 0;
            const kpiPercent = target > 0 ? Math.round((actualThisWeek / target) * 100) : 0;

            // 🚀 MỚI: Format sẵn Data cho Biểu đồ Năng suất (Chống hover ra 3)
            const chartDataMap: Record<string, Set<string>> = {};
            myLogs7Days.forEach(log => {
                const dateStr = new Date(log.createdAt).toLocaleDateString('vi-VN', { 
                    day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' 
                }).replace('/', '-');
                
                if (!chartDataMap[dateStr]) chartDataMap[dateStr] = new Set();
                chartDataMap[dateStr].add(log.taskId); // Add vào Set để tự triệt tiêu trùng lặp
            });

            // Biến Object thành Array để chart dễ dùng: [{ date: '08-04', done: 1 }, ...]
            const chartDataArray = Object.keys(chartDataMap).map(date => ({
                date: date,
                done: chartDataMap[date].size
            })).reverse(); // Đảo ngược để ngày cũ lên trước, ngày mới xuống sau

            return NextResponse.json({
                role: "EMPLOYEE", 
                dbRole: role,     
                stats: {
                    pendingTasks: myActiveTasks,
                    lifetimeLogs: myLogsAllTime,
                    kpiPercent: kpiPercent,
                    targetThisWeek: target,
                    actualThisWeek: actualThisWeek
                },
                recentLogs: myLogs7Days, // Vẫn trả về danh sách log để hiển thị bảng lịch sử
                chartData: chartDataArray // 👈 TRẢ VỀ CỤC DATA SẠCH NÀY CHO BIỂU ĐỒ
            });
        }
    } catch (error) {
        console.error("LỖI API DASHBOARD:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}