"use client";

import React from "react";
import {
    LayoutDashboard,
    Trello,
    BarChart3,
    Users,
    MessageSquare,
    LogOut,
    Shield,
    FileText,
    PieChart,
    Network,
    ShieldCheck,
    FolderKanban,
    DollarSign,
    TvMinimalPlay
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { usePermission } from "./PermissionProvider"; // 🚀 Import Hook phân quyền

interface SidebarProps {
    isSidebarOpen: boolean;
    setSidebarOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isSidebarOpen, setSidebarOpen }: SidebarProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { hasPermission, loading } = usePermission();
    
    const userRole = (session?.user as any)?.role;

    // 🚀 MAP MÃ QUYỀN VÀO MENU
    const menuItems = [
        { name: "Tổng quan", icon: <LayoutDashboard size={20} />, path: "/dashboard", show: hasPermission("MENU_DASHBOARD") },
        { name: "Bảng công việc", icon: <Trello size={20} />, path: "/tasks", show: hasPermission("MENU_TASKS") },
        { name: "Đơn từ & Đề xuất", icon: <FileText size={20} />, path: "/requests", show: hasPermission("MENU_REQUESTS") },
        { name: "Đánh giá KPI", icon: <BarChart3 size={20} />, path: "/kpi", show: hasPermission("MENU_KPI") },
        { name: "Thảo luận", icon: <MessageSquare size={20} />, path: "/chat", show: true }, // Chat mặc định ai cũng được vào
        { name: "Hệ thống Kênh", icon: <TvMinimalPlay  size={20} />, path: "/channels", show: hasPermission("MENU_CHANNELS") },
        { name: "Dự án", icon: <FolderKanban size={20} />, path: "/projects", show: hasPermission("MENU_PROJECTS") },
        { name: "Doanh thu", icon: <DollarSign size={20} />, path: "/revenue", show: hasPermission("MENU_REVENUE") },
        { name: "Đội ngũ", icon: <Shield size={20} />, path: "/teams", show: hasPermission("MENU_TEAMS") },
        { name: "Nhân sự", icon: <Users size={20} />, path: "/users", show: hasPermission("MENU_USERS") },
        { name: "Sơ đồ tổ chức", icon: <Network size={20} />, path: "/org-chart", show: hasPermission("MENU_ORG_CHART") },
        { name: "Báo cáo ngày", icon: <PieChart size={20} />, path: "/daily-report", show: hasPermission("MENU_DAILY_REPORT") },
        { name: "Báo cáo chiến lược", icon: <PieChart size={20} />, path: "/analytics", show: hasPermission("MENU_ANALYTICS") },
        // Riêng menu Phân quyền, fix cứng chỉ Admin cao nhất mới thấy để tránh rủi ro
        { name: "Phân quyền", icon: <ShieldCheck size={20} />, path: "/permissions", show: userRole === "ADMIN" || userRole === "BAN_GIAM_DOC" },
    ];

    return (
        <>
            {/* LỚP PHỦ MỜ CHO MOBILE (OVERLAY) */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* THANH SIDEBAR */}
            <aside className={`
                fixed md:static top-0 left-0 h-screen shrink-0 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-50
                ${isSidebarOpen ? "translate-x-0 w-[260px] md:w-64" : "-translate-x-full md:translate-x-0 md:w-20"}
            `}>
                <div className="p-4 md:p-6 flex items-center gap-3 shrink-0 h-16 md:h-20">
                    <Image src="/images/logo-icon.png" alt="Logo" width={40} height={40} className="md:w-[50px] md:h-[50px] shrink-0" />
                    {isSidebarOpen && <span className="font-black text-lg md:text-xl text-slate-900 tracking-tight whitespace-nowrap">Sano <span className="text-red-600">WS</span></span>}
                </div>

                <nav className="flex-grow px-3 space-y-1 overflow-y-auto custom-scrollbar pt-2">
                    {/* Nếu hệ thống đang tải quyền thì hiện mờ mờ cho đẹp */}
                    {loading ? (
                        <div className="p-4 text-center text-slate-400 text-xs font-medium animate-pulse">Đang tải menu...</div>
                    ) : (
                        menuItems.filter(item => item.show).map((item) => {
                            const isActive = pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`flex items-center gap-3 px-3 py-3 md:px-4 rounded-2xl transition-all group ${isActive
                                        ? "bg-red-50 text-red-600 font-bold"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                                    title={!isSidebarOpen ? item.name : undefined}
                                >
                                    <span className={`shrink-0 ${isActive ? "text-red-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                                        {item.icon}
                                    </span>
                                    {isSidebarOpen && <span className="truncate text-sm md:text-base">{item.name}</span>}
                                </Link>
                            );
                        })
                    )}
                </nav>

                <div className="p-3 md:p-4 border-t border-slate-100 shrink-0">
                    <button
                        onClick={() => signOut()}
                        className="flex items-center justify-center md:justify-start gap-3 w-full px-3 py-3 md:px-4 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all text-sm md:text-base"
                        title={!isSidebarOpen ? "Đăng xuất" : undefined}
                    >
                        <LogOut size={20} className="shrink-0" />
                        {isSidebarOpen && <span className="font-medium truncate">Đăng xuất</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}