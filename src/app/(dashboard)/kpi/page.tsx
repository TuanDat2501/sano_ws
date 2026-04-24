"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { TrendingUp, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

import KpiEmployeeDetail from "./components/KpiEmployeeDetail";
import KpiTeamTable from "./components/KpiTeamTable";
import KpiDrawer from "./components/KpiDrawer";
import { getContinuousWeekRange } from "@/lib/utils";

// --- BỘ CÔNG CỤ TÍNH LỊCH CHUẨN ---
function getMonthlyWeekRange(year: number, month: number, weekNumber: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const actualStart = startOfWeek < firstDayOfMonth ? firstDayOfMonth : startOfWeek;
    const actualEnd = endOfWeek > lastDayOfMonth ? lastDayOfMonth : endOfWeek;

    const formatDate = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

    return {
        start: actualStart,
        end: actualEnd,
        label: `Tuần ${weekNumber} (${formatDate(actualStart)} - ${formatDate(actualEnd)})`
    };
}

function getCurrentWeekNumber(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    for (let w = 1; w <= 5; w++) {
        const range = getContinuousWeekRange(year, month, w);
        if (date >= range.start && date <= range.end) {
            return w > 4 ? 4 : w; 
        }
    }
    return 1;
}

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
    const currentWeekNum = getCurrentWeekNumber(today); 

    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedWeek, setSelectedWeek] = useState(currentWeekNum);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; 

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

        // 🚀 BƯỚC 1: OPTIMISTIC UPDATE - Cập nhật giao diện ngay lập tức để không bị "Nháy bảng"
        setKpiList(prev => prev.map(k => {
            if (k.userId === userId) {
                // Tự động tính toán lại phần trăm trên Frontend
                const newPercent = targetNum > 0 ? Math.round((k.actualValue / targetNum) * 100) : 0;
                return { ...k, targetValue: targetNum, percent: newPercent };
            }
            return k;
        }));

        // 🚀 BƯỚC 2: Gọi API lưu ngầm dưới nền (Background Sync)
        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    userId, 
                    year: selectedYear, 
                    month: selectedMonth, 
                    weekNumber: selectedWeek, 
                    targetValue: targetNum 
                })
            });
            
            if (res.ok) {
                showToast("success", "Đã chốt chỉ tiêu!");
                // Không cần gọi lại fetchKpiData() ở đây nữa để tránh nháy màn hình
            } else {
                showToast("error", "Lỗi lưu dữ liệu. Đang tải lại bảng...");
                fetchKpiData(); // Chỉ tải lại nếu lưu bị lỗi
            }
        } catch (error) {
            showToast("error", "Mất kết nối server");
            fetchKpiData(); // Trả lại data gốc nếu mất mạng
        }
    };

    if (!queryTeamId && !isManager) return <div className="h-full flex-1 p-8 text-center text-slate-500 flex items-center justify-center font-medium">Bạn chưa được phân vào Team nào để xem KPI.</div>;

    const activeKpi = kpiList.find(k => k.userId === viewingUserId);
    const totalPages = Math.ceil(kpiList.length / itemsPerPage);
    const paginatedKpiList = kpiList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="h-full flex flex-col p-3 md:p-8 bg-slate-50 overflow-hidden animate-fade-in relative">

            {/* HEADER */}
            <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 md:mb-6 gap-3 md:gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <TrendingUp className="text-red-600 w-5 h-5 md:w-6 md:h-6" /> Bảng Theo Dõi KPI
                    </h1>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 md:mt-1.5 flex items-center gap-1.5 md:gap-2">
                        <Calendar size={14} className="md:w-4 md:h-4" /> {getContinuousWeekRange(selectedYear, selectedMonth, selectedWeek).label}
                    </p>
                </div>

                {/* Khối Filter: Trượt ngang trên mobile */}
                <div className="flex items-center gap-1 md:gap-2 bg-white p-1.5 md:p-2 rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full xl:w-auto custom-scrollbar-thin">
                    {isHighLevel && (
                        <div className="flex items-center gap-1 px-2 md:px-3 border-r border-slate-200 shrink-0">
                            <Users size={14} className="text-slate-400 md:w-4 md:h-4" />
                            <select className="bg-transparent text-xs md:text-sm font-black text-slate-800 outline-none cursor-pointer max-w-[100px] md:max-w-[140px] truncate" value={selectedTeamFilter} onChange={(e) => setSelectedTeamFilter(e.target.value)}>
                                <option value="ALL">Toàn công ty</option>
                                <option value="" disabled>--- Chọn Team ---</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex items-center gap-1 px-2 md:px-3 border-r border-slate-200 shrink-0">
                        <span className="text-[10px] md:text-sm font-bold text-slate-500">Tháng:</span>
                        <select className="bg-transparent text-xs md:text-sm font-black text-slate-800 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>T{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-1 px-2 md:px-3 shrink-0">
                        <span className="text-[10px] md:text-sm font-bold text-slate-500">Tuần:</span>
                        <select className="bg-transparent text-xs md:text-sm font-black text-slate-800 outline-none cursor-pointer" value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>
                            {availableWeeks.map(w => <option key={w} value={w}>Tuần {w}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* BODY */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {!isManager && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <h2 className="text-lg md:text-xl font-black text-slate-800 mb-4 md:mb-6 flex items-center gap-2">Mục tiêu của bạn</h2>
                        <KpiEmployeeDetail activeKpi={activeKpi} isLoading={isLoading} />
                    </div>
                )}

                {isManager && (
                    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex-1 flex flex-col min-h-0">
                            <KpiTeamTable
                                kpiList={paginatedKpiList} 
                                handleUpdateTarget={handleUpdateTarget}
                                onRowClick={(id: any) => { setViewingUserId(id); setIsDrawerOpen(true); }}
                                isLoading={isLoading}
                                teamId={queryTeamId}
                                year={selectedYear}
                                month={selectedMonth}
                            />
                        </div>

                        {/* Phân trang: Ẩn bớt chữ trên Mobile */}
                        {!isLoading && kpiList.length > 0 && (
                            <div className="shrink-0 p-3 md:p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <span className="text-[10px] md:text-sm text-slate-500 font-medium hidden sm:inline">
                                    Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, kpiList.length)}</span> / <span className="font-bold text-slate-800">{kpiList.length}</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium sm:hidden">
                                    Tổng: <span className="font-bold text-slate-800">{kpiList.length}</span>
                                </span>

                                <div className="flex items-center gap-1.5 md:gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 md:p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                                    >
                                        <ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" />
                                    </button>

                                    <span className="text-xs md:text-sm font-black text-slate-700 px-2">
                                        {currentPage} <span className="text-slate-400 font-medium">/ {totalPages}</span>
                                    </span>

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="p-1.5 md:p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                                    >
                                        <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isManager && (
                <KpiDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} activeKpi={activeKpi} />
            )}
        </div>
    );
}