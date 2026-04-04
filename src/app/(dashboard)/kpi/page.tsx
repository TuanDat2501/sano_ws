"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { TrendingUp, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

import KpiEmployeeDetail from "./components/KpiEmployeeDetail";
import KpiTeamTable from "./components/KpiTeamTable";
import KpiDrawer from "./components/KpiDrawer";

export default function KpiDashboard() {
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT";
    const teamId = currentUser?.teamId; 
    const { showToast } = useToast();

    const isHighLevel = ["BAN_GIAM_DOC", "ADMIN", "HR"].includes(userRole);
    const isManager = ["LEADER", "BAN_GIAM_DOC", "ADMIN", "HR"].includes(userRole);

    const [teams, setTeams] = useState<any[]>([]);
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("ALL");
    const queryTeamId = isHighLevel ? selectedTeamFilter : teamId;

    const today = new Date();
    const currentDay = today.getDate();
    let currentWeekNum = Math.ceil(currentDay / 7);
    if (currentWeekNum > 4) currentWeekNum = 4;

    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedWeek, setSelectedWeek] = useState(currentWeekNum);
    
    // 🚀 STATE PHÂN TRANG (PAGINATION)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // Sếp có thể chỉnh số lượng nhân sự hiển thị trên 1 trang ở đây

    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const [kpiList, setKpiList] = useState<any[]>([]);
    const [weekInfo, setWeekInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true); 
    
    const availableWeeks = [1, 2, 3, 4];

    useEffect(() => {
        if (isHighLevel) {
            fetch("/api/teams").then(res => res.ok ? res.json() : []).then(setTeams);
        }
    }, [isHighLevel]);

    const fetchKpiData = async () => {
        if (!queryTeamId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true); 
        try {
            const res = await fetch(`/api/kpi?teamId=${queryTeamId}&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`);
            const data = await res.json();
            if (res.ok) {
                setKpiList(data.kpiList || []);
                setWeekInfo(data.weekData);
            } else {
                showToast("error", data.error || "Không thể tải dữ liệu");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        } finally {
            setIsLoading(false); 
        }
    };

    // Theo dõi bộ lọc: Hễ sếp đổi Team, Tháng, Tuần thì LÀM MỚI LẠI TRANG SỐ 1
    useEffect(() => {
        setCurrentPage(1); 
        if (currentUser) fetchKpiData();
    }, [selectedYear, selectedMonth, selectedWeek, selectedTeamFilter, currentUser]);

    useEffect(() => {
        if (!isManager && kpiList.length > 0 && !viewingUserId) {
            const me = kpiList.find(k => k.userId === currentUser?.id);
            if (me) setViewingUserId(me.userId);
        }
    }, [kpiList, currentUser, viewingUserId, isManager]);

    const handleUpdateTarget = async (userId: string, newTarget: string) => {
        const targetNum = parseInt(newTarget);
        if (isNaN(targetNum) || targetNum < 0) return;
        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, year: selectedYear, month: selectedMonth, weekNumber: selectedWeek, targetValue: targetNum })
            });
            if (res.ok) {
                showToast("success", "Đã chốt chỉ tiêu mới!");
                fetchKpiData(); 
            }
        } catch (error) {
            showToast("error", "Mất kết nối server");
        }
    };

    if (!queryTeamId && !isManager) return <div className="h-full flex-1 p-8 text-center text-slate-500 flex items-center justify-center font-medium">Bạn chưa được phân vào Team nào để xem KPI.</div>;

    const activeKpi = kpiList.find(k => k.userId === viewingUserId);

    // 🚀 TÍNH TOÁN DỮ LIỆU CẮT CHO PHÂN TRANG
    const totalPages = Math.ceil(kpiList.length / itemsPerPage);
    const paginatedKpiList = kpiList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        // 🚀 KHÓA CỨNG MÀN HÌNH BẰNG `h-full overflow-hidden`
        <div className="h-full flex flex-col p-4 md:p-8 bg-slate-50 overflow-hidden animate-fade-in relative">
            
            {/* ================= HEADER (Giữ cố định bằng shrink-0) ================= */}
            <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <TrendingUp className="text-red-600" /> Bảng Theo Dõi KPI
                    </h1>
                    {weekInfo && (
                        <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                            <Calendar size={16} /> Tuần {weekInfo.weekIndex} Tháng {weekInfo.month} ({new Date(weekInfo.startDate).toLocaleDateString('vi-VN')} - {new Date(weekInfo.endDate).toLocaleDateString('vi-VN')})
                        </p>
                    )}
                </div>
                
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200 overflow-x-auto max-w-full">
                    {isHighLevel && (
                        <div className="flex items-center gap-1 px-3 border-r border-slate-200 shrink-0">
                            <Users size={16} className="text-slate-400" />
                            <select className="bg-transparent font-black text-slate-800 outline-none cursor-pointer max-w-[140px] truncate" value={selectedTeamFilter} onChange={(e) => setSelectedTeamFilter(e.target.value)}>
                                <option value="ALL">Toàn công ty</option>
                                <option value="" disabled>--- Chọn Team ---</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex items-center gap-1 px-3 border-r border-slate-200 shrink-0">
                        <span className="text-sm font-bold text-slate-500">Tháng:</span>
                        <select className="bg-transparent font-black text-slate-800 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-1 px-3 shrink-0">
                        <span className="text-sm font-bold text-slate-500">Tuần:</span>
                        <select className="bg-transparent font-black text-slate-800 outline-none cursor-pointer" value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>
                            {availableWeeks.map(w => <option key={w} value={w}>Tuần {w}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* ================= BODY (Tự động chiếm phần không gian còn lại) ================= */}
            {/* 🚀 Dùng `flex-1 min-h-0` để nội dung bên trong được phép cuộn mà không đẩy bung màn hình */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                
                {!isManager && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">Mục tiêu của bạn</h2>
                        <KpiEmployeeDetail activeKpi={activeKpi} isLoading={isLoading} />
                    </div>
                )}

                {isManager && (
                    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                        
                        {/* 🚀 VÙNG CUỘN CỦA TABLE */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <KpiTeamTable 
                                kpiList={paginatedKpiList} // Truyền data đã cắt qua cho Component
                                handleUpdateTarget={handleUpdateTarget} 
                                onRowClick={(id) => { setViewingUserId(id); setIsDrawerOpen(true); }} 
                                isLoading={isLoading} 
                                teamId={queryTeamId} 
                                year={selectedYear} 
                                month={selectedMonth}
                            />
                        </div>

                        {/* 🚀 THANH ĐIỀU HƯỚNG PHÂN TRANG (Cố định ở đáy Table) */}
                        {!isLoading && kpiList.length > 0 && (
                            <div className="shrink-0 p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <span className="text-sm text-slate-500 font-medium">
                                    Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, kpiList.length)}</span> trong tổng số <span className="font-bold text-slate-800">{kpiList.length}</span> nhân sự
                                </span>
                                
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                                        title="Trang trước"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    
                                    <span className="text-sm font-black text-slate-700 px-2">
                                        {currentPage} <span className="text-slate-400 font-medium">/ {totalPages}</span>
                                    </span>

                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                                        title="Trang sau"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal/Drawer */}
            {isManager && (
                <KpiDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} activeKpi={activeKpi} />
            )}
        </div>
    );
}