"use client";

import { useState, useEffect, Fragment } from "react";
import { Loader2, UsersIcon, Layers, CheckCircle2, Plus, Trash2, Save, CalendarDays, Undo2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
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
    const isManager = ["LEADER", "ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser?.role) || currentUser?.permissions?.includes("MENU_KPI");

    const [surplusData, setSurplusData] = useState<any[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]); 
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();
    
    const [teams, setTeams] = useState<any[]>([]);
    
    const [selectedTeam, setSelectedTeam] = useState<string>(canFilterTeam ? "ALL" : (currentUser?.teamId || "ALL"));
    
    const [channels, setChannels] = useState<any[]>([]);

    const currentInfo = getCurrentWeekInfo();
    const [selectedYear, setSelectedYear] = useState(currentInfo.year);
    const [selectedMonth, setSelectedMonth] = useState(currentInfo.month);
    const [selectedWeek, setSelectedWeek] = useState(currentInfo.week);

    // STATE PHÂN TRANG (PAGINATION)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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
        fetch("/api/channels").then(res => res.ok ? res.json() : []).then(setChannels);
    }, [canFilterTeam]);

    const fetchSurplus = async () => {
        setIsLoading(true);
        try {
            const teamQuery = selectedTeam ? `?teamId=${selectedTeam}&limit=1000` : `?teamId=ALL&limit=1000`;
            const usersRes = await fetch(`/api/users${teamQuery}`);
            
            let users: any[] = [];
            if (usersRes.ok) {
                const data = await usersRes.json();
                users = Array.isArray(data) ? data : (data.data || data.users || []);
            }
            if (!Array.isArray(users)) users = [];

            users = users.filter((u: any) => 
                u.isActive !== false && 
                u.role !== "BAN_GIAM_DOC" && 
                u.role !== "HR" && 
                u.team?.name !== "Nhân sự" && 
                u.team?.name !== "HR" &&
                u.team?.name !== "Ban Giám Đốc"
            );

            if (!["ADMIN", "BAN_GIAM_DOC", "KE_TOAN", "LEADER"].includes(currentUser?.role) && !currentUser?.permissions?.includes("MENU_TEAMS")) {
                users = users.filter((u: any) => u.id === currentUser?.id);
            }

            const promises = users.map((u: any) => 
                fetch(`/api/org-chart/surplus?userId=${u.id}&year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`)
                    .then(res => res.json())
                    .then(resData => ({
                        user: u,
                        surplusDetails: resData.data || []
                    }))
                    .catch(() => ({ user: u, surplusDetails: [] }))
            );

            const results = await Promise.all(promises);

            let mappedData: any[] = [];

            results.sort((a, b) => {
                const tA = a.user.team?.name || "ZZZ";
                const tB = b.user.team?.name || "ZZZ";
                if (tA !== tB) return tA.localeCompare(tB);
                return a.user.fullName.localeCompare(b.user.fullName);
            });

            results.forEach((item: any) => {
                const details = item.surplusDetails;
                const uInfo = item.user;
                const tName = uInfo.team?.name || "Chưa có team";

                mappedData.push({
                    userId: uInfo.id,
                    userFullName: uInfo.fullName,
                    userAvatar: uInfo.avatarUrl,
                    userRole: uInfo.role,
                    teamName: tName,
                    details: details.map((d: any, idx: number) => ({
                        rowId: `saved_${uInfo.id}_${idx}`, 
                        channelName: d.channelName || "",
                        jobCategory: d.jobCategory || "CONTENT",
                        duration: d.duration || 10,
                        count: d.count || 1
                    }))
                });
            });

            setSurplusData(JSON.parse(JSON.stringify(mappedData)));
            setOriginalData(JSON.parse(JSON.stringify(mappedData)));

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

    // --- CÁC HÀM XỬ LÝ TRỰC TIẾP TRÊN BẢNG ---
    const handleAddRow = (userId: string, defaultRole: string) => {
        setSurplusData(prev => prev.map(u => {
            if (u.userId === userId) {
                return {
                    ...u,
                    details: [
                        ...u.details, 
                        { rowId: `new_${Date.now()}`, channelName: "", jobCategory: defaultRole || "CONTENT", duration: 10, count: 1 }
                    ]
                };
            }
            return u;
        }));
    };

    const handleRemoveRow = (userId: string, rowId: string) => {
        setSurplusData(prev => prev.map(u => {
            if (u.userId === userId) {
                return { ...u, details: u.details.filter((d: any) => d.rowId !== rowId) };
            }
            return u;
        }));
    };

    const handleUpdateRow = (userId: string, rowId: string, field: string, value: any) => {
        setSurplusData(prev => prev.map(u => {
            if (u.userId === userId) {
                return {
                    ...u,
                    details: u.details.map((d: any) => d.rowId === rowId ? { ...d, [field]: value } : d)
                };
            }
            return u;
        }));
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const promises = surplusData.map(async (uData, index) => {
                if (JSON.stringify(uData.details) !== JSON.stringify(originalData[index].details)) {
                    const finalPayload = uData.details
                        .filter((f: any) => f.count > 0 && f.channelName.trim() !== "")
                        .map((f: any) => ({
                            channelName: f.channelName.trim(),
                            jobCategory: f.jobCategory,
                            duration: Number(f.duration) || 0,
                            count: Number(f.count) || 0
                        }));

                    return fetch('/api/org-chart/surplus', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            userId: uData.userId, 
                            year: selectedYear, 
                            month: selectedMonth, 
                            week: selectedWeek, 
                            surplusData: finalPayload 
                        })
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(promises);
            showToast("success", "Đã lưu toàn bộ thay đổi thành công!");
            fetchSurplus(); 

        } catch (error) {
            showToast("error", "Lỗi kết nối khi lưu dữ liệu.");
        } finally {
            setIsSaving(false);
        }
    };

    const totalPages = Math.ceil(surplusData.length / itemsPerPage);
    const paginatedData = surplusData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden animate-fade-in">
            
            <div className="shrink-0 p-4 bg-white border-b border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl shadow-sm"><Layers size={20} /></div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            Khai Báo Bài Dư
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
                                <UsersIcon size={14} className="text-slate-400" />
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
                                ${hasUnsavedChanges ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/30' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}
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

            {/* 🚀 Đã xóa class "flex flex-col" và "flex-1" trên table để các dòng không bị kéo dãn dọc */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-max">
                    <thead className="bg-slate-100 text-[10px] uppercase font-black text-slate-500 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-slate-200">
                        <tr>
                            <th className="border border-slate-200 p-2 text-center sticky left-0 bg-slate-200 z-40 w-[40px] shadow-[1px_0_0_0_#e2e8f0]">STT</th>
                            <th className="border border-slate-200 p-2 sticky left-[40px] bg-slate-200 z-40 w-[240px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Nhân sự</th>
                            <th className="border border-slate-200 p-2 w-[120px] text-center">Team</th>
                            <th className="border border-slate-200 p-2 w-[100px] text-center">Vai trò</th>
                            <th className="border border-slate-200 p-2 min-w-[200px]">Kênh</th>
                            <th className="border border-slate-200 p-2 w-[150px] text-center">Khâu (Job)</th>
                            <th className="border border-slate-200 p-2 w-[100px] text-center">Phút</th>
                            <th className="border border-slate-200 p-2 w-[100px] text-center">Số lượng</th>
                            <th className="border border-slate-200 p-2 w-[50px] text-center sticky right-0 bg-slate-200 z-40 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">Xóa</th>
                        </tr>
                    </thead>
                    
                    <tbody className="bg-white">
                        {isLoading ? (
                            <tr><td colSpan={9} className="p-16 text-center"><Loader2 className="animate-spin mx-auto text-slate-400 w-8 h-8" /></td></tr>
                        ) : paginatedData.length === 0 ? (
                            <tr><td colSpan={9} className="p-16 text-center text-slate-400 font-medium italic">Không có dữ liệu nhân sự.</td></tr>
                        ) : (
                            paginatedData.map((userRow, pageIndex) => {
                                const canEdit = isManager || userRow.userId === currentUser?.id;
                                const detailsCount = userRow.details.length;
                                const showAddRow = canEdit;
                                const totalRows = Math.max(1, detailsCount) + (showAddRow && detailsCount > 0 ? 1 : 0);

                                const globalIndex = (currentPage - 1) * itemsPerPage + pageIndex;
                                const rowBgClass = globalIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70";

                                return (
                                    <Fragment key={userRow.userId}>
                                        {detailsCount === 0 ? (
                                            <tr className={`${rowBgClass} hover:bg-slate-100/50 transition-colors group`}>
                                                <td className={`border border-slate-200 p-2 text-center font-bold text-slate-400 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] align-middle ${rowBgClass}`}>
                                                    {globalIndex + 1}
                                                </td>
                                                
                                                <td className={`border border-slate-200 p-2 sticky left-[40px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] align-middle ${rowBgClass}`}>
                                                    <div className="flex items-center gap-2.5">
                                                        {userRow.userAvatar ? (
                                                            <img src={userRow.userAvatar} alt={userRow.userFullName} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[9px] shadow-sm shrink-0">
                                                                {userRow.userFullName.charAt(0)}
                                                            </div>
                                                        )}
                                                        <span className="font-bold text-slate-800 text-[13px]">{userRow.userFullName}</span>
                                                    </div>
                                                </td>

                                                <td className="border border-slate-200 p-2 text-center align-middle bg-inherit">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-200/50 px-2 py-1 rounded border border-slate-200">{userRow.teamName}</span>
                                                </td>

                                                <td className="border border-slate-200 p-2 text-center align-middle bg-inherit">
                                                    <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">{userRow.userRole}</span>
                                                </td>

                                                <td colSpan={5} className="border border-slate-200 p-0 align-middle bg-inherit">
                                                    {canEdit ? (
                                                        <button 
                                                            onClick={() => handleAddRow(userRow.userId, userRow.userRole)} 
                                                            className="w-full h-full min-h-[42px] px-3 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition-colors flex items-center justify-start gap-1.5"
                                                        >
                                                            <Plus size={14} strokeWidth={2.5} /> Thêm bài dư cho {userRow.userFullName}
                                                        </button>
                                                    ) : (
                                                        <div className="w-full h-full min-h-[42px] px-3 flex items-center justify-start text-xs text-slate-400 italic">Chưa có bài dư</div>
                                                    )}
                                                </td>
                                            </tr>
                                        ) : (
                                            <>
                                                {userRow.details.map((detail: any, dIdx: number) => (
                                                    <tr key={detail.rowId} className={`${rowBgClass} hover:bg-slate-100/50 transition-colors group`}>
                                                        {dIdx === 0 && (
                                                            <>
                                                                <td rowSpan={totalRows} className={`border border-slate-200 p-2 text-center font-bold text-slate-400 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] align-top pt-4 ${rowBgClass}`}>
                                                                    {globalIndex + 1}
                                                                </td>
                                                                
                                                                <td rowSpan={totalRows} className={`border border-slate-200 p-2 sticky left-[40px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] align-top pt-3 ${rowBgClass}`}>
                                                                    <div className="flex items-center gap-2.5">
                                                                        {userRow.userAvatar ? (
                                                                            <img src={userRow.userAvatar} alt={userRow.userFullName} className="w-6 h-6 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" />
                                                                        ) : (
                                                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[9px] shadow-sm shrink-0">
                                                                                {userRow.userFullName.charAt(0)}
                                                                            </div>
                                                                        )}
                                                                        <span className="font-bold text-slate-800 text-[13px]">{userRow.userFullName}</span>
                                                                    </div>
                                                                </td>

                                                                <td rowSpan={totalRows} className="border border-slate-200 p-2 text-center align-top bg-inherit pt-4">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-200/50 px-2 py-1 rounded border border-slate-200">{userRow.teamName}</span>
                                                                </td>

                                                                <td rowSpan={totalRows} className="border border-slate-200 p-2 text-center align-top bg-inherit pt-4">
                                                                    <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">{userRow.userRole}</span>
                                                                </td>
                                                            </>
                                                        )}

                                                        <td className="border border-slate-200 p-0 align-top relative bg-inherit group/cell">
                                                            <input 
                                                                list="channel-suggestions"
                                                                type="text" 
                                                                placeholder="Nhập tên kênh..." 
                                                                value={detail.channelName} 
                                                                onChange={(e) => handleUpdateRow(userRow.userId, detail.rowId, 'channelName', e.target.value)} 
                                                                disabled={!canEdit}
                                                                className="w-full h-full min-h-[42px] bg-transparent outline-none px-3 py-2 text-xs font-bold text-slate-700 transition-colors focus:bg-blue-50/50 hover:bg-slate-50/50 disabled:opacity-60" 
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top relative bg-inherit group/cell">
                                                            <select 
                                                                value={detail.jobCategory} 
                                                                onChange={(e) => handleUpdateRow(userRow.userId, detail.rowId, 'jobCategory', e.target.value)} 
                                                                disabled={!canEdit}
                                                                className="w-full h-full min-h-[42px] bg-transparent outline-none px-3 py-2 text-xs font-bold text-indigo-700 transition-colors focus:bg-blue-50/50 hover:bg-slate-50/50 cursor-pointer disabled:opacity-60 appearance-none text-center"
                                                            >
                                                                <option value="CONTENT" className="bg-white">Content</option>
                                                                <option value="EDITOR" className="bg-white">Editor</option>
                                                                <option value="ANIMATION" className="bg-white">Chuyển động</option>
                                                                <option value="PUBLISHER" className="bg-white">Quản lý kênh</option>
                                                            </select>
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top relative bg-inherit group/cell">
                                                            <input 
                                                                type="number" min="0" 
                                                                value={detail.duration} 
                                                                onChange={(e) => handleUpdateRow(userRow.userId, detail.rowId, 'duration', Number(e.target.value))} 
                                                                disabled={!canEdit}
                                                                className="w-full h-full min-h-[42px] bg-transparent outline-none px-3 py-2 text-xs font-black text-amber-600 text-center transition-colors focus:bg-blue-50/50 hover:bg-slate-50/50 disabled:opacity-60" 
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top relative bg-inherit group/cell">
                                                            <input 
                                                                type="number" min="1" 
                                                                value={detail.count} 
                                                                onChange={(e) => handleUpdateRow(userRow.userId, detail.rowId, 'count', Number(e.target.value))} 
                                                                disabled={!canEdit}
                                                                className="w-full h-full min-h-[42px] bg-transparent outline-none px-3 py-2 text-sm font-black text-orange-600 text-center transition-colors focus:bg-blue-50/50 hover:bg-slate-50/50 disabled:opacity-60" 
                                                            />
                                                        </td>
                                                        <td className={`border border-slate-200 p-0 align-top text-center sticky right-0 z-10 shadow-[-1px_0_0_0_#e2e8f0] group/cell ${rowBgClass}`}>
                                                            {canEdit ? (
                                                                <button 
                                                                    onClick={() => handleRemoveRow(userRow.userId, detail.rowId)} 
                                                                    className="w-full h-full min-h-[42px] text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
                                                                    title="Xóa dòng này"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            ) : (
                                                                <div className="w-full h-full min-h-[42px] flex items-center justify-center text-slate-300">-</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}

                                                {showAddRow && detailsCount > 0 && (
                                                    <tr className={`${rowBgClass} hover:bg-slate-100/50 transition-colors`}>
                                                        <td colSpan={5} className="border border-slate-200 p-0 align-middle bg-inherit">
                                                            <button 
                                                                onClick={() => handleAddRow(userRow.userId, userRow.userRole)} 
                                                                className="w-full h-[38px] px-3 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition-colors flex items-center justify-start gap-1.5"
                                                            >
                                                                <Plus size={14} strokeWidth={2.5} /> Thêm dòng cho {userRow.userFullName}
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

            {/* 🚀 THANH PHÂN TRANG CỐ ĐỊNH Ở ĐÁY BẢNG */}
            {!isLoading && surplusData.length > 0 && (
                <div className="p-3 md:p-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
                    <span className="text-[10px] md:text-sm text-slate-500 font-medium hidden sm:inline">
                        Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, surplusData.length)}</span> / <span className="font-bold text-slate-800">{surplusData.length}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium sm:hidden">
                        Tổng: <span className="font-bold text-slate-800">{surplusData.length}</span>
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

            <datalist id="channel-suggestions">
                {channels.map((c: any) => <option key={c.id} value={c.name} />)}
            </datalist>
            
        </div>
    );
}