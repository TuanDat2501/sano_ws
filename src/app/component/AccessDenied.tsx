"use client";

import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AccessDenied() {
    const router = useRouter();

    return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 animate-fade-in">
            <div className="bg-white p-8 md:p-12 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 max-w-md w-full">
                <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="text-red-600 w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">Truy Cập Bị Từ Chối</h1>
                <p className="text-slate-500 font-medium mb-8">
                    Sếp ơi, tài khoản của sếp không có quyền vào khu vực này. Vui lòng liên hệ Admin nếu đây là một nhầm lẫn.
                </p>
                <button 
                    onClick={() => router.back()}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95"
                >
                    <ArrowLeft size={18} /> Quay lại trang trước
                </button>
            </div>
        </div>
    );
}