"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { TrendingUp, Calendar } from "lucide-react";
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

    const isManager = ["LEADER", "BAN_GIAM_DOC", "ADMIN"].includes(userRole);

    const today = new Date();
    const currentDay = today.getDate();
    let currentWeekNum = Math.ceil(currentDay / 7);
    if (currentWeekNum > 4) currentWeekNum = 4;

    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedWeek, setSelectedWeek] = useState(currentWeekNum);
    
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const [kpiList, setKpiList] = useState<any[]>([]);
    const [weekInfo, setWeekInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true); // State quản lý loading
    
    const availableWeeks = [1, 2, 3, 4];

    const fetchKpiData = async () => {
        if (!teamId) return;
        setIsLoading(true); // Bật loading
        try {
            const res = await fetch(`/api/kpi?teamId=${teamId}&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`);
            const data = await res.json();
            if (res.ok) {
                setKpiList(data.kpiList || []);
                setWeekInfo(data.weekData);
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        } finally {
            setIsLoading(false); // Tắt loading
        }
    };

    useEffect(() => {
        if (currentUser) fetchKpiData();
    }, [selectedYear, selectedMonth, selectedWeek, currentUser]);

    // Tự động gán user active nếu là nhân viên
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

    if (!teamId && !isManager) return <div className="p-8 text-center text-slate-500">Bạn chưa được phân vào Team nào.</div>;

    const activeKpi = kpiList.find(k => k.userId === viewingUserId);

    return (
        <div className="flex-1 p-8 bg-slate-50 overflow-y-auto h-full custom-scrollbar relative">
            
            {/* Header Bộ Lọc */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
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
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-1 px-3 border-r border-slate-200">
                        <span className="text-sm font-bold text-slate-500">Tháng:</span>
                        <select className="bg-transparent font-black text-slate-800 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-1 px-3">
                        <span className="text-sm font-bold text-slate-500">Tuần:</span>
                        <select className="bg-transparent font-black text-slate-800 outline-none cursor-pointer" value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>
                            {availableWeeks.map(w => <option key={w} value={w}>Tuần {w}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Khối Giao Diện Chính (Luôn giữ khung trắng) */}
            <div className="flex-1 space-y-6 md:space-y-8">
                {/* Component cho Nhân viên */}
                {!isManager && (
                    <div className="mb-8">
                        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">Mục tiêu của bạn</h2>
                        {/* 🚀 TRUYỀN PROP isLoading VÀO Ô 1 & Ô 2 */}
                        <KpiEmployeeDetail activeKpi={activeKpi} isLoading={isLoading} />
                    </div>
                )}

                {/* Component cho Quản lý */}
                {isManager && (
                    <KpiTeamTable 
                        kpiList={kpiList} 
                        handleUpdateTarget={handleUpdateTarget} 
                        onRowClick={(id) => { setViewingUserId(id); setIsDrawerOpen(true); }} 
                        isLoading={isLoading} 
                        teamId={teamId} 
                        year={selectedYear} 
                        month={selectedMonth}
                    />
                )}
            </div>

            {isManager && (
                <KpiDrawer 
                    isOpen={isDrawerOpen} 
                    onClose={() => setIsDrawerOpen(false)} 
                    activeKpi={activeKpi} 
                />
            )}
        </div>
    );
}