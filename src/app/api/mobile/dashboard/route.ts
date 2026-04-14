import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

// 3. XỬ LÝ LẤY DỮ LIỆU
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const role = searchParams.get('role');

        // Bắt lỗi nếu thiếu thông tin từ App gửi lên
        if (!userId || !role) {
            return NextResponse.json(
                { error: "Thiếu định danh người dùng!" }, 
                { status: 400, headers: corsHeaders }
            );
        }

        const isAdmin = role === 'ADMIN' || role === 'BAN_GIAM_DOC';

        // ===============================================
        // LUỒNG 1: TRẢ DỮ LIỆU CHO QUẢN LÝ (Tổng quan)
        // ===============================================
        if (isAdmin) {
            const [videoDone, pendingReqs] = await Promise.all([
                // Đếm toàn bộ task đã xong
                prisma.task.count({ 
                    where: { status: 'DONE' } 
                }),
                // Đếm toàn bộ đơn đang chờ duyệt
                prisma.request.count({ 
                    where: { 
                        status: { in: ['PENDING_1', 'PENDING_2'] } 
                    } 
                })
            ]);

            return NextResponse.json({
                roleType: 'ADMIN',
                stats: { 
                    videoDone: videoDone || 0, 
                    pendingReqs: pendingReqs || 0 
                },
                kpi: 82 // Sếp có thể thay bằng công thức tính KPI thật
            }, { status: 200, headers: corsHeaders });
        } 
        
        // ===============================================
        // LUỒNG 2: TRẢ DỮ LIỆU CHO NHÂN VIÊN (Cá nhân)
        // ===============================================
        else {
            const [tasksInProgress, myRequests] = await Promise.all([
                // Đếm các task của RIÊNG nhân viên này đang làm
                // LƯU Ý: Thay 'assigneeId' bằng tên cột lưu id người nhận việc trong bảng Task của sếp
                prisma.task.count({ 
                    where: { 
                        // assigneeId: userId,  <-- Bỏ comment dòng này và sửa tên cột cho đúng schema của sếp
                        status: { not: 'DONE' } 
                    } 
                }),
                // Đếm các đơn từ do RIÊNG nhân viên này tạo
                // LƯU Ý: Thay 'userId' bằng tên cột lưu người tạo đơn trong bảng Request của sếp
                prisma.request.count({ 
                    where: { 
                        // userId: userId  <-- Bỏ comment dòng này và sửa tên cột cho đúng schema
                    } 
                })
            ]);
            return NextResponse.json({
                roleType: 'STAFF',
                stats: { 
                    tasksInProgress: tasksInProgress || 0, 
                    myRequests: myRequests || 0 
                }
            }, { status: 200, headers: corsHeaders });
        }

    } catch (error) {
        console.error(">>> [API MOBILE DASHBOARD ERROR]:", error);
        return NextResponse.json(
            { error: "Lỗi trích xuất dữ liệu Server" }, 
            { status: 500, headers: corsHeaders }
        );
    }
}