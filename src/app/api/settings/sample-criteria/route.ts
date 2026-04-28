import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 🚀 1. LẤY TIÊU CHUẨN MẪU (DÀNH CHO TẤT CẢ QUẢN LÝ DỰ ÁN)
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const setting = await prisma.systemSetting.findUnique({
            where: { settingKey: "SAMPLE_CRITERIA" }
        });

        return NextResponse.json({ criteria: setting?.settingValue || null });
    } catch (error) {
        console.error("LỖI LẤY MẪU:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// 🚀 2. LƯU/CẬP NHẬT TIÊU CHUẨN MẪU (CHỈ DÀNH CHO ADMIN)
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as any;

        // Bảo mật: Chặn ngay nếu không phải ADMIN
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Chỉ Admin mới có quyền cập nhật Bộ Tiêu Chuẩn Mẫu" }, { status: 403 });
        }

        const body = await req.json();
        
        // Dùng lệnh Upsert: Có rồi thì Update, Chưa có thì Tạo mới
        await prisma.systemSetting.upsert({
            where: { settingKey: "SAMPLE_CRITERIA" },
            update: { settingValue: body.criteria },
            create: { settingKey: "SAMPLE_CRITERIA", settingValue: body.criteria }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("LỖI LƯU MẪU:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}