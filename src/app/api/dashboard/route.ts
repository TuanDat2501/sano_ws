import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

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
            // 🚀 GIẢI PHÁP CHỐNG LỖI PRISMA: Lấy danh sách ID nhân viên trước
            let teamUserIds: string[] = [];
            if (!isTopManagement) {
                const teamUsers = await prisma.user.findMany({ 
                    where: { teamId: teamId, isActive: true }, 
                    select: { id: true } 
                });
                teamUserIds = teamUsers.map(u => u.id);
            }

            // 🚀 Bộ lọc Task cực chuẩn: Tìm những task mà người làm nằm trong mảng teamUserIds
            const taskFilter = isTopManagement ? {} : {
                OR: [
                    { contentId: { in: teamUserIds } },
                    { editorId: { in: teamUserIds } },
                    { publisherId: { in: teamUserIds } }
                ]
            };

            // 🚀 Bộ lọc User cho Log và KPI
            const userCondition = isTopManagement ? {} : { userId: { in: teamUserIds } };

            // Dùng Promise.all để bắn song song nhiều Query cùng lúc (Chống sập server)
            const [
                totalActiveTasks,
                totalPendingTasks,
                totalOverdueTasks,
                logsThisWeek,
                kpiRecords
            ] = await Promise.all([
                // 1. Tổng Task đang chạy (Chưa đóng)
                prisma.task.count({ 
                    where: { ...taskFilter, isClosed: false } 
                }),
                
                // 2. Chờ nghiệm thu (Task đã có ít nhất 1 link nhưng chưa đóng)
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

                // 3. Tồn đọng/Cảnh báo (Task giao rồi nhưng trống Link)
                prisma.task.count({
                    where: {
                        ...taskFilter,
                        isClosed: false,
                        scriptLink: { equals: "" },
                        videoLink: { equals: "" },
                        publishLink: { equals: "" }
                    }
                }),

                // 4. Lấy toàn bộ Log trong tuần để vẽ biểu đồ Sản lượng
                prisma.taskLog.findMany({
                    where: {
                        createdAt: { gte: startOfWeek },
                        ...userCondition, // Ép theo userId thuộc team
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO"] }
                    },
                    include: { user: { select: { fullName: true } } }
                }),

                // 5. Lấy KPI tuần này để vẽ Bảng Phong Thần
                prisma.weeklyKPI.findMany({
                    where: {
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: Math.ceil(today.getDate() / 7) > 4 ? 4 : Math.ceil(today.getDate() / 7),
                        ...userCondition // Ép theo userId thuộc team
                    },
                    include: { user: { select: { fullName: true, role: true } } }
                })
            ]);

            // Tính % KPI Trung bình của toàn cty/team
            let totalTarget = 0;
            kpiRecords.forEach((k: any) => totalTarget += k.targetValue);
            const totalActual = logsThisWeek.length;
            const avgKpiPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

            // Đóng gói JSON trả về cho Frontend
            return NextResponse.json({
                role: "MANAGER", // Vẫn giữ nguyên để Frontend rẽ nhánh UI cho nhàn
                dbRole: role,    // 🚀 TRẢ VỀ ĐÚNG GIÁ TRỊ TRONG DB (LEADER / BAN_GIAM_DOC / ADMIN) ĐỂ DEBUG
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
                // 1. Việc khẩn đang giữ (Chưa nộp link)
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

                // 2. Góc Thành Tựu (Toàn bộ log từ lúc vào làm)
                prisma.taskLog.count({
                    where: { 
                        userId: userId,
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO"] }
                    }
                }),

                // 3. Biểu đồ Năng suất & Lịch sử 7 ngày qua
                prisma.taskLog.findMany({
                    where: {
                        userId: userId,
                        createdAt: { gte: sevenDaysAgo },
                        action: { in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"] }
                    },
                    orderBy: { createdAt: 'desc' },
                    include: { task: { select: { title: true } } }
                }),

                // 4. Target KPI Tuần này của mình
                prisma.weeklyKPI.findFirst({
                    where: {
                        userId: userId,
                        year: today.getFullYear(),
                        month: today.getMonth() + 1,
                        weekNumber: Math.ceil(today.getDate() / 7) > 4 ? 4 : Math.ceil(today.getDate() / 7)
                    }
                })
            ]);

            // Tính số bài làm được tuần này
            const actualThisWeek = myLogs7Days.filter(log => new Date(log.createdAt) >= startOfWeek).length;
            const target = myKpiThisWeek?.targetValue || 0;
            const kpiPercent = target > 0 ? Math.round((actualThisWeek / target) * 100) : 0;

            return NextResponse.json({
                role: "EMPLOYEE", // Dùng để gọi component DashboardEmployee
                dbRole: role,     // 🚀 TRẢ VỀ ĐÚNG GIÁ TRỊ (CONTENT / EDITOR / PUBLISHER)
                stats: {
                    pendingTasks: myActiveTasks,
                    lifetimeLogs: myLogsAllTime,
                    kpiPercent: kpiPercent,
                    targetThisWeek: target,
                    actualThisWeek: actualThisWeek
                },
                recentLogs: myLogs7Days
            });
        }
    } catch (error) {
        console.error("LỖI API DASHBOARD:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}