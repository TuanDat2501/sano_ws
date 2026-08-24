import { Metadata } from "next";
import { PermissionProvider } from "./component/PermissionProvider";
import { Providers } from "./component/Providers";
import { ToastProvider } from "./component/ToastProvider";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

// 🚀 BỔ SUNG CÁC IMPORT CẦN THIẾT ĐỂ KIỂM TRA BẢO TRÌ
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HardHat } from "lucide-react"; // Icon mũ bảo hộ cực hợp với màn hình bảo trì

const primaryFont1 = Be_Vietnam_Pro({ 
  subsets: ["vietnamese"],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sano WorkSpace",
  description: "Hệ thống quản lý Sano Media",
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  
  // 1. LẤY SESSION ĐỂ NHẬN DIỆN XEM AI ĐANG TRUY CẬP
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN";

  // 2. TRUY VẤN TRẠNG THÁI BẢO TRÌ TRỰC TIẾP TỪ DATABASE
  let isMaintenance = false;
  try {
     const setting = await prisma.systemSetting.findUnique({ 
         where: { settingKey: "MAINTENANCE_MODE" } 
     });
     if (setting && setting.settingValue) {
         isMaintenance = (setting.settingValue as any).enabled === true;
     }
  } catch (error) {
     console.error("Lỗi check trạng thái bảo trì:", error);
  }

  // 3. LOGIC KHÓA CỬA THÔNG MINH
  // - Có Session (Đã đăng nhập)
  // - Trạng thái bảo trì đang bật
  // - KHÔNG PHẢI LÀ ADMIN
  // => Đủ 3 điều kiện trên thì thay thế bằng màn hình bảo trì
  const isBlocked = session && isMaintenance && !isAdmin;

  return (
    <html lang="en">
      <body className={`${primaryFont1.className} antialiased text-slate-800 bg-slate-50`}>
        <Providers>
          <ToastProvider>
            <PermissionProvider>
              {isBlocked ? (
                // 🚀 MÀN HÌNH CHẶN CỬA BẢO TRÌ
                <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                    <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-rose-100 max-w-lg w-full text-center flex flex-col items-center animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <HardHat size={40} />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight">Hệ thống đang bảo trì</h1>
                        <p className="text-slate-500 font-medium mb-8 leading-relaxed text-sm md:text-base">
                            Sếp ơi, Sano WorkSpace đang được tạm ngưng để tiến hành nâng cấp trải nghiệm. Vui lòng quay lại sau ít phút nhé!
                        </p>
                        <a 
                            href="/" 
                            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 active:scale-95 inline-block"
                        >
                            Thử tải lại trang
                        </a>
                    </div>
                </div>
              ) : (
                // Nếu không bị chặn thì cho phép Load toàn bộ App bình thường
                children
              )}
            </PermissionProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}