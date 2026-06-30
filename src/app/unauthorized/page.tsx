"use client";

import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UnauthorizedPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 max-w-lg w-full text-center animate-fade-in">
                
                {/* Icon Cảnh báo */}
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-20"></div>
                    <ShieldAlert className="w-10 h-10 text-red-600 relative z-10" strokeWidth={2.5} />
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight">
                    Truy Cập Bị Từ Chối
                </h1>
                
                <p className="text-sm md:text-base text-slate-500 font-medium mb-8 leading-relaxed">
                    Sếp (hoặc bạn) không có quyền truy cập vào khu vực này. Nếu cho rằng đây là sự nhầm lẫn, vui lòng liên hệ với <strong>Ban Giám Đốc</strong> hoặc <strong>Admin</strong> để được cấp quyền.
                </p>

                {/* Các nút hành động */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <ArrowLeft size={18} />
                        Quay lại trang cũ
                    </button>
                    
                    <Link
                        href="/dashboard"
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Home size={18} />
                        Về trang Tổng quan
                    </Link>
                </div>
            </div>
        </div>
    );
}