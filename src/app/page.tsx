// src/app/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  // 1. Kiểm tra phiên đăng nhập ngay tại Server
  const session = await getServerSession(authOptions);

  // 2. Nếu chưa login -> Đá về trang /login
  if (!session) {
    redirect("/login");
  } 
  
  // 3. Nếu đã login -> Đẩy vào trang Dashboard chính
  // Sếp nhớ tạo folder "src/app/dashboard/page.tsx" nhé
  redirect("/dashboard");
}