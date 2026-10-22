"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Users, CalendarDays, ClipboardList } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { useSession } from "next-auth/react"; // 🚀 ĐÃ BỔ SUNG

const EVALUATION_CRITERIA = [
    { group: "Văn hóa", name: "Tinh cam kết", maxScore: 5 },
    { group: "Văn hóa", name: "Tinh thần chia sẻ", maxScore: 5 },
    { group: "Văn hóa", name: "Khả năng thích nghi", maxScore: 5 },
    { group: "Văn hóa", name: "Thái độ - Đạo đức", maxScore: 5 },
    { group: "Văn hóa", name: "Tinh thần hòa nhập", maxScore: 5 },
    { group: "Nội quy", name: "Tuân thủ nội quy", maxScore: 5 },
    { group: "Nội quy", name: "Đúng giờ", maxScore: 5 },
    { group: "Nội quy", name: "Đi làm đầy đủ", maxScore: 5 },
    { group: "Nội quy", name: "Kỷ luật tác phong", maxScore: 5 },
    { group: "Hiệu quả", name: "Kiến thức chuyên môn", maxScore: 5 },
    { group: "Hiệu quả", name: "Chất lượng công việc", maxScore: 5 },
    { group: "Hiệu quả", name: "KPI", maxScore: 10 },
    { group: "Hiệu quả", name: "Sáng tạo đổi mới", maxScore: 5 },
    { group: "Hiệu quả", name: "Thái độ trong CV", maxScore: 5 },
    { group: "Hiệu quả", name: "Phát triển", maxScore: 10 },
    { group: "Kỹ năng mềm", name: "Kỹ năng tin học", maxScore: 2 },
    { group: "Kỹ năng mềm", name: "Kỹ năng giao tiếp", maxScore: 5 },
    { group: "Kỹ năng mềm", name: "Kỹ năng làm việc nhóm", maxScore: 5 },
    { group: "Kỹ năng mềm", name: "Lập kế hoạch báo cáo", maxScore: 3 },
];

export default function MonthlyEvaluationPage() {
    const { data: session } = useSession(); // 🚀 LẤY THÔNG TIN ĐĂNG NHẬP
    const currentUser = session?.user as any;
    
    // 🚀 PHÂN QUYỀN
    const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser?.role) || currentUser?.permissions?.includes("MENU_TEAMS");
    const isLeader = currentUser?.role === "LEADER" || currentUser?.isTeamLeader;

    const { showToast } = useToast();
    const currentDate = new Date();
    
    const [viewMode, setViewMode] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
    
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [year, setYear] = useState(currentDate.getFullYear());
    const [teamId, setTeamId] = useState("");
    const [teams, setTeams] = useState<any[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
    const [yearlyData, setYearlyData] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/teams").then(res => res.json()).then(data => {
            if (Array.isArray(data)) {
                // 🚀 NẾU LÀ LEADER -> CHỈ HIỆN TEAM CỦA HỌ VÀ TỰ ĐỘNG CHỌN
                if (!isManager && isLeader && currentUser?.teamId) {
                    setTeams(data.filter(t => t.id === currentUser.teamId));
                    setTeamId(currentUser.teamId);
                } else {
                    setTeams(data);
                }
            }
        });
    }, [currentUser, isManager, isLeader]);

    const fetchEvaluations = async () => {
        setIsLoading(true);
        try {
            if (viewMode === 'MONTHLY') {
                if (!teamId || teamId === "ALL") { setPersonnel([]); return; }
                const res = await fetch(`/api/evaluations?teamId=${teamId}&month=${month}&year=${year}&mode=monthly`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setPersonnel(data);
                const initScores: Record<string, any> = {};
                data.forEach((p: any) => { initScores[p.userId] = p.details || {}; });
                setScores(initScores);
            } else {
                const res = await fetch(`/api/evaluations?teamId=${teamId || 'ALL'}&year=${year}&mode=yearly`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setYearlyData(data);
            }
        } catch (error: any) {
            showToast("error", error.message || "Lỗi tải dữ liệu");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        if (viewMode === 'MONTHLY' && !teamId) return; 
        fetchEvaluations(); 
    }, [teamId, month, year, viewMode]);

    const handleScoreChange = (userId: string, criteriaName: string, value: string, maxScore: number) => {
        let numValue = Number(value);
        if (numValue > maxScore) numValue = maxScore;
        if (numValue < 0) numValue = 0;

        setScores(prev => ({
            ...prev,
            [userId]: { ...prev[userId], [criteriaName]: numValue }
        }));
    };

    const calculateTotal = (userId: string) => {
        const userScores = scores[userId];
        if (!userScores) return 0;
        return Object.values(userScores).reduce((sum, val) => sum + (val || 0), 0);
    };

    const determineGrade = (total: number) => {
        if (total >= 90) return "TỐT";
        if (total >= 80) return "HOÀN THÀNH";
        return "KHÔNG HOÀN THÀNH";
    };

    const handleSave = async () => {
        if (!teamId || personnel.length === 0) return;
        setIsSaving(true);
        const payload = personnel.map(p => {
            const total = calculateTotal(p.userId);
            return {
                userId: p.userId,
                totalScore: total,
                grade: determineGrade(total),
                details: scores[p.userId] || {},
                note: ""
            };
        });

        try {
            const res = await fetch("/api/evaluations", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, month, year, evaluations: payload })
            });
            if (res.ok) showToast("success", "Đã lưu bảng đánh giá thành công!");
            else showToast("error", "Lưu thất bại.");
        } catch (e) { showToast("error", "Lỗi mạng"); } 
        finally { setIsSaving(false); }
    };

    const monthsArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    return (
        <div className="h-full p-4 flex flex-col bg-slate-50 animate-fade-in">
            {/* THANH CÔNG CỤ */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shadow-inner"><Users size={20} /></div>
                    <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Đánh giá Nhân sự</h1>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                    {viewMode === 'MONTHLY' && (
                        <button onClick={handleSave} disabled={isSaving || personnel.length === 0} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20 ml-2">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu Điểm
                        </button>
                    )}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner mr-2">
                        <button 
                            onClick={() => setViewMode('MONTHLY')} 
                            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${viewMode === 'MONTHLY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <ClipboardList size={14} /> Chấm điểm Tháng
                        </button>
                        <button 
                            onClick={() => setViewMode('YEARLY')} 
                            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${viewMode === 'YEARLY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <CalendarDays size={14} /> Tổng hợp Cả năm
                        </button>
                    </div>

                    {/* 🚀 ẨN TÙY CHỌN "TẤT CẢ TEAM" NẾU CHỈ LÀ LEADER */}
                    <select 
                        className={`border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-indigo-500 ${(!isManager && isLeader) ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50'}`} 
                        value={teamId} 
                        onChange={(e) => setTeamId(e.target.value)}
                        disabled={!isManager && isLeader}
                    >
                        {isManager && <option value={viewMode === 'YEARLY' ? "ALL" : ""}>-- Tất cả Team --</option>}
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    
                    {viewMode === 'MONTHLY' && (
                        <select className="border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm bg-slate-50 outline-none focus:border-indigo-500" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                            {monthsArray.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                        </select>
                    )}
                    
                    <select className="border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm bg-slate-50 outline-none focus:border-indigo-500" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>Năm {y}</option>)}
                    </select>
                    
                    
                </div>
            </div>

            {/* VÙNG BẢNG ĐÁNH GIÁ */}
            <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col min-h-0 relative">
                {viewMode === 'MONTHLY' && !teamId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <p className="font-bold">Vui lòng chọn Phòng ban để bắt đầu đánh giá tháng</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-indigo-500"><Loader2 size={32} className="animate-spin" /></div>
                ) : viewMode === 'MONTHLY' ? (
                    <div className="flex-1 overflow-auto custom-scrollbar relative bg-white">
                        <table className="w-full text-center border-collapse text-xs md:text-sm whitespace-nowrap min-w-max relative">
                            <thead className="sticky top-0 z-50 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
                                <tr>
                                    <th className="bg-slate-200 sticky left-0 z-50 p-2 w-[100px] border border-slate-300">Phân loại</th>
                                    <th className="bg-slate-200 sticky left-[100px] z-50 p-2 w-[250px] border border-slate-300">Năng lực (Tiêu chí)</th>
                                    <th className="bg-slate-200 sticky left-[350px] z-50 p-2 w-[80px] border border-slate-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.2)]">Tối đa</th>
                                    <th colSpan={personnel.length} className="bg-[#fff2cc] text-orange-800 font-black p-2 border border-slate-300 uppercase tracking-widest text-base">
                                        DANH SÁCH THÀNH VIÊN ({teams.find(t=>t.id===teamId)?.name})
                                    </th>
                                </tr>
                                <tr>
                                    <th className="bg-slate-100 sticky left-0 z-40 border border-slate-200"></th>
                                    <th className="bg-slate-100 sticky left-[100px] z-40 border border-slate-200"></th>
                                    <th className="bg-slate-100 sticky left-[350px] z-40 border border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.2)]"></th>
                                    {personnel.map(p => (
                                        <th key={p.userId} className="p-3 bg-slate-50 border border-slate-300 font-black text-slate-800 min-w-[140px]">
                                            <div className="flex items-center justify-center gap-2">
                                                {p.avatarUrl ? (
                                                    <img src={p.avatarUrl} alt={p.fullName} className="w-6 h-6 rounded-full object-cover shadow-sm" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[9px] shadow-sm">{p.fullName.charAt(0)}</div>
                                                )}
                                                <span>{p.fullName}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    <th className="bg-slate-100 sticky left-0 z-40 border border-slate-200"></th>
                                    <th className="bg-slate-100 sticky left-[100px] z-40 border border-slate-200 text-right pr-4 text-blue-700 font-black uppercase">XẾP LOẠI:</th>
                                    <th className="bg-slate-100 sticky left-[350px] z-40 border border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.2)]"></th>
                                    {personnel.map(p => {
                                        const total = calculateTotal(p.userId);
                                        const grade = determineGrade(total);
                                        let gradeColor = "text-red-600 bg-red-50";
                                        if (grade === "TỐT") gradeColor = "text-emerald-700 bg-emerald-100";
                                        else if (grade === "HOÀN THÀNH") gradeColor = "text-blue-700 bg-blue-100";
                                        return (
                                            <th key={p.userId} className="p-2 border border-slate-300 bg-slate-50">
                                                <div className="flex flex-col gap-1 items-center justify-center">
                                                    <span className={`text-lg font-black ${total < 80 ? 'text-red-600' : 'text-slate-800'}`}>{total}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest ${gradeColor}`}>{grade}</span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {EVALUATION_CRITERIA.map((criteria, index) => {
                                    const isFirstOfGroup = index === 0 || EVALUATION_CRITERIA[index - 1].group !== criteria.group;
                                    const countInGroup = EVALUATION_CRITERIA.filter(c => c.group === criteria.group).length;
                                    return (
                                        <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                            {isFirstOfGroup && (
                                                <td rowSpan={countInGroup} className="sticky left-0 z-30 bg-white border border-slate-300 font-black text-slate-700 uppercase tracking-widest bg-slate-50/50">
                                                    {criteria.group}
                                                </td>
                                            )}
                                            <td className="sticky left-[100px] z-30 bg-white border border-slate-300 text-left px-3 py-2 font-medium text-slate-800 whitespace-normal leading-snug">
                                                {criteria.name}
                                            </td>
                                            <td className="sticky left-[350px] z-30 bg-white border border-slate-300 font-black text-slate-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                                                {criteria.maxScore}
                                            </td>
                                            {personnel.map(p => (
                                                <td key={p.userId} className="border border-slate-300 p-1 min-w-[140px]">
                                                    <input 
                                                        type="number" min="0" max={criteria.maxScore}
                                                        className="w-full h-full p-2 text-center text-sm font-bold text-slate-700 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-blue-500/50 rounded transition-all"
                                                        value={scores[p.userId]?.[criteria.name] ?? ""}
                                                        onChange={(e) => handleScoreChange(p.userId, criteria.name, e.target.value, criteria.maxScore)}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                        <table className="w-full text-center border-collapse text-xs md:text-sm whitespace-nowrap min-w-[1200px] relative">
                            <thead className="sticky top-0 z-50 bg-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.1)] font-black text-slate-600">
                                <tr>
                                    <th className="p-3 border border-slate-300 w-[50px]">STT</th>
                                    <th className="p-3 border border-slate-300 w-[200px] text-left">HỌ VÀ TÊN</th>
                                    <th className="p-3 border border-slate-300 w-[120px]">TEAM</th>
                                    {monthsArray.map(m => (
                                        <th key={m} className="p-3 border border-slate-300 w-[70px]">THÁNG {String(m).padStart(2, '0')}</th>
                                    ))}
                                    <th className="p-3 border border-slate-300 w-[120px] bg-slate-300">TRUNG BÌNH</th>
                                </tr>
                            </thead>
                            <tbody>
                                {yearlyData.length === 0 ? (
                                    <tr><td colSpan={16} className="py-10 text-slate-400 font-medium">Không có dữ liệu đánh giá trong năm.</td></tr>
                                ) : (
                                    yearlyData.map((user, idx) => {
                                        let sum = 0; let count = 0;
                                        
                                        const rowScores = monthsArray.map(m => {
                                            const score = user.monthlyScores[m];
                                            if (score !== undefined && score > 0) {
                                                sum += score;
                                                count++;
                                            }
                                            return score;
                                        });

                                        const avg = count > 0 ? (sum / count).toFixed(1) : "";

                                        let avgColor = "bg-white";
                                        const numAvg = Number(avg);
                                        if (avg) {
                                            if (numAvg >= 90) avgColor = "bg-[#00b050] text-white font-black"; 
                                            else if (numAvg >= 80) avgColor = "bg-[#c6efce] text-green-900 font-black"; 
                                            else avgColor = "bg-[#ffeb9c] text-orange-900 font-black"; 
                                        }

                                        const isFirstOfTeam = idx === 0 || yearlyData[idx - 1].teamName !== user.teamName;
                                        const teamMembersCount = yearlyData.filter((u: any) => u.teamName === user.teamName).length;

                                        return (
                                            <tr key={user.userId} className="hover:bg-blue-50/40 transition-colors odd:bg-white even:bg-slate-50/80">
                                                <td className="p-2 border border-slate-300 font-bold text-slate-500">{idx + 1}</td>
                                                <td className="p-2 border border-slate-300 text-left font-bold text-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        {user.avatarUrl ? (
                                                            <img src={user.avatarUrl} alt={user.fullName} className="w-7 h-7 rounded-full object-cover shadow-sm border border-slate-200" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[10px] shadow-sm">{user.fullName.charAt(0)}</div>
                                                        )}
                                                        <span className="truncate">{user.fullName}</span>
                                                    </div>
                                                </td>
                                                
                                                {isFirstOfTeam && (
                                                    <td 
                                                        rowSpan={teamMembersCount} 
                                                        className="p-2 border border-slate-300 text-[11px] font-black uppercase text-indigo-700 bg-white align-middle shadow-[1px_0_0_0_#cbd5e1_inset]"
                                                    >
                                                        {user.teamName}
                                                    </td>
                                                )}
                                                
                                                {rowScores.map((score, index) => (
                                                    <td key={index} className="p-2 border border-slate-300 font-bold text-slate-700">
                                                        {score > 0 ? score : ""}
                                                    </td>
                                                ))}
                                                
                                                <td className={`p-2 border border-slate-300 text-[15px] ${avgColor}`}>
                                                    {avg}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}