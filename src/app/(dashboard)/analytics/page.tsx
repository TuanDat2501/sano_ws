"use client";

import { useSession } from "next-auth/react";
import { PieChart as PieChartIcon, Lock, Loader2, Calendar, Filter, Download, DollarSign, Star, Eye, TrendingUp } from "lucide-react";
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

const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
const CHANNEL_COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#64748b', '#14b8a6', '#f97316'];

export default function AnalyticsPage() {
    const { data: session, status } = useSession();
    const { showToast } = useToast();

    const [selectedWeek, setSelectedWeek] = useState(0);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedTeam, setSelectedTeam] = useState("ALL");

    const [data, setData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(true);
    const [selectedChartChannel, setSelectedChartChannel] = useState("ALL");
    useEffect(() => {
        const fetchAnalytics = async () => {
            setIsFetching(true);
            try {
                const res = await fetch(`/api/analytics?week=${selectedWeek}&month=${selectedMonth}&year=${selectedYear}&teamId=${selectedTeam}`);
                if (res.ok) setData(await res.json());
                else showToast("error", "Lỗi tải báo cáo");
            } catch (error) { showToast("error", "Mất kết nối máy chủ"); }
            finally { setIsFetching(false); }
        };
        if (status === "authenticated") fetchAnalytics();
    }, [selectedWeek, selectedMonth, selectedYear, selectedTeam, status]);

    const getDisplayDateRange = () => {
        const pad = (num: number) => num.toString().padStart(2, '0');

        if (selectedWeek === 0) {
            const maxDays = new Date(selectedYear, selectedMonth, 0).getDate();
            return `Dữ liệu từ 01/${pad(selectedMonth)}/${selectedYear} đến ${pad(maxDays)}/${pad(selectedMonth)}/${selectedYear}`;
        }

        const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
        const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0);

        const dayOfWeek = firstDayOfMonth.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfFirstWeek = new Date(selectedYear, selectedMonth - 1, 1 + diffToMonday);

        const startOfWeek = new Date(startOfFirstWeek);
        startOfWeek.setDate(startOfFirstWeek.getDate() + (selectedWeek - 1) * 7);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const actualStart = startOfWeek < firstDayOfMonth ? firstDayOfMonth : startOfWeek;
        const actualEnd = endOfWeek > lastDayOfMonth ? lastDayOfMonth : endOfWeek;

        return `Dữ liệu tuần ${selectedWeek} (từ ngày ${pad(actualStart.getDate())}/${pad(actualStart.getMonth() + 1)} đến ${pad(actualEnd.getDate())}/${pad(actualEnd.getMonth() + 1)})`;
    };

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

    const stats = data?.stats || {};

    const dualAxisData = {
        labels: data?.overallTrend?.map((t: any) => t.date) || [],
        datasets: [
            { label: 'Tổng Doanh Thu ($)', data: data?.overallTrend?.map((t: any) => t.revenue) || [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', yAxisID: 'y', borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: true },
            { label: 'Tổng Lượt Xem (Views)', data: data?.overallTrend?.map((t: any) => t.views) || [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)', yAxisID: 'y1', borderWidth: 2, borderDash: [5, 5], pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: false }
        ]
    };
    const dualAxisOptions = {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index' as const, intersect: false },
        plugins: { legend: { display: true, position: 'top' as const, labels: { usePointStyle: true, boxWidth: 10, font: { weight: 'bold' as const } } }, tooltip: commonTooltipOptions, datalabels: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { type: 'linear' as const, display: true, position: 'left' as const, grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { font: { size: 10 }, callback: (value: any) => '$' + value.toLocaleString() } },
            y1: { type: 'linear' as const, display: true, position: 'right' as const, grid: { drawOnChartArea: false }, border: { display: false }, ticks: { font: { size: 10 }, callback: (value: any) => value > 999999 ? (value / 1000000).toFixed(1) + 'M' : value > 999 ? (value / 1000).toFixed(1) + 'K' : value } }
        }
    };

    const topViewsData = {
        labels: data?.topChannelsByViews?.map((c: any) => c.name) || [],
        datasets: [{ label: 'Lượt Xem (Views)', data: data?.topChannelsByViews?.map((c: any) => c.views) || [], backgroundColor: ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'], borderRadius: 4, barThickness: 20 }]
    };
    const topViewsOptions = {
        indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: commonTooltipOptions, datalabels: { display: true, color: '#fff', font: { weight: 'bold' as const, size: 10 }, align: 'end' as const, anchor: 'start' as const, formatter: (val: number) => val.toLocaleString() } },
        scales: { x: { display: false }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' as const } } } }
    };

    const teamRevenueLineData = {
        labels: data?.revenueTrend?.map((t: any) => t.date) || [],
        datasets: (data?.activeTeamNames || []).map((teamName: string, index: number) => { const color = TEAM_COLORS[index % TEAM_COLORS.length]; return { label: teamName, data: data?.revenueTrend?.map((t: any) => t[teamName] || 0) || [], borderColor: color, backgroundColor: color + '15', borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, tension: 0.3, fill: true }; })
    };
    const channelRevenueLineData = {
        labels: data?.overallTrend?.map((t: any) => t.date) || [],
        datasets: selectedChartChannel === "ALL"
            ? [{
                label: "Tổng Doanh Thu Tất Cả Kênh ($)",
                data: data?.overallTrend?.map((t: any) => t.revenue) || [],
                borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: true
            }]
            : [{
                label: `Doanh thu - ${selectedChartChannel} ($)`,
                data: data?.channelRevenueTrend?.map((t: any) => t[selectedChartChannel] || 0) || [],
                borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: true
            }]
    };
    const channelViewsLineData = {
        labels: data?.overallTrend?.map((t: any) => t.date) || [],
        datasets: selectedChartChannel === "ALL"
            ? [{
                label: "Tổng Lượt Xem Tất Cả Kênh (Views)",
                data: data?.overallTrend?.map((t: any) => t.views) || [],
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: true
            }]
            : [{
                label: `Lượt xem - ${selectedChartChannel} (Views)`,
                data: data?.channelViewsTrend?.map((t: any) => t[selectedChartChannel] || 0) || [],
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: true
            }]
    };

    const standardLineOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' as const, align: 'end' as const, labels: { boxWidth: 12, usePointStyle: true, font: { size: 11, weight: 'bold' as const } } }, tooltip: commonTooltipOptions, datalabels: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { border: { display: false }, ticks: { font: { size: 10 }, callback: (value: any) => '$' + value.toLocaleString() } } }
    };
    const viewsLineOptions = { ...standardLineOptions, scales: { ...standardLineOptions.scales, y: { border: { display: false }, ticks: { font: { size: 10 }, callback: (value: any) => value > 999999 ? (value / 1000000).toFixed(1) + 'M' : value > 999 ? (value / 1000).toFixed(1) + 'K' : value.toLocaleString() } } } };

    const monetizationDonutData = {
        labels: data?.monetizationStatus?.map((d: any) => d.name) || [],
        datasets: [{ data: data?.monetizationStatus?.map((d: any) => d.value) || [], backgroundColor: data?.monetizationStatus?.map((d: any) => d.fill) || [], borderWidth: 0 }]
    };

    const taskFunnelData = {
        labels: data?.taskFunnel?.map((d: any) => d.name) || ['Kho Ý Tưởng', 'Cần Làm', 'Đang Làm', 'Chờ Duyệt', 'Hoàn Thành'],
        datasets: [{ label: "Số lượng Task", data: data?.taskFunnel?.map((d: any) => d.value) || [0, 0, 0, 0, 0], backgroundColor: ['#94a3b8', '#3b82f6', '#f59e0b', '#a855f7', '#10b981'], borderRadius: 4, barThickness: 30 }]
    };

    // 🚀 ĐÃ GẮN BIẾN DATA THẬT `data?.leadTimeData` TỪ API (Có đổ dải màu cho đẹp)
    const leadTimeBarData = {
        labels: data?.leadTimeData?.map((d: any) => d.name) || ['Lên Kịch Bản', 'Dựng Video', 'Đăng Kênh', 'Nghiệm Thu'],
        datasets: [{
            label: "Số ngày xử lý TB",
            data: data?.leadTimeData?.map((d: any) => d.days) || [0, 0, 0, 0],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981'],
            borderRadius: 4,
            barThickness: 24
        }]
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-3 md:p-8 space-y-4 md:space-y-6 pb-12 relative">

            {/* --- HEADER CONTROLS --- */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 md:gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <PieChartIcon className="text-blue-600 w-5 h-5 md:w-6 md:h-6" /> Báo Cáo Chiến Lược
                    </h1>
                    <p className="text-xs italic text-slate-500 mt-1.5 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        {getDisplayDateRange()}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm flex-1 sm:flex-none">
                        <Calendar size={16} className="text-slate-400 shrink-0" />
                        <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer border-r pr-2 border-slate-200" value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))}>
                            <option value={0}>Cả Tháng</option>
                            <option value={1}>Tuần 1</option>
                            <option value={2}>Tuần 2</option>
                            <option value={3}>Tuần 3</option>
                            <option value={4}>Tuần 4</option>
                            <option value={5}>Tuần 5</option>
                        </select>
                        <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer pl-1" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                            {[...Array(12)].map((_, i) => (<option key={i + 1} value={i + 1}>Tháng {i + 1}</option>))}
                        </select>
                        <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer border-l pl-2 border-slate-200" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
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

            <div className="mt-8 mb-4 flex items-center gap-3">
                <div className="h-8 w-1.5 bg-emerald-500 rounded-full"></div>
                <h2 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest">Tài Chính & Lượt Xem Kênh</h2>
                <div className="flex-1 h-px bg-slate-300 ml-4"></div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <MiniStatCard title="Tổng Doanh Thu" value={`$${(stats.totalRevenue || 0).toLocaleString()}`} suffix="USD" icon={<DollarSign size={16} className="text-emerald-500" />} />
                <MiniStatCard title="Tổng Lượt Xem" value={(stats.totalViews || 0).toLocaleString()} suffix="Views" icon={<Eye size={16} className="text-blue-500" />} />
                <MiniStatCard title="Điểm Chất Lượng TB" value={stats.avgQualityScore ? stats.avgQualityScore.toFixed(1) : "0.0"} suffix="/10" icon={<Star size={16} className="text-amber-500" />} />
                <MiniStatCard title="Sản Lượng Task" value={stats.totalOutput} suffix="Task Done" icon={<TrendingUp size={16} className="text-purple-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[300px] md:h-[350px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 shrink-0">Doanh thu và Views</h2>
                    <div className="flex-1 w-full min-h-0 relative"><Line data={dualAxisData} options={dualAxisOptions} /></div>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[300px] md:h-[350px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-4 shrink-0">Top 5 Kênh Trong Tháng</h2>
                    <div className="flex-1 w-full min-h-0 relative"><Bar data={topViewsData} options={topViewsOptions} /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[280px] md:h-[320px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 shrink-0">Doanh Thu Theo Đội Nhóm (USD)</h2>
                    <div className="flex-1 w-full min-h-0 relative"><Line data={teamRevenueLineData} options={standardLineOptions} /></div>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[280px] md:h-[320px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-4 shrink-0">Trạng Thái Bật Kiếm Tiền</h2>
                    <div className="flex-1 relative flex justify-center items-center">
                        <Doughnut data={monetizationDonutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: commonTooltipOptions, datalabels: commonDataLabelsConfig } }} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {data?.monetizationStatus?.map((m: any, i: number) => (
                            <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ backgroundColor: m.fill + '20', color: m.fill }}>{m.name}: {m.value}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* 🚀 HEADER BỘ LỌC CHUNG CHO 2 BIỂU ĐỒ KÊNH */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-8 mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="text-purple-500 w-5 h-5" /> Phân Tích Biến Động Kênh
                </h2>

                <select
                    value={selectedChartChannel}
                    onChange={(e) => setSelectedChartChannel(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm cursor-pointer w-full sm:w-auto min-w-[280px]"
                >
                    <option value="ALL">TỔNG HỆ THỐNG (Tất cả kênh)</option>
                    {data?.activeChannelNames?.map((name: string) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[300px] md:h-[350px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 shrink-0 flex items-center gap-1.5"><DollarSign size={16} className="text-emerald-500" /> Doanh Thu Kênh</h2>
                    <div className="flex-1 w-full min-h-0 relative">
                        <Line data={channelRevenueLineData} options={standardLineOptions} />
                    </div>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[300px] md:h-[350px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 shrink-0 flex items-center gap-1.5"><Eye size={16} className="text-blue-500" /> Lượt Xem Kênh</h2>
                    <div className="flex-1 w-full min-h-0 relative">
                        <Line data={channelViewsLineData} options={viewsLineOptions} />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                <div className="p-3 md:p-4 border-b border-slate-100"><h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">Phân Tích Hiệu Suất Từng Kênh (Tính RPM)</h2></div>
                
                {/* 🚀 THÊM overflow-auto và max-h-[400px] để bảng có thể cuộn dọc */}
                <div className="overflow-auto max-h-[400px] text-sm text-slate-600 custom-scrollbar relative">
                    <table className="w-full text-left min-w-[800px]">
                        
                        {/* 🚀 THÊM sticky top-0 z-10 để ghim Header */}
                        <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-b border-slate-200 text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr><th className="px-4 py-3 bg-slate-50">Tên Kênh</th><th className="px-4 py-3 bg-slate-50">Đội Nhóm</th><th className="px-4 py-3 bg-slate-50 text-right">Tổng Lượt Xem (Views)</th><th className="px-4 py-3 bg-slate-50 text-right">Tổng Doanh Thu ($)</th><th className="px-4 py-3 bg-slate-50 text-right text-purple-600">RPM ($/1k Views)</th><th className="px-4 py-3 bg-slate-50 text-right">Trạng Thái Bật KT</th></tr>
                        </thead>
                        
                        <tbody className="divide-y divide-slate-100">
                            {data?.channelGrid?.length > 0 ? data.channelGrid.map((c: any) => (
                                <tr key={c.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-xs md:text-sm font-bold text-slate-800">{c.name}</td>
                                    <td className="px-4 py-3 text-[10px] font-black uppercase text-blue-600"><span className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">{c.team}</span></td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">{c.views > 0 ? c.views.toLocaleString() : "-"}</td>
                                    <td className="px-4 py-3 text-sm text-right font-black text-emerald-600">{c.revenue > 0 ? `$${c.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "-"}</td>
                                    <td className="px-4 py-3 text-sm text-right font-black text-purple-600">{c.rpm > 0 ? `$${c.rpm.toFixed(2)}` : "-"}</td>
                                    <td className="px-4 py-3 text-right"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${c.monetization === 'DA_BAT' ? 'text-emerald-600 bg-emerald-50' : c.monetization === 'TAT_KIEM_TIEN' ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>{c.monetizationLabel}</span></td>
                                </tr>
                            )) : (<tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Không có dữ liệu kênh</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-12 mb-4 flex items-center gap-3">
                <div className="h-8 w-1.5 bg-blue-500 rounded-full"></div>
                <h2 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest">Tiến Độ Dự Án & Hiệu Suất Nhân Sự</h2>
                <div className="flex-1 h-px bg-slate-300 ml-4"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[260px] md:h-[300px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 md:mb-4 shrink-0">Phễu Trạng Thái Công Việc (Toàn Hệ Thống)</h2>
                    <div className="flex-1 w-full min-h-0 relative">
                        <Bar
                            data={taskFunnelData}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: commonTooltipOptions, datalabels: { display: true, color: '#ffffff', font: { weight: 'bold', size: 10 }, anchor: 'end', align: 'bottom', offset: 4 } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10, weight: 'bold' as const } } }, y: { grid: { display: false }, border: { display: false } } } }}
                        />
                    </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[260px] md:h-[300px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 md:mb-4 shrink-0">Điểm Nghẽn (Thời Gian Hoàn Thành Trung Bình)</h2>
                    <div className="flex-1 w-full min-h-0 relative">
                        <Bar
                            data={leadTimeBarData}
                            options={{ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: commonTooltipOptions, datalabels: { display: true, color: '#ffffff', font: { weight: 'bold', size: 10 }, anchor: 'end', align: 'start', formatter: (val) => val > 0 ? `${val} ngày` : '' } }, scales: { x: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } } } }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                <div className="p-3 md:p-4 border-b border-slate-100"><h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">Tiến Độ Dự Án (Project Health)</h2></div>
                
                {/* 🚀 THÊM overflow-auto và max-h-[400px] */}
                <div className="overflow-auto max-h-[400px] text-sm text-slate-600 custom-scrollbar relative">
                    <table className="w-full text-left min-w-[700px]">
                        
                        {/* 🚀 THÊM sticky top-0 z-10 */}
                        <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-b border-slate-200 text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr><th className="px-4 py-3 bg-slate-50">Tên Dự Án</th><th className="px-4 py-3 bg-slate-50">Người Giám Sát</th><th className="px-4 py-3 bg-slate-50 text-center">Tiến Độ Giao Việc</th><th className="px-4 py-3 bg-slate-50 text-right">Hoàn Thành</th></tr>
                        </thead>
                        
                        <tbody className="divide-y divide-slate-100">
                            {data?.projectHealth?.length > 0 ? data.projectHealth.map((p: any) => (
                                <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-xs md:text-sm font-bold text-blue-700">{p.name}</td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-600">{p.supervisor}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden"><div className={`h-full rounded-full ${p.progress >= 100 ? 'bg-green-500' : p.progress > 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${p.progress}%` }}></div></div>
                                            <span className="text-xs font-black w-8 text-right">{p.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-500">{p.doneTasks} / {p.totalTasks} Task</td>
                                </tr>
                            )) : (<tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">Không có dự án nào đang chạy</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                <div className="p-3 md:p-4 border-b border-slate-100"><h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">Hiệu Suất Cán Bộ Nhân Viên</h2></div>
                
                {/* 🚀 THÊM overflow-auto và max-h-[400px] */}
                <div className="overflow-auto max-h-[400px] text-sm text-slate-600 custom-scrollbar relative">
                    <table className="w-full text-left min-w-[800px]">
                        
                        {/* 🚀 THÊM sticky top-0 z-10 */}
                        <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-b border-slate-200 text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr><th className="px-4 py-3 bg-slate-50">Họ & Tên</th><th className="px-4 py-3 bg-slate-50">Vị Trí</th><th className="px-4 py-3 bg-slate-50 text-center">Sản Lượng</th><th className="px-4 py-3 bg-slate-50 text-center">% KPI</th><th className="px-4 py-3 bg-slate-50 text-center text-amber-600">Điểm TB</th><th className="px-4 py-3 bg-slate-50 text-right">Trạng Thái</th></tr>
                        </thead>
                        
                        <tbody className="divide-y divide-slate-100">
                            {data?.hrGrid?.map((u: any) => (
                                <tr key={u.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-xs md:text-sm font-bold text-slate-800">{u.name}</td>
                                    <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">{u.role}</td>
                                    <td className="px-4 py-3 text-sm text-center font-bold text-slate-800">{u.output}</td>
                                    <td className={`px-4 py-3 text-sm text-center font-black ${u.kpi >= 100 ? 'text-green-600' : u.kpi < 80 ? 'text-red-600' : 'text-slate-800'}`}>{u.kpi}%</td>
                                    <td className="px-4 py-3 text-sm text-center font-black text-amber-500">{u.avgScore}</td>
                                    <td className="px-4 py-3 text-right"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${u.status === 'Active' ? 'text-green-600 bg-green-50' : 'text-slate-500 bg-slate-100'}`}>{u.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function MiniStatCard({ title, value, suffix, icon }: any) {
    return (
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden">
            {icon && <div className="absolute top-4 right-4 opacity-50">{icon}</div>}
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
            <div className="flex items-baseline gap-1">
                <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
                <span className="text-[10px] md:text-xs font-bold text-slate-500">{suffix}</span>
            </div>
        </div>
    );
}