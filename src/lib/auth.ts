import { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// =====================================================================
// 🚀 DẠY TYPE-SCRIPT BIẾT RẰNG USER CÓ THÊM QUYỀN (PERMISSIONS) VÀ isTeamLeader
// =====================================================================
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      teamId: string | null;
      avatarUrl: string | null;
      permissions: string[]; // Bổ sung mảng quyền
      isTeamLeader: boolean; // 🚀 BỔ SUNG: Cờ xác định quản lý
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
    isTeamLeader: boolean; // 🚀 BỔ SUNG
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
    permissions: string[]; // Bổ sung mảng quyền
    isTeamLeader: boolean; // 🚀 BỔ SUNG
  }
}
// =====================================================================

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Tài khoản", type: "text" },
        password: { label: "Mật khẩu", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { username: credentials.username },
            include: { team: true } 
          });

          if (!user || !user.passwordHash) return null;

          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isPasswordValid) return null;

          return {
            id: user.id,
            name: user.fullName,
            username: user.username,
            role: user.role,
            teamId: user.teamId,
            avatarUrl: user.avatarUrl,
            isTeamLeader: user.isTeamLeader || false, // 🚀 Kéo từ DB lên
          };
        } catch (error) {
          console.error(">>> [AUTH ERROR]:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    // 🚀 BỔ SUNG THÊM trigger VÀ session VÀO THAM SỐ ĐẦU VÀO CỦA HÀM JWT
    async jwt({ token, user, trigger, session }) {
      // Biến 'user' chỉ tồn tại ở lần chạy ĐẦU TIÊN ngay khi đăng nhập thành công
      if (user) {
        token.id = user.id;
        token.name = user.name; // 🚀 Ghi chú: Thêm dòng này để lưu name gốc
        token.role = user.role;
        token.teamId = user.teamId;
        token.username = user.username;
        token.avatarUrl = user.avatarUrl;
        token.isTeamLeader = user.isTeamLeader;

        // CHỌC DATABASE 1 LẦN DUY NHẤT LẤY QUYỀN NẠP VÀO TOKEN
        try {
            const userPermissions = await prisma.permission.findMany({
                where: { 
                    role: user.role,
                    isAllowed: true 
                },
                select: { moduleId: true }
            });
            token.permissions = userPermissions.map(p => p.moduleId);
        } catch (error) {
            console.error(">>> [AUTH] Lỗi nạp Permission:", error);
            token.permissions = [];
        }
      }

      // =======================================================
      // 🚀 BỔ SUNG: CHỐT CHẶN HỨNG LỆNH CẬP NHẬT TỪ FRONTEND
      // =======================================================
      if (trigger === "update" && session?.user) {
        if (session.user.name) token.name = session.user.name;
        if (session.user.avatarUrl) token.avatarUrl = session.user.avatarUrl;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.name = token.name as string; // 🚀 Nạp name từ Token ra Session
        session.user.role = token.role;
        session.user.teamId = token.teamId;
        session.user.username = token.username;
        session.user.avatarUrl = token.avatarUrl;
        session.user.isTeamLeader = token.isTeamLeader;
        session.user.permissions = token.permissions; 
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};