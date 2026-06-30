import { Metadata } from "next";
import { PermissionProvider } from "./component/PermissionProvider";
import { Providers } from "./component/Providers";
import { ToastProvider } from "./component/ToastProvider";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

import { Inter } from "next/font/google";
const primaryFont = Inter({ 
  subsets: ["vietnamese"], // BẮT BUỘC CÓ DÒNG NÀY ĐỂ KHÔNG LỖI DẤU
  display: "swap",
});

// LỰA CHỌN 2: Nếu sếp thích Be Vietnam Pro thì dùng cụm này:
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${primaryFont1.className} antialiased text-slate-800 bg-slate-50`}>
        <Providers>
          <ToastProvider>
            <PermissionProvider> {/* 🚀 Bọc ở đây */}
              {children}
            </PermissionProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}