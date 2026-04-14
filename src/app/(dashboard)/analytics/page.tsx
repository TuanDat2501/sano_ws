"use client";

import { useSession } from "next-auth/react";
import { PieChart as PieChartIcon, Lock, Loader2, Calendar, Filter, Download, Wallet } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/app/component/ToastProvider";

import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler, ChartDataLabels);

const commonTooltipOptions = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', titleColor: '#1e293b', bodyColor: '#475569', borderColor: '#e2e8f0',
    borderWidth: 1, padding: 12, boxPadding: 6, usePointStyle: true,
    titleFont: { family: 'inherit', size: 13, weight: 'bold' as const }, bodyFont: { family: 'inherit', size: 12, weight: 'bold' as const }, bodySpacing: 6,
};
const commonDataLabelsConfig = {
    color: '#ffffff', font: { weight: 'bold' as const, size: 12, family: 'inherit' },
    formatter: (value: number) => value > 0 ? value : "",
    display: (context: any) => context.dataset.data[context.dataIndex] > 0
};

export default function AnalyticsPage() {
    const { data: session, status } = useSession();
    const { showToast } = useToast();

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedTeam, setSelectedTeam] = useState("ALL");

    const [data, setData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setIsFetching(true);
            try {
                const res = await fetch(`/api/analytics?month=${selectedMonth}&year=${selectedYear}&teamId=${selectedTeam}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                } else {
                    showToast("error", "Lỗi tải báo cáo");
                }
            } catch (error) {
                showToast("error", "Mất kết nối máy chủ");
            } finally {
                setIsFetching(false);
            }
        };
        if (status === "authenticated") fetchAnalytics();
    }, [selectedMonth, selectedYear, selectedTeam, status]);

    if (status === "loading" || (isFetching && !data)) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
    }
    
    const currentUser = session?.user as any;
    if (!["ADMIN", "BAN_GIAM_DOC"].includes(currentUser?.role || "CONTENT")) {
        return (
            <div className="h-full bg-slate-50 flex flex-col items-center justify-center">
                <div className="bg-red-50 p-6 rounded-full mb-6 text-red-500"><Lock size={64} /></div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">Khu Vực Tuyệt Mật</h1>
            </div>
        );
    }

    const stats = data?.stats || { totalOutput: 0, avgKpi: 0, pendingRequestsCount: 0, currentHeadcount: 0, newHires: 0, resigns: 0 };

    const lineChartData = { 
        labels: data?.trendData?.map((t: any) => t.name) || [], 
        datasets: [
            { label: 'Chỉ tiêu', data: data?.trendData?.map((t: any) => t.Target) || [], borderColor: '#94a3b8', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, tension: 0.3 }, 
            { label: 'Thực đạt (DONE)', data: data?.trendData?.map((t: any) => t.Actual) || [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.3, fill: true }
        ] 
    };

    const allocationBarData = {
        labels: data?.allocation?.map((a: any) => a.name) || [],
        datasets: [{ label: "Số lượng Task", data: data?.allocation?.map((a: any) => a.value) || [], backgroundColor: data?.allocation?.map((a: any) => a.fill) || [], borderRadius: 4, barThickness: 30 }]
    };

    const leadTimeBarData = {
        labels: data?.leadTimeData?.map((d: any) => d.name) || [],
        datasets: [{
            label: "Số ngày xử lý TB",
            data: data?.leadTimeData?.map((d: any) => d.days) || [],
            backgroundColor: '#6366f1',
            borderRadius: 4,
            barThickness: 20
        }]
    };

    const requestDonutData = {
        labels: data?.requestBreakdown?.map((d: any) => d.name) || [],
        datasets: [{ data: data?.requestBreakdown?.map((d: any) => d.value) || [], backgroundColor: data?.requestBreakdown?.map((d: any) => d.fill) || [], borderWidth: 0, hoverOffset: 4 }]
    };
    const totalRequestsThisMonth = data?.requestBreakdown?.reduce((sum: number, item: any) => sum + item.value, 0) || 0;

    const hrDonutChartData = {
        labels: data?.hrHealth?.map((h: any) => h.name) || [],
        datasets: [{ data: data?.hrHealth?.map((h: any) => h.value) || [], backgroundColor: data?.hrHealth?.map((h: any) => h.fill) || [], borderWidth: 0, hoverOffset: 4 }]
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-3 md:p-8 space-y-4 md:space-y-6 pb-12 relative">
            {isFetching && (
                <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-blue-600 text-white text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse flex items-center gap-2 z-50">
                    <Loader2 size={12} className="animate-spin md:w-[14px] md:h-[14px]" /> Đang đồng bộ...
                </div>
            )}

            {/* --- HEADER --- */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 md:gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <PieChartIcon className="text-blue-600 w-5 h-5 md:w-6 md:h-6" /> Báo Cáo Chiến Lược
                    </h1>
                </div>
                
                {/* Responsive Bộ lọc: Tràn full width trên Mobile */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm flex-1 sm:flex-none">
                        <Calendar size={16} className="text-slate-400 shrink-0" />
                        <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer flex-1" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                            {[...Array(12)].map((_, i) => (<option key={i + 1} value={i + 1}>Tháng {i + 1}</option>))}
                        </select>
                        <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer border-l pl-2" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                            <option value={2026}>2026</option>
                            <option value={2025}>2025</option>
                        </select>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm flex-1 sm:flex-none">
                        <Filter size={16} className="text-slate-400 shrink-0" />
                        <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer w-full" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                            <option value="ALL">Toàn Công Ty</option>
                            {data?.teams?.map((t: any) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                        </select>
                    </div>
                    
                    <button className="flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs md:text-sm font-bold shadow-sm transition-all active:scale-95 sm:w-auto w-full">
                        <Download size={16} /> Xuất PDF
                    </button>
                </div>
            </div>

            {/* --- HÀNG 1: 4 BOX SỐ LIỆU --- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <MiniStatCard title={`Sản Lượng T${selectedMonth}`} value={stats.totalOutput} suffix="bài" />
                <MiniStatCard title="KPI Trung Bình" value={stats.avgKpi} suffix="%" />

                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
                    <div className="flex justify-between items-start mb-1 md:mb-2">
                        <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider line-clamp-1">Đơn Cần Duyệt</p>
                        <Wallet className="w-4 h-4 md:w-4 md:h-4 text-amber-500 shrink-0" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <h3 className="text-xl md:text-2xl font-black text-slate-800">{stats.pendingRequestsCount}</h3>
                        <span className="text-[10px] md:text-xs font-bold text-slate-500">đơn</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] md:text-[11px] font-bold mt-1 md:mt-2 text-slate-400 line-clamp-1">
                        <span>Chờ phê duyệt</span>
                    </div>
                </div>

                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
                    <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 md:mb-2 line-clamp-1">Quân Số Hiện Tại</p>
                    <div className="flex items-baseline gap-1 md:gap-2">
                        <h3 className="text-xl md:text-2xl font-black text-slate-800">{stats.currentHeadcount}</h3>
                        <span className="text-[10px] md:text-xs font-bold text-slate-500">người</span>
                    </div>
                    <div className="flex flex-wrap gap-1 md:gap-2 mt-1 md:mt-2">
                        <span className="text-[9px] md:text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{stats.newHires} Mới</span>
                        <span className="text-[9px] md:text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">-{stats.resigns} Nghỉ</span>
                    </div>
                </div>
            </div>

            {/* --- HÀNG 2: TREND FULL-WIDTH --- */}
            <div className="w-full bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[260px] md:h-[320px]">
                <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 md:mb-4 shrink-0">Biến Động Năng Suất (6 Tháng)</h2>
                <div className="flex-1 w-full min-h-0 relative">
                    <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }, tooltip: commonTooltipOptions, datalabels: { display: false } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { font: { size: 10 } } } } }} />
                </div>
            </div>

            {/* --- HÀNG 3: TÁC VỤ & ĐIỂM NGHẼN --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[260px] md:h-[300px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 md:mb-4 shrink-0">Phân Bổ Tác Vụ</h2>
                    <div className="flex-1 w-full min-h-0 relative">
                        <Bar data={allocationBarData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: commonTooltipOptions, datalabels: { display: true, color: '#ffffff', font: { weight: 'bold', size: 10 }, anchor: 'end', align: 'bottom', offset: 4 } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, border: { display: false } } } }} />
                    </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[260px] md:h-[300px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 md:mb-4 shrink-0">Điểm Nghẽn (Ngày/Bước)</h2>
                    <div className="flex-1 w-full min-h-0 relative">
                        <Bar 
                            data={leadTimeBarData} 
                            options={{ 
                                indexAxis: 'y' as const, 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                plugins: { 
                                    legend: { display: false }, 
                                    tooltip: commonTooltipOptions, 
                                    datalabels: { display: true, color: '#ffffff', font: { weight: 'bold', size: 10 }, anchor: 'end', align: 'start', formatter: (val) => val > 0 ? `${val} ngày` : '' } 
                                }, 
                                scales: { 
                                    x: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { font: { size: 10 } } }, 
                                    y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } } 
                                } 
                            }} 
                        />
                    </div>
                </div>
            </div>

            {/* --- HÀNG 4: DONUT CHARTS (Responsive gắt gao nhất) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

                {/* Cơ cấu Đề xuất */}
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-auto sm:h-[280px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-4 shrink-0">Cơ Cấu Đề Xuất</h2>
                    {/* Trên mobile hiển thị dọc (flex-col), trên tablet/PC hiển thị ngang (grid-cols) */}
                    <div className="flex-1 flex flex-col sm:grid sm:grid-cols-[1fr_1.2fr] gap-6 sm:gap-4 items-center min-h-0">
                        {/* Bánh Donut */}
                        <div className="w-full h-[160px] sm:h-full relative flex justify-center items-center">
                            <Doughnut data={requestDonutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: commonTooltipOptions, datalabels: commonDataLabelsConfig } }} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{totalRequestsThisMonth}</p>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase mt-0.5">Tổng Đơn</p>
                            </div>
                        </div>
                        {/* Legend bên cạnh/bên dưới */}
                        <div className="flex flex-col justify-center space-y-2.5 sm:space-y-3.5 w-full sm:pl-2">
                            {requestDonutData.labels.map((label: string, index: number) => {
                                const value = requestDonutData.datasets[0].data[index];
                                const color = requestDonutData.datasets[0].backgroundColor[index];
                                return (
                                    <div key={index} className="flex items-center justify-between gap-2 w-full">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }}></div>
                                            <span className="text-[11px] sm:text-xs font-bold text-slate-600 truncate">{label}</span>
                                        </div>
                                        <span className="text-xs sm:text-sm font-black text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 shrink-0">{value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sức khỏe Nhân sự */}
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-auto sm:h-[280px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-4 shrink-0">Đánh Giá Năng Lực</h2>
                    <div className="flex-1 flex flex-col sm:grid sm:grid-cols-[1fr_1.2fr] gap-6 sm:gap-4 items-center min-h-0">
                        <div className="w-full h-[160px] sm:h-full relative flex justify-center items-center">
                            <Doughnut data={hrDonutChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: commonTooltipOptions, datalabels: commonDataLabelsConfig } }} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{stats.currentHeadcount}</p>
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">Nhân sự</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:flex sm:flex-col gap-3 sm:space-y-4 w-full">
                            {data?.hrHealth?.map((h: any, idx: number) => (
                                <div key={idx} className="flex flex-col bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg sm:rounded-none">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase truncate">{h.name}</span>
                                    <span className="text-base sm:text-lg font-black" style={{ color: h.fill }}>{h.value} <span className="text-[10px] sm:text-xs text-slate-500">người</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- BẢNG DỮ LIỆU THỰC TẾ --- */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                <div className="p-3 md:p-4 border-b border-slate-100">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">Chi Tiết Từng Nhân Sự (Tháng {selectedMonth})</h2>
                </div>
                <div className="overflow-x-auto text-sm text-slate-600 custom-scrollbar">
                    <table className="w-full text-left min-w-[700px] md:min-w-[800px]">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-3 md:px-4 py-3">Họ & Tên</th>
                                <th className="px-3 md:px-4 py-3">Vị Trí</th>
                                <th className="px-3 md:px-4 py-3 text-center">% KPI Tháng</th>
                                <th className="px-3 md:px-4 py-3 text-center">Sản Lượng</th>
                                <th className="px-3 md:px-4 py-3 text-center">Đơn Xin Đợi Duyệt</th>
                                <th className="px-3 md:px-4 py-3 text-right">Trạng Thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.hrGrid?.length > 0 ? data.hrGrid.map((u: any) => (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-bold text-slate-800">{u.name}</td>
                                    <td className="px-3 md:px-4 py-2.5 md:py-3 text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-wider">{u.role}</td>
                                    <td className={`px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-center font-black ${u.kpi >= 100 ? 'text-green-600' : u.kpi < 80 ? 'text-red-600' : 'text-slate-800'}`}>{u.kpi}%</td>
                                    <td className="px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-center font-bold text-slate-800">{u.output} task</td>
                                    <td className="px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-center font-bold text-amber-500">{u.pendingReq > 0 ? `${u.pendingReq} đơn` : '-'}</td>
                                    <td className="px-3 md:px-4 py-2.5 md:py-3 text-right">
                                        <span className={`text-[9px] md:text-[10px] font-black uppercase px-2 py-1 rounded ${u.status === 'Active' ? 'text-green-600 bg-green-50' : u.status.includes('PIP') ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>
                                            {u.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs md:text-sm text-slate-400 font-medium">Không có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function MiniStatCard({ title, value, suffix }: any) {
    return (
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 shrink-0 flex flex-col justify-center">
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 md:mb-2 line-clamp-1">{title}</p>
            <div className="flex items-baseline gap-1">
                <h3 className="text-xl md:text-2xl font-black text-slate-800">{value}</h3>
                <span className="text-[10px] md:text-xs font-bold text-slate-500">{suffix}</span>
            </div>
        </div>
    );
}