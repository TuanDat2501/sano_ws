import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
config();
const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("⏳ Đang tạo tài khoản Admin...");
    
    // Băm mật khẩu (Mật khẩu đăng nhập sẽ là: Sanoteam123)
    const hashedPassword = await bcrypt.hash('Sanoteam123', 10);

    try {
        const user = await prisma.user.create({
            data: {
                username: 'admin',
                passwordHash: hashedPassword,
                fullName: 'Quản trị viên Sano',
                // NẾU CODE BÁO LỖI THIẾU TRƯỜNG NÀO, SẾP THÊM VÀO NHÉ (ví dụ email, role...)
                // email: 'admin@sano.com',
                role: 'ADMIN',
            }
        });

        console.log("✅ TẠO ADMIN THÀNH CÔNG RỰC RỠ!");
        console.log("👉 Tài khoản: admin");
        console.log("👉 Mật khẩu: Sanoteam123");
    } catch (error) {
        console.error("❌ Lỗi:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();