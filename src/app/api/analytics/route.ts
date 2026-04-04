import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        if (!["ADMIN", "BAN_GIAM_DOC"].includes(currentUser.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());
        const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
        const teamId = searchParams.get("teamId") || "ALL";

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const teamFilter = teamId !== "ALL" ? { teamId } : {};

        // 🚀 BẮN MULTI-QUERY LẤY THÊM BẢNG REQUEST (ĐỀ XUẤT)
        const [
            teams,
            users,
            taskLogsThisMonth,
            kpisThisMonth,
            requestsThisMonth
        ] = await Promise.all([
            prisma.team.findMany({
                where: { users: { some: { role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR"] } } } },
                select: { id: true, name: true }
            }),
            prisma.user.findMany({
                where: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR"] } },
                select: { id: true, fullName: true, role: true, isActive: true, createdAt: true, teamId: true }
            }),
            prisma.taskLog.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR"] } },
                    // 🚀 PHẢI CÓ COMPLETE_TASK Ở ĐÂY
                    action: {
                        in: ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"]
                    }
                },
                include: { user: { select: { role: true } } }
            }),
            prisma.weeklyKPI.findMany({
                where: { month, year, user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR"] } } },
                include: { user: { select: { id: true } } }
            }),
            // Lấy tất cả Request (Đề xuất) trong tháng
            prisma.request.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    ...teamFilter // Lọc đơn theo Team nếu có
                }
            })
        ]);

        // ==========================================
        // 🧠 XỬ LÝ SỐ LIỆU SẢN XUẤT (TASKS & KPI)
        // ==========================================

        const isDoneLog = (l: any) => {
            return ["SUBMIT_SCRIPT", "SUBMIT_VIDEO", "PUBLISH_VIDEO", "COMPLETE_TASK"].includes(l.action) ||
                   (l.action === "UPDATE_STATUS" && l.details && l.details.includes("sang [DONE]"));
        };

        // 🚀 FIX LỖI 1: Dùng Set() gom nhóm theo taskId. Đảm bảo 1 task có 3 log DONE cũng chỉ đếm là 1.
        let totalOutput = new Set(taskLogsThisMonth.filter(isDoneLog).map((l:any) => l.taskId)).size;
        
        // 🚀 FIX LỖI 2: Phân bổ tác vụ đếm trực tiếp bằng chữ "SUBMIT_...", không quan tâm ai là người bấm.
        let scriptCount = new Set(taskLogsThisMonth.filter((l:any) => l.action === "SUBMIT_SCRIPT").map((l:any) => l.taskId)).size;
        let videoCount = new Set(taskLogsThisMonth.filter((l:any) => l.action === "SUBMIT_VIDEO").map((l:any) => l.taskId)).size;
        let publishCount = new Set(taskLogsThisMonth.filter((l:any) => l.action === "PUBLISH_VIDEO" ).map((l:any) => l.taskId)).size;

        // Tính KPI (Sử dụng Set để chống đúp điểm cho nhân viên)
        const userKpiMap: Record<string, { target: number, actualTasks: Set<string> }> = {};
        kpisThisMonth.forEach(kpi => {
            if (!userKpiMap[kpi.userId]) userKpiMap[kpi.userId] = { target: 0, actualTasks: new Set() };
            userKpiMap[kpi.userId].target += kpi.targetValue;
        });
        
        taskLogsThisMonth.forEach(log => {
            if (isDoneLog(log) && userKpiMap[log.userId]) {
                userKpiMap[log.userId].actualTasks.add(log.taskId); // Thêm ID task vào mảng lưới lọc
            }
        });

        let hrHealth = { excellent: 0, good: 0, pip: 0 };
        Object.values(userKpiMap).forEach(d => {
            const actual = d.actualTasks.size; // Lấy số lượng thực tế sau khi đã lọc trùng
            const p = d.target > 0 ? (actual / d.target) * 100 : 0;
            if (p >= 100) hrHealth.excellent++;
            else if (p >= 80) hrHealth.good++;
            else if (d.target > 0) hrHealth.pip++;
        });

        // ==========================================
        // 💰 XỬ LÝ SỐ LIỆU HÀNH CHÍNH / ĐỀ XUẤT (REQUESTS)
        // ==========================================
        let pendingRequestsCount = 0;
        const requestTypes = { hr: 0, finance: 0, equipment: 0, ads: 0 };
        const userPendingReqMap: Record<string, number> = {};

        requestsThisMonth.forEach(req => {
            // Đếm số đơn chờ duyệt
            if (req.status === "PENDING_1" || req.status === "PENDING_2") {
                pendingRequestsCount++;
                userPendingReqMap[req.requesterId] = (userPendingReqMap[req.requesterId] || 0) + 1;
            }
            // Phân loại nhóm đơn
            if (["NGHI_PHEP", "DI_MUON_VE_SOM", "LAM_REMOTE"].includes(req.type)) requestTypes.hr++;
            else if (["TAM_UNG", "THUONG", "THANH_TOAN"].includes(req.type)) requestTypes.finance++;
            else if (req.type === "MUA_SAM") requestTypes.equipment++;
            else if (req.type === "CHAY_ADS") requestTypes.ads++;
        });



        const trendPromises = [];
        // Lặp 6 lần để lấy data của tháng hiện tại và 5 tháng trước đó
        for (let i = 5; i >= 0; i--) {
            let d = new Date(year, month - 1 - i, 1);
            let m = d.getMonth() + 1;
            let y = d.getFullYear();
            let dStart = new Date(y, m - 1, 1);
            let dEnd = new Date(y, m, 0, 23, 59, 59);

            // Bắn truy vấn lấy Target (KPI) và Actual (TaskLog) của từng tháng
            trendPromises.push(
                Promise.all([
                    prisma.weeklyKPI.findMany({
                        where: { month: m, year: y, user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR"] } } }
                    }),

                    // 🚀 SỬA Ở ĐÂY: Chỉ đếm số lượng Task đã chốt DONE (Đường Xanh)
                    prisma.taskLog.count({
                        where: {
                            createdAt: { gte: dStart, lte: dEnd },
                            user: { ...teamFilter, role: { notIn: ["ADMIN", "BAN_GIAM_DOC", "HR"] } },
                            // Chỉ lấy log Đóng task (Cron Job) HOẶC Kéo thẻ sang DONE (Real-time)

                            OR: [
                                { action: "COMPLETE_TASK" },
                                { action: "UPDATE_STATUS", details: { contains: "sang [DONE]" } }
                            ]
                        }
                    })
                ]).then(([kpis, actualCount]) => ({
                    name: `T${m < 10 ? '0' + m : m}`,
                    Target: kpis.reduce((sum, k) => sum + k.targetValue, 0),
                    Actual: actualCount // <-- Trả về số lượng Task thực tế hoàn thành
                }))
            );
        }

        // ==========================================
        // ⏱️ XỬ LÝ SỐ LIỆU LEAD TIME (ĐIỂM NGHẼN)
        // Lấy toàn bộ lịch sử của các Task có hoạt động trong tháng
        // ==========================================
        const activeTaskIds = [...new Set(taskLogsThisMonth.map(l => l.taskId))];
        
        const fullTaskLogs = await prisma.taskLog.findMany({
            where: { taskId: { in: activeTaskIds } },
            orderBy: { createdAt: 'asc' }
        });

        const logsByTask: Record<string, any[]> = {};
        fullTaskLogs.forEach(log => {
            if (!logsByTask[log.taskId]) logsByTask[log.taskId] = [];
            logsByTask[log.taskId].push(log);
        });

        let scriptTimeTotal = 0, scriptCountLT = 0;
        let videoTimeTotal = 0, videoCountLT = 0;
        let publishTimeTotal = 0, publishCountLT = 0;

        Object.values(logsByTask).forEach(logs => {
            // Tìm thời điểm xảy ra các hành động (Lấy mốc đầu tiên nếu bị bấm nhiều lần)
            const createTime = logs.find(l => l.action === "CREATE_TASK")?.createdAt?.getTime() || logs[0]?.createdAt?.getTime(); 
            const scriptTime = logs.find(l => l.action === "SUBMIT_SCRIPT")?.createdAt?.getTime();
            const videoTime = logs.find(l => l.action === "SUBMIT_VIDEO")?.createdAt?.getTime();
            const publishTime = logs.find(l => l.action === "PUBLISH_VIDEO" || l.action === "COMPLETE_TASK")?.createdAt?.getTime();

            // Tính số ngày (1 ngày = 1000 * 60 * 60 * 24 milliseconds)
            if (createTime && scriptTime && scriptTime > createTime) {
                scriptTimeTotal += (scriptTime - createTime) / 86400000;
                scriptCountLT++;
            }
            if (scriptTime && videoTime && videoTime > scriptTime) {
                videoTimeTotal += (videoTime - scriptTime) / 86400000;
                videoCountLT++;
            }
            if (videoTime && publishTime && publishTime > videoTime) {
                publishTimeTotal += (publishTime - videoTime) / 86400000;
                publishCountLT++;
            }
        });

        const leadTimeData = [
            { name: "Viết Kịch bản", days: scriptCountLT ? Number((scriptTimeTotal / scriptCountLT).toFixed(1)) : 0 },
            { name: "Dựng Video", days: videoCountLT ? Number((videoTimeTotal / videoCountLT).toFixed(1)) : 0 },
            { name: "Duyệt & Đăng", days: publishCountLT ? Number((publishTimeTotal / publishCountLT).toFixed(1)) : 0 },
        ];

        // Đợi cả 6 tháng query xong
        const trendData = await Promise.all(trendPromises);
        // ==========================================
        // 📦 TRẢ DỮ LIỆU VỀ CHO FRONTEND
        // ==========================================
        return NextResponse.json({
            teams,
            trendData, // 🚀 BƠM DATA 6 THÁNG VÀO ĐÂY
            leadTimeData,
            stats: {
                totalOutput,
                avgKpi: kpisThisMonth.length > 0 ? Math.round((totalOutput / kpisThisMonth.reduce((a, b) => a + b.targetValue, 0)) * 100) : 0,
                pendingRequestsCount,
                currentHeadcount: users.filter(u => u.isActive).length,
                newHires: users.filter(u => u.createdAt >= startDate && u.createdAt <= endDate).length,
                resigns: users.filter(u => !u.isActive).length
            },
            // ... (Phần allocation, requestBreakdown, hrHealth, hrGrid sếp giữ nguyên như cũ nhé)
            allocation: [
                { name: "Kịch bản (Content)", value: scriptCount, fill: "#3b82f6" },
                { name: "Dựng Video (Editor)", value: videoCount, fill: "#eab308" },
                { name: "Lên Kênh (Manager)", value: publishCount, fill: "#a855f7" },
            ],
            requestBreakdown: [
                { name: "Nghỉ phép/Remote", value: requestTypes.hr, fill: "#94a3b8" },
                { name: "Tài chính/Tạm ứng", value: requestTypes.finance, fill: "#f97316" },
                { name: "Mua sắm thiết bị", value: requestTypes.equipment, fill: "#06b6d4" },
                { name: "Chạy Ads", value: requestTypes.ads, fill: "#ec4899" },
            ],
            hrHealth: [
                { name: "Xuất Sắc (>100%)", value: hrHealth.excellent, fill: "#10b981" },
                { name: "Khá/TB (80-100%)", value: hrHealth.good, fill: "#f59e0b" },
                { name: "Báo động (<80%)", value: hrHealth.pip, fill: "#ef4444" }
            ],
            hrGrid: users.map(u => {
                const actual = userKpiMap[u.id]?.actualTasks.size || 0;
                const target = userKpiMap[u.id]?.target || 0;
                return {
                    id: u.id, name: u.fullName, role: u.role,
                    kpi: target > 0 ? Math.round((actual / target) * 100) : 0,
                    // Lọc trùng cho output của cá nhân
                    output: new Set(taskLogsThisMonth.filter(l => l.userId === u.id && isDoneLog(l)).map(l => l.taskId)).size,
                    pendingReq: userPendingReqMap[u.id] || 0,
                    status: u.isActive ? "Active" : "Nghỉ việc"
                };
            }).sort((a,b) => b.output - a.output)
        });

    } catch (error) {
        console.error("Analytics API Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}