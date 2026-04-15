import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// LẤY DANH SÁCH QUYỀN
export async function GET() {
    try {
        const permissions = await prisma.permission.findMany();
        
        // Chuyển đổi mảng DB thành object Ma trận: { "MENU_DASHBOARD": { "CONTENT": true, "EDITOR": false } }
        const matrix: Record<string, Record<string, boolean>> = {};
        
        permissions.forEach(p => {
            if (!matrix[p.moduleId]) matrix[p.moduleId] = {};
            matrix[p.moduleId][p.role] = p.isAllowed;
        });

        return NextResponse.json(matrix);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi tải quyền" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        // 1. Lấy dữ liệu ma trận từ phía Client gửi lên
        const matrix = await req.json(); 
        
        // 2. Biến đổi ma trận Object thành 1 Mảng (Array) phẳng
        const newPermissions = [];
        for (const moduleId in matrix) {
            for (const role in matrix[moduleId]) {
                newPermissions.push({
                    role: role,
                    moduleId: moduleId,
                    isAllowed: matrix[moduleId][role]
                });
            }
        }

        // =======================================================
        // 🚀 CÁCH 2: GIAO DỊCH (TRANSACTION) SIÊU TỐC ĐỘ
        // =======================================================
        await prisma.$transaction(async (tx) => {
            // Bước A: Xóa toàn bộ dữ liệu phân quyền cũ trong Database
            await tx.permission.deleteMany();

            // Bước B: Bơm toàn bộ mảng dữ liệu mới vào bằng 1 lệnh duy nhất
            await tx.permission.createMany({
                data: newPermissions,
            });
        });

        return NextResponse.json({ message: "Lưu thành công siêu tốc!" }, { status: 200 });

    } catch (error) {
        console.error(">>> [API POST PERMISSIONS] LỖI:", error);
        return NextResponse.json(
            { error: "Lỗi lưu cấu hình phân quyền trên Server" }, 
            { status: 500 }
        );
    }
}