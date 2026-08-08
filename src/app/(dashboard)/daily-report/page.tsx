"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, Check, Loader2, Calendar, FileBarChart, ExternalLink, Users, Search, Filter, ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import PermissionGuard from "@/app/component/PermissionGuard";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useToast } from "@/app/component/ToastProvider";

// Hàm helper lấy danh sách ngày trong tháng
const getDaysOfMonth = (currentDate: Date) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: numDays }).map((_, i) => new Date(year, month, i + 1, 12, 0, 0));
};

const getBadgeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('kịch bản') || t.includes('eng')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (t.includes('video')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (t.includes('audio')) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    if (t.includes('bố cục') || t.includes('thumb')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (t.includes('đã đăng')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (t.includes('ghi chú')) return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-violet-100 text-purple-700 border-violet-200'; // Default
};

export default function DailyReportPage() {
    const { data: session, status } = useSession();
    const { showToast } = useToast();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // ================= STATES: THỜI GIAN =================
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
    const tableDays = useMemo(() => getDaysOfMonth(currentMonthDate), [currentMonthDate]);
    const tableStartDateStr = tableDays[0].toISOString().split('T')[0];
    const tableEndDateStr = tableDays[tableDays.length - 1].toISOString().split('T')[0];

    // ================= STATES: DATA & BỘ LỌC =================
    const [usersData, setUsersData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTeam, setFilterTeam] = useState("ALL");
    
    // ================= STATES: UI TƯƠNG TÁC =================
    const [focusedCol, setFocusedCol] = useState<number | null>(null);
    const [selectedCell, setSelectedCell] = useState<{ user: any, date: Date, links: any[] } | null>(null);

    // Tự động cuộn đến ngày hôm nay khi load
    useEffect(() => {
        const todayObj = new Date();
        todayObj.setHours(12, 0, 0, 0);
        const todayKey = todayObj.toISOString().split('T')[0];

        const todayElem = document.getElementById(`day-col-${todayKey}`);
        if (todayElem && scrollContainerRef.current) {
            setTimeout(() => {
                const scrollLeft = todayElem.offsetLeft - 300; 
                scrollContainerRef.current?.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
            }, 200);
        }
    }, [tableDays]);

    // Gọi API lấy dữ liệu cả tháng
    useEffect(() => {
        if (status === "loading") return;

        setIsLoading(true);
        fetch(`/api/reports/daily?startDate=${tableStartDateStr}&endDate=${tableEndDateStr}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setUsersData(data);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Lỗi fetch báo cáo:", err);
                setIsLoading(false);
            });
    }, [tableStartDateStr, tableEndDateStr, status]);

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentMonthDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setCurrentMonthDate(newDate);
    };

    // Lọc danh sách Team
    const uniqueTeams = useMemo(() => {
        const teams = new Set(usersData.map(r => r.teamName || r.team?.name));
        return Array.from(teams).filter(Boolean).sort() as string[];
    }, [usersData]);

    // Xử lý Lọc Nhân sự & Nhóm theo Team
    const filteredUsers = useMemo(() => {
        let result = [...usersData];

        if (filterTeam !== "ALL") {
            result = result.filter(u => (u.teamName || u.team?.name) === filterTeam);
        }

        if (searchTerm) {
            result = result.filter(u => u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        return result.sort((a, b) => {
            const nameA = a.teamName || a.team?.name || "ZZZ";
            const nameB = b.teamName || b.team?.name || "ZZZ";
            return nameA.localeCompare(nameB);
        });
    }, [usersData, searchTerm, filterTeam]);

    // Tính tổng số đã nộp / thiếu theo từng ngày
    const dailyStats = useMemo(() => {
        const stats: Record<string, { reported: number, missing: number }> = {};
        tableDays.forEach(day => {
            const dateKey = day.toISOString().split('T')[0];
            let reported = 0;
            let missing = 0;
            filteredUsers.forEach(user => {
                if (user.dailyReports?.[dateKey]?.hasReported) {
                    reported++;
                } else {
                    missing++;
                }
            });
            stats[dateKey] = { reported, missing };
        });
        return stats;
    }, [tableDays, filteredUsers]);

    const teamCounts: Record<string, number> = {};
    filteredUsers.forEach(u => {
        const tName = u.teamName || u.team?.name || "No Team";
        teamCounts[tName] = (teamCounts[tName] || 0) + 1;
    });
    let currentTeamForRender = "";
    const weekDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // Xuất Excel theo format Grid hiện tại
    const handleExportExcel = async () => {
        if (filteredUsers.length === 0) {
            showToast("error", "Không có dữ liệu để xuất!");
            return;
        }

        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Báo Cáo Bảng Lưới');

            // Cấu hình cột
            const cols = [
                { header: 'Team', key: 'team', width: 15 },
                { header: 'STT', key: 'stt', width: 5 },
                { header: 'Họ và tên', key: 'name', width: 25 },
            ];

            tableDays.forEach(day => {
                const dateStr = `${day.getDate()}/${day.getMonth() + 1}`;
                cols.push({ header: dateStr, key: `d_${day.toISOString().split('T')[0]}`, width: 12 });
            });
            worksheet.columns = cols;

            // Đổ màu Header
            worksheet.getRow(1).eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            let currentTeamStr = "";
            let startRowMerge = 2;

            filteredUsers.forEach((user, idx) => {
                const tName = user.teamName || user.team?.name || "No Team";
                const currentRow = idx + 2;

                const rowData: any = {
                    team: tName,
                    stt: idx + 1,
                    name: `${user.fullName} (${user.role || ''})`,
                };

                tableDays.forEach(day => {
                    const dateKey = day.toISOString().split('T')[0];
                    const dayData = user.dailyReports?.[dateKey];
                    // 🚀 SỬA TRONG EXCEL: Xuất số lượng bài thay vì ✓ ✗
                    rowData[`d_${dateKey}`] = dayData?.hasReported ? (dayData.links?.length || 1) : '-';
                });

                worksheet.addRow(rowData);

                // Gộp cột Team
                if (idx === 0) {
                    currentTeamStr = tName;
                    startRowMerge = currentRow;
                } else if (tName !== currentTeamStr) {
                    if (currentRow - 1 > startRowMerge) {
                        worksheet.mergeCells(`A${startRowMerge}:A${currentRow - 1}`);
                    }
                    currentTeamStr = tName;
                    startRowMerge = currentRow;
                }

                if (idx === filteredUsers.length - 1) {
                    if (currentRow > startRowMerge) {
                        worksheet.mergeCells(`A${startRowMerge}:A${currentRow}`);
                    }
                }
            });

            // Format body rows (Border + Color)
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.eachCell((cell, colNumber) => {
                        cell.border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
                        cell.alignment = { vertical: 'middle', horizontal: colNumber > 3 ? 'center' : 'left' };
                        
                        if (colNumber > 3) {
                            if (cell.value !== '-' && Number(cell.value) > 0) cell.font = { color: { argb: 'FF10B981' }, bold: true }; // Xanh
                            else cell.font = { color: { argb: 'FF94A3B8' }, bold: true }; // Xám
                        }
                    });
                }
            });

            // Bổ sung các hàng Footer tính tổng
            const reportedRow: any = { team: 'TỔNG ĐÃ NỘP', stt: '', name: '' };
            const missingRow: any = { team: 'TỔNG THIẾU', stt: '', name: '' };

            tableDays.forEach(day => {
                const dateKey = day.toISOString().split('T')[0];
                reportedRow[`d_${dateKey}`] = dailyStats[dateKey].reported;
                missingRow[`d_${dateKey}`] = dailyStats[dateKey].missing;
            });

            const rRow = worksheet.addRow(reportedRow);
            const mRow = worksheet.addRow(missingRow);

            worksheet.mergeCells(`A${rRow.number}:C${rRow.number}`);
            worksheet.mergeCells(`A${mRow.number}:C${mRow.number}`);

            [rRow, mRow].forEach((row, idx) => {
                row.eachCell((cell, colNum) => {
                    cell.font = { bold: true, color: colNum > 3 ? (idx === 0 ? { argb: 'FF10B981' } : { argb: 'FFEF4444' }) : { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Nền tối
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (colNum <= 3) cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
            });

            worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `BaoCao_HangNgay_${tableStartDateStr}_${tableEndDateStr}.xlsx`);
            showToast("success", "Đã xuất file Excel thành công!");

        } catch (error) {
            showToast("error", "Lỗi xuất file Excel!");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <PermissionGuard moduleId="MENU_DAILY_REPORT">
            <div className="h-full max-h-[calc(100vh-60px)] flex flex-col p-2 md:p-4 bg-slate-50 overflow-hidden animate-fade-in gap-3 md:gap-4 relative">
                
                {/* ================= HEADER & TOOLBAR ================= */}
                <div className="shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-2.5 md:p-3 rounded-xl border border-slate-200 gap-3 shadow-sm z-10">
                    <div>
                        <h1 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-1.5">
                            <FileBarChart className="text-blue-600 w-4 h-4 md:w-5 md:h-5" /> Bảng Theo Dõi Báo Cáo
                        </h1>
                        <p className="text-[9px] md:text-[10px] text-slate-500 font-medium mt-0.5">Kiểm soát tiến độ nộp báo cáo hằng ngày của nhân sự.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg h-9 px-2 flex-1 sm:flex-none sm:w-48">
                            <Search size={14} className="text-slate-400 mr-1.5 shrink-0" />
                            <input 
                                type="text" 
                                placeholder="Tên nhân sự..." 
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg h-9 px-2 w-full sm:w-auto">
                            <Filter size={14} className="text-slate-400 mr-1.5 shrink-0" />
                            <select
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full sm:w-28 cursor-pointer"
                                value={filterTeam}
                                onChange={(e) => setFilterTeam(e.target.value)}
                            >
                                <option value="ALL">Tất cả Team</option>
                                {uniqueTeams.map((team: string) => (
                                    <option key={team} value={team}>{team}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 h-9 w-full sm:w-auto justify-between sm:justify-center ml-0 sm:ml-2">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white rounded transition-all shadow-sm"><ChevronLeft size={16} /></button>
                            <div className="text-[10px] md:text-[11px] font-black text-slate-700 px-1 uppercase tracking-widest whitespace-nowrap">
                                THÁNG {currentMonthDate.getMonth() + 1} / {currentMonthDate.getFullYear()}
                            </div>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white rounded transition-all shadow-sm"><ChevronRight size={16} /></button>
                        </div>

                        <button 
                            onClick={handleExportExcel}
                            disabled={isExporting}
                            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-[11px] md:text-xs w-full sm:w-auto shadow-md shadow-emerald-600/20 ml-0 sm:ml-2 disabled:opacity-70"
                        >
                            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            <span>Xuất Excel</span>
                        </button>
                    </div>
                </div>

                {/* ================= BẢNG DỮ LIỆU (GRID) ================= */}
                <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar relative bg-white border border-slate-200 rounded-xl shadow-sm">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/60 z-[100] flex flex-col items-center justify-center backdrop-blur-[1px]">
                            <Loader2 className="animate-spin text-blue-600 h-8 w-8 mb-2" />
                            <span className="text-xs font-bold text-slate-500">Đang tải dữ liệu tháng...</span>
                        </div>
                    )}
                    
                    <table className="w-full h-full text-left border-separate border-spacing-0 min-w-max">
                        <thead className="sticky top-0 z-[60] bg-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-b-2 border-slate-300">
                            <tr className="text-slate-700 text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                                <th className="p-2 border-r border-slate-300 sticky left-0 z-[70] bg-slate-200 w-[90px] text-center">Team</th>
                                <th className="p-2 border-r border-slate-300 sticky left-[90px] z-[70] bg-slate-200 w-[40px] text-center">STT</th>
                                <th className="p-2 border-r-4 border-slate-300 sticky left-[130px] z-[70] bg-slate-200 w-[180px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Nhân sự</th>

                                {tableDays.map((day, idx) => {
                                    const todayObj = new Date();
                                    todayObj.setHours(12, 0, 0, 0);
                                    const isToday = day.toISOString().split('T')[0] === todayObj.toISOString().split('T')[0];

                                    return (
                                        <th 
                                            id={`day-col-${day.toISOString().split('T')[0]}`} 
                                            key={idx} 
                                            className={`p-2 border-r border-slate-300 text-center w-[50px] md:w-[60px] transition-colors duration-300 ${focusedCol === idx ? 'bg-blue-100 border-blue-300 shadow-inner' : 'bg-slate-100'}`}
                                            onMouseEnter={() => setFocusedCol(idx)}
                                            onMouseLeave={() => setFocusedCol(null)}
                                        >
                                            <div className={`mb-0.5 transition-colors ${focusedCol === idx ? 'text-blue-700 font-black' : 'text-slate-500'}`}>
                                                {weekDays[day.getDay()]}
                                            </div>
                                            <div className={`text-xs md:text-sm ${isToday ? 'text-red-600 font-black' : (focusedCol === idx ? 'text-blue-800 font-black' : '')}`}>
                                                {day.getDate()}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr><td colSpan={3 + tableDays.length} className="p-6 h-full text-center align-top pt-16 text-slate-400 italic text-sm">Chưa có dữ liệu nhân sự.</td></tr>
                            ) : (
                                filteredUsers.map((user, index) => {
                                    const teamName = user.teamName || user.team?.name || "No Team";
                                    const isFirstRowOfTeam = teamName !== currentTeamForRender;
                                    if (isFirstRowOfTeam) currentTeamForRender = teamName;
                                    const rowSpanCount = teamCounts[teamName];
                                    const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-[#f4f5f7]";

                                    return (
                                        <tr key={user.id} className={`${rowBgClass} hover:bg-[#e2e8f0] focus-within:bg-blue-50/50 transition-colors group`}>
                                            {isFirstRowOfTeam && (
                                                <td rowSpan={rowSpanCount} className={`p-1.5 border-b border-r border-slate-300 sticky left-0 z-40 bg-slate-100 align-middle text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`}>
                                                    <span className="font-black text-slate-600 text-[10px] md:text-xs uppercase tracking-widest">{teamName}</span>
                                                </td>
                                            )}

                                            <td className={`p-1.5 border-b border-r border-slate-200 sticky left-[90px] z-30 ${rowBgClass} group-hover:bg-[#e2e8f0] transition-colors text-center font-bold text-slate-500 text-xs`}>
                                                {index + 1}
                                            </td>

                                            <td className={`p-2 border-b border-r-4 border-slate-200 sticky left-[130px] z-30 ${rowBgClass} group-hover:bg-[#e2e8f0] transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]`}>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 md:h-7 md:w-7 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-500 overflow-hidden shrink-0 text-[10px] border border-slate-300">
                                                        {user.avatarUrl ? <img src={user.avatarUrl} alt="avt" className="w-full h-full object-cover" /> : user.fullName?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-[11px] md:text-xs text-slate-800 line-clamp-1" title={user.fullName}>{user.fullName}</span>
                                                        <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-wider">{user.role}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {tableDays.map((day, idx) => {
                                                const dateKey = day.toISOString().split('T')[0];
                                                const dayData = user.dailyReports?.[dateKey]; 
                                                const hasReported = dayData?.hasReported;
                                                // Đếm tổng số bài đã nộp (hoặc mặc định là 1 nếu báo cáo nhưng ko đính link)
                                                const count = dayData?.links?.length || (hasReported ? 1 : 0);

                                                return (
                                                    <td 
                                                        key={dateKey} 
                                                        className={`p-1 border-b border-r border-slate-200/50 last:border-r-0 transition-colors duration-300 text-center ${focusedCol === idx ? 'bg-blue-50/40' : ''}`}
                                                        onMouseEnter={() => setFocusedCol(idx)}
                                                        onMouseLeave={() => setFocusedCol(null)}
                                                    >
                                                        {/* 🚀 HIỂN THỊ SỐ LƯỢNG BÀI ĐÃ NỘP */}
                                                        {hasReported ? (
                                                            <button 
                                                                onClick={() => setSelectedCell({ user, date: day, links: dayData.links || [] })}
                                                                className="w-5 h-5 md:w-6 md:h-6 mx-auto bg-violet-100 rounded flex items-center justify-center cursor-pointer hover:bg-violet-200 hover:scale-110 transition-all shadow-sm border border-violet-200 group/btn relative"
                                                                title="Xem chi tiết báo cáo"
                                                            >
                                                                <span className="text-violet-700 font-black text-[10px] md:text-xs leading-none mt-px">{count}</span>
                                                            </button>
                                                        ) : (
                                                            <div className="w-5 h-5 md:w-6 md:h-6 mx-auto bg-slate-50 rounded flex items-center justify-center border border-slate-100 opacity-50">
                                                                <span className="text-slate-300 text-[10px] font-black">-</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )
                                })
                            )}
                            {filteredUsers.length > 0 && <tr><td colSpan={3 + tableDays.length} className="h-full border-0 p-0"></td></tr>}
                        </tbody>

                        <tfoot className="sticky bottom-0 z-[60] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-slate-800">
                            <tr className="text-white font-black">
                                <td colSpan={3} className="p-3 border-r-4 border-slate-700 uppercase tracking-widest text-[10px] md:text-xs sticky left-0 z-[70] bg-slate-800 text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                                    Thống Kê Nộp Báo Cáo
                                </td>

                                {tableDays.map((day, idx) => {
                                    const dateKey = day.toISOString().split('T')[0];
                                    const stat = dailyStats[dateKey];
                                    return (
                                        <td key={dateKey} className="p-1 border-r border-slate-700 last:border-r-0 bg-slate-800 text-center align-middle">
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <div className="bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded text-[9px] w-full max-w-[44px] border border-emerald-500/30">
                                                    Đạt: {stat.reported}
                                                </div>
                                                <div className="bg-red-500/20 text-red-400 px-1 py-0.5 rounded text-[9px] w-full max-w-[44px] border border-red-500/30">
                                                    Thiếu: {stat.missing}
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* ================= MODAL HIỂN THỊ CHI TIẾT LINK BÁO CÁO CỦA NGÀY ================= */}
                {selectedCell && (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-scale-up">
                            
                            {/* 🚀 ĐÃ SỬA: HEADER CỦA BOX HIỂN THỊ */}
                            <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 relative">
                                <div>
                                    <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2">
                                        <Check className="text-emerald-500 w-5 h-5 md:w-6 md:h-6" strokeWidth={3} /> Chi Tiết Báo Cáo
                                    </h2>
                                    <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">
                                        Nhân sự: <strong className="text-blue-600">{selectedCell.user.fullName}</strong> <span className="mx-1">•</span> Ngày: <strong className="text-slate-700">{selectedCell.date.toLocaleDateString('vi-VN')}</strong>
                                    </p>
                                </div>
                                <button onClick={() => setSelectedCell(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors shadow-sm">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
                                {selectedCell.links.length === 0 ? (
                                    <div className="text-center p-6 text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                                        Có đánh dấu báo cáo nhưng không đính kèm Link công việc nào.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {selectedCell.links.map((link: any, idx: number) => {
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
                                                    // 🚀 ĐÃ SỬA: DESIGN TỪNG DÒNG GIỐNG VỚI MẪU CỦA SẾP
                                                    className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2 md:p-3 shadow-sm hover:shadow-md hover:border-violet-300 transition-all group overflow-hidden"
                                                    title={link.url}
                                                >
                                                    <span className={`px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-lg shrink-0 ${badgeStyle}`}>
                                                        {type}
                                                    </span>
                                                    <span className="text-xs md:text-sm font-bold text-slate-700 group-hover:text-violet-700 truncate flex-1 leading-snug">
                                                        {idx + 1}. {title}
                                                    </span>
                                                    <div className="px-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                                        <ExternalLink size={16} className="text-blue-500" />
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PermissionGuard>
    );
}