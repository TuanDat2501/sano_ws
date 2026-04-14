import { NextAuthOptions, DefaultSession } from "next-auth"; // 🚀 Import thêm DefaultSession ở đây
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// =====================================================================
// 🚀 DẠY TYPE-SCRIPT BIẾT RẰNG USER CỦA MÌNH CÓ THÊM AVATAR VÀ ROLE
// =====================================================================
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      teamId: string | null;
      avatarUrl: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
  }
}
// =====================================================================

export const authOptions: NextAuthOptions = {
  // KHÔNG CẦN PrismaAdapter khi dùng Credentials
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Tài khoản", type: "text" },
        password: { label: "Mật khẩu", type: "password" }
      },
      async authorize(credentials) {
        // 1. Kiểm tra xem người dùng có nhập đủ không
        if (!credentials?.username || !credentials?.password) {
            console.log(">>> [AUTH] Thiếu username hoặc password");
            return null;
        }

        try {
          // 2. Tìm user trong DB theo USERNAME
          const user = await prisma.user.findUnique({
            where: { username: credentials.username },
            include: { team: true } 
          });
          
          console.log(">>> [AUTH] Tìm thấy User trong DB:", user ? user.username : "KHÔNG");

          if (!user || !user.passwordHash) return null;

          // 3. So sánh mật khẩu bằng bcryptjs
          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
          console.log(">>> [AUTH] Mật khẩu đúng không?:", isPasswordValid);

          if (!isPasswordValid) return null;

          // 4. Trả về thông tin
          return {
            id: user.id,
            name: user.fullName, // Giữ nguyên ánh xạ fullName vào name mặc định
            username: user.username,
            role: user.role,
            teamId: user.teamId,
            avatarUrl: user.avatarUrl,
          };
        } catch (error) {
          console.error(">>> [AUTH ERROR]:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
        token.username = user.username;
        token.avatarUrl = user.avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.teamId = token.teamId;
        session.user.username = token.username;
        session.user.avatarUrl = token.avatarUrl;
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