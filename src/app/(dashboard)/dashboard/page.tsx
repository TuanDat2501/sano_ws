"use client";

import { useSession } from "next-auth/react";
import DashboardEmployee from "./components/DashboardEmployee";
import DashboardManager from "./components/DashboardManager";
import { LayoutDashboard, Loader2 } from "lucide-react"; 
import PermissionGuard from "@/app/component/PermissionGuard";
import { useRouter } from "next/navigation";
export default function DashboardPage() {
    const { data: session, status } = useSession(); 

    if (status === "loading") {
        return (
            <div className="flex-1 p-4 sm:p-8 bg-slate-50 flex flex-col items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} strokeWidth={2.5} />
                <p className="text-slate-500 font-bold animate-pulse text-sm sm:text-base">Đang đồng bộ dữ liệu tổng quan...</p>
            </div>
        );
    }

    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT";
    const isManager = ["LEADER", "BAN_GIAM_DOC", "ADMIN","HR","KE_TOAN"].includes(userRole);

    return (
        // Tối ưu Padding: Mobile p-4, Tablet/PC p-8
        <PermissionGuard moduleId="MENU_DASHBOARD">
        <div className="flex-1 p-4 md:p-8 bg-slate-50 overflow-y-auto h-full custom-scrollbar relative">
            <div className="mb-6 md:mb-8">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                    <LayoutDashboard className="text-blue-600" /> Tổng quan hệ thống
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                    Chào mừng trở lại! Chúc một ngày làm việc năng suất tại Sano WorkSpace. 🚀
                </p>
            </div>

            {isManager ? <DashboardManager /> : <DashboardEmployee />}
        </div>
        </PermissionGuard>
    );
}