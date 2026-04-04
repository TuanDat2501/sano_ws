"use client";

import { X, BellRing, Copy } from "lucide-react";
import KpiEmployeeDetail from "./KpiEmployeeDetail";
import { useToast } from "@/app/component/ToastProvider";

interface KpiDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    activeKpi: any;
}

export default function KpiDrawer({ isOpen, onClose, activeKpi }: KpiDrawerProps) {
    const { showToast } = useToast();

    // 🚀 HÀM TẠO TIN NHẮN VÀ COPY VÀO CLIPBOARD
    const handleCopyReminder = () => {
        if (!activeKpi) return;

        // Đếm số bài đang Pending (Chưa nộp link)
        const pendingCount = activeKpi.logs?.filter((log: any) => log.action === "PENDING").length || 0;

        // Soạn template tin nhắn
        const message = 
`📢 BÁO CÁO KPI TUẦN - ${activeKpi.fullName}
🎯 Chỉ tiêu tuần: ${activeKpi.targetValue} bài
✅ Đã hoàn thành: ${activeKpi.actualValue} bài
⏳ Đang nợ (Chưa nộp link): ${pendingCount} bài
👉 Tiến độ hiện tại: ${activeKpi.percent}%

Vào hệ thống cập nhật link nghiệm thu công việc lẹ lên nhé! 🚀`;

        // Copy vào Clipboard
        navigator.clipboard.writeText(message).then(() => {
            showToast("success", "Đã copy tin nhắn nhắc việc!");
        }).catch(() => {
            showToast("error", "Không thể copy, vui lòng thử lại!");
        });
    };

    return (
        <div className={`fixed inset-0 z-[100] flex justify-end transition-all duration-300 ease-in-out ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
            <div 
                className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            ></div>
            
            {/* Sửa lại width cho Drawer responsive hơn trên mobile (w-full md:max-w-5xl) */}
            <div className={`relative w-full md:max-w-5xl bg-slate-50 h-full flex flex-col transform transition-transform duration-300 ease-out shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {activeKpi && (
                    <>
                        {/* HEADER DRAWER */}
                        <div className="sticky top-0 z-20 flex items-center justify-between p-4 md:p-6 bg-white border-b border-slate-200 shadow-sm">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2">
                                Chi tiết KPI: <span className="text-blue-600">{activeKpi.fullName}</span>
                            </h2>
                            
                            <div className="flex items-center gap-3">
                                {/* 🚀 NÚT NHẮC VIỆC MỚI THÊM */}
                                <button 
                                    onClick={handleCopyReminder}
                                    className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 md:px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95"
                                    title="Copy tin nhắn đòi nợ"
                                >
                                    <BellRing size={16} />
                                    <span className="hidden md:inline">Nhắc việc</span>
                                </button>

                                <button onClick={onClose} className="p-2 md:p-2.5 bg-slate-100 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors text-slate-600">
                                    <X size={20} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
                            <KpiEmployeeDetail activeKpi={activeKpi} isLoading={false} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}