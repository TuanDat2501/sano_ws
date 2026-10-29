"use client";

import { useState, useEffect, Fragment } from "react";
import { Loader2, Tv, Layers, CheckCircle2, Plus, Trash2, Save, CalendarDays, Undo2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { useSession } from "next-auth/react"; 

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

function getCurrentWeekInfo() {
    const today = new Date();
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

export default function SurplusView() {
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    
    const canFilterTeam = ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(currentUser?.role) || currentUser?.permissions?.includes("MENU_TEAMS");

    const [surplusData, setSurplusData] = useState<any[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]); 
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();
    
    const [teams, setTeams] = useState<any[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<string>(canFilterTeam ? "ALL" : (currentUser?.teamId || "ALL"));

    const currentInfo = getCurrentWeekInfo();
    const [selectedYear, setSelectedYear] = useState(currentInfo.year);
    const [selectedMonth, setSelectedMonth] = useState(currentInfo.month);
    const [selectedWeek, setSelectedWeek] = useState(currentInfo.week);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

    const availableWeeks = getAvailableWeeks(selectedYear, selectedMonth);
    const hasUnsavedChanges = JSON.stringify(surplusData) !== JSON.stringify(originalData);

    useEffect(() => {
        const maxWeek = availableWeeks[availableWeeks.length - 1];
        if (selectedWeek > maxWeek) {
            setSelectedWeek(maxWeek);
        }
    }, [selectedMonth, selectedYear, availableWeeks]);

    useEffect(() => {
        setCurrentPage(1); 
    }, [selectedTeam, selectedMonth, selectedWeek, selectedYear]);

    useEffect(() => {
        if (canFilterTeam) {
            fetch("/api/teams").then(res => res.ok ? res.json() : []).then(setTeams);
        }
    }, [canFilterTeam]);

    const fetchSurplus = async () => {
        setIsLoading(true);
        try {
            const teamQuery = selectedTeam ? `?teamId=${selectedTeam}` : `?teamId=ALL`;
            const res = await fetch(`/api/surplus/channel${teamQuery}&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`);
            
            if (res.ok) {
                const data = await res.json();
                
                // 🚀 BỔ SUNG: Sắp xếp dữ liệu theo Team, rồi mới đến tên Kênh
                const sortedData = data.data.sort((a: any, b: any) => {
                    const tA = a.teamName || "ZZZ";
                    const tB = b.teamName || "ZZZ";
                    if (tA !== tB) return tA.localeCompare(tB);
                    return (a.channelName || "").localeCompare(b.channelName || "");
                });

                setSurplusData(JSON.parse(JSON.stringify(sortedData)));
                setOriginalData(JSON.parse(JSON.stringify(sortedData)));
            }
        } catch (error) {
            console.error(error);
            showToast("error", "Lỗi tải dữ liệu bài dư");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) fetchSurplus();
    }, [selectedTeam, selectedYear, selectedMonth, selectedWeek, currentUser]);

    const handleAddRow = (channelId: string) => {
        setSurplusData(prev => prev.map(c => {
            if (c.channelId === channelId) {
                return {
                    ...c,
                    details: [
                        ...c.details, 
                        { rowId: `new_${Date.now()}`, jobCategory: "CONTENT", duration: 10, count: 1 }
                    ]
                };
            }
            return c;
        }));
    };

    const handleRemoveRow = (channelId: string, rowId: string) => {
        setSurplusData(prev => prev.map(c => {
            if (c.channelId === channelId) {
                return { ...c, details: c.details.filter((d: any) => d.rowId !== rowId) };
            }
            return c;
        }));
    };

    const handleUpdateRow = (channelId: string, rowId: string, field: string, value: any) => {
        setSurplusData(prev => prev.map(c => {
            if (c.channelId === channelId) {
                return {
                    ...c,
                    details: c.details.map((d: any) => d.rowId === rowId ? { ...d, [field]: value } : d)
                };
            }
            return c;
        }));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const changedData = surplusData.filter((cData, index) => {
                return JSON.stringify(cData.details) !== JSON.stringify(originalData[index].details);
            });

            if (changedData.length === 0) {
                setIsSaving(false);
                return;
            }

            const finalPayload = changedData.map(c => ({
                channelId: c.channelId,
                details: c.details.filter((d: any) => d.count > 0).map((d: any) => ({
                    jobCategory: d.jobCategory,
                    duration: Number(d.duration) || 0,
                    count: Number(d.count) || 0
                }))
            }));

            const res = await fetch('/api/surplus/channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    year: selectedYear, 
                    month: selectedMonth, 
                    week: selectedWeek, 
                    surplusData: finalPayload 
                })
            });

            if (res.ok) {
                showToast("success", "Đã lưu toàn bộ thay đổi thành công!");
                fetchSurplus(); 
            } else {
                showToast("error", "Lỗi lưu dữ liệu.");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối khi lưu dữ liệu.");
        } finally {
            setIsSaving(false);
        }
    };

    const totalPages = Math.ceil(surplusData.length / itemsPerPage);
    const paginatedData = surplusData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // 🚀 BỔ SUNG: Tính toán biến gộp cột cho Team trên trang hiện tại
    const teamCountsInPage: Record<string, number> = {};
    paginatedData.forEach(channelRow => {
        const teamName = channelRow.teamName;
        const detailsCount = channelRow.details.length;
        const totalRows = Math.max(1, detailsCount) + (detailsCount > 0 ? 1 : 0);
        teamCountsInPage[teamName] = (teamCountsInPage[teamName] || 0) + totalRows;
    });

    let currentTeamForRender = "";

    return (
        <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden animate-fade-in">
            
            <div className="shrink-0 p-4 bg-white border-b border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl shadow-sm"><Layers size={20} /></div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            Khai Báo Bài Dư (Theo Kênh)
                        </h2>
                        <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                            <CalendarDays size={14} /> Tuần {selectedWeek} ({selectedMonth}/{selectedYear})
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
                        {canFilterTeam && (
                            <div className="flex items-center gap-1 px-2 md:px-3 border-r border-slate-200 shrink-0">
                                <select
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-[100px] md:w-[130px] cursor-pointer"
                                    value={selectedTeam}
                                    onChange={(e) => setSelectedTeam(e.target.value)}
                                >
                                    <option value="ALL">Toàn công ty</option>
                                    {teams.map((team: any) => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex items-center gap-1 px-2 md:px-3 border-r border-slate-200 shrink-0">
                            <span className="text-[10px] md:text-sm font-bold text-slate-500">Tháng:</span>
                            <select className="bg-transparent text-xs md:text-sm font-black text-slate-800 outline-none cursor-pointer" value={selectedMonth} onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedWeek(1); }}>
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

                    <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                            <button 
                                onClick={fetchSurplus}
                                disabled={isSaving}
                                className="bg-white border border-slate-200 text-slate-600 px-3 py-2 h-[38px] rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-slate-100 transition-colors text-xs"
                            >
                                <Undo2 size={14} /> Hủy bỏ
                            </button>
                        )}
                        <button 
                            onClick={handleSaveAll}
                            disabled={!hasUnsavedChanges || isSaving}
                            className={`px-4 py-2 h-[38px] rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all text-sm
                                ${hasUnsavedChanges ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}
                            `}
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : hasUnsavedChanges ? <Save size={16} /> : <CheckCircle2 size={16} />}
                            Lưu Bài Dư
                        </button>
                    </div>
                </div>
            </div>

            {hasUnsavedChanges && (
                <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 flex items-center justify-center gap-2 shadow-sm animate-pulse shrink-0">
                    <AlertCircle size={14} /> Bạn có thay đổi chưa được lưu. Hãy bấm nút "Lưu Bài Dư" để ghi nhận!
                </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar bg-white h-[calc(100vh-240px)] min-h-[450px]">
                <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-max">
                    <thead className="bg-slate-100 text-[10px] uppercase font-black text-slate-500 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-slate-200">
                        <tr>
                            {/* 🚀 ĐÃ SỬA: Bổ sung cột Team đứng đầu, STT, Tên kênh... */}
                            <th className="border border-slate-200 p-2 text-center sticky left-0 bg-slate-200 z-40 w-[100px] shadow-[1px_0_0_0_#e2e8f0]">Team</th>
                            <th className="border border-slate-200 p-2 text-center sticky left-[100px] bg-slate-200 z-40 w-[40px] shadow-[1px_0_0_0_#e2e8f0]">STT</th>
                            <th className="border border-slate-200 p-2 sticky left-[140px] bg-slate-200 z-40 w-[280px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Tên Kênh</th>
                            <th className="border border-slate-200 p-2 w-[180px] text-center">Khâu Công Việc</th>
                            <th className="border border-slate-200 p-2 w-[120px] text-center">Số Phút</th>
                            <th className="border border-slate-200 p-2 w-[120px] text-center">Số Lượng Bài</th>
                            <th className="border border-slate-200 p-2 w-[60px] text-center sticky right-0 bg-slate-200 z-40 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">Xóa</th>
                        </tr>
                    </thead>
                    
                    <tbody className="bg-white">
                        {isLoading ? (
                            <tr><td colSpan={7} className="p-16 text-center"><Loader2 className="animate-spin mx-auto text-slate-400 w-8 h-8" /></td></tr>
                        ) : paginatedData.length === 0 ? (
                            <tr><td colSpan={7} className="p-16 text-center text-slate-400 font-medium italic">Không có dữ liệu kênh.</td></tr>
                        ) : (
                            paginatedData.map((channelRow, pageIndex) => {
                                const detailsCount = channelRow.details.length;
                                const totalRows = Math.max(1, detailsCount) + (detailsCount > 0 ? 1 : 0);
                                const globalIndex = (currentPage - 1) * itemsPerPage + pageIndex;
                                const rowBgClass = globalIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70";

                                const teamName = channelRow.teamName;
                                const isFirstChannelOfTeam = teamName !== currentTeamForRender;
                                if (isFirstChannelOfTeam) currentTeamForRender = teamName;
                                const teamSpanCount = teamCountsInPage[teamName];

                                return (
                                    <Fragment key={channelRow.channelId}>
                                        {detailsCount === 0 ? (
                                            <tr className={`${rowBgClass} hover:bg-slate-100/50 transition-colors group`}>
                                                
                                                {/* 🚀 Cột TEAM gom chung */}
                                                {isFirstChannelOfTeam && (
                                                    <td rowSpan={teamSpanCount} className="border border-slate-200 p-2 text-center align-middle sticky left-0 z-20 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">{teamName}</span>
                                                    </td>
                                                )}

                                                <td className={`border border-slate-200 p-2 text-center font-bold text-slate-400 sticky left-[100px] z-20 shadow-[1px_0_0_0_#e2e8f0] align-middle ${rowBgClass}`}>
                                                    {globalIndex + 1}
                                                </td>
                                                
                                                <td className={`border border-slate-200 p-2 sticky left-[140px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] align-middle ${rowBgClass}`}>
                                                    <div className="flex items-center gap-2.5">
                                                        {channelRow.channelAvatar ? (
                                                            <img src={channelRow.channelAvatar} alt={channelRow.channelName} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black shadow-sm shrink-0">
                                                                <Tv size={12} />
                                                            </div>
                                                        )}
                                                        <span className="font-bold text-slate-800 text-[13px]">{channelRow.channelName}</span>
                                                    </div>
                                                </td>

                                                <td colSpan={4} className="border border-slate-200 p-0 align-middle bg-inherit">
                                                    <button 
                                                        onClick={() => handleAddRow(channelRow.channelId)} 
                                                        className="w-full h-full min-h-[42px] px-3 text-xs font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Plus size={14} strokeWidth={2.5} /> Báo bài dư cho kênh
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : (
                                            <>
                                                {channelRow.details.map((detail: any, dIdx: number) => (
                                                    <tr key={detail.rowId} className={`${rowBgClass} hover:bg-slate-100/50 transition-colors group`}>
                                                        {dIdx === 0 && (
                                                            <>
                                                                {/* 🚀 Cột TEAM gom chung */}
                                                                {isFirstChannelOfTeam && (
                                                                    <td rowSpan={teamSpanCount} className="border border-slate-200 p-2 text-center align-top pt-4 sticky left-0 z-20 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]">
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">{teamName}</span>
                                                                    </td>
                                                                )}

                                                                <td rowSpan={totalRows} className={`border border-slate-200 p-2 text-center font-bold text-slate-400 sticky left-[100px] z-20 shadow-[1px_0_0_0_#e2e8f0] align-top pt-4 ${rowBgClass}`}>
                                                                    {globalIndex + 1}
                                                                </td>
                                                                
                                                                <td rowSpan={totalRows} className={`border border-slate-200 p-2 sticky left-[140px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] align-top pt-3 ${rowBgClass}`}>
                                                                    <div className="flex items-center gap-2.5">
                                                                        {channelRow.channelAvatar ? (
                                                                            <img src={channelRow.channelAvatar} alt={channelRow.channelName} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                                                                        ) : (
                                                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black shadow-sm shrink-0">
                                                                                <Tv size={12} />
                                                                            </div>
                                                                        )}
                                                                        <span className="font-bold text-slate-800 text-[13px]">{channelRow.channelName}</span>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        )}

                                                        <td className="border border-slate-200 p-0 align-top relative bg-inherit group/cell">
                                                            <select 
                                                                value={detail.jobCategory} 
                                                                onChange={(e) => handleUpdateRow(channelRow.channelId, detail.rowId, 'jobCategory', e.target.value)} 
                                                                className="w-full h-full min-h-[42px] bg-transparent outline-none px-3 py-2 text-xs font-bold text-indigo-700 transition-colors focus:bg-emerald-50/50 hover:bg-slate-50/50 cursor-pointer text-center appearance-none"
                                                            >
                                                                <option value="CONTENT" className="bg-white">✍️ KỊCH BẢN</option>
                                                                <option value="EDITOR" className="bg-white">🎬 DỰNG VIDEO</option>
                                                                <option value="ANIMATION" className="bg-white">✨ CHUYỂN ĐỘNG</option>
                                                                {/* <option value="PUBLISHER" className="bg-white">🚀 QUẢN LÝ KÊNH</option> */}
                                                            </select>
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top relative bg-inherit group/cell">
                                                            <input 
                                                                type="number" min="0" 
                                                                value={detail.duration} 
                                                                onChange={(e) => handleUpdateRow(channelRow.channelId, detail.rowId, 'duration', Number(e.target.value))} 
                                                                className="w-full h-full min-h-[42px] bg-transparent outline-none px-3 py-2 text-xs font-black text-amber-600 text-center transition-colors focus:bg-emerald-50/50 hover:bg-slate-50/50" 
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top relative bg-inherit group/cell">
                                                            <input 
                                                                type="number" min="1" 
                                                                value={detail.count} 
                                                                onChange={(e) => handleUpdateRow(channelRow.channelId, detail.rowId, 'count', Number(e.target.value))} 
                                                                className="w-full h-full min-h-[42px] bg-transparent outline-none px-3 py-2 text-sm font-black text-orange-600 text-center transition-colors focus:bg-emerald-50/50 hover:bg-slate-50/50" 
                                                            />
                                                        </td>
                                                        <td className={`border border-slate-200 p-0 align-top text-center sticky right-0 z-10 shadow-[-1px_0_0_0_#e2e8f0] group/cell ${rowBgClass}`}>
                                                            <button 
                                                                onClick={() => handleRemoveRow(channelRow.channelId, detail.rowId)} 
                                                                className="w-full h-full min-h-[42px] text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
                                                                title="Xóa dòng này"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}

                                                {detailsCount > 0 && (
                                                    <tr className={`${rowBgClass} hover:bg-slate-100/50 transition-colors`}>
                                                        <td colSpan={4} className="border border-slate-200 p-0 align-middle bg-inherit">
                                                            <button 
                                                                onClick={() => handleAddRow(channelRow.channelId)} 
                                                                className="w-full h-[38px] px-3 text-xs font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors flex items-center justify-center gap-1.5"
                                                            >
                                                                <Plus size={14} strokeWidth={2.5} /> Thêm khâu báo dư
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {!isLoading && surplusData.length > 0 && (
                <div className="p-3 md:p-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
                    <span className="text-[10px] md:text-sm text-slate-500 font-medium">
                        Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, surplusData.length)}</span> / <span className="font-bold text-slate-800">{surplusData.length}</span> Kênh
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
    );
}