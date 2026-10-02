"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { TrendingUp, Calendar, Users, ChevronLeft, ChevronRight, Database, Download, Loader2,Lock } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

import KpiEmployeeDetail from "./components/KpiEmployeeDetail";
import KpiTeamTable from "./components/KpiTeamTable";
import KpiDrawer from "./components/KpiDrawer";
import TaskLogManager from "./components/TaskLogManager"; 

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// 🚀 HÀM 1: SINH TEXT TUẦN CHUẨN THEO THÁNG (LỊCH VIỆT NAM: THỨ 2 - CHỦ NHẬT)
function getWeekData(year: number, month: number, weekNumber: number) {
    // Ép giờ 12:00:00 trưa để tuyệt đối không bị nhảy ngày do lệch múi giờ
    const totalDays = new Date(year, month, 0, 12, 0, 0).getDate(); 
    const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 là Chủ Nhật, 1 là Thứ Hai...
    
    // Tính khoảng cách từ mùng 1 đến Chủ Nhật đầu tiên
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    let startDay = 1;
    let endDay = firstSunday;

    // Các tuần sau tuần 1 thì cứ tịnh tiến cộng 7 ngày
    if (weekNumber > 1) {
        startDay = firstSunday + (weekNumber - 2) * 7 + 1;
        endDay = Math.min(startDay + 6, totalDays); // Ép giới hạn không vượt quá ngày cuối tháng
    }

    const startOfWeek = new Date(year, month - 1, startDay, 12, 0, 0);
    const endOfWeek = new Date(year, month - 1, endDay, 12, 0, 0);

    const pad = (num: number) => num.toString().padStart(2, '0');
    const label = `Tuần ${weekNumber} (${pad(startDay)}/${pad(month)}/${year} - ${pad(endDay)}/${pad(month)}/${year})`;

    return { start: startOfWeek, end: endOfWeek, label };
}

// 🚀 HÀM 2: TÍNH SỐ TUẦN HỢP LỆ TRONG THÁNG (CẮT GỌN TRONG THÁNG ĐÓ)
function getAvailableWeeks(year: number, month: number) {
    const totalDays = new Date(year, month, 0, 12, 0, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    const remainingDays = totalDays - firstSunday;
    const totalWeeks = 1 + Math.ceil(remainingDays / 7);

    return Array.from({ length: totalWeeks }, (_, i) => i + 1);
}

// 🚀 HÀM 3: LẤY THÔNG TIN TUẦN HIỆN TẠI VÀO HÔM NAY (ÉP CHUẨN GIỜ VIỆT NAM)
function getCurrentWeekInfo() {
    const today = new Date();
    // Khử múi giờ của Server, ép cứng về múi giờ Việt Nam (UTC+7)
    const localTime = today.getTime();
    const localOffset = today.getTimezoneOffset() * 60000;
    const utc = localTime + localOffset;
    const vietnamTime = new Date(utc + (3600000 * 7)); 

    const year = vietnamTime.getFullYear();
    const month = vietnamTime.getMonth() + 1;
    const date = vietnamTime.getDate();

    const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    let week = 1;
    if (date > firstSunday) {
        week = 2 + Math.floor((date - firstSunday - 1) / 7);
    }

    return { year, month, week };
}

export default function KpiDashboard() {
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT";
    const teamId = currentUser?.teamId;
    const { showToast } = useToast();

    const isHighLevel = ["BAN_GIAM_DOC", "ADMIN", "HR", "KE_TOAN"].includes(userRole);
    const isManager = ["LEADER", "BAN_GIAM_DOC", "ADMIN", "HR", "KE_TOAN"].includes(userRole);

    const canFilterTeam = isHighLevel || currentUser?.isTeamLeader || currentUser?.permissions?.includes("MENU_TEAMS");

    const [mainTab, setMainTab] = useState<'KPI' | 'LOGS'>('KPI');

    const [teams, setTeams] = useState<any[]>([]);
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("ALL");
    
    const queryTeamId = canFilterTeam ? selectedTeamFilter : teamId;

    const currentInfo = getCurrentWeekInfo();
    const [selectedYear, setSelectedYear] = useState(currentInfo.year);
    const [selectedMonth, setSelectedMonth] = useState(currentInfo.month);
    const [selectedWeek, setSelectedWeek] = useState(currentInfo.week);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const [kpiList, setKpiList] = useState<any[]>([]);
    const [weekInfo, setWeekInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const availableWeeks = getAvailableWeeks(selectedYear, selectedMonth);

    useEffect(() => {
        const maxWeek = availableWeeks[availableWeeks.length - 1];
        if (selectedWeek !== 0 && selectedWeek > maxWeek) {
            setSelectedWeek(maxWeek);
        }
    }, [selectedMonth, selectedYear, availableWeeks]);

    useEffect(() => {
        if (canFilterTeam) {
            fetch("/api/teams").then(res => res.ok ? res.json() : []).then(setTeams);
        }
    }, [canFilterTeam]);

    const fetchKpiData = async () => {
        setIsLoading(true);
        try {
            if (isManager) {
                if (!queryTeamId) {
                    setIsLoading(false);
                    return;
                }
                
                const url = `/api/kpi?teamId=${queryTeamId}&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`;
                
                const res = await fetch(url);
                const data = await res.json();
                if (res.ok) {
                    setKpiList(data.kpiList || []);
                    setWeekInfo(data.weekData);
                } else {
                    showToast("error", data.error || "Không thể tải dữ liệu");
                }
            } else {
                if (!currentUser?.id) return;
                const res = await fetch(`/api/kpi/${currentUser.id}?year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`);
                const data = await res.json();

                if (res.ok) {
                    setKpiList([data]);
                    setViewingUserId(data.userId);
                } else {
                    showToast("error", data.error || "Không thể tải dữ liệu");
                }
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (mainTab === 'KPI') {
            setCurrentPage(1);
            if (currentUser) fetchKpiData();
        }
    }, [selectedYear, selectedMonth, selectedWeek, selectedTeamFilter, currentUser, mainTab]);

    useEffect(() => {
        if (isManager && kpiList.length > 0 && !viewingUserId) {
            const me = kpiList.find(k => k.userId === currentUser?.id);
            if (me) setViewingUserId(me.userId);
        }
    }, [kpiList, currentUser, viewingUserId, isManager]);

    const handleUpdateTarget = async (userId: string, newTarget: string | number, targetDetails: any[] = [], note: string = "") => {
        const targetNum = parseInt(newTarget as string);
        if (isNaN(targetNum) || targetNum < 0) return;

        setKpiList(prev => prev.map(k => {
            if (k.userId === userId) {
                const oldT = k.targetValue !== targetNum ? k.targetValue : k.oldTargetValue;
                const newPercent = targetNum > 0 ? Math.round((k.actualValue / targetNum) * 100) : 0;
                return { ...k, targetValue: targetNum, oldTargetValue: oldT, percent: newPercent, targetDetails, note };
            }
            return k;
        }));

        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId, year: selectedYear, month: selectedMonth, weekNumber: selectedWeek,
                    targetValue: targetNum, targetDetails, note 
                })
            });

            if (res.ok) {
                showToast("success", "Đã chốt chỉ tiêu chi tiết!");
            } else {
                showToast("error", "Lỗi lưu dữ liệu. Đang tải lại bảng...");
                fetchKpiData();
            }
        } catch (error) {
            showToast("error", "Mất kết nối server");
            fetchKpiData();
        }
    };

    // ==========================================
    // 🚀 XỬ LÝ XUẤT EXCEL CHUẨN XÁC
    // ==========================================
    const handleExportExcelThang = async () => {
        setIsExporting(true);
        try {
            const weekPromises = availableWeeks.map(w => 
                fetch(`/api/kpi?teamId=${queryTeamId}&year=${selectedYear}&month=${selectedMonth}&week=${w}`).then(res => res.json())
            );
            const weeksData = await Promise.all(weekPromises);

            const userMap = new Map();
            
            weeksData.forEach((weekRes, index) => {
                const w = availableWeeks[index];
                const list = weekRes.kpiList || [];
                
                list.forEach((userKpi: any) => {
                    if (!userMap.has(userKpi.userId)) {
                        userMap.set(userKpi.userId, {
                            id: userKpi.userId,
                            fullName: userKpi.fullName,
                            role: userKpi.role,
                            teamName: userKpi.teamName || "Chưa có team", 
                            weeks: {},
                            targets: new Map() 
                        });
                    }
                    
                    const uData = userMap.get(userKpi.userId);
                    uData.weeks[w] = userKpi;

                    if (userKpi.targetDetails && userKpi.targetDetails.length > 0) {
                        userKpi.targetDetails.forEach((td: any) => {
                            const safeDuration = Number(td.duration) || 0;
                            const safeRework = Boolean(td.isRework);
                            const safeChannelName = td.channelName || "Khác";

                            const tKey = `${safeChannelName}_${safeDuration}_${safeRework}`;
                            if (!uData.targets.has(tKey)) {
                                uData.targets.set(tKey, {
                                    channelName: safeChannelName,
                                    duration: safeDuration,
                                    isRework: safeRework
                                });
                            }
                        });
                    } else if (userKpi.targetValue > 0 || userKpi.actualValue > 0) {
                        const tKey = `Chung_0_false`;
                        if (!uData.targets.has(tKey)) {
                            uData.targets.set(tKey, { channelName: "Chung", duration: 0, isRework: false });
                        }
                    }
                });
            });

            // 🚀 BỎ LOGIC LỌC BỎ NHÂN SỰ. LẤY TOÀN BỘ DANH SÁCH TỪ API
            const users = Array.from(userMap.values());
            
            if (users.length === 0) {
                showToast("error", "Không có dữ liệu trong tháng này.");
                setIsExporting(false);
                return;
            }

            users.sort((a, b) => {
                const teamA = a.teamName || "ZZZ";
                const teamB = b.teamName || "ZZZ";
                if (teamA !== teamB) return teamA.localeCompare(teamB);
                return a.fullName.localeCompare(b.fullName);
            });

            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet(`KPI_Thang_${selectedMonth}`);

            const cols = [
                { width: 5 },  
                { width: 15 }, 
                { width: 25 }, 
                { width: 15 }, 
                { width: 22 }, 
            ];
            for (let i = 1; i <= availableWeeks.length; i++) {
                cols.push({ width: 10 }); 
                cols.push({ width: 10 }); 
                cols.push({ width: 10 }); 
                cols.push({ width: 12 }); 
            }
            ws.columns = cols;

            const row1 = ws.addRow([]);
            row1.height = 40;
            ws.mergeCells('A1:E1');
            const titleCell = ws.getCell('A1');
            titleCell.value = `THÁNG ${selectedMonth}`;
            titleCell.font = { name: 'Times New Roman', size: 18, bold: true, color: { argb: 'FFFF0000' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' } }; 
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            for (let i = 0; i < availableWeeks.length; i++) {
                const w = availableWeeks[i];
                const startCol = 5 + (i * 4) + 1;
                const endCol = startCol + 3;
                
                ws.mergeCells(1, startCol, 1, endCol);
                const weekCell = ws.getCell(1, startCol);
                
                const { start: sd, end: ed } = getWeekData(selectedYear, selectedMonth, w);
                const pad = (num: number) => num.toString().padStart(2, '0');
                const dateStr = `(${pad(sd.getDate())}-${pad(ed.getDate())}/${pad(ed.getMonth() + 1)})`;

                weekCell.value = `KHỐI LƯỢNG CÔNG VIỆC TUẦN ${w}\n${dateStr}`;
                weekCell.font = { name: 'Times New Roman', size: 10, bold: true };
                weekCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' } };
                weekCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }

            const headers = ['STT', 'TEAM', 'HỌ TÊN NHÂN SỰ', 'CÔNG VIỆC', 'KÊNH PHỤ TRÁCH'];
            for (let i = 0; i < availableWeeks.length; i++) {
                headers.push('Thời lượng video (phút)', 'KPI được giao/Tuần', 'KPI hoàn thành/Tuần', 'Mức độ hoàn thành');
            }
            const row2 = ws.addRow(headers);
            row2.height = 45;
            row2.eachCell((cell) => {
                cell.font = { name: 'Times New Roman', size: 10, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });
            
            for(let i=1; i <= 5 + (availableWeeks.length * 4); i++) {
                ws.getCell(1, i).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            }

            let startRow = 3;
            let currentTeamStr = "";
            let startTeamRow = 3;

            users.forEach((u, uIdx) => {
                const targetList = Array.from(u.targets.values());
                if (targetList.length === 0) targetList.push({ channelName: '', duration: 0, isRework: false });
                
                const numRows = targetList.length;

                targetList.forEach((tg: any, tIdx: number) => {
                    const rowData = [];
                    rowData.push(uIdx + 1); 
                    rowData.push(u.teamName);
                    rowData.push(u.fullName);
                    
                    let roleStr = u.role;
                    if (roleStr === "CONTENT") roleStr = "Content";
                    if (roleStr === "EDITOR") roleStr = "Edit";
                    if (roleStr === "PUBLISHER") roleStr = "QLK";
                    rowData.push(roleStr);
                    
                    rowData.push(tg.channelName + (tg.isRework ? " (Xào)" : ""));

                    for (let i = 0; i < availableWeeks.length; i++) {
                        const w = availableWeeks[i];
                        const weekKpi = u.weeks[w];
                        
                        // 🚀 GÁN MẶC ĐỊNH LÀ 0 CHO MỌI TRƯỜNG HỢP Ô TRỐNG
                        let tMins: string | number = tg.duration || 0; 
                        let giao: number | string = 0;
                        let hoanThanh: number | string = 0;
                        // Dòng đầu tiên (tIdx === 0) luôn hiển thị phần trăm, mặc định 0%
                        let percentStr = tIdx === 0 ? "0%" : ""; 

                        if (weekKpi) {
                            if (tIdx === 0) {
                                percentStr = `${weekKpi.percent || 0}%`;
                            }

                            if (weekKpi.targetDetails && weekKpi.targetDetails.length > 0) {
                                const detail = weekKpi.targetDetails.find((d:any) => 
                                    (d.channelName || "Khác") === tg.channelName && 
                                    Number(d.duration) === Number(tg.duration) && 
                                    Boolean(d.isRework) === Boolean(tg.isRework)
                                );
                                if (detail) {
                                    tMins = detail.duration || 0;
                                    giao = detail.targetCount || 0;
                                    hoanThanh = detail.actualCount || 0;
                                }
                            } else if (tg.channelName === 'Chung' || tg.channelName === '') {
                                tMins = 0;
                                giao = weekKpi.targetValue || 0;
                                hoanThanh = weekKpi.actualValue || 0;
                            }
                        }

                        rowData.push(tMins, giao, hoanThanh, percentStr);
                    }

                    const r = ws.addRow(rowData);
                    r.eachCell((cell) => {
                        cell.font = { name: 'Times New Roman', size: 11 };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                        
                        if (uIdx % 2 === 0) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; 
                        }
                    });
                });

                if (numRows > 1) {
                    ws.mergeCells(startRow, 1, startRow + numRows - 1, 1); 
                    ws.mergeCells(startRow, 3, startRow + numRows - 1, 3); 
                    ws.mergeCells(startRow, 4, startRow + numRows - 1, 4); 
                    
                    for (let i = 0; i < availableWeeks.length; i++) {
                        const pCol = 5 + (i * 4) + 4; 
                        ws.mergeCells(startRow, pCol, startRow + numRows - 1, pCol); 
                    }
                }

                if (uIdx === 0) {
                    currentTeamStr = u.teamName;
                    startTeamRow = startRow;
                } else if (u.teamName !== currentTeamStr) {
                    if (startRow - 1 > startTeamRow) {
                        ws.mergeCells(startTeamRow, 2, startRow - 1, 2);
                    }
                    currentTeamStr = u.teamName;
                    startTeamRow = startRow;
                }

                startRow += numRows;

                if (uIdx === users.length - 1) {
                    if (startRow - 1 > startTeamRow) {
                        ws.mergeCells(startTeamRow, 2, startRow - 1, 2); 
                    }
                }
            });

            ws.views = [{ state: 'frozen', xSplit: 5, ySplit: 2 }];

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `KPI_Thang_${selectedMonth}_${selectedYear}.xlsx`);
            showToast("success", "Đã xuất file Excel thành công!");

        } catch (error) {
            console.error(error);
            showToast("error", "Lỗi xuất file Excel!");
        } finally {
            setIsExporting(false);
        }
    };

    if (isManager && !canFilterTeam && !queryTeamId) return <div className="h-full flex-1 p-8 text-center text-slate-500 flex items-center justify-center font-medium">Bạn chưa được phân vào Team nào để xem KPI.</div>;

    const activeKpi = kpiList.find(k => k.userId === viewingUserId);
    const totalPages = Math.ceil(kpiList.length / itemsPerPage);
    const paginatedKpiList = kpiList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="h-full flex flex-col p-3 md:p-8 bg-slate-50 overflow-hidden animate-fade-in relative">

            {userRole === 'ADMIN' && (
                <div className="flex gap-1 mb-4 border-b border-slate-200 shrink-0">
                    <button 
                        onClick={() => setMainTab('KPI')}
                        className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider transition-colors border-b-2 ${mainTab === 'KPI' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        Bảng Theo Dõi KPI
                    </button>
                    <button 
                        onClick={() => setMainTab('LOGS')}
                        className={`px-4 py-2.5 text-sm font-black uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${mainTab === 'LOGS' ? 'border-rose-600 text-rose-700 bg-rose-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <Database size={16} /> Quản lý Log (Dọn Rác)
                    </button>
                </div>
            )}

            {mainTab === 'LOGS' ? (
                <div className="flex-1 min-h-0">
                    <TaskLogManager teams={teams} />
                </div>
            ) : (
                <>
                    <div className="shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 md:mb-6 gap-3 md:gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                                <TrendingUp className="text-blue-600 w-5 h-5 md:w-6 md:h-6" /> Thống Kê KPI
                            </h1>
                            <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 md:mt-1.5 flex items-center gap-1.5 md:gap-2">
                                <Calendar size={14} className="md:w-4 md:h-4" />
                                {selectedWeek === 0 ? `Tháng ${selectedMonth}/${selectedYear}` : getWeekData(selectedYear, selectedMonth, selectedWeek).label}
                                {kpiList.length > 0 && kpiList[0]?.isLocked && (
                                    <span className="bg-red-50 text-red-600 px-2.5 py-0.5 rounded-md border border-red-200 text-[10px] md:text-[11px] font-black uppercase flex items-center gap-1 shadow-sm ml-1 md:ml-2">
                                        <Lock size={12} strokeWidth={2.5} /> ĐÃ CHỐT SỔ (KHÓA KPI)
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-1 md:gap-2 bg-white p-1.5 md:p-2 rounded-xl shadow-sm border border-slate-200 overflow-x-auto w-full xl:w-auto custom-scrollbar-thin">
                            
                            {canFilterTeam && (
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
                                    <option value={0}>Cả tháng</option>
                                    {availableWeeks.map(w => <option key={w} value={w}>Tuần {w}</option>)}
                                </select>
                            </div>
                            
                            <button 
                                onClick={handleExportExcelThang}
                                disabled={isExporting}
                                className="h-7 md:h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ml-1 disabled:opacity-70 text-xs whitespace-nowrap active:scale-95"
                            >
                                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                Xuất Báo Cáo
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {!isManager && (
                            <div className="flex-1 flex flex-col min-h-0">
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
                                        week={selectedWeek} 
                                    />
                                </div>

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
                </>
            )}

            {isManager && mainTab === 'KPI' && (
                <KpiDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} activeKpi={activeKpi} />
            )}
        </div>
    );
}