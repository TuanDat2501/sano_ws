import { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// =====================================================================
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      teamId: string | null;
      avatarUrl: string | null;
      permissions: string[]; 
      isTeamLeader: boolean; 
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
    isTeamLeader: boolean; 
    teamName?: string; 
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
    permissions: string[]; 
    isTeamLeader: boolean; 
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
            isTeamLeader: user.isTeamLeader || false,
            teamName: user.team?.name,
          };
        } catch (error) {
          console.error(">>> [AUTH ERROR]:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 1. Nạp thông tin cơ bản lần đầu đăng nhập
      if (user) {
        token.id = user.id;
        token.name = user.name; 
        token.role = user.role;
        token.teamId = user.teamId;
        token.username = user.username;
        token.avatarUrl = user.avatarUrl;
        token.isTeamLeader = user.isTeamLeader;
      }

      // 2. 🚀 TỰ ĐỘNG CẬP NHẬT DATA & QUYỀN TỪ DB MỖI KHI CÓ REQUEST / F5
      if (token.id) {
          try {
              // Lấy dữ liệu user mới nhất từ DB
              const dbUser = await prisma.user.findUnique({
                  where: { id: token.id as string },
                  include: { team: true } // Cần lấy Team để check quyền Nhân sự
              });

              if (dbUser) {
                  // Cập nhật lại Role & Team phòng trường hợp sếp vừa đổi ở màn Admin
                  token.role = dbUser.role;
                  token.teamId = dbUser.teamId;
                  token.isTeamLeader = dbUser.isTeamLeader;

                  // Tính toán lại Permissions động
                  if (dbUser.role === "ADMIN" || dbUser.role === "BAN_GIAM_DOC") {
                      const dbModules = await prisma.permission.findMany({ select: { moduleId: true }, distinct: ['moduleId'] });
                      const defaultModules = ["MENU_DASHBOARD", "MENU_TASKS", "MENU_KPI", "MENU_REVENUE", "MENU_REQUESTS", "MENU_TEAMS", "MENU_USERS", "MENU_ORG_CHART", "MENU_DAILY_REPORT", "MENU_CHANNELS", "MENU_ANALYTICS", "ACTION_CREATE_TASK", "ACTION_APPROVE_REQUEST", "MENU_PROJECTS"];
                      const allModules = [...defaultModules, ...dbModules.map(m => m.moduleId)];
                      token.permissions = Array.from(new Set(allModules));
                  } else {
                      const rolesToCheck: string[] = [dbUser.role];

                      if (dbUser.role === "LEADER" && dbUser.team?.name?.toLowerCase().includes("nhân sự")) {
                          rolesToCheck.push("DEPARTMENT_LEADER");
                          rolesToCheck.push("HR"); 
                      }

                      const userPermissions = await prisma.permission.findMany({
                          where: { 
                              role: { in: rolesToCheck },
                              isAllowed: true 
                          },
                          select: { moduleId: true }
                      });
                      const rawPerms = userPermissions.map(p => p.moduleId);
                      token.permissions = Array.from(new Set(rawPerms));
                  }
              }
          } catch (error) {
              console.error(">>> [AUTH] Lỗi tự động nạp Permission:", error);
          }
      }

      // 3. Xử lý Trigger update từ Client (đổi tên, avatar)
      if (trigger === "update" && session?.user) {
        if (session.user.name) token.name = session.user.name;
        if (session.user.avatarUrl) token.avatarUrl = session.user.avatarUrl;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.name = token.name as string; 
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