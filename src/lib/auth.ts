// File: src/lib/auth.ts (hoặc đường dẫn tương ứng của sếp)
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs"; // Bắt buộc dùng bcryptjs để không văng lỗi trên Vercel
import { prisma } from "@/lib/prisma";

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
          console.log(user);
          
          console.log(">>> [AUTH] Tìm thấy User trong DB:", user ? user.username : "KHÔNG");

          if (!user || !user.passwordHash) return null;

          // 3. So sánh mật khẩu bằng bcryptjs
          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
          console.log(">>> [AUTH] Mật khẩu đúng không?:", isPasswordValid);

          if (!isPasswordValid) return null;

          // 4. Trả về thông tin
          return {
            id: user.id,
            name: user.fullName,
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
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
        token.username = (user as any).username;
        token.avatarUrl = (user as any).avatarUrl;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).teamId = token.teamId;
        (session.user as any).username = token.username;
        (session.user as any).avatarUrl = token.avatarUrl;
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