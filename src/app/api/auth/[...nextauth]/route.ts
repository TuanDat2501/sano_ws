import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
// PHẢI IMPORT TỪ LIB CỦA MÌNH
const handler = NextAuth({
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
            where: { username: credentials.username }
          });

          // LOG 1: Xem có tìm thấy ông admin này trong MySQL không
          console.log(">>> [AUTH DEBUG] User tìm thấy:", user ? user.username : "KHÔNG TÌM THẤY");

          if (!user) return null;

          // LOG 2: Xem mật khẩu người dùng gõ vào và mật khẩu trong DB
          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
          console.log(">>> [AUTH DEBUG] So sánh mật khẩu:", isPasswordValid);

          if (!isPasswordValid) return null;

          return {
            id: user.id,
            name: user.fullName,
            role: user.role,
            teamId: user.teamId,
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
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
        token.id = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).teamId = token.teamId;
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };