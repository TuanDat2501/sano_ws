import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Chặn tất cả trừ các file tĩnh, favicon, và trang login
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};