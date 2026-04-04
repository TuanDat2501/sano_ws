"use client";

import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
    LayoutDashboard,
    Trello,
    BarChart3,
    Users,
    MessageSquare,
    LogOut,
    Zap,
    Shield,
    FileText,
    PieChart,
    Network
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Navbar from "../component/Navbar";
import FloatingChat from "../component/chat/FloatingChat";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const userRole = (session?.user as any)?.role;
    const menuItems = [
        { name: "Tổng quan", icon: <LayoutDashboard size={20} />, path: "/dashboard", show: true },
        { name: "Bảng công việc", icon: <Trello size={20} />, path: "/tasks", show: true },
        { name: "Đơn từ & Đề xuất", icon: <FileText size={20} />, path: "/requests", show: true },
        { name: "Đánh giá KPI", icon: <BarChart3 size={20} />, path: "/kpi", show: true },
        { name: "Thảo luận", icon: <MessageSquare size={20} />, path: "/chat", show: true },
        { name: "Đội ngũ", icon: <Shield size={20} />, path: "/teams", show: userRole === "ADMIN" },
        { name: "Nhân sự", icon: <Users size={20} />, path: "/users", show: userRole === "ADMIN" },
        { name: "Sơ đồ tổ chức", icon: <Network size={20} />, path: "/org-chart", show: userRole === "ADMIN" || userRole === "BAN_GIAM_DOC" || userRole === "HR" },
        { name: "Báo cáo", icon: <PieChart size={20} />, path: "/analytics", show: userRole === "ADMIN" || userRole === "BAN_GIAM_DOC" },
    ];

    return (
        // 1. KHÓA CHẾT CHIỀU CAO TOÀN TRANG (h-screen + overflow-hidden)
        <div className="h-screen w-full bg-[#f8fafc] flex font-sans overflow-hidden">
            
            {/* ---------- SIDEBAR ---------- */}
            {/* Thêm shrink-0 để Sidebar không bao giờ bị ép nhỏ */}
            <aside className={`${isSidebarOpen ? "w-64" : "w-20"} h-screen shrink-0 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-50`}>
                <div className="p-6 flex items-center gap-3">
                    <div className="bg-red-600 p-2 rounded-xl shrink-0 shadow-lg shadow-red-500/20">
                        <Zap className="h-5 w-5 text-white fill-white" />
                    </div>
                    {isSidebarOpen && <span className="font-black text-xl text-slate-900 tracking-tight">Sano <span className="text-red-600">WS</span></span>}
                </div>

                <nav className="flex-grow px-3 space-y-1 overflow-y-auto">
                    {menuItems.filter(item => item.show).map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${isActive
                                    ? "bg-red-50 text-red-600 font-bold"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                            >
                                <span className={`${isActive ? "text-red-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                                    {item.icon}
                                </span>
                                {isSidebarOpen && <span>{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                    >
                        <LogOut size={20} />
                        {isSidebarOpen && <span className="font-medium">Đăng xuất</span>}
                    </button>
                </div>
            </aside>

            {/* ---------- MAIN CONTENT AREA ---------- */}
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* NAVBAR (Luôn dính ở trên cùng) */}
                <div className="shrink-0">
                    <Navbar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
                </div>

                {/* DYNAMIC CONTENT (Khu vực để Kanban tự do cuộn) */}
                {/* 2. Ép thẻ bọc children phải ẩn scroll tổng, nhường quyền scroll cho Kanban */}
                <div className="flex-1 relative overflow-hidden bg-[#f8fafc] p-6">
                    {children}
                </div>
                <FloatingChat />
            </main>
            
        </div>
    );
}