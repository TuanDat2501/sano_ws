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

// LƯU CẤU HÌNH QUYỀN (Ghi đè toàn bộ)
export async function POST(req: Request) {
    try {
        const matrix = await req.json(); // Nhận ma trận từ Frontend
        
        // Chuyển ma trận ngược lại thành mảng để nhét vào Prisma
        const updates = [];
        for (const moduleId in matrix) {
            for (const role in matrix[moduleId]) {
                updates.push({
                    role: role,
                    moduleId: moduleId,
                    isAllowed: matrix[moduleId][role]
                });
            }
        }

        // Thực hiện Upsert (Có thì sửa, chưa có thì tạo mới) cho từng ô trong ma trận
        await prisma.$transaction(
            updates.map((data) => 
                prisma.permission.upsert({
                    where: {
                        role_moduleId: {
                            role: data.role,
                            moduleId: data.moduleId
                        }
                    },
                    update: { isAllowed: data.isAllowed },
                    create: data
                })
            ),
            {
                maxWait: 5000, // Đợi kết nối DB tối đa 5s
                timeout: 20000 // 🚀 CHUẨN CẤP PHÉP CHẠY TỐI ĐA 20 GIÂY
            }
        );

        return NextResponse.json({ message: "Lưu thành công!" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Lỗi lưu cấu hình" }, { status: 500 });
    }
}