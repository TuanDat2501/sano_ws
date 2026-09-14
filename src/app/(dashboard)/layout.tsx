"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "../component/Navbar";
import FloatingChat from "../component/chat/FloatingChat";
import Sidebar from "../component/Sidebar"; // 🚀 Import Sidebar mới vào

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    
    // Tự động thu gọn Sidebar nếu là màn hình điện thoại/tablet nhỏ khi vừa vào web
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Tự động đóng Sidebar trên Mobile sau khi click chuyển trang
    useEffect(() => {
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, [pathname]);

    return (
        <div className="h-screen w-full bg-[#f8fafc] flex font-sans overflow-hidden">
            
            {/* 🚀 SIDEBAR CỦA SẾP ĐÃ ĐƯỢC ĐÓNG GÓI RA ĐÂY */}
            <Sidebar 
                isSidebarOpen={isSidebarOpen} 
                setSidebarOpen={setSidebarOpen} 
            />

            {/* ---------- MAIN CONTENT AREA ---------- */}
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
                
                {/* NAVBAR */}
                <div className="shrink-0 z-30 relative">
                    <Navbar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
                </div>

                {/* DYNAMIC CONTENT */}
                {/* Đổi padding để Responsive: p-3 (Mobile) -> p-4 (Tablet) -> p-6 (PC) */}
                <div className="flex-1 relative overflow-hidden bg-[#f8fafc] p-3 sm:p-4 md:p-6 z-10">
                    {children}
                </div>

                <FloatingChat />
            </main>
        </div>
    );
}