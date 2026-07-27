"use client";

import { useSession } from "next-auth/react";
import { PieChart as PieChartIcon, Lock, Loader2, Calendar, Filter, Download, DollarSign, Star, Eye, TrendingUp, Users, Tv } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/app/component/ToastProvider";
import { usePermission } from "@/app/component/PermissionProvider";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getCurrentWeekNumber } from "@/lib/utils";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler, ChartDataLabels);

const commonTooltipOptions = { backgroundColor: 'rgba(255, 255, 255, 0.95)', titleColor: '#1e293b', bodyColor: '#475569', borderColor: '#e2e8f0', borderWidth: 1, padding: 12, boxPadding: 6, usePointStyle: true, titleFont: { family: 'inherit', size: 13, weight: 'bold' as const }, bodyFont: { family: 'inherit', size: 12, weight: 'bold' as const }, bodySpacing: 6, };
const commonDataLabelsConfig = { color: '#ffffff', font: { weight: 'bold' as const, size: 12, family: 'inherit' }, formatter: (value: number) => value > 0 ? value : "", display: (context: any) => context.dataset.data[context.dataIndex] > 0 };
const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function AnalyticsPage() {
    const { data: session, status } = useSession();
    const { showToast } = useToast();
    const { hasPermission, loading: permLoading } = usePermission();
    // ==================================================
    // TẦNG 1: TRẠNG THÁI DOANH THU & KÊNH (Dải ngày)
    // ==================================================
    const [timeRange, setTimeRange] = useState("28d"); // Mặc định 28 ngày
    const [startDateObj, setStartDateObj] = useState<Date | null>(null);
    const [endDateObj, setEndDateObj] = useState<Date | null>(null);
    const [isCustomDate, setIsCustomDate] = useState(false);
    const [customStartStr, setCustomStartStr] = useState("");
    const [customEndStr, setCustomEndStr] = useState("");

    // ==================================================
    // TẦNG 2: TRẠNG THÁI HR & VẬN HÀNH (Tuần / Tháng)
    // ==================================================
    const [kpiWeek, setKpiWeek] = useState(() => getCurrentWeekNumber(new Date()));
    const [kpiMonth, setKpiMonth] = useState(new Date().getMonth() + 1);
    const [kpiYear, setKpiYear] = useState(new Date().getFullYear());

    // BỘ LỌC TEAM CHUNG
    const [selectedTeam, setSelectedTeam] = useState("ALL");
    const [data, setData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(true);
    const [selectedChartChannel, setSelectedChartChannel] = useState("ALL");


    const [isExporting, setIsExporting] = useState(false);
    // Xử lý Logic Ngày Tầng 1
    useEffect(() => {
        if (timeRange === "custom") return;
        setIsCustomDate(false);
        const end = new Date();
        const start = new Date();

        if (timeRange === "7d") start.setDate(end.getDate() - 7);
        else if (timeRange === "28d") start.setDate(end.getDate() - 28);
        else if (timeRange === "90d") start.setDate(end.getDate() - 90);
        else if (timeRange === "this_month") start.setDate(1);

        setStartDateObj(start);
        setEndDateObj(end);
    }, [timeRange]);

    // Gọi API
    useEffect(() => {
        if (status !== "authenticated" || !startDateObj || !endDateObj) return;

        const fetchAnalytics = async () => {
            setIsFetching(true);
            try {
                const sParam = startDateObj.toISOString().split('T')[0];
                const eParam = endDateObj.toISOString().split('T')[0];

                const url = `/api/analytics?start=${sParam}&end=${eParam}&kpiW=${kpiWeek}&kpiM=${kpiMonth}&kpiY=${kpiYear}&team=${selectedTeam}`;
                const res = await fetch(url);
                if (res.ok) setData(await res.json());
                else showToast("error", "Lỗi tải báo cáo");
            } catch (error) {
                showToast("error", "Mất kết nối máy chủ");
            } finally { setIsFetching(false); }
        };
        fetchAnalytics();
    }, [startDateObj, endDateObj, kpiWeek, kpiMonth, kpiYear, selectedTeam, status]);

    const handleExportReport = async () => {
        if (!data) {
            showToast("error", "Chưa có dữ liệu để xuất!");
            return;
        }
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();

            // --- Sheet 1: Bảng Vàng Kênh ---
            if (data.channelGrid && data.channelGrid.length > 0) {
                const wsChannels = workbook.addWorksheet('Doanh Thu Kênh');
                wsChannels.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'Tên Kênh', key: 'name', width: 35 },
                    { header: 'Đội Nhóm', key: 'team', width: 20 },
                    { header: 'Lượt Xem', key: 'views', width: 15 },
                    { header: 'Doanh Thu ($)', key: 'revenue', width: 18 },
                    { header: 'RPM ($)', key: 'rpm', width: 15 },
                    { header: 'Trạng Thái', key: 'status', width: 20 },
                ];
                
                data.channelGrid.forEach((c: any, index: number) => {
                    wsChannels.addRow({
                        stt: index + 1,
                        name: c.name,
                        team: c.team,
                        views: c.views,
                        revenue: c.revenue,
                        rpm: c.rpm,
                        status: c.monetizationLabel
                    });
                });

                // Style Header
                wsChannels.getRow(1).eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.font = { bold: true };
                });
            }

            // --- Sheet 2: KPI Nhân Sự ---
            if (data.hrGrid && data.hrGrid.length > 0) {
                const wsHR = workbook.addWorksheet('KPI Nhân Sự');
                wsHR.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'Họ & Tên', key: 'name', width: 30 },
                    { header: 'Vị Trí', key: 'role', width: 20 },
                    { header: 'Sản Lượng (Task)', key: 'output', width: 20 },
                    { header: 'KPI (%)', key: 'kpi', width: 15 },
                    { header: 'Điểm Lượng (Sao)', key: 'avgScore', width: 20 },
                ];
                
                data.hrGrid.forEach((u: any, index: number) => {
                    wsHR.addRow({
                        stt: index + 1,
                        name: u.name,
                        role: u.role,
                        output: u.output,
                        kpi: u.kpi,
                        avgScore: u.avgScore
                    });
                });

                // Style Header
                wsHR.getRow(1).eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.font = { bold: true };
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `BaoCao_TongHop_${new Date().getTime()}.xlsx`);
            showToast("success", "Đã tải báo cáo thành công!");
        } catch (error) {
            showToast("error", "Lỗi khi xuất báo cáo!");
        } finally {
            setIsExporting(false);
        }
    };

    const handleApplyCustomDate = () => {
        if (!customStartStr || !customEndStr) { showToast("error", "Vui lòng chọn đủ 2 ngày!"); return; }
        setStartDateObj(new Date(customStartStr));
        setEndDateObj(new Date(customEndStr));
        setIsCustomDate(false);
    }

    if (status === "loading" || permLoading || (!data && isFetching)) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
    }

    // 🚀 ĐÃ SỬA: Check quyền ĐỘNG theo mã MENU_ANALYTICS từ Database
    if (!hasPermission("MENU_ANALYTICS")) {
        return (
            <div className="h-full bg-slate-50 flex flex-col items-center justify-center">
                <div className="bg-red-50 p-6 rounded-full mb-6 text-red-500"><Lock size={64} /></div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">Khu Vực Tuyệt Mật</h1>
                <p className="text-slate-500 mt-2 font-medium">Bạn không có quyền xem Báo cáo chiến lược.</p>
            </div>
        );
    }

    const stats = data?.stats || {};

    // 🚀 ĐÃ SỬA: Tách riêng 2 cục Data cho Doanh thu và Views
    const revenueChartData = {
        labels: data?.overallTrend?.map((t: any) => t.date) || [],
        datasets: [{
            label: 'Tổng Doanh Thu ($)',
            data: data?.overallTrend?.map((t: any) => t.revenue) || [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: true
        }]
    };

    const viewsChartData = {
        labels: data?.overallTrend?.map((t: any) => t.date) || [],
        datasets: [{
            label: 'Tổng Lượt Xem',
            data: data?.overallTrend?.map((t: any) => t.views) || [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.3, fill: true
        }]
    };

    // 🚀 Thêm options ẩn các số nham nhở trên line chart
    const lineChartOptions = {
        maintainAspectRatio: false,
        plugins: {
            datalabels: { display: false }, // Ẩn số trên line để biểu đồ sạch sẽ
            tooltip: commonTooltipOptions
        },
        scales: {
            y: { beginAtZero: true }
        }
    };

    const monetizationDonutData = { labels: data?.monetizationStatus?.map((d: any) => d.name) || [], datasets: [{ data: data?.monetizationStatus?.map((d: any) => d.value) || [], backgroundColor: data?.monetizationStatus?.map((d: any) => d.fill) || [], borderWidth: 0 }] };
    const leadTimeBarData = { labels: data?.leadTimeData?.map((d: any) => d.name) || [], datasets: [{ label: "Số ngày xử lý TB", data: data?.leadTimeData?.map((d: any) => d.days) || [], backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981'], borderRadius: 4, barThickness: 24 }] };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-3 md:p-8 space-y-4 md:space-y-6 pb-12 relative">

            {/* ================================================== */}
            {/* KHU VỰC HEADER - BỘ LỌC TẦNG 1 (DOANH THU KÊNH) */}
            {/* ================================================== */}
            {/* 🚀 ĐÃ SỬA: Thêm class 'relative' vào thẻ div cha */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 top-0 z-50 relative">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <PieChartIcon className="text-blue-600 w-5 h-5 md:w-6 md:h-6" /> Báo Cáo Chiến Lược
                    </h1>
                    <p className="text-xs italic text-slate-500 mt-1 font-medium flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        {startDateObj && endDateObj ? `Doanh thu từ ${startDateObj.toLocaleDateString('vi-VN')} đến ${endDateObj.toLocaleDateString('vi-VN')}` : 'Đang tải...'}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">

                    {/* BỘ LỌC YOUTUBE STYLE */}
                    <div className="flex items-center bg-slate-50 border border-slate-200 p-1 rounded-lg shadow-inner flex-1 sm:flex-none">
                        {[{ label: '7 Ngày', value: '7d' }, { label: '28 Ngày', value: '28d' }, { label: '90 Ngày', value: '90d' }].map((tab) => (
                            <button key={tab.value} onClick={() => setTimeRange(tab.value)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeRange === tab.value ? "bg-white text-blue-600 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-800"}`}>{tab.label}</button>
                        ))}
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        <button onClick={() => { setTimeRange("custom"); setIsCustomDate(!isCustomDate); }} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeRange === "custom" ? "bg-white text-blue-600 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-800"}`}>Tùy chỉnh 📅</button>
                    </div>

                    {/* LỌC TEAM CHUNG */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm flex-1 sm:flex-none">
                        <Filter size={16} className="text-slate-400 shrink-0" />
                        <select className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                            <option value="ALL">Toàn Hệ Thống</option>
                            {data?.teams?.map((t: any) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                        </select>
                    </div>

                    <button 
                        onClick={handleExportReport}
                        disabled={isExporting}
                        className="flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs md:text-sm font-black shadow-sm transition-all active:scale-95 sm:w-auto w-full disabled:opacity-70"
                    >
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                        Báo Cáo
                    </button>
                </div>

                {/* 🚀 ĐÃ SỬA CSS POPUP: Bổ sung z-[999], flex-wrap và đổ bóng (shadow-2xl) để hiển thị nổi bật, không bị vỡ bố cục */}
                {isCustomDate && (
                    <div className="absolute top-full right-0 mt-2 bg-white p-4 rounded-xl shadow-2xl border border-slate-200 z-[999] flex flex-wrap sm:flex-nowrap items-end gap-3 animate-fade-in w-full sm:w-auto">
                        <div className="w-full sm:w-auto">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Từ ngày</label>
                            <input type="date" className="w-full border border-slate-200 rounded-md text-sm p-1.5 outline-none font-bold text-slate-700" value={customStartStr} onChange={(e) => setCustomStartStr(e.target.value)} />
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Đến ngày</label>
                            <input type="date" className="w-full border border-slate-200 rounded-md text-sm p-1.5 outline-none font-bold text-slate-700" value={customEndStr} onChange={(e) => setCustomEndStr(e.target.value)} />
                        </div>
                        <button onClick={handleApplyCustomDate} className="w-full sm:w-auto bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold hover:bg-blue-700 shadow-sm">Áp dụng</button>
                    </div>
                )}
            </div>

            {/* THẺ CHỈ SỐ DOANH THU */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-6">
                <MiniStatCard
                    title="Tổng Doanh Thu"
                    value={`$${(stats.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    suffix="USD"
                    icon={<DollarSign size={16} className="text-emerald-500" />}
                />
                <MiniStatCard
                    title="Tổng Lượt Xem"
                    value={(stats.totalViews || 0).toLocaleString()}
                    suffix="Views"
                    icon={<Eye size={16} className="text-blue-500" />}
                />
                <MiniStatCard
                    title="Kênh Đang Bật KT"
                    value={data?.monetizationStatus?.find((m: any) => m.name === "Đã bật ($)")?.value || 0}
                    suffix="Kênh"
                    icon={<DollarSign size={16} className="text-amber-500" />}
                />
                <MiniStatCard
                    title="Sản Lượng Video"
                    value={(stats.totalOutput || 0).toLocaleString()}
                    suffix="Video"
                    icon={<Tv size={16} className="text-purple-500" />}
                />
            </div>
            
            {/* 🚀 ĐÃ SỬA BỐ CỤC: Xếp chồng Doanh thu và Views ở cột trái, Donut ở cột phải */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 md:gap-6 mt-4">
                
                {/* Cột trái: Chứa 2 biểu đồ */}
                <div className="flex flex-col gap-4 md:gap-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[280px]">
                        <h2 className="text-xs font-black text-slate-800 uppercase mb-2">Biểu Đồ Doanh Thu ($)</h2>
                        <div className="flex-1 w-full min-h-0 relative">
                            <Line data={revenueChartData} options={lineChartOptions} />
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[280px]">
                        <h2 className="text-xs font-black text-slate-800 uppercase mb-2">Biểu Đồ Lượt Xem (Views)</h2>
                        <div className="flex-1 w-full min-h-0 relative">
                            <Line data={viewsChartData} options={lineChartOptions} />
                        </div>
                    </div>
                </div>

                {/* Cột phải: Nuôi kênh */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
                    <h2 className="text-xs font-black text-slate-800 uppercase mb-4">Nuôi Kênh & Bật Kiếm Tiền</h2>
                    
                    <div className="flex-1 flex justify-center items-center lg:items-start lg:pt-4">
                        <div className="relative w-full max-w-[300px] aspect-square">
                            <Doughnut 
                                data={monetizationDonutData} 
                                options={{ 
                                    maintainAspectRatio: false, 
                                    cutout: '70%', 
                                    plugins: { 
                                        tooltip: commonTooltipOptions,
                                        // 🚀 ĐÃ SỬA: Đẩy chú thích xuống dưới đáy
                                        legend: {
                                            position: 'bottom',
                                            labels: {
                                                usePointStyle: true,
                                                padding: 20,
                                                font: { family: 'inherit', weight: 'bold', size: 12 }
                                            }
                                        },
                                        // 🚀 ĐÃ SỬA: Làm nổi bật số (Màu trắng, to và in đậm)
                                        datalabels: {
                                            color: '#ffffff',
                                            font: { weight: 'bold', size: 18, family: 'inherit' },
                                            formatter: (value: number) => value > 0 ? value : "",
                                            display: (context: any) => context.dataset.data[context.dataIndex] > 0
                                        }
                                    } 
                                }} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* BẢNG XẾP HẠNG KÊNH YOUTUBE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0 mt-4">
                <div className="p-3 md:p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><DollarSign size={16} className="text-emerald-600" /> Bảng Vàng Doanh Thu Từng Kênh</h2>
                </div>
                <div className="overflow-auto max-h-[400px] text-sm text-slate-600 custom-scrollbar relative">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr><th className="px-4 py-3 border-b">Tên Kênh</th><th className="px-4 py-3 border-b">Đội Nhóm</th><th className="px-4 py-3 border-b text-right">Lượt Xem (Views)</th><th className="px-4 py-3 border-b text-right">Doanh Thu ($)</th><th className="px-4 py-3 border-b text-right text-purple-600">RPM</th><th className="px-4 py-3 border-b text-right">Trạng Thái</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.channelGrid?.map((c: any, idx: number) => (
                                <tr key={c.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{idx < 3 ? ['🥇', '🥈', '🥉'][idx] : ''} {c.name}</td>
                                    <td className="px-4 py-3 text-[10px] font-black uppercase text-blue-600"><span className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">{c.team}</span></td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">{c.views > 0 ? c.views.toLocaleString() : "-"}</td>
                                    <td className="px-4 py-3 text-sm text-right font-black text-emerald-600">{c.revenue > 0 ? `$${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</td>
                                    <td className="px-4 py-3 text-sm text-right font-black text-purple-600">{c.rpm > 0 ? `$${c.rpm.toFixed(2)}` : "-"}</td>
                                    <td className="px-4 py-3 text-right"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${c.monetization === 'DA_BAT' ? 'text-emerald-600 bg-emerald-50' : c.monetization === 'TAT_KIEM_TIEN' ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>{c.monetizationLabel}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ================================================== */}
            {/* KHU VỰC TẦNG 2 - BỘ LỌC HR & KPI (Tuần / Tháng) */}
            {/* ================================================== */}
            <div className="mt-16 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-blue-50/50 p-4 border border-blue-100 rounded-xl">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-1.5 bg-blue-500 rounded-full"></div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Tiến Độ Dự Án & Hiệu Suất Nhân Sự</h2>
                        <p className="text-xs font-medium text-slate-500">Đánh giá theo lịch KPI chuẩn của Công ty.</p>
                    </div>
                </div>

                {/* BỘ LỌC LỊCH CỐ ĐỊNH NHƯ ẢNH YÊU CẦU */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                    <Calendar size={16} className="text-slate-400 shrink-0" />
                    <select className="bg-transparent text-sm font-bold text-slate-700 outline-none border-r pr-2 border-slate-200" value={kpiWeek} onChange={(e) => setKpiWeek(Number(e.target.value))}>
                        <option value={0}>Cả Tháng</option><option value={1}>Tuần 1</option><option value={2}>Tuần 2</option><option value={3}>Tuần 3</option><option value={4}>Tuần 4</option><option value={5}>Tuần 5</option>
                    </select>
                    <select className="bg-transparent text-sm font-bold text-slate-700 outline-none pl-1" value={kpiMonth} onChange={(e) => setKpiMonth(Number(e.target.value))}>
                        {[...Array(12)].map((_, i) => (<option key={i + 1} value={i + 1}>Tháng {i + 1}</option>))}
                    </select>
                    <select className="bg-transparent text-sm font-bold text-slate-700 outline-none border-l pl-2 border-slate-200" value={kpiYear} onChange={(e) => setKpiYear(Number(e.target.value))}>
                        <option value={2026}>2026</option><option value={2025}>2025</option>
                    </select>
                </div>
            </div>

            {/* BẢNG THEO DÕI NHÂN SỰ VÀ ĐIỂM NGHẼN (LEAD TIME) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 md:gap-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[350px]">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider mb-2 shrink-0">Đo lường Điểm Nghẽn (Ngày)</h2>
                    <div className="flex-1 w-full min-h-0 relative"><Bar data={leadTimeBarData} options={{ indexAxis: 'y', maintainAspectRatio: false }} /></div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[350px]">
                    <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                        <Users size={16} className="text-blue-500" /><h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider">KPI Cán Bộ Nhân Viên</h2>
                    </div>
                    <div className="overflow-auto flex-1 text-sm text-slate-600 custom-scrollbar relative">
                        <table className="w-full text-left min-w-[700px]">
                            <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <tr><th className="px-4 py-3 border-b">Họ & Tên</th><th className="px-4 py-3 border-b text-center">Sản Lượng (Task)</th><th className="px-4 py-3 border-b text-center">% KPI Thực Tế</th><th className="px-4 py-3 border-b text-center text-amber-600">Điểm Lượng</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data?.hrGrid?.map((u: any) => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-sm font-bold text-slate-800">
                                            {u.name} <span className="block text-[10px] font-black uppercase text-slate-400">{u.role}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-center font-bold text-slate-800">{u.output}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-md text-xs font-black ${u.kpi >= 100 ? 'bg-green-100 text-green-700' : u.kpi < 80 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{u.kpi}%</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-center font-black text-amber-500">{u.avgScore} ⭐</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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