"use client";

import { useSession } from "next-auth/react";
import DashboardEmployee from "./components/DashboardEmployee";
import DashboardManager from "./components/DashboardManager";
import { LayoutDashboard, Loader2 } from "lucide-react"; // Bổ sung Loader2

export default function DashboardPage() {
    // 🚀 Lấy thêm biến 'status' để biết khi nào đang fetch data
    const { data: session, status } = useSession(); 

    // 🚀 CHẶN NGAY TỪ CỬA: Nếu đang loading thì hiện vòng quay
    if (status === "loading") {
        return (
            <div className="flex-1 p-8 bg-slate-50 flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} strokeWidth={2.5} />
                <p className="text-slate-500 font-bold animate-pulse">Đang đồng bộ dữ liệu tổng quan...</p>
            </div>
        );
    }

    // Sau khi load xong (status === 'authenticated') mới bắt đầu chia luồng
    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT";
    
    // Kiểm tra quyền Quản lý
    const isManager = ["LEADER", "BAN_GIAM_DOC", "ADMIN"].includes(userRole);

    return (
        <div className="flex-1 p-4 md:p-8 bg-slate-50 overflow-y-auto h-full custom-scrollbar relative">
            <div className="mb-8">
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <LayoutDashboard className="text-blue-600" /> Tổng quan hệ thống
                </h1>
                <p className="text-sm text-slate-500 font-medium mt-1">
                    Chào mừng trở lại! Chúc một ngày làm việc năng suất tại BeastLore Studio. 🚀
                </p>
            </div>

            {/* Điều hướng Giao diện */}
            {isManager ? <DashboardManager /> : <DashboardEmployee />}
        </div>
    );
}