"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, DollarSign, Check, Loader2, Eye, Download, Filter, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/app/component/PermissionProvider";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface RevenueEntry {
    views?: number | string;
    revenue?: number | string;
}

const getDaysOfMonth = (currentDate: Date) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    
    return Array.from({ length: numDays }).map((_, i) => {
        return new Date(year, month, i + 1, 12, 0, 0); 
    });
};

export default function RevenueEntryPage() {
    const { showToast } = useToast();
    const scrollContainerRef = useRef<HTMLDivElement>(null); 
    
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
    const tableDays = useMemo(() => getDaysOfMonth(currentMonthDate), [currentMonthDate]);
    const tableStartDateStr = tableDays[0].toISOString().split('T')[0];
    const tableEndDateStr = tableDays[tableDays.length - 1].toISOString().split('T')[0];

    const [exportFromDate, setExportFromDate] = useState(tableStartDateStr);
    const [exportToDate, setExportToDate] = useState(tableEndDateStr);
    const [isExporting, setIsExporting] = useState(false);

    const [channels, setChannels] = useState<any[]>([]);
    const [revenueData, setRevenueData] = useState<Record<string, RevenueEntry>>({});
    const [savingCells, setSavingCells] = useState<Record<string, 'saving' | 'saved' | null>>({});
    const [focusedCol, setFocusedCol] = useState<number | null>(null);
    const [activeTooltip, setActiveTooltip] = useState<{ content: string; x: number; y: number; } | null>(null);
    const [filterTeam, setFilterTeam] = useState("ALL");
    
    const { data: session, status } = useSession();
    const router = useRouter();
    const { hasPermission, loading } = usePermission();

    const currentUser = session?.user as any;
    const userRole = currentUser?.role;
    const userTeamId = currentUser?.teamId;

    const isKeToan = userRole === "KE_TOAN" || userRole === "ADMIN" || userRole === "BAN_GIAM_DOC"; 
    const canFilterTeam = hasPermission("MENU_TEAMS") || ["BAN_GIAM_DOC", "KE_TOAN", "ADMIN"].includes(userRole);
    
    useEffect(() => {
        if (!loading && !hasPermission("MENU_REVENUE")) {
            router.push("/dashboard");
        }
    }, [loading, hasPermission, router]);

    useEffect(() => {
        const todayObj = new Date();
        todayObj.setHours(12, 0, 0, 0);
        const todayKey = todayObj.toISOString().split('T')[0];

        const todayElem = document.getElementById(`day-col-${todayKey}`);
        if (todayElem && scrollContainerRef.current) {
            setTimeout(() => {
                const scrollLeft = todayElem.offsetLeft - 350; 
                scrollContainerRef.current?.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
            }, 200);
        }
    }, [tableDays]); 

    useEffect(() => {
        const fetchTableData = async () => {
            try {
                const res = await fetch(`/api/revenue?startDate=${tableStartDateStr}&endDate=${tableEndDateStr}`);
                const data = await res.json();

                if (Array.isArray(data)) {
                    setChannels(data);

                    const initialData: Record<string, RevenueEntry> = {};
                    data.forEach(channel => {
                        const revList = channel.revenues || channel.dailyRevenues || [];
                        revList.forEach((rev: any) => {
                            const dateKey = new Date(rev.date).toISOString().split('T')[0];
                            initialData[`${channel.id}_${dateKey}`] = {
                                views: rev.views || 0,
                                revenue: rev.revenue !== undefined ? rev.revenue : (rev.amount || 0)
                            };
                        });
                    });
                    setRevenueData(initialData);
                }
            } catch (error) {
                showToast("error", "Lỗi tải dữ liệu");
            }
        };
        if (status === "authenticated") {
            fetchTableData();
        }
    }, [tableStartDateStr, tableEndDateStr, showToast, status]);

    const uniqueTeams = useMemo(() => {
        const teams = channels.map(c => c.team?.name).filter(Boolean);
        return Array.from(new Set(teams)) as string[];
    }, [channels]);

    const filteredChannels = useMemo(() => {
        let result = [...channels];
        
        if (canFilterTeam) {
            if (filterTeam !== "ALL") {
                result = result.filter(ch => ch.team?.name === filterTeam);
            }
        } else if (userTeamId) {
            result = result.filter(ch => ch.teamId === userTeamId || ch.team?.id === userTeamId);
        }

        return result.sort((a, b) => {
            const nameA = a.team?.name || "ZZZ";
            const nameB = b.team?.name || "ZZZ";
            return nameA.localeCompare(nameB);
        });
    }, [channels, filterTeam, canFilterTeam, userTeamId]);

    const dailyTotals = useMemo(() => {
        return tableDays.map(day => {
            const dateKey = day.toISOString().split('T')[0];
            let totalViews = 0;
            let totalRevenue = 0;

            filteredChannels.forEach(channel => {
                const cellKey = `${channel.id}_${dateKey}`;
                const data = revenueData[cellKey];
                if (data) {
                    totalViews += Number(data.views || 0);
                    totalRevenue += Number(data.revenue || 0);
                }
            });

            return { views: totalViews, revenue: totalRevenue };
        });
    }, [tableDays, filteredChannels, revenueData]);

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentMonthDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setCurrentMonthDate(newDate);
    };

    const handleCellBlur = async (channelId: string, dateObj: Date, field: 'views' | 'revenue', value: string) => {
        const dateKey = dateObj.toISOString().split('T')[0];
        const cellKey = `${channelId}_${dateKey}`;

        const numValue = value.trim() === "" ? 0 : parseFloat(value);
        if (isNaN(numValue)) return;

        const currentData = revenueData[cellKey] || { views: 0, revenue: 0 };
        if (currentData[field] === numValue) return;

        const newData = { ...currentData, [field]: numValue };
        setSavingCells(prev => ({ ...prev, [cellKey]: 'saving' }));
        setRevenueData(prev => ({ ...prev, [cellKey]: newData }));

        try {
            const res = await fetch('/api/revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId,
                    date: dateKey,
                    views: newData.views,
                    revenue: newData.revenue
                })
            });

            if (res.ok) {
                setSavingCells(prev => ({ ...prev, [cellKey]: 'saved' }));
                setTimeout(() => setSavingCells(prev => ({ ...prev, [cellKey]: null })), 2000);
            } else {
                showToast("error", "Lưu thất bại!");
                setSavingCells(prev => ({ ...prev, [cellKey]: null }));
                setRevenueData(prev => ({ ...prev, [cellKey]: currentData }));
            }
        } catch (error) {
            showToast("error", "Lỗi Server!");
            setSavingCells(prev => ({ ...prev, [cellKey]: null }));
            setRevenueData(prev => ({ ...prev, [cellKey]: currentData }));
        }
    };

    // HÀM XUẤT EXCEL 
    const handleExportExcel = async () => {
        if (new Date(exportFromDate) > new Date(exportToDate)) {
            showToast("error", "Ngày bắt đầu không được lớn hơn ngày kết thúc!");
            return;
        }

        setIsExporting(true);
        try {
            const res = await fetch(`/api/revenue?startDate=${exportFromDate}&endDate=${exportToDate}`);
            const data = await res.json();

            if (!Array.isArray(data)) throw new Error("Dữ liệu lỗi");

            const start = new Date(exportFromDate);
            const end = new Date(exportToDate);
            const exportDays: Date[] = [];
            let curr = new Date(start);
            while (curr <= end) {
                exportDays.push(new Date(curr));
                curr.setDate(curr.getDate() + 1);
            }

            const exportRevenueData: Record<string, RevenueEntry> = {};
            data.forEach((channel: any) => {
                const revList = channel.revenues || channel.dailyRevenues || [];
                revList.forEach((rev: any) => {
                    const dateKey = new Date(rev.date).toISOString().split('T')[0];
                    exportRevenueData[`${channel.id}_${dateKey}`] = {
                        views: rev.views || 0,
                        revenue: rev.revenue !== undefined ? rev.revenue : (rev.amount || 0)
                    };
                });
            });

            let exportChannels = [...data];
            if (canFilterTeam) {
                if (filterTeam !== "ALL") {
                    exportChannels = exportChannels.filter(ch => ch.team?.name === filterTeam);
                }
            } else if (userTeamId) {
                exportChannels = exportChannels.filter(ch => ch.teamId === userTeamId || ch.team?.id === userTeamId);
            }
            exportChannels.sort((a, b) => (a.team?.name || "ZZZ").localeCompare(b.team?.name || "ZZZ"));

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Báo Cáo Doanh Thu');

            const cols: any[] = [
                { key: 'stt', width: 5 },
                { key: 'team', width: 20 },
                { key: 'channel', width: 35 },
            ];

            exportDays.forEach(day => {
                cols.push({ key: `v_${day.toISOString()}`, width: 15 });
                cols.push({ key: `r_${day.toISOString()}`, width: 18 });
            });
            worksheet.columns = cols;

            const row1 = ['STT', 'Team', 'Tên Kênh'];
            const row2 = ['', '', '']; 

            exportDays.forEach(day => {
                const dateStr = `${day.getDate()}/${day.getMonth() + 1}`;
                row1.push(dateStr, ''); 
                row2.push(`Views (${dateStr})`, `Doanh thu $ (${dateStr})`);
            });

            worksheet.addRow(row1);
            worksheet.addRow(row2);

            worksheet.mergeCells(1, 1, 2, 1); 
            worksheet.mergeCells(1, 2, 2, 2); 
            worksheet.mergeCells(1, 3, 2, 3); 

            exportDays.forEach((_, idx) => {
                const startCol = 4 + (idx * 2);
                const endCol = 5 + (idx * 2);
                worksheet.mergeCells(1, startCol, 1, endCol); 
            });

            // 🚀 BỔ SUNG: Biến theo dõi gộp ô Team theo chiều dọc
            let currentTeamStr = "";
            let startRowMerge = 3;

            exportChannels.forEach((ch, idx) => {
                const teamName = ch.team?.name || "No Team";
                const currentRow = idx + 3; // Vì Dữ liệu bắt đầu từ Dòng số 3

                const rowData: any = { stt: idx + 1, team: teamName, channel: ch.name };
                exportDays.forEach(day => {
                    const dateKey = day.toISOString().split('T')[0];
                    const cellKey = `${ch.id}_${dateKey}`;
                    const d = exportRevenueData[cellKey];
                    rowData[`v_${day.toISOString()}`] = d?.views || 0;
                    rowData[`r_${day.toISOString()}`] = d?.revenue || 0;
                });
                worksheet.addRow(rowData);

                // 🚀 BỔ SUNG: Logic kiểm tra và Gộp ô Team
                if (idx === 0) {
                    currentTeamStr = teamName;
                    startRowMerge = currentRow;
                } else if (teamName !== currentTeamStr) {
                    // Nếu team thay đổi, gộp các hàng của team trước đó
                    if (currentRow - 1 > startRowMerge) {
                        worksheet.mergeCells(startRowMerge, 2, currentRow - 1, 2);
                    }
                    currentTeamStr = teamName;
                    startRowMerge = currentRow;
                }

                // Gộp ô cho team ở những dòng cuối cùng của mảng
                if (idx === exportChannels.length - 1) {
                    if (currentRow > startRowMerge) {
                        worksheet.mergeCells(startRowMerge, 2, currentRow, 2);
                    }
                }
            });

            [1, 2].forEach(rowNum => {
                const row = worksheet.getRow(rowNum);
                row.height = 25;
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: '000000' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 2) {
                    row.eachCell((cell, colNumber) => {
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } },
                            bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } }
                        };
                        // 🚀 Định dạng cho ô Team luôn nằm ở giữa theo chiều dọc
                        if (colNumber > 3) cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        else if (colNumber === 1) cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        else cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    });
                }
            });

            worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 2 }];

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `DoanhThu_${exportFromDate}_${exportToDate}.xlsx`);
            showToast("success", "Xuất file Excel thành công!");

        } catch (error) {
            showToast("error", "Lỗi xuất file Excel!");
        } finally {
            setIsExporting(false);
        }
    };

    const teamCounts: Record<string, number> = {};
    filteredChannels.forEach(ch => {
        const tName = ch.team?.name || "No Team";
        teamCounts[tName] = (teamCounts[tName] || 0) + 1;
    });
    let currentTeamForRender = "";
    const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    return (
        <div className="p-4 md:p-6 bg-slate-50 h-full max-h-[calc(100vh-80px)] flex flex-col overflow-hidden animate-fade-in gap-4 md:gap-6">
            
            <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-4 relative z-10">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <DollarSign className="text-emerald-500" /> Bảng Kê Doanh Thu Tháng
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Nhập liệu doanh thu hằng ngày (USD).</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
                    
                    {canFilterTeam && (
                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl h-10 px-3 w-full sm:w-auto">
                            <Filter size={16} className="text-slate-400 mr-2 shrink-0" />
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
                    )}

                    <div className="flex items-center gap-2 md:gap-4 bg-slate-50 p-1 md:p-1.5 rounded-xl border border-slate-200 h-10 w-full sm:w-auto justify-between sm:justify-center">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded-md transition-all shadow-sm"><ChevronLeft size={18} /></button>
                        <div className="text-[11px] md:text-xs font-black text-slate-700 px-1 uppercase tracking-widest whitespace-nowrap">
                            THÁNG {currentMonthDate.getMonth() + 1} / {currentMonthDate.getFullYear()}
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded-md transition-all shadow-sm"><ChevronRight size={18} /></button>
                    </div>
                </div>
            </div>

            {isKeToan && (
                <div className="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 gap-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><FileSpreadsheet size={20} /></div>
                        <div>
                            <h3 className="text-sm font-black text-emerald-800">Xuất Báo Cáo Kế Toán</h3>
                            <p className="text-[11px] text-emerald-600 font-medium">Chọn khoảng thời gian bất kỳ để tải Excel</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 px-2 bg-white border border-slate-200 rounded-xl py-1 h-10 shadow-sm w-full sm:w-auto overflow-x-auto custom-scrollbar-thin">
                            <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Từ</span>
                            <input 
                                type="date" 
                                className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none w-[110px] md:w-[120px] cursor-pointer" 
                                value={exportFromDate} 
                                onChange={(e) => setExportFromDate(e.target.value)} 
                            />
                            <div className="w-[1px] h-4 bg-slate-300 mx-0.5 shrink-0"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Đến</span>
                            <input 
                                type="date" 
                                className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none w-[110px] md:w-[120px] cursor-pointer" 
                                value={exportToDate} 
                                onChange={(e) => setExportToDate(e.target.value)} 
                            />
                        </div>

                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting}
                            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-xs md:text-sm w-full sm:w-auto shadow-md shadow-emerald-600/20"
                        >
                            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            <span>Tải Xuống</span>
                        </button>
                    </div>
                </div>
            )}

            <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar relative bg-white border border-slate-200 rounded-2xl shadow-sm">
                <table className="w-full h-full text-left border-separate border-spacing-0 min-w-max">
                    <thead className="sticky top-0 z-[60] bg-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-b-2 border-slate-300">
                        <tr className="text-slate-700 text-[10px] font-black uppercase tracking-widest">
                            <th className="p-3 border-r border-slate-300 sticky left-0 z-[70] bg-slate-200 w-[100px] text-center">Team</th>
                            <th className="p-3 border-r border-slate-300 sticky left-[100px] z-[70] bg-slate-200 w-[50px] text-center">STT</th>
                            <th className="p-3 border-r border-slate-300 sticky left-[150px] z-[70] bg-slate-200 w-[200px]">Tên Kênh</th>

                            {tableDays.map((day, idx) => {
                                const todayObj = new Date();
                                todayObj.setHours(12, 0, 0, 0);
                                const isToday = day.toISOString().split('T')[0] === todayObj.toISOString().split('T')[0];

                                return (
                                    <th id={`day-col-${day.toISOString().split('T')[0]}`} key={idx} className={`p-3 border-r border-slate-300 text-center w-[120px] transition-colors duration-300 ${focusedCol === idx ? 'bg-blue-100 border-blue-300 shadow-inner' : 'bg-slate-100'}`}>
                                        <div className={`mb-1 transition-colors ${focusedCol === idx ? 'text-blue-700 font-black' : 'text-slate-500'}`}>
                                            {weekDays[day.getDay()]}
                                        </div>
                                        <div className={`text-sm ${isToday ? 'text-red-600 font-black' : (focusedCol === idx ? 'text-blue-800 font-black' : '')}`}>
                                            {day.getDate()}/{day.getMonth() + 1}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {filteredChannels.length === 0 ? (
                            <tr><td colSpan={3 + tableDays.length} className="p-8 h-full text-center align-top pt-20 text-slate-400 italic">Chưa có dữ liệu.</td></tr>
                        ) : (
                            filteredChannels.map((channel, index) => {
                                const teamName = channel.team?.name || "No Team";
                                const isFirstRowOfTeam = teamName !== currentTeamForRender;
                                if (isFirstRowOfTeam) currentTeamForRender = teamName;
                                const rowSpanCount = teamCounts[teamName];
                                const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-[#f4f5f7]";

                                return (
                                    <tr key={channel.id} className={`${rowBgClass} hover:bg-[#e2e8f0] focus-within:bg-blue-50/50 transition-colors group`}>
                                        {isFirstRowOfTeam && (
                                            <td rowSpan={rowSpanCount} className={`p-2 border-b border-r border-slate-300 sticky left-0 z-40 bg-slate-100 align-middle text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`}>
                                                <span className="font-black text-slate-600 text-xs md:text-sm uppercase tracking-widest">{teamName}</span>
                                            </td>
                                        )}

                                        <td className={`p-2 border-b border-r border-slate-200 sticky left-[100px] z-30 ${rowBgClass} group-hover:bg-[#e2e8f0] group-focus-within:bg-blue-50/50 transition-colors text-center font-bold text-slate-500`}>
                                            {index + 1}
                                        </td>

                                        <td className={`p-3 border-b border-r border-slate-200 sticky left-[150px] z-30 ${rowBgClass} group-hover:bg-[#e2e8f0] group-focus-within:bg-blue-50/50 transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]`}>
                                            <p className="font-bold text-sm text-slate-800 line-clamp-2" title={channel.name}>{channel.name}</p>
                                        </td>

                                        {tableDays.map((day, idx) => {
                                            const dateKey = day.toISOString().split('T')[0];
                                            const cellKey = `${channel.id}_${dateKey}`;
                                            const data = revenueData[cellKey] || { revenue: "", views: "" };
                                            const cellState = savingCells[cellKey];
                                            const isMonetized = channel.monetization;

                                            const handleFocus = (e: React.FocusEvent<HTMLInputElement>, channelName: string, day: Date, currentData: any, type: 'views' | 'revenue') => {
                                                setFocusedCol(idx);
                                                const rect = e.target.getBoundingClientRect();
                                                const dateStr = `${day.getDate()}/${day.getMonth() + 1}`;

                                                let info = "";
                                                if (type === 'views') {
                                                    const views = currentData.views !== "" ? Number(currentData.views).toLocaleString() : "0";
                                                    info = `Views 48h`;
                                                } else {
                                                    const revenue = currentData.revenue !== "" ? `$${Number(currentData.revenue).toLocaleString()}` : "$0";
                                                    info = `Doanh thu`;
                                                }

                                                setActiveTooltip({
                                                    content: `${dateStr} - ${channelName} - ${info}`,
                                                    x: rect.left + rect.width / 2,
                                                    y: rect.top - 40
                                                });
                                            };

                                            return (
                                                <td key={cellKey} className={`p-1.5 border-b border-r border-slate-200/50 last:border-r-0 relative transition-colors duration-300 ${focusedCol === idx ? 'bg-blue-50/40' : ''}`}>
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="relative">
                                                            <input
                                                                key={`views_${cellKey}_${data.views}`}
                                                                type="text"
                                                                inputMode="numeric"
                                                                placeholder="0"
                                                                className="w-full text-right pr-2 py-1.5 text-xs font-bold bg-transparent border border-slate-200/60 rounded-md focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-slate-700 hover:bg-black/5"
                                                                defaultValue={data.views !== "" && data.views !== 0 ? Number(data.views).toLocaleString('en-US') : ""}
                                                                onFocus={(e) => handleFocus(e, channel.name, day, data, 'views')}
                                                                onChange={(e) => {
                                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                                    e.target.value = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                                }}
                                                                onBlur={(e) => {
                                                                    setFocusedCol(null);
                                                                    setActiveTooltip(null);
                                                                    const rawVal = e.target.value.replace(/,/g, '');
                                                                    handleCellBlur(channel.id, day, 'views', rawVal);
                                                                }}
                                                            />
                                                            <Eye className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 opacity-60 pointer-events-none" size={13} strokeWidth={3} />
                                                        </div>

                                                        <div className="relative min-h-[32px] flex items-center">
                                                            {isMonetized === 'DA_BAT' ? (
                                                                <>
                                                                    <input
                                                                        key={`rev_${cellKey}_${data.revenue}`}
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        placeholder="0"
                                                                        className="w-full text-right pr-2 py-1.5 text-xs font-black bg-emerald-50/30 border border-emerald-200/60 rounded-md focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all text-emerald-700 hover:bg-emerald-50/80"
                                                                        defaultValue={data.revenue !== "" && data.revenue !== 0 ? Number(data.revenue).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ""}
                                                                        onFocus={(e) => handleFocus(e, channel.name, day, data, 'revenue')}
                                                                        onChange={(e) => {
                                                                            let rawValue = e.target.value.replace(/[^\d.]/g, '');
                                                                            const parts = rawValue.split('.');
                                                                            if (parts.length > 2) parts.pop();
                                                                            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                                            e.target.value = parts.join('.');
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            setFocusedCol(null);
                                                                            setActiveTooltip(null);
                                                                            const rawVal = e.target.value.replace(/,/g, '');
                                                                            handleCellBlur(channel.id, day, 'revenue', rawVal);
                                                                        }}
                                                                    />
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500 uppercase select-none pointer-events-none">$</span>
                                                                </>
                                                            ) : (
                                                                <div className="w-full py-1.5 px-2 bg-black/5 rounded-md border border-dashed border-black/10 text-center">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none italic">
                                                                        Chưa BKT
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {cellState === 'saving' && <Loader2 className="absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-slate-400" size={14} />}
                                                    {cellState === 'saved' && <Check className="absolute top-1/2 right-4 -translate-y-1/2 text-emerald-500" size={14} />}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )
                            })
                        )}
                        {filteredChannels.length > 0 && <tr><td colSpan={3 + tableDays.length} className="h-full border-0 p-0"></td></tr>}
                    </tbody>

                    <tfoot className="sticky bottom-0 z-[60] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-slate-800">
                        <tr className="text-white font-black">
                            <td colSpan={3} className="p-4 border-r border-slate-700 uppercase tracking-widest text-xs sticky left-0 z-[70] bg-slate-800 text-center">
                                Tổng Cả Hệ Thống
                            </td>
                            {dailyTotals.map((total, idx) => (
                                <td key={idx} className="p-2 border-r border-slate-700 last:border-r-0 bg-slate-800 w-[120px]">
                                    <div className="flex flex-col gap-1.5 text-right pr-2">
                                        <div className="text-[11px] text-blue-300 font-bold tracking-tight flex items-center justify-end gap-1">
                                            {total.views.toLocaleString()} <Eye size={11} strokeWidth={3} className="opacity-60" />
                                        </div>
                                        <div className="text-sm text-emerald-400 font-black tracking-tight drop-shadow-sm">
                                            <span className="text-[10px] font-black opacity-50 uppercase mr-0.5">$</span>
                                            {total.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {activeTooltip && (
                <div
                    className="fixed z-[9999] pointer-events-none transition-all duration-200"
                    style={{ left: activeTooltip.x, top: activeTooltip.y, transform: 'translateX(-50%)' }}
                >
                    <div className="bg-slate-800 text-white px-3 py-2 rounded-xl text-[11px] font-black shadow-2xl flex items-center gap-2 whitespace-nowrap animate-bounce-subtle border border-slate-700">
                        {activeTooltip.content}
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45 border-r border-b border-slate-700"></div>
                    </div>
                </div>
            )}
        </div>
    );
}