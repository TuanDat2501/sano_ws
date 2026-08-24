"use client";

import { useState, useEffect } from "react";
import { Settings, Power, ShieldAlert, Loader2, Info } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function SettingsPage() {
    const { showToast } = useToast();
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    setIsMaintenance(data.isMaintenance || false);
                }
            } catch (error) {
                showToast("error", "Không tải được cấu hình hệ thống");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const toggleMaintenance = async () => {
        const newState = !isMaintenance;
        
        if (newState) {
            if (!window.confirm("CẢNH BÁO: Bật chế độ bảo trì sẽ chặn tất cả nhân sự (trừ Admin) truy cập vào hệ thống. Bạn có chắc chắn muốn bật?")) {
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isMaintenance: newState })
            });

            if (res.ok) {
                setIsMaintenance(newState);
                showToast("success", newState ? "Đã BẬT chế độ bảo trì!" : "Đã TẮT chế độ bảo trì!");
            } else {
                showToast("error", "Cập nhật thất bại. Thử lại sau!");
            }
        } catch (error) {
            showToast("error", "Mất kết nối tới server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 size={32} className="animate-spin mb-2" />
            </div>
        );
    }

    return (
        <div className="h-full p-4 md:p-8 bg-slate-50 animate-fade-in flex justify-center items-start">
            <div className="w-full max-w-3xl space-y-6">
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-slate-200 text-slate-700 rounded-2xl shadow-sm">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cấu hình Hệ thống</h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">Trung tâm điều khiển các tính năng cốt lõi của Workspace</p>
                    </div>
                </div>

                {/* Khối Cài đặt Bảo trì */}
                <div className={`p-6 rounded-3xl border transition-all duration-300 shadow-sm ${isMaintenance ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        
                        <div className="flex gap-4 items-start flex-1 pr-4">
                            <div className={`p-3 rounded-2xl shrink-0 transition-colors duration-300 ${isMaintenance ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-slate-100 text-slate-400'}`}>
                                <Power size={28} />
                            </div>
                            <div>
                                <h2 className={`text-lg font-black tracking-wide ${isMaintenance ? 'text-rose-700' : 'text-slate-800'}`}>
                                    Chế độ Bảo trì (Maintenance Mode)
                                </h2>
                                <p className="text-sm font-medium text-slate-500 mt-1.5 leading-relaxed">
                                    Đóng băng hệ thống. Khi được kích hoạt, chỉ có <b>Quản trị viên (ADMIN)</b> mới có thể truy cập. Các tài khoản khác sẽ bị chuyển hướng đến trang thông báo bảo trì.
                                </p>
                            </div>
                        </div>

                        {/* Nút Gạt (Toggle Switch) */}
                        <div className="shrink-0 flex items-center justify-center w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0">
                            <button 
                                onClick={toggleMaintenance}
                                disabled={isSaving}
                                className={`relative inline-flex h-[36px] w-[64px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${isSaving ? 'opacity-50 cursor-wait' : ''} ${isMaintenance ? 'bg-red-500' : 'bg-slate-300'}`}
                            >
                                <span className={`pointer-events-none inline-block h-[32px] w-[32px] transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${isMaintenance ? 'translate-x-[28px]' : 'translate-x-0'}`} />
                            </button>
                        </div>

                    </div>

                    {isMaintenance && (
                        <div className="mt-6 flex items-start gap-3 bg-white p-4 rounded-xl border border-rose-100 shadow-sm animate-fade-in">
                            <ShieldAlert className="text-red-500 shrink-0" size={20} />
                            <div>
                                <p className="text-sm font-bold text-slate-800">Trạng thái: Đang bảo trì ⚠️</p>
                                <p className="text-xs font-medium text-slate-500 mt-1">Toàn bộ nhân sự đang bị chặn kết nối. Hãy tắt chế độ này khi nâng cấp xong để mọi người có thể vào lại Workspace.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Khối Cài đặt khác (Placeholder chờ nâng cấp sau này) */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm opacity-60">
                    <div className="flex gap-4 items-start">
                        <div className="p-3 bg-slate-100 text-slate-400 rounded-2xl shrink-0">
                            <Info size={28} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-wide text-slate-800">Các tính năng đang phát triển</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1.5 leading-relaxed">
                                Cài đặt cảnh báo Telegram, Tự động sao lưu dữ liệu, Quy tắc tự động xoá Log rác... (Sẽ được ra mắt trong bản cập nhật tới).
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}