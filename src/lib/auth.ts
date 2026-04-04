
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt"; // Đảm bảo bạn đã cài thư viện này để check pass

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Tài khoản", type: "text" },
        password: { label: "Mật khẩu", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 1. Tìm user trong DB theo email
        const user = await prisma.user.findFirst({
          where: { email: credentials.email },
          include: { team: true } // Lấy luôn thông tin team
        });

        if (!user || !user.passwordHash) return null;

        // 2. So sánh mật khẩu (Dùng bcrypt)
        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isPasswordValid) return null;

        // 3. Trả về thông tin user để lưu vào JWT
        return {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          teamId: user.teamId,
        };
      }
    })
  ],
  callbacks: {
    // Đưa thông tin Role và TeamId từ Database vào Token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
      }
      return token;
    },
    // Đưa thông tin từ Token ra Session để dùng ở Frontend/API
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).teamId = token.teamId;
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login", // Đường dẫn trang login của bạn
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};