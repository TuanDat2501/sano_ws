// File: types/next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  /**
   * Mở rộng thuộc tính cho Session (Dùng khi gọi useSession hoặc getServerSession)
   */
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      teamId: string | null;
      avatarUrl: string | null;
    } & DefaultSession["user"];
  }

  /**
   * Mở rộng thuộc tính cho User (Dùng trong file auth.ts lúc return từ DB)
   */
  interface User extends DefaultUser {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
  }
}

declare module "next-auth/jwt" {
  /**
   * Mở rộng thuộc tính cho token JWT
   */
  interface JWT {
    id: string;
    username: string;
    role: string;
    teamId: string | null;
    avatarUrl: string | null;
  }
}