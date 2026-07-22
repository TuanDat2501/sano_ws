"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, CheckCircle2, Loader2, Calendar, FileBarChart, ExternalLink, Users, XCircle, Search, Filter } from "lucide-react";
import PermissionGuard from "@/app/component/PermissionGuard";

// Hàm helper để tô màu nhãn (Badge) tùy theo loại Link
const getBadgeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('kịch bản') || t.includes('eng')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (t.includes('video')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (t.includes('audio')) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    if (t.includes('bố cục') || t.includes('thumb')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (t.includes('đã đăng')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (t.includes('ghi chú')) return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-slate-100 text-slate-600 border-slate-200'; // Default
};

export default function DailyReportPage() {
    const { data: session, status } = useSession();
    const currentUser = session?.user as any;

    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate] = useState(new Date().toLocaleDateString('vi-VN'));

    // 🚀 STATE CHO BỘ LỌC
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTeam, setFilterTeam] = useState("ALL");
    const [filterStatus, setFilterStatus] = useState("ALL");

    useEffect(() => {
        if (status === "loading") return;

        fetch("/api/reports/daily")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Sắp xếp: Ai CHƯA báo cáo bị đẩy lên đầu bảng
                    const sorted = data.sort((a, b) => {
                        if (a.hasReported === b.hasReported) return 0;
                        return a.hasReported ? 1 : -1; 
                    });
                    setReports(sorted);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, [currentUser, status]);

    // 🚀 LẤY DANH SÁCH TEAM ĐỘNG (Dành cho Dropdown Lọc)
    const uniqueTeams = useMemo(() => {
        const teams = new Set(reports.map(r => r.teamName));
        return Array.from(teams).filter(Boolean).sort();
    }, [reports]);

    // 🚀 XỬ LÝ LỌC DỮ LIỆU
    const filteredReports = useMemo(() => {
        return reports.filter(user => {
            const matchSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchTeam = filterTeam === "ALL" || user.teamName === filterTeam;
            const matchStatus = filterStatus === "ALL" 
                || (filterStatus === "REPORTED" && user.hasReported)
                || (filterStatus === "MISSING" && !user.hasReported);
            
            return matchSearch && matchTeam && matchStatus;
        });
    }, [reports, searchTerm, filterTeam, filterStatus]);

    if (status === "loading" || isLoading) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 h-10 w-10" /></div>;
    }

    // 🚀 THỐNG KÊ (Nhảy số tự động theo bộ lọc)
    const totalUsers = filteredReports.length;
    const reportedUsers = filteredReports.filter(r => r.hasReported).length;
    const missingUsers = totalUsers - reportedUsers;

    return (
        <PermissionGuard moduleId="MENU_DAILY_REPORT">
            <div className="h-full max-h-[calc(100vh-80px)] flex flex-col p-4 md:p-6 bg-slate-50 overflow-hidden animate-fade-in gap-4 md:gap-6">
                
                {/* 🚀 HEADER & THỐNG KÊ (UI MỚI) */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0 bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 relative z-10">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                            <FileBarChart className="text-blue-600 w-6 h-6 md:w-7 md:h-7" /> Báo Cáo Hằng Ngày
                        </h1>
                        <p className="text-xs md:text-sm font-medium text-slate-500 mt-1.5 flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" /> 
                            <span>Phòng ban: <strong className="text-slate-700">Sản xuất</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>Ngày: <strong className="text-blue-700">{currentDate}</strong></span>
                        </p>
                    </div>

                    {/* Thống kê dạng Card */}
                    <div className="flex w-full xl:w-auto gap-3">
                        <div className="flex-1 xl:flex-none flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg hidden sm:block"><Users size={18} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng NV</p>
                                <p className="text-lg font-black text-slate-800 leading-none mt-0.5">{totalUsers}</p>
                            </div>
                        </div>
                        <div className="flex-1 xl:flex-none flex items-center gap-3 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-100">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hidden sm:block"><CheckCircle2 size={18} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">Đã Nộp</p>
                                <p className="text-lg font-black text-emerald-700 leading-none mt-0.5">{reportedUsers}</p>
                            </div>
                        </div>
                        <div className="flex-1 xl:flex-none flex items-center gap-3 bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg hidden sm:block"><XCircle size={18} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-widest">Thiếu</p>
                                <p className="text-lg font-black text-red-700 leading-none mt-0.5">{missingUsers}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🚀 THANH CÔNG CỤ BỘ LỌC */}
                <div className="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm tên nhân sự..." 
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none flex items-center bg-slate-50 border border-slate-200 rounded-lg h-9 md:h-10 px-3">
                            <Filter size={14} className="text-slate-400 mr-2 shrink-0" />
                            <select
                                className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none w-full sm:w-32 cursor-pointer"
                                value={filterTeam}
                                onChange={(e) => setFilterTeam(e.target.value)}
                            >
                                <option value="ALL">Tất cả Team</option>
                                {uniqueTeams.map((team: string) => (
                                    <option key={team} value={team}>{team}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative flex-1 sm:flex-none flex items-center bg-slate-50 border border-slate-200 rounded-lg h-9 md:h-10 px-3">
                            <Filter size={14} className="text-slate-400 mr-2 shrink-0" />
                            <select
                                className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none w-full sm:w-36 cursor-pointer"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="ALL">Mọi trạng thái</option>
                                <option value="REPORTED">✅ Đã báo cáo</option>
                                <option value="MISSING">❌ Trống báo cáo</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 🚀 BẢNG BÁO CÁO CHI TIẾT */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 overflow-hidden flex flex-col relative z-0">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[700px] md:min-w-full">
                            <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                <tr>
                                    <th className="px-6 py-4 font-black text-slate-500 uppercase tracking-widest text-[11px] w-[30%] border-b border-slate-200">Nhân sự & Đội nhóm</th>
                                    <th className="px-4 py-4 font-black text-slate-500 uppercase tracking-widest text-[11px] w-[20%] border-b border-slate-200">Trạng thái</th>
                                    <th className="px-4 py-4 font-black text-slate-500 uppercase tracking-widest text-[11px] border-b border-slate-200">Chi tiết công việc (Links)</th>
                                </tr>
                            </thead>
                            
                            <tbody className="divide-y divide-slate-100">
                                {filteredReports.map((user) => (
                                    <tr 
                                        key={user.id} 
                                        className={`group transition-colors hover:bg-slate-50/70 ${!user.hasReported ? 'bg-red-50/20' : ''}`}
                                    >
                                        {/* CỘT 1: Avatar + Tên + Team */}
                                        <td className={`px-6 py-4 relative`}>
                                            {/* Đường viền trái báo hiệu trạng thái */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${user.hasReported ? 'bg-emerald-400 opacity-0 group-hover:opacity-100' : 'bg-red-500'} transition-opacity`}></div>
                                            
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className="h-10 w-10 md:h-11 md:w-11 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 overflow-hidden shrink-0 text-sm border border-slate-200 shadow-sm">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        user.fullName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`font-bold text-sm ${!user.hasReported ? 'text-red-700' : 'text-slate-800'}`}>
                                                        {user.fullName}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase text-slate-400 mt-0.5 tracking-wider">
                                                        {user.teamName}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* CỘT 2: Huy hiệu Trạng thái */}
                                        <td className="px-4 py-4">
                                            {user.hasReported ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 shadow-sm">
                                                    <CheckCircle2 size={14} className="text-emerald-500" /> Đã cập nhật
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold border border-red-200 shadow-sm">
                                                    <AlertCircle size={14} className="text-red-500 animate-pulse" /> Trống báo cáo
                                                </span>
                                            )}
                                        </td>

                                        {/* CỘT 3: Links hiển thị dạng Label thông minh */}
                                        <td className="px-4 py-4">
                                            {user.hasReported ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {user.links.map((link: any, idx: number) => {
                                                        // Bóc tách "[Loại] Tên bài"
                                                        const match = link.name.match(/^\[(.*?)\]\s*(.*)$/);
                                                        const type = match ? match[1] : 'Link';
                                                        const title = match ? match[2] : link.name;
                                                        const badgeStyle = getBadgeColor(type);

                                                        return (
                                                            <a 
                                                                key={idx} 
                                                                href={link.url} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                className="flex items-center max-w-full bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all group overflow-hidden"
                                                                title={link.name}
                                                            >
                                                                <span className={`px-2 py-1.5 text-[10px] font-black uppercase tracking-wider border-r shrink-0 ${badgeStyle}`}>
                                                                    {type}
                                                                </span>
                                                                <span className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 group-hover:text-blue-600 truncate max-w-[150px] sm:max-w-[200px] lg:max-w-[300px]">
                                                                    {title}
                                                                </span>
                                                                <div className="pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <ExternalLink size={12} className="text-blue-500" />
                                                                </div>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="text-xs font-medium text-slate-400 italic">
                                                    Chưa phát sinh dữ liệu trên hệ thống.
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                
                                {filteredReports.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-10 text-center flex flex-col items-center justify-center">
                                            <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
                                            <p className="text-slate-500 text-sm font-medium">Không tìm thấy nhân sự nào khớp với bộ lọc.</p>
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