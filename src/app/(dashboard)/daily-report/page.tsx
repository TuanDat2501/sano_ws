"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, CheckCircle2, Link as LinkIcon, Loader2, Calendar, FileBarChart } from "lucide-react";
import PermissionGuard from "@/app/component/PermissionGuard";

export default function DailyReportPage() {
    const { data: session, status } = useSession();
    const currentUser = session?.user as any;

    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate] = useState(new Date().toLocaleDateString('vi-VN'));

    useEffect(() => {
        if (status === "loading") return;
        
        const allowedRoles = ["ADMIN", "BAN_GIAM_DOC", "HR"];
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            setIsLoading(false);
            return;
        }

        fetch("/api/reports/daily")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setReports(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, [currentUser, status]);

    if (status === "loading" || isLoading) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-red-600 h-8 w-8" /></div>;
    }

    const allowedRoles = ["ADMIN", "BAN_GIAM_DOC", "HR"];
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                <AlertCircle className="text-red-500 mb-4 h-12 w-12 md:h-16 md:w-16" />
                <h2 className="text-xl md:text-2xl font-black text-slate-800">Truy Cập Bị Từ Chối</h2>
                <p className="mt-2 text-sm md:text-base font-medium">Chỉ Admin, Ban Giám Đốc và HR mới có quyền xem báo cáo này.</p>
            </div>
        );
    }

    const totalUsers = reports.length;
    const reportedUsers = reports.filter(r => r.hasReported).length;
    const missingUsers = totalUsers - reportedUsers;

    return (
        <PermissionGuard moduleId="MENU_DAILY_REPORT">
        <div className="h-full flex flex-col p-3 md:p-8 bg-slate-50 overflow-y-auto custom-scrollbar animate-fade-in">
            
            {/* HEADER */}
            <div className="mb-6 md:mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <FileBarChart className="text-red-600 w-5 h-5 md:w-6 md:h-6" /> Báo Cáo Công Việc Hằng Ngày
                    </h1>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1.5 flex items-center gap-2">
                        <Calendar size={14} className="md:w-4 md:h-4" /> Phòng ban: <strong className="text-slate-700">Sản xuất</strong> | Ngày: <strong className="text-slate-700">{currentDate}</strong>
                    </p>
                </div>

                {/* THỐNG KÊ NHANH: Tràn full màn hình trên mobile, chia đều 3 cột */}
                <div className="flex justify-between w-full xl:w-auto bg-white p-2.5 md:p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                    <div className="text-center px-2 md:px-4 border-r border-slate-100 flex-1 xl:flex-none">
                        <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase">Tổng nhân sự</p>
                        <p className="text-lg md:text-xl font-black text-slate-800">{totalUsers}</p>
                    </div>
                    <div className="text-center px-2 md:px-4 border-r border-slate-100 flex-1 xl:flex-none">
                        <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase">Đã báo cáo</p>
                        <p className="text-lg md:text-xl font-black text-green-600">{reportedUsers}</p>
                    </div>
                    <div className="text-center px-2 md:px-4 flex-1 xl:flex-none">
                        <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase">Chưa báo cáo</p>
                        <p className="text-lg md:text-xl font-black text-red-600">{missingUsers}</p>
                    </div>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU */}
            <div className="bg-white border border-slate-200 rounded-xl md:rounded-[24px] shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    {/* Bắt buộc phải có min-w để bảng không bị bóp méo trên mobile */}
                    <table className="w-full text-left border-collapse min-w-[550px] md:min-w-full">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200">
                                <th className="p-3 md:p-4 font-black text-slate-600 text-xs md:text-sm w-1/3">Nhân sự</th>
                                <th className="p-3 md:p-4 font-black text-slate-600 text-xs md:text-sm w-1/4">Trạng thái</th>
                                <th className="p-3 md:p-4 font-black text-slate-600 text-xs md:text-sm">Link đính kèm trong ngày</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reports.map((user) => (
                                <tr 
                                    key={user.id} 
                                    className={`transition-colors ${!user.hasReported ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50'}`}
                                >
                                    {/* CỘT 1: Thông tin nhân sự */}
                                    <td className="p-3 md:p-4">
                                        <div className="flex items-center gap-2.5 md:gap-3">
                                            <div className="h-8 w-8 md:h-10 md:w-10 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-600 overflow-hidden shrink-0 text-xs md:text-base">
                                                {user.avatarUrl ? (
                                                    <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    user.fullName.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <span className={`font-bold text-xs md:text-sm ${!user.hasReported ? 'text-red-700' : 'text-slate-800'}`}>
                                                {user.fullName}
                                            </span>
                                        </div>
                                    </td>

                                    {/* CỘT 2: Trạng thái */}
                                    <td className="p-3 md:p-4">
                                        {user.hasReported ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1 rounded-full bg-green-100 text-green-700 text-[10px] md:text-xs font-bold border border-green-200">
                                                <CheckCircle2 size={12} className="md:w-3.5 md:h-3.5" /> Đã cập nhật
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1 rounded-full bg-red-100 text-red-700 text-[10px] md:text-xs font-bold border border-red-200 animate-pulse">
                                                <AlertCircle size={12} className="md:w-3.5 md:h-3.5" /> Trống báo cáo
                                            </span>
                                        )}
                                    </td>

                                    {/* CỘT 3: Danh sách Link */}
                                    <td className="p-3 md:p-4 py-3">
                                        {user.hasReported ? (
                                            <div className="flex flex-col gap-1.5 md:gap-2">
                                                {user.links.map((link: any, idx: number) => (
                                                    <a 
                                                        key={idx} 
                                                        href={link.url} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline w-fit group"
                                                    >
                                                        <LinkIcon size={12} className="md:w-3.5 md:h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
                                                        <span className="truncate max-w-[180px] sm:max-w-[200px] md:max-w-[250px]">{link.name}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs md:text-sm font-medium text-red-500 italic">
                                                Chưa có link công việc nào được gắn.
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {reports.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-6 md:p-8 text-center text-slate-500 text-xs md:text-sm font-medium">
                                        Không tìm thấy nhân sự nào thuộc phòng Sản xuất.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        </PermissionGuard>
    );
}