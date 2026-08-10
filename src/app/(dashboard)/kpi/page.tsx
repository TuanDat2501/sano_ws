"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { TrendingUp, Calendar, Users, ChevronLeft, ChevronRight, Database, Download, Loader2 } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

import KpiEmployeeDetail from "./components/KpiEmployeeDetail";
import KpiTeamTable from "./components/KpiTeamTable";
import KpiDrawer from "./components/KpiDrawer";
import TaskLogManager from "./components/TaskLogManager"; 

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// 🚀 ĐÃ SỬA: Hàm sinh Text Tuần chuẩn ISO
function getWeekData(year: number, month: number, weekNumber: number) {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    
    const dayOfWeek = firstDayOfMonth.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    
    if (thursdayOfFirstWeek.getMonth() !== month - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }

    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    startOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setHours(23, 59, 59, 999);

    const pad = (num: number) => num.toString().padStart(2, '0');
    const label = `Tuần ${weekNumber} (${pad(startOfWeek.getDate())}/${pad(startOfWeek.getMonth() + 1)}/${startOfWeek.getFullYear()} - ${pad(endOfWeek.getDate())}/${pad(endOfWeek.getMonth() + 1)}/${endOfWeek.getFullYear()})`;

    return { start: startOfWeek, end: endOfWeek, label };
}

// 🚀 BỔ SUNG: Tính xem một tháng có bao nhiêu tuần hợp lệ (4 hay 5)
function getAvailableWeeks(year: number, month: number) {
    const weeks = [];
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const dayOfWeek = firstDayOfMonth.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    
    if (thursdayOfFirstWeek.getMonth() !== month - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }

    for (let w = 1; w <= 5; w++) {
        const startOfWeek = new Date(startOfFirstWeek);
        startOfWeek.setDate(startOfFirstWeek.getDate() + (w - 1) * 7);
        
        const thursday = new Date(startOfWeek);
        thursday.setDate(startOfWeek.getDate() + 3);
        
        // Nếu ngày Thứ 5 của tuần này đã chạy sang tháng khác -> Dừng lại!
        if (thursday.getMonth() !== month - 1) {
            break;
        }
        weeks.push(w);
    }
    return weeks;
}

// 🚀 ĐÃ SỬA: Hàm lấy ngày hiện tại (Tự nhận diện tháng và tuần)
function getCurrentWeekInfo() {
    const d = new Date();
    d.setHours(0,0,0,0);
    
    const dayOfWeek = d.getDay();
    const diffToThursday = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + diffToThursday);
    
    const targetYear = thursday.getFullYear();
    const targetMonth = thursday.getMonth() + 1;
    
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const diffToMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
    const startOfFirstWeek = new Date(targetYear, targetMonth - 1, 1 + diffToMonday);
    
    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    if (thursdayOfFirstWeek.getMonth() !== targetMonth - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }
    
    const diffTime = d.getTime() - startOfFirstWeek.getTime();
    const weekNumber = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    return { year: targetYear, month: targetMonth, week: weekNumber > 0 ? weekNumber : 1 };
}

export default function KpiDashboard() {
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT";
    const teamId = currentUser?.teamId;
    const { showToast } = useToast();

    const isHighLevel = ["BAN_GIAM_DOC", "ADMIN", "HR", "KE_TOAN"].includes(userRole);
    const isManager = ["LEADER", "BAN_GIAM_DOC", "ADMIN", "HR", "KE_TOAN"].includes(userRole);

    const [mainTab, setMainTab] = useState<'KPI' | 'LOGS'>('KPI');

    const [teams, setTeams] = useState<any[]>([]);
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("ALL");
    const queryTeamId = isHighLevel ? selectedTeamFilter : teamId;

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

    // 🚀 Lấy mảng Tuần động theo tháng đang chọn
    const availableWeeks = getAvailableWeeks(selectedYear, selectedMonth);

    // Ép lại tuần nếu user đổi sang tháng có ít tuần hơn
    useEffect(() => {
        const maxWeek = availableWeeks[availableWeeks.length - 1];
        if (selectedWeek !== 0 && selectedWeek > maxWeek) {
            setSelectedWeek(maxWeek);
        }
    }, [selectedMonth, selectedYear, availableWeeks]);

    useEffect(() => {
        if (isHighLevel || session?.user.isTeamLeader) {
            fetch("/api/teams").then(res => res.ok ? res.json() : []).then(setTeams);
        }
    }, [isHighLevel, session?.user.isTeamLeader]);

    const fetchKpiData = async () => {
        setIsLoading(true);
        try {
            if (isManager) {
                if (!queryTeamId) {
                    setIsLoading(false);
                    return;
                }
                let url = ""
                if (session?.user.isTeamLeader) {
                    url = `/api/kpi?teamId=ALL&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`
                } else {
                    url = `/api/kpi?teamId=${queryTeamId}&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`
                }
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

    const handleUpdateTarget = async (userId: string, newTarget: string | number, targetDetails: any[] = []) => {
        const targetNum = parseInt(newTarget as string);
        if (isNaN(targetNum) || targetNum < 0) return;

        setKpiList(prev => prev.map(k => {
            if (k.userId === userId) {
                const newPercent = targetNum > 0 ? Math.round((k.actualValue / targetNum) * 100) : 0;
                return { ...k, targetValue: targetNum, percent: newPercent, targetDetails };
            }
            return k;
        }));

        try {
            const res = await fetch("/api/kpi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId, year: selectedYear, month: selectedMonth, weekNumber: selectedWeek,
                    targetValue: targetNum, targetDetails 
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

    const handleExportExcelThang = async () => {
        setIsExporting(true);
        try {
            // Lặp theo mảng Tuần động
            const weekPromises = availableWeeks.map(w => 
                fetch(`/api/kpi?teamId=${queryTeamId}&year=${selectedYear}&month=${selectedMonth}&week=${w}`).then(res => res.json())
            );
            const weeksData = await Promise.all(weekPromises);

            const userMap = new Map();
            
            weeksData.forEach((weekRes, index) => {
                const w = availableWeeks[index]; // Lấy đúng tuần
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
                            const tKey = `${td.channelName}_${td.duration}_${td.isRework}`;
                            if (!uData.targets.has(tKey)) {
                                uData.targets.set(tKey, {
                                    channelName: td.channelName || "Khác",
                                    duration: td.duration || 0,
                                    isRework: td.isRework || false
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
                
                const weekDataRes = weeksData[i]?.weekData;
                let dateStr = "";
                if (weekDataRes && weekDataRes.startDate) {
                    const sd = new Date(weekDataRes.startDate);
                    const ed = new Date(weekDataRes.endDate);
                    dateStr = `(${sd.getDate()}-${ed.getDate()}/${ed.getMonth()+1})`;
                }

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
                if (targetList.length === 0) targetList.push({ channelName: '', duration: '', isRework: false });
                
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
                        let tMins = "";
                        let giao: number | string = "";
                        let hoanThanh: number | string = "";
                        let percentStr = "";

                        if (weekKpi) {
                            if (tIdx === 0) {
                                percentStr = `${weekKpi.percent || 0},00%`;
                            }

                            if (weekKpi.targetDetails && weekKpi.targetDetails.length > 0) {
                                const detail = weekKpi.targetDetails.find((d:any) => d.channelName === tg.channelName && d.duration === tg.duration && d.isRework === tg.isRework);
                                if (detail) {
                                    tMins = detail.duration || "";
                                    giao = detail.targetCount || 0;
                                    hoanThanh = detail.actualCount || 0;
                                }
                            } else if (tg.channelName === 'Chung') {
                                tMins = "0";
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

    if (isManager && !isHighLevel && !queryTeamId) return <div className="h-full flex-1 p-8 text-center text-slate-500 flex items-center justify-center font-medium">Bạn chưa được phân vào Team nào để xem KPI.</div>;

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
                            </p>
                        </div>

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
                            {session?.user.isTeamLeader && (
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
                                    {/* 🚀 ĐÃ SỬA: Lặp qua mảng tuần động của riêng tháng đó */}
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