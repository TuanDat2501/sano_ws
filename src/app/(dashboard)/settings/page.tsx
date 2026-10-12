"use client";

import { useState, useEffect } from "react";
import { Settings, Power, ShieldAlert, Loader2, Database, DownloadCloud } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function SettingsPage() {
    const { showToast } = useToast();
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSubmitting] = useState(false);
    
    // State cho tính năng Backup
    const [isBackingUp, setIsBackingUp] = useState(false);

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

    // 🚀 HÀM GỌI API VÀ XỬ LÝ TẢI FILE SQL
    const handleBackupDatabase = async () => {
        if (!window.confirm("Hệ thống sẽ nén và tải xuống toàn bộ dữ liệu hiện tại. Quá trình này có thể mất vài giây. Tiếp tục?")) return;
        
        setIsBackingUp(true);
        try {
            const res = await fetch("/api/settings/backup");
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Lỗi hệ thống khi sao lưu");
            }

            // Xử lý stream file trả về từ Backend
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            
            // Lấy filename từ Header hoặc tự tạo tên mặc định
            const contentDisposition = res.headers.get("Content-Disposition");
            let fileName = "Backup_NoiBo.sql";
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2) {
                    fileName = fileNameMatch[1];
                }
            }
            
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            showToast("success", "Đã xuất file .sql thành công!");
        } catch (error: any) {
            showToast("error", error.message);
        } finally {
            setIsBackingUp(false);
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

                {/* 🚀 KHỐI SAO LƯU DỮ LIỆU */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="flex gap-4 items-start flex-1 pr-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                                <Database size={28} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black tracking-wide text-slate-800">Sao lưu Dữ liệu (Backup)</h2>
                                <p className="text-sm font-medium text-slate-500 mt-1.5 leading-relaxed">
                                    Trích xuất toàn bộ cấu trúc và dữ liệu hiện tại của hệ thống thành một file <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">.sql</code> để cất giữ phòng ngừa rủi ro.
                                </p>
                            </div>
                        </div>

                        <div className="shrink-0 flex items-center justify-center w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0">
                            <button 
                                onClick={handleBackupDatabase}
                                disabled={isBackingUp}
                                className="px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow-md flex items-center gap-2 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {isBackingUp ? <Loader2 size={18} className="animate-spin" /> : <DownloadCloud size={18} />}
                                {isBackingUp ? "Đang trích xuất..." : "Tải bản sao lưu"}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}