import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// 1. CHUẨN BỊ BỘ HEADERS CORS CHO MOBILE
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 2. 🚀 XỬ LÝ OPTIONS (CORS PREFLIGHT) - RẤT QUAN TRỌNG
// Không có cái này App Mobile gọi GET sẽ bị chặn ngay lập tức
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Không có quyền truy cập!" }, { status: 401, headers: corsHeaders });
        }

        const token = authHeader.split(" ")[1];
        const secretKey = process.env.NEXTAUTH_SECRET || "sano_super_secret_key_2026";
        
        let decodedPayload;
        try {
            decodedPayload = jwt.verify(token, secretKey) as { id: string, role: string };
        } catch (err) {
            return NextResponse.json({ error: "Token không hợp lệ!" }, { status: 403, headers: corsHeaders });
        }

        const userId = decodedPayload.id;
        const role = decodedPayload.role;
        const isAdmin = role === 'ADMIN' || role === 'BAN_GIAM_DOC';

        if (isAdmin) {
            // 1. Kéo dữ liệu cơ bản từ DB
            const [videoDone, pendingReqs, allLeaveRequests, totalStaff] = await Promise.all([
                prisma.task.count({ where: { status: 'DONE' } }),
                prisma.request.count({ where: { status: { in: ['PENDING_1', 'PENDING_2'] } } }),
                
                // Kéo tất cả đơn NGHI_PHEP đã duyệt lên (chưa lọc ngày)
                prisma.request.findMany({
                    where: {
                        type: 'NGHI_PHEP',
                        status: 'APPROVED'
                    },
                    select: { contentData: true } // Chỉ lấy cột JSON cho nhẹ
                }),

                prisma.user.count({ where: { role: { not: 'ADMIN' } } })
            ]);

            // 2. Lọc bằng Javascript để đếm số người nghỉ HÔM NAY trong cột Json
            let absentToday = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset giờ phút giây về 0 để so sánh chuẩn ngày

            allLeaveRequests.forEach(req => {
                const data = req.contentData as any;
                
                // Nếu là đơn Nghỉ phép (có startDate và endDate)
                if (data && data.startDate && data.endDate) {
                    const start = new Date(data.startDate);
                    const end = new Date(data.endDate);
                    end.setHours(23, 59, 59, 999); // Bao trọn hết ngày cuối cùng

                    // Nếu ngày hôm nay nằm trong khoảng từ Start đến End
                    if (today >= start && today <= end) {
                        absentToday++;
                    }
                }
                
                // Nếu là đơn Làm Remote/Đi muộn (chỉ có cột date)
                else if (data && data.date) {
                    const reqDate = new Date(data.date);
                    if (reqDate.toDateString() === today.toDateString()) {
                        absentToday++;
                    }
                }
            });

            return NextResponse.json({
                roleType: 'ADMIN',
                stats: { 
                    videoDone, 
                    pendingReqs, 
                    absentToday, 
                    activeStaff: totalStaff - absentToday 
                },
                kpi: 82 
            }, { status: 200, headers: corsHeaders });
        } 
        
        else {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            
            // Tính tuần thứ mấy trong tháng (logic đơn giản)
            const weekNumber = Math.ceil(now.getDate() / 7);
            const userInvolvedCondition = {
                OR: [
                    { assigneeId: userId }, // Đang cầm trịch (Hot potato)
                    { contentId: userId },  // Là người viết kịch bản
                    { editorId: userId },   // Là người dựng video
                    { publisherId: userId } // Là người đăng bài
                ]
            };
            const [kpiData, tasksDoneThisWeek, activeTasks, recentNotifs] = await Promise.all([
                // 1. Lấy mục tiêu tuần từ bảng WeeklyKPI
                prisma.weeklyKPI.findUnique({
                    where: { user_time_unique: { userId, year, month, weekNumber } }
                }),
                // 2. Đếm số Task đã DONE trong tuần này
                prisma.task.count({
                    where: { 
                        ...userInvolvedCondition,
                        status: 'DONE',
                        updatedAt: { gte: new Date(now.setDate(now.getDate() - now.getDay())) } // Từ đầu tuần
                    }
                }),
               
                // 3. Lấy 3 Task cần làm ngay (TODO hoặc DOING)
                prisma.task.findMany({
                    where: { 
                       ...userInvolvedCondition, 
                        status: { in: ['TODO', 'DOING', 'REVIEW'] } 
                    },
                    take: 3,
                    orderBy: { updatedAt: 'desc' }
                }),
                // 4. Lấy 3 thông báo mới nhất
                prisma.notification.findMany({
                    where: { userId:userId,isRead: false },
                    take: 3,
                    orderBy: { createdAt: 'desc' }
                })
            ]);

            const target = kpiData?.targetValue || 0;
            const percent = target > 0 ? Math.round((tasksDoneThisWeek / target) * 100) : 0;

            return NextResponse.json({
                roleType: 'STAFF',
                weekInfo: `Tuần ${weekNumber} Tháng ${month}`,
                kpi: {
                    percent,
                    done: tasksDoneThisWeek,
                    target: target,
                    remaining: target - tasksDoneThisWeek > 0 ? target - tasksDoneThisWeek : 0
                },
                activeTasks: activeTasks.map(t => ({ id: t.id, title: t.title, status: t.status })),
                notifications: recentNotifs.map(n => ({ id: n.id, message: n.message }))
            }, { status: 200,headers: corsHeaders });
        }

    } catch (error) {
        console.error(">>> [API MOBILE DASHBOARD ERROR]:", error);
        return NextResponse.json(
            { error: "Lỗi trích xuất dữ liệu Server" }, 
            { status: 500, headers: corsHeaders }
        );
    }
}