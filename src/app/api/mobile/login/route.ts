import { NextResponse } from "next/server";
import bcrypt from "bcryptjs"; 
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

// Xử lý CORS cho Mobile
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();
        
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        };

        // 1. Tìm user trong DB bằng findUnique giống hệt Web
        const user = await prisma.user.findUnique({
            where: { username: username }
        });

        if (!user) {
            return NextResponse.json({ error: "Tài khoản không tồn tại!" }, { status: 404, headers: corsHeaders });
        }

        // 2. KIỂM TRA MẬT KHẨU
        if (!password || !user.passwordHash) {
            return NextResponse.json({ error: "Dữ liệu mật khẩu không hợp lệ!" }, { status: 400, headers: corsHeaders });
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        
        if (!isPasswordValid) {
            return NextResponse.json({ error: "Mật khẩu không chính xác!" }, { status: 401, headers: corsHeaders });
        }

        // ==========================================
        // 🚀 BƯỚC MỚI: TẠO TOKEN BẢO MẬT (JWT)
        // ==========================================
        // Lấy mã bí mật từ .env, nếu quên setup thì dùng tạm chuỗi backup
        const secretKey = process.env.NEXTAUTH_SECRET || "sano_super_secret_key_2026";

        // Gói id và role vào token, hạn sử dụng 7 ngày
        const mobileToken = jwt.sign(
            { id: user.id, role: user.role }, 
            secretKey, 
            { expiresIn: '7d' } 
        );
        // ==========================================

        // 3. Lấy ma trận quyền
        const permissions = await prisma.permission.findMany({
            where: { role: user.role }
        });

        const myPerms: Record<string, boolean> = {};
        permissions.forEach(p => {
            myPerms[p.moduleId] = p.isAllowed;
        });

        // 4. Trả về đúng format kèm theo TOKEN
        return NextResponse.json({
            token: mobileToken, // 🚀 TRẢ VỀ TOKEN Ở ĐÂY
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName, 
                role: user.role,
                teamId: user.teamId,
                avatarUrl: user.avatarUrl
            },
            permissions: myPerms
        }, { status: 200, headers: corsHeaders });

    } catch (error) {
        console.error(">>> [LỖI API MOBILE LOGIN]:", error);
        return NextResponse.json(
            { error: "Lỗi kết nối máy chủ" }, 
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}