"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, BellRing } from "lucide-react";
import KpiEmployeeDetail from "./KpiEmployeeDetail";
import { useToast } from "@/app/component/ToastProvider";

interface KpiDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    activeKpi: any;
}

export default function KpiDrawer({ isOpen, onClose, activeKpi }: KpiDrawerProps) {
    const { showToast } = useToast();
    // 🚀 BƯỚC 1: Khai báo state để check môi trường Client
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleCopyReminder = () => {
        if (!activeKpi) return;

        const pendingCount = activeKpi.logs?.filter((log: any) => log.action === "PENDING").length || 0;

        const message = 
`📢 BÁO CÁO KPI TUẦN - ${activeKpi.fullName}
🎯 Chỉ tiêu tuần: ${activeKpi.targetValue} bài
✅ Đã hoàn thành: ${activeKpi.actualValue} bài
⏳ Đang nợ (Chưa nộp link): ${pendingCount} bài
👉 Tiến độ hiện tại: ${activeKpi.percent}%

Vào hệ thống cập nhật link nghiệm thu công việc lẹ lên nhé! 🚀`;

        navigator.clipboard.writeText(message).then(() => {
            showToast("success", "Đã copy tin nhắn nhắc việc!");
        }).catch(() => {
            showToast("error", "Không thể copy, vui lòng thử lại!");
        });
    };

    // 🚀 BƯỚC 2: Gói toàn bộ giao diện vào một biến
    const drawerContent = (
        <div className={`fixed inset-0 z-[99999] flex justify-end transition-all duration-300 ease-in-out ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
            <div 
                className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            ></div>
            
            <div className={`relative w-full md:max-w-4xl lg:max-w-5xl bg-slate-50 h-full flex flex-col transform transition-transform duration-300 ease-out shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {activeKpi && (
                    <>
                        {/* 🚀 Đã bỏ 'sticky top-0' và dùng 'relative shrink-0' để Header nằm im một chỗ chuẩn chỉnh */}
                        <div className="relative z-20 flex items-center justify-between p-3 md:p-5 lg:p-6 bg-white border-b border-slate-200 shadow-sm shrink-0">
                            <h2 className="text-base md:text-lg lg:text-xl font-black text-slate-800 flex items-center gap-1.5 md:gap-2 truncate">
                                Chi tiết KPI: <span className="text-blue-600 truncate">{activeKpi.fullName}</span>
                            </h2>
                            
                            <div className="flex items-center gap-2 md:gap-3 shrink-0">
                                <button 
                                    onClick={handleCopyReminder}
                                    className="flex items-center gap-1.5 md:gap-2 bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm active:scale-95"
                                    title="Copy tin nhắn đòi nợ"
                                >
                                    <BellRing size={14} className="md:w-4 md:h-4" />
                                    <span className="hidden sm:inline">Nhắc việc</span>
                                </button>

                                <button onClick={onClose} className="p-1.5 md:p-2.5 bg-slate-100 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors text-slate-600">
                                    <X size={18} className="md:w-5 md:h-5" strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Nội dung bên dưới sẽ tự động cuộn (overflow-y-auto) */}
                        <div className="p-3 md:p-6 lg:p-8 flex-1 overflow-y-auto custom-scrollbar">
                            <KpiEmployeeDetail activeKpi={activeKpi} isLoading={false} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    // 🚀 BƯỚC 3: Dùng Portal bắn thẳng ra ngoài document.body
    if (!mounted) return null;
    return createPortal(drawerContent, document.body);
}