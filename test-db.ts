import { PrismaClient } from '@prisma/client';

// Khởi tạo Prisma độc lập
const prisma = new PrismaClient();

async function main() {
    console.log("⏳ Đang thử gõ cửa Database trên VPS...");
    
    try {
        // Query thử lấy 5 user đầu tiên. 
        // (Nếu bảng của sếp tên là khác thì đổi 'user' thành tên bảng đó nhé, VD: prisma.department.findMany)
        const data = await prisma.user.findMany({
            take: 5,
        });

        console.log("✅ KẾT NỐI THÀNH CÔNG RỰC RỠ!");
        console.log(`🎉 Đã lấy được ${data.length} bản ghi:`);
        console.dir(data, { depth: null }); // In data ra terminal cho sếp ngắm

    } catch (error: any) {
        console.log("❌ KẾT NỐI THẤT BẠI!");
        
        // Bắt chính xác loại lỗi để sếp biết đường sửa
        if (error.message.includes('Can\'t reach database server')) {
            console.error("🚨 Nguyên nhân: Không thể chạm tới VPS. Khả năng cao VPS đang đóng port 3306 hoặc chặn IP lạ.");
        } else if (error.message.includes('Access denied')) {
            console.error("🚨 Nguyên nhân: Sai Username hoặc Password của MySQL.");
        } else {
            console.error("🚨 Lỗi chi tiết từ Prisma:", error.message);
        }
    } finally {
        // Làm xong nhớ đóng kết nối cho gọn gàng
        await prisma.$disconnect();
    }
}

// Chạy hàm
main();