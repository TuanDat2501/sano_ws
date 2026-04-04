import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client'; 
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Nạp biến môi trường từ file .env


const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });

async function main() {
  // ... Giữ nguyên phần logic tạo Team và User bên dưới ...
  console.log("Đang bắt đầu seed...");
  
  const defaultTeam = await prisma.team.upsert({
    where: { name: 'Ban Giám Đốc' },
    update: {},
    create: {
      name: 'Ban Giám Đốc',
      description: 'Team quản trị tối cao của BeastLore',
    },
  });

  const hashedPassword = await bcrypt.hash('123456', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Quản trị viên',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      teamId: defaultTeam.id,
    },
  });

  console.log('✅ Đã tạo xong tài khoản Admin!');
  console.log(`👉 Username: ${adminUser.username} | Password: 123456`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });