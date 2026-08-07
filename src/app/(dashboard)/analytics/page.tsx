"use client";

import { useSession } from "next-auth/react";
import { PieChart as PieChartIcon, Lock, Loader2, Calendar, Filter, Download, DollarSign, Eye, Tv, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/app/component/ToastProvider";
import { usePermission } from "@/app/component/PermissionProvider";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getCurrentWeekNumber } from "@/lib/utils";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler, ChartDataLabels);

const commonTooltipOptions = { backgroundColor: 'rgba(255, 255, 255, 0.95)', titleColor: '#1e293b', bodyColor: '#475569', borderColor: '#e2e8f0', borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true, titleFont: { family: 'inherit', size: 12, weight: 'bold' as const }, bodyFont: { family: 'inherit', size: 11, weight: 'bold' as const }, bodySpacing: 4, };

export default function AnalyticsPage() {
    const { data: session, status } = useSession();
    const { showToast } = useToast();
    const { hasPermission, loading: permLoading } = usePermission();

    const [timeRange, setTimeRange] = useState("28d"); 
    const [startDateObj, setStartDateObj] = useState<Date | null>(null);
    const [endDateObj, setEndDateObj] = useState<Date | null>(null);
    const [isCustomDate, setIsCustomDate] = useState(false);
    const [customStartStr, setCustomStartStr] = useState("");
    const [customEndStr, setCustomEndStr] = useState("");

    const [kpiWeek, setKpiWeek] = useState(() => getCurrentWeekNumber(new Date()));
    const [kpiMonth, setKpiMonth] = useState(new Date().getMonth() + 1);
    const [kpiYear, setKpiYear] = useState(new Date().getFullYear());

    const [selectedTeam, setSelectedTeam] = useState("ALL");
    const [data, setData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(true);

    const [isExporting, setIsExporting] = useState(false);

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

                wsChannels.getRow(1).eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.font = { bold: true };
                });
            }

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
        return <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
    }

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

    const revenueChartData = {
        labels: data?.overallTrend?.map((t: any) => t.date) || [],
        datasets: [{
            label: 'Tổng Doanh Thu ($)',
            data: data?.overallTrend?.map((t: any) => t.revenue) || [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2, pointRadius: 1.5, pointHoverRadius: 5, tension: 0.3, fill: true
        }]
    };

    const viewsChartData = {
        labels: data?.overallTrend?.map((t: any) => t.date) || [],
        datasets: [{
            label: 'Tổng Lượt Xem',
            data: data?.overallTrend?.map((t: any) => t.views) || [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2, pointRadius: 1.5, pointHoverRadius: 5, tension: 0.3, fill: true
        }]
    };

    // 🚀 ĐÃ SỬA: Cấu hình interaction mode để rê chuột dễ dàng hơn
    const lineChartOptions = {
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const, // Dóng trục dọc (Ngày)
            intersect: false,       // Bỏ bắt buộc phải rê trúng điểm chấm
        },
        plugins: {
            datalabels: { display: false },
            tooltip: commonTooltipOptions
        },
        scales: {
            y: { beginAtZero: true, ticks: { font: { size: 10 } } },
            x: { ticks: { font: { size: 10 } } }
        }
    };

    const monetizationDonutData = { labels: data?.monetizationStatus?.map((d: any) => d.name) || [], datasets: [{ data: data?.monetizationStatus?.map((d: any) => d.value) || [], backgroundColor: data?.monetizationStatus?.map((d: any) => d.fill) || [], borderWidth: 0 }] };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-2 md:p-4 space-y-3 md:space-y-4 relative pb-10">

            {/* ================================================== */}
            {/* BÁO CÁO CHIẾN LƯỢC - STICKY LÊN TOP */}
            {/* ================================================== */}
            <div className="sticky top-0 z-[100] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-2.5 md:p-3 rounded-xl shadow-sm border border-slate-200 w-full backdrop-blur-md bg-white/90">
                <div>
                    <h1 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-1.5">
                        <PieChartIcon className="text-blue-600 w-4 h-4 md:w-5 md:h-5" /> Báo Cáo Chiến Lược
                    </h1>
                    <p className="text-[9px] md:text-[10px] italic text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        {startDateObj && endDateObj ? `Doanh thu từ ${startDateObj.toLocaleDateString('vi-VN')} đến ${endDateObj.toLocaleDateString('vi-VN')}` : 'Đang tải...'}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto relative">

                    <div className="flex items-center bg-slate-50 border border-slate-200 p-0.5 rounded-lg shadow-inner flex-1 sm:flex-none">
                        {[{ label: '7 Ngày', value: '7d' }, { label: '28 Ngày', value: '28d' }, { label: '90 Ngày', value: '90d' }].map((tab) => (
                            <button key={tab.value} onClick={() => setTimeRange(tab.value)} className={`px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-md transition-all ${timeRange === tab.value ? "bg-white text-blue-600 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-800"}`}>{tab.label}</button>
                        ))}
                        <div className="w-px h-3 bg-slate-300 mx-1"></div>
                        <button onClick={() => { setTimeRange("custom"); setIsCustomDate(!isCustomDate); }} className={`px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-md transition-all ${timeRange === "custom" ? "bg-white text-blue-600 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-800"}`}>Tùy chỉnh 📅</button>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm flex-1 sm:flex-none">
                        <Filter size={14} className="text-slate-400 shrink-0" />
                        <select className="bg-transparent text-[11px] md:text-xs font-bold text-slate-700 outline-none w-full cursor-pointer" value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
                            <option value="ALL">Toàn Hệ Thống</option>
                            {data?.teams?.map((t: any) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                        </select>
                    </div>

                    <button 
                        onClick={handleExportReport}
                        disabled={isExporting}
                        className="flex justify-center items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-black shadow-sm transition-all active:scale-95 sm:w-auto w-full disabled:opacity-70"
                    >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                        Xuất Excel
                    </button>

                    {isCustomDate && (
                        <div className="absolute top-[120%] right-0 bg-white p-3 rounded-xl shadow-2xl border border-slate-200 z-[999] flex flex-wrap sm:flex-nowrap items-end gap-2 animate-fade-in w-full sm:w-auto">
                            <div className="w-full sm:w-auto">
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Từ ngày</label>
                                <input type="date" className="w-full border border-slate-200 rounded text-xs p-1 outline-none font-bold text-slate-700 cursor-pointer" value={customStartStr} onChange={(e) => setCustomStartStr(e.target.value)} />
                            </div>
                            <div className="w-full sm:w-auto">
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Đến ngày</label>
                                <input type="date" className="w-full border border-slate-200 rounded text-xs p-1 outline-none font-bold text-slate-700 cursor-pointer" value={customEndStr} onChange={(e) => setCustomEndStr(e.target.value)} />
                            </div>
                            <button onClick={handleApplyCustomDate} className="w-full sm:w-auto bg-blue-600 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-blue-700 shadow-sm transition-colors">Áp dụng</button>
                        </div>
                    )}
                </div>
            </div>

            {/* THẺ CHỈ SỐ DOANH THU */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                <MiniStatCard
                    title="Tổng Doanh Thu"
                    value={`$${(stats.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    suffix="USD"
                    icon={<DollarSign size={14} className="text-emerald-500" />}
                />
                <MiniStatCard
                    title="Tổng Lượt Xem"
                    value={(stats.totalViews || 0).toLocaleString()}
                    suffix="Views"
                    icon={<Eye size={14} className="text-blue-500" />}
                />
                <MiniStatCard
                    title="Kênh Đang Bật KT"
                    value={data?.monetizationStatus?.find((m: any) => m.name === "Đã bật ($)")?.value || 0}
                    suffix="Kênh"
                    icon={<DollarSign size={14} className="text-amber-500" />}
                />
                <MiniStatCard
                    title="Sản Lượng Video"
                    value={(stats.totalOutput || 0).toLocaleString()}
                    suffix="Video"
                    icon={<Tv size={14} className="text-purple-500" />}
                />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3 md:gap-4">
                <div className="flex flex-col gap-3 md:gap-4">
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[200px] md:h-[220px]">
                        <h2 className="text-[10px] md:text-xs font-black text-slate-800 uppercase mb-2">Biểu Đồ Doanh Thu ($)</h2>
                        <div className="flex-1 w-full min-h-0 relative">
                            <Line data={revenueChartData} options={lineChartOptions} />
                        </div>
                    </div>
                    
                    <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[200px] md:h-[220px]">
                        <h2 className="text-[10px] md:text-xs font-black text-slate-800 uppercase mb-2">Biểu Đồ Lượt Xem (Views)</h2>
                        <div className="flex-1 w-full min-h-0 relative">
                            <Line data={viewsChartData} options={lineChartOptions} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full justify-center items-center">
                    <h2 className="text-[10px] md:text-xs font-black text-slate-800 uppercase mb-2 w-full text-left">Nuôi Kênh & Bật Kiếm Tiền</h2>
                    
                    <div className="flex-1 flex justify-center items-center w-full">
                        <div className="relative w-full max-w-[180px] md:max-w-[200px] aspect-square">
                            <Doughnut 
                                data={monetizationDonutData} 
                                options={{ 
                                    maintainAspectRatio: false, 
                                    cutout: '65%', 
                                    plugins: { 
                                        tooltip: commonTooltipOptions,
                                        legend: {
                                            position: 'bottom',
                                            labels: {
                                                usePointStyle: true,
                                                padding: 10,
                                                font: { family: 'inherit', weight: 'bold', size: 11 }
                                            }
                                        },
                                        datalabels: {
                                            color: '#ffffff',
                                            font: { weight: 'bold', size: 14, family: 'inherit' },
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                <div className="p-2 md:p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-[11px] md:text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><DollarSign size={14} className="text-emerald-600" /> Bảng Vàng Doanh Thu Kênh</h2>
                </div>
                <div className="overflow-auto max-h-[350px] text-xs text-slate-600 custom-scrollbar relative">
                    <table className="w-full text-left min-w-[700px]">
                        <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr><th className="px-3 py-2 border-b">Tên Kênh</th><th className="px-3 py-2 border-b">Đội Nhóm</th><th className="px-3 py-2 border-b text-right">Lượt Xem</th><th className="px-3 py-2 border-b text-right">Doanh Thu ($)</th><th className="px-3 py-2 border-b text-right text-purple-600">RPM</th><th className="px-3 py-2 border-b text-right">Trạng Thái</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.channelGrid?.map((c: any, idx: number) => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-3 py-2 text-xs font-bold text-slate-800">{idx < 3 ? ['🥇', '🥈', '🥉'][idx] : ''} {c.name}</td>
                                    <td className="px-3 py-2 text-[9px] font-black uppercase text-blue-600"><span className="bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{c.team}</span></td>
                                    <td className="px-3 py-2 text-xs text-right font-bold text-blue-600">{c.views > 0 ? c.views.toLocaleString() : "-"}</td>
                                    <td className="px-3 py-2 text-xs text-right font-black text-emerald-600">{c.revenue > 0 ? `$${c.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</td>
                                    <td className="px-3 py-2 text-xs text-right font-black text-purple-600">{c.rpm > 0 ? `$${c.rpm.toFixed(2)}` : "-"}</td>
                                    <td className="px-3 py-2 text-right"><span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${c.monetization === 'DA_BAT' ? 'text-emerald-600 bg-emerald-50' : c.monetization === 'TAT_KIEM_TIEN' ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>{c.monetizationLabel}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ================================================== */}
            {/* KHU VỰC TẦNG 2 - BỘ LỌC HR & KPI (Tuần / Tháng) */}
            {/* ================================================== */}
            <div className="mt-4 md:mt-6 mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-blue-50/50 p-3 border border-blue-100 rounded-xl">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-1.5 bg-blue-500 rounded-full"></div>
                    <div>
                        <h2 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest">Tiến Độ Dự Án & Hiệu Suất</h2>
                        <p className="text-[10px] font-medium text-slate-500 mt-0.5">Đánh giá theo lịch KPI chuẩn.</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <select className="bg-transparent text-[11px] md:text-xs font-bold text-slate-700 outline-none border-r pr-1 border-slate-200 cursor-pointer" value={kpiWeek} onChange={(e) => setKpiWeek(Number(e.target.value))}>
                        <option value={0}>Cả Tháng</option><option value={1}>Tuần 1</option><option value={2}>Tuần 2</option><option value={3}>Tuần 3</option><option value={4}>Tuần 4</option><option value={5}>Tuần 5</option>
                    </select>
                    <select className="bg-transparent text-[11px] md:text-xs font-bold text-slate-700 outline-none pl-1 cursor-pointer" value={kpiMonth} onChange={(e) => setKpiMonth(Number(e.target.value))}>
                        {[...Array(12)].map((_, i) => (<option key={i + 1} value={i + 1}>Tháng {i + 1}</option>))}
                    </select>
                    <select className="bg-transparent text-[11px] md:text-xs font-bold text-slate-700 outline-none border-l pl-1 border-slate-200 cursor-pointer" value={kpiYear} onChange={(e) => setKpiYear(Number(e.target.value))}>
                        <option value={2026}>2026</option><option value={2025}>2025</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[400px]">
                <div className="p-2.5 md:p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50 shrink-0">
                    <Users size={14} className="text-blue-500" /><h2 className="text-[11px] md:text-xs font-black text-slate-800 uppercase tracking-wider">KPI Cán Bộ Nhân Viên</h2>
                </div>
                <div className="overflow-auto flex-1 text-[11px] md:text-xs text-slate-600 custom-scrollbar relative">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-3 md:px-4 py-2 border-b">Họ & Tên</th>
                                <th className="px-3 md:px-4 py-2 border-b text-center">Thực Đạt / Target</th>
                                <th className="px-3 md:px-4 py-2 border-b text-center">% KPI Thực Tế</th>
                                <th className="px-3 md:px-4 py-2 border-b text-center text-amber-600">Điểm Lượng</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.hrGrid?.map((u: any) => (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-3 md:px-4 py-2 font-bold text-slate-800">
                                        {u.name} <span className="block text-[9px] font-black uppercase text-slate-400 mt-0.5">{u.role}</span>
                                    </td>
                                    <td className="px-3 md:px-4 py-2 text-center font-bold text-slate-800">
                                        <span className="text-blue-600">{u.output}</span> <span className="text-slate-300 mx-1">/</span> <span className="text-slate-500">{u.target}</span>
                                    </td>
                                    <td className="px-3 md:px-4 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] md:text-[11px] font-black ${u.kpi >= 100 ? 'bg-green-100 text-green-700' : u.kpi < 80 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{u.kpi}%</span>
                                    </td>
                                    <td className="px-3 md:px-4 py-2 text-center font-black text-amber-500">{u.avgScore} ⭐</td>
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
        <div className="bg-white p-2.5 md:p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden h-[72px] md:h-[80px]">
            {icon && <div className="absolute top-2.5 right-2.5 opacity-40">{icon}</div>}
            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 z-10">{title}</p>
            <div className="flex items-baseline gap-1 z-10">
                <h3 className="text-base md:text-xl font-black text-slate-800 tracking-tight leading-none">{value}</h3>
                <span className="text-[9px] md:text-[10px] font-bold text-slate-500">{suffix}</span>
            </div>
        </div>
    );
}