"use client";

import { useState, useEffect } from "react";
import { Shield, Save, Loader2, Lock, AlertCircle, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/component/ToastProvider";

// Danh sách các Role trong hệ thống
const ROLES = [
    { id: "ADMIN", name: "Admin", color: "bg-red-100 text-red-700" },
    { id: "BAN_GIAM_DOC", name: "Giám Đốc", color: "bg-purple-100 text-purple-700" },
    { id: "HR", name: "Hành Chính", color: "bg-pink-100 text-pink-700" },
    { id: "LEADER", name: "Leader", color: "bg-blue-100 text-blue-700" },
    { id: "CONTENT", name: "Content", color: "bg-orange-100 text-orange-700" },
    { id: "EDITOR", name: "Editor", color: "bg-cyan-100 text-cyan-700" },
    { id: "PUBLISHER", name: "Publisher", color: "bg-emerald-100 text-emerald-700" },
];

// Danh sách các Module/Menu cần kiểm soát
const MODULES = [
    { id: "MENU_DASHBOARD", name: "Xem Tổng quan (Dashboard)" },
    { id: "MENU_TASKS", name: "Xem Bảng công việc (Kanban)" },
    { id: "MENU_KPI", name: "Xem Đánh giá KPI" },
    { id: "MENU_REVENUE", name: "Quản lý Doanh thu" },
    { id: "MENU_REQUESTS", name: "Xem Đơn từ & Đề xuất" },
    { id: "MENU_TEAMS", name: "Quản lý Cơ cấu Đội ngũ" },
    { id: "MENU_USERS", name: "Quản lý Nhân sự (Users)" },
    { id: "MENU_ORG_CHART", name: "Xem Sơ đồ tổ chức" },
    { id: "MENU_DAILY_REPORT", name: "Xem Báo cáo Hằng ngày" },
    { id: "MENU_CHANNELS", name: "Quản lý Hệ thống Kênh" },
    { id: "MENU_ANALYTICS", name: "Xem Báo cáo Chiến lược (Tuyệt mật)" },
    { id: "ACTION_CREATE_TASK", name: "Quyền Tạo Task (Giao việc)" },
    { id: "ACTION_APPROVE_REQUEST", name: "Quyền Duyệt Đơn từ" },
    { id: "MENU_PROJECTS", name: "Quản lý Dự án" },
];

export default function PermissionsPage() {
    const { data: session, status } = useSession();
    const currentUser = session?.user as any;
    const { showToast } = useToast();

    // State lưu trữ ma trận quyền: Record<ModuleId, Record<RoleId, boolean>>
    const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);


    // Fake fetch data ban đầu (Sau này sếp nối API thật vào đây)
    useEffect(() => {
        if (status === "loading") return;

        const fetchPermissions = async () => {
            try {
                const res = await fetch("/api/permissions");
                const dbPerms = await res.json();

                // Tạo khung ma trận mặc định trước (chống lỗi crash UI)
                const initialPerms: any = {};
                MODULES.forEach(mod => {
                    initialPerms[mod.id] = {};
                    ROLES.forEach(role => {
                        // Admin và BGD mặc định auto True, không thể tắt
                        if (role.id === "ADMIN" || role.id === "BAN_GIAM_DOC") {
                            initialPerms[mod.id][role.id] = true;
                        } else {
                            // Đọc từ DB lên, nếu DB trống thì gán false
                            initialPerms[mod.id][role.id] = dbPerms[mod.id]?.[role.id] || false;
                        }
                    });
                });

                setPermissions(initialPerms);
            } catch (error) {
                showToast("error", "Không thể tải cấu hình.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchPermissions();
    }, [status]);

    const handleToggle = (moduleId: string, roleId: string) => {
        // Không cho phép tắt quyền của ADMIN để tránh sếp tự khóa mõm mình
        if (roleId === "ADMIN") {
            showToast("info", "Không thể gỡ quyền của Hệ thống (ADMIN).");
            return;
        }

        setPermissions(prev => ({
            ...prev,
            [moduleId]: {
                ...prev[moduleId],
                [roleId]: !prev[moduleId][roleId]
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/permissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(permissions) // Ném nguyên cục JSON ma trận xuống
            });

            if (res.ok) {
                showToast("success", "Cập nhật cấu hình phân quyền thành công!");
            } else {
                showToast("error", "Đã có lỗi xảy ra khi lưu.");
            }
        } catch (error) {
            showToast("error", "Mất kết nối máy chủ");
        } finally {
            setIsSaving(false);
        }
    };

    // Bảo mật: Chỉ Admin mới được vào trang này
    if (status === "loading" || isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-red-600 h-8 w-8" /></div>;
    if (currentUser?.role !== "ADMIN") {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-50">
                <Lock className="text-red-500 mb-4 h-16 w-16" />
                <h2 className="text-2xl font-black text-slate-800">Truy Cập Bị Từ Chối</h2>
                <p className="mt-2 font-medium">Chỉ ADMIN cấp cao nhất mới có quyền cấu hình hệ thống.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-3 md:p-6 lg:p-8 bg-slate-50 animate-fade-in">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mb-4 md:mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                        <Shield className="text-red-600 w-6 h-6 md:w-8 md:h-8" /> Phân Quyền <span className="text-red-600">Hiển Thị</span>
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Cấu hình tính năng hiển thị cho từng nhóm chức vụ.</p>
                </div>
                
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-70 text-sm md:text-base"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                    {isSubmitting ? "Đang lưu..." : "Lưu Cấu Hình"}
                </button>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 p-3 md:p-4 rounded-xl mb-4 md:mb-6 shrink-0 flex items-start gap-3">
                <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs md:text-sm text-blue-800 font-medium leading-relaxed">
                    Sự thay đổi sẽ được áp dụng ngay lập tức cho các nhân sự đang online. Các ô mờ (Admin) là quyền mặc định của hệ thống không thể thay đổi.
                </p>
            </div>

            {/* --- MA TRẬN PHÂN QUYỀN (TABLE) --- */}
            <div className="flex-1 bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-slate-50 sticky top-0 z-1000 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                            <tr>
                                <th className="px-4 md:px-6 py-4 text-xs md:text-sm font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 bg-slate-50 left-0 sticky z-20 w-[250px] md:w-[300px] shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                                    Module / Tính năng
                                </th>
                                {ROLES.map(role => (
                                    <th key={role.id} className="px-3 py-4 border-b border-slate-200 text-center">
                                        <span className={`inline-flex px-2 md:px-3 py-1 rounded-md md:rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-widest ${role.color}`}>
                                            {role.name}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {MODULES.map(mod => (
                                <tr key={mod.id} className="hover:bg-slate-50/50 transition-colors group">
                                    {/* Cột tính năng: Được sticky bên trái để cuộn ngang không mất chữ */}
                                    <td className="px-4 md:px-6 py-3.5 md:py-4 font-bold text-slate-800 text-xs md:text-sm bg-white group-hover:bg-slate-50/50 sticky left-0 z-10 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                                        {mod.name}
                                    </td>
                                    
                                    {ROLES.map(role => {
                                        const hasAccess = permissions[mod.id]?.[role.id] || false;
                                        const isAdmin = role.id === "ADMIN";

                                        return (
                                            <td key={`${mod.id}_${role.id}`} className="px-3 py-3.5 md:py-4 text-center">
                                                <button
                                                    onClick={() => handleToggle(mod.id, role.id)}
                                                    disabled={isAdmin}
                                                    className={`
                                                        w-6 h-6 md:w-7 md:h-7 mx-auto rounded-md md:rounded-lg flex items-center justify-center transition-all
                                                        ${isAdmin ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-90 hover:shadow-sm'}
                                                        ${hasAccess 
                                                            ? 'bg-red-600 text-white border-red-600' 
                                                            : 'bg-slate-100 text-transparent border-slate-200 border hover:border-red-300'
                                                        }
                                                    `}
                                                >
                                                    <Check size={16} strokeWidth={3} className={hasAccess ? 'opacity-100' : 'opacity-0'} />
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}