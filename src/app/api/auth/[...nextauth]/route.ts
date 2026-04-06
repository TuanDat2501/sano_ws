// File: src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
// (Lưu ý: Đổi đường dẫn import này cho đúng với nơi sếp lưu file auth.ts ở Bước 1)
import { authOptions } from "@/lib/auth"; 

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };