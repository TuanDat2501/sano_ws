"use client";

import { Eye, Target, TrendingUp, AlertCircle, X, Plus, Trash2, CheckCircle2, Loader2, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// ========================================================
// 🚀 COMPONENT MODAL: THIẾT LẬP KPI CHI TIẾT (LARK STYLE)
// ========================================================
const TargetSettingModal = ({ isOpen, onClose, user, onSave }: any) => {
    const [mounted, setMounted] = useState(false);
    const [mode, setMode] = useState<'CHUNG' | 'CHI_TIET'>(user?.targetDetails?.length > 0 ? 'CHI_TIET' : 'CHUNG');
    const [generalTarget, setGeneralTarget] = useState<number | string>(user?.targetValue || 0);
    const [details, setDetails] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen && user) {
            setGeneralTarget(user.targetValue || 0);
            setMode(user.targetDetails?.length > 0 ? 'CHI_TIET' : 'CHUNG');
            
            if (user.targetDetails?.length > 0) {
                setDetails(user.targetDetails.map((d: any, idx: number) => ({ ...d, id: Date.now() + idx })));
            } else {
                setDetails([{ id: Date.now(), channelId: "", channelName: "", duration: 10, isRework: false, targetCount: 1 }]);
            }

            // Tải danh sách Kênh để chọn
            fetch("/api/channels").then(res => res.json()).then(data => {
                setChannels(Array.isArray(data) ? data : []);
                setIsLoading(false);
            });
        }
    }, [isOpen, user]);

    if (!isOpen || !mounted || !user) return null;

    const handleAddRow = () => {
        setDetails([...details, { id: Date.now(), channelId: "", channelName: "", duration: 10, isRework: false, targetCount: 1 }]);
    };

    const handleRemoveRow = (id: number) => {
        setDetails(details.filter(d => d.id !== id));
    };

    const handleChangeRow = (id: number, field: string, value: any) => {
        setDetails(details.map(d => {
            if (d.id === id) {
                const newData = { ...d, [field]: value };
                if (field === 'channelId') {
                    const c = channels.find(x => x.id === value);
                    if (c) newData.channelName = c.name;
                }
                return newData;
            }
            return d;
        }));
    };

    const handleSave = () => {
        if (mode === 'CHUNG') {
            const num = Number(generalTarget);
            onSave(user.userId, isNaN(num) ? 0 : num, []);
        } else {
            const cleanDetails = details.filter(d => Number(d.targetCount) > 0);
            const total = cleanDetails.reduce((sum, d) => sum + Number(d.targetCount), 0);
            onSave(user.userId, total, cleanDetails);
        }
        onClose();
    };

    const totalDetailCount = details.reduce((sum, d) => sum + Number(d.targetCount || 0), 0);

    const modalContent = (
        <>
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100000] animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl pointer-events-auto flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
                    
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Target className="text-blue-600" /> Gán KPI Chỉ Tiêu
                            </h2>
                            <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2">
                                Nhân sự: <span className="text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded">{user.fullName}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                        {/* TABS */}
                        <div className="flex p-1 bg-slate-100 rounded-xl mb-6 w-fit border border-slate-200 shadow-inner">
                            <button 
                                onClick={() => setMode('CHUNG')} 
                                className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${mode === 'CHUNG' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Giao Nhanh (Tổng)
                            </button>
                            <button 
                                onClick={() => setMode('CHI_TIET')} 
                                className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${mode === 'CHI_TIET' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Giao Chi Tiết
                            </button>
                        </div>

                        {mode === 'CHUNG' ? (
                            <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl animate-fade-in flex flex-col items-center justify-center py-10">
                                <label className="text-sm font-black text-blue-800 uppercase tracking-widest mb-4">Tổng số lượng Video / Tuần</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    className="w-32 text-center text-3xl font-black text-blue-600 bg-white border-2 border-blue-200 rounded-2xl py-3 shadow-inner focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                                    value={generalTarget}
                                    onChange={e => setGeneralTarget(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs font-bold text-blue-500 mt-4 italic">* Không phân biệt Kênh hay Bài mới / cũ</p>
                            </div>
                        ) : (
                            <div className="animate-fade-in flex flex-col gap-4">
                                {isLoading ? (
                                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                                ) : (
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left bg-white">
                                            <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                                <tr>
                                                    <th className="p-3">Thuộc Kênh</th>
                                                    <th className="p-3 w-[100px] text-center">Phút</th>
                                                    <th className="p-3 w-[140px] text-center">Loại Bài</th>
                                                    <th className="p-3 w-[100px] text-center">Số lượng</th>
                                                    <th className="p-3 w-[50px] text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {details.map((d, index) => (
                                                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-2">
                                                            <select 
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                                                                value={d.channelId}
                                                                onChange={e => handleChangeRow(d.id, 'channelId', e.target.value)}
                                                            >
                                                                <option value="">-- Dùng Chung --</option>
                                                                {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" min="0" 
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-black text-center text-amber-600 outline-none focus:border-blue-500"
                                                                value={d.duration}
                                                                onChange={e => handleChangeRow(d.id, 'duration', Number(e.target.value))}
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <select 
                                                                className={`w-full border rounded-lg p-2 text-xs font-black outline-none focus:border-blue-500 ${d.isRework ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}
                                                                value={d.isRework ? "true" : "false"}
                                                                onChange={e => handleChangeRow(d.id, 'isRework', e.target.value === "true")}
                                                            >
                                                                <option value="false">✨ BÀI MỚI</option>
                                                                <option value="true">♻️ BÀI CŨ (XÀO)</option>
                                                            </select>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" min="1" 
                                                                className="w-full bg-white border-2 border-blue-200 rounded-lg p-2 text-sm font-black text-center text-blue-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                                value={d.targetCount}
                                                                onChange={e => handleChangeRow(d.id, 'targetCount', Number(e.target.value))}
                                                            />
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button onClick={() => handleRemoveRow(d.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="p-3 bg-slate-50 flex items-center justify-between border-t border-slate-200">
                                            <button onClick={handleAddRow} className="text-xs font-bold text-blue-600 bg-blue-100/50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                                <Plus size={14} /> Thêm dòng
                                            </button>
                                            <div className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                                Tổng quy đổi: <span className="text-lg font-black text-blue-600 bg-blue-100 px-3 py-0.5 rounded-lg border border-blue-200">{totalDetailCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm">Hủy bỏ</button>
                        <button onClick={handleSave} className="px-6 py-2.5 rounded-xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/30 flex items-center gap-2 active:scale-95">
                            <CheckCircle2 size={18} /> Chốt Chỉ Tiêu
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(modalContent, document.body);
};


export default function KpiTeamTable({
    kpiList,
    handleUpdateTarget,
    onRowClick,
    isLoading,
    teamId,
    year,
    month
}: any) {
    const [editingUser, setEditingUser] = useState<any>(null);

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-50/50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Đang tải dữ liệu KPI...</p>
                </div>
            </div>
        );
    }

    if (!kpiList || kpiList.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-50/50">
                <div className="text-center flex flex-col items-center gap-3">
                    <AlertCircle className="w-12 h-12 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">Chưa có dữ liệu KPI cho bộ lọc này.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="w-full h-full overflow-auto custom-scrollbar bg-white">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-slate-100 text-[10px] md:text-[11px] uppercase font-black text-slate-500 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                        <tr>
                            <th className="border border-slate-200 p-3 text-center sticky left-0 bg-slate-200 z-40 w-[50px] shadow-[1px_0_0_0_#e2e8f0]">STT</th>
                            <th className="border border-slate-200 p-3 sticky left-[50px] bg-slate-200 z-40 w-[250px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Nhân sự</th>
                            
                            <th className="border border-slate-200 p-3 w-[120px] text-center">Team</th>
                            <th className="border border-slate-200 p-3 w-[120px] text-center">Vai trò</th>
                            
                            <th className="border border-slate-200 p-3 w-[140px] text-center text-blue-700 bg-blue-50/50">Chỉ tiêu (Target)</th>
                            <th className="border border-slate-200 p-3 w-[140px] text-center text-emerald-700 bg-emerald-50/50">Đã làm (Actual)</th>
                            <th className="border border-slate-200 p-3 w-[140px] text-center text-purple-700 bg-purple-50/50">Tiến độ (%)</th>
                            
                            <th className="border border-slate-200 p-3 text-center sticky right-0 bg-slate-200 z-40 w-[100px] shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {kpiList.map((user: any, index: number) => {
                            let percentColor = "text-slate-600 bg-slate-100";
                            if (user.percent >= 100) percentColor = "text-emerald-700 bg-emerald-100 border-emerald-300";
                            else if (user.percent >= 80) percentColor = "text-blue-700 bg-blue-100 border-blue-300";
                            else if (user.percent >= 50) percentColor = "text-amber-700 bg-amber-100 border-amber-300";
                            else if (user.percent > 0) percentColor = "text-rose-700 bg-rose-100 border-rose-300";

                            return (
                                <tr 
                                    key={user.userId} 
                                    className="transition-colors group odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/40 cursor-pointer"
                                    onClick={() => onRowClick(user.userId)}
                                >
                                    <td className="border border-slate-200 p-3 text-center font-bold text-slate-400 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] bg-inherit align-middle">
                                        {index + 1}
                                    </td>

                                    <td className="border border-slate-200 p-3 sticky left-[50px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] bg-inherit align-middle">
                                        <div className="flex items-center gap-3">
                                            {user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.fullName} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[10px] shadow-sm">
                                                    {user.fullName.charAt(0)}
                                                </div>
                                            )}
                                            <span className="font-bold text-slate-800 text-[13px] truncate">{user.fullName}</span>
                                        </div>
                                    </td>

                                    <td className="border border-slate-200 p-3 text-center align-middle bg-inherit">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
                                            {user.teamName}
                                        </span>
                                    </td>

                                    <td className="border border-slate-200 p-3 text-center align-middle bg-inherit">
                                        <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                                            {user.role}
                                        </span>
                                    </td>

                                    {/* 🚀 CỘT TARGET: CLick để mở Bảng Giao Việc Chi Tiết */}
                                    <td 
                                        className="border border-slate-200 p-2 text-center align-middle bg-inherit group/cell cursor-pointer transition-colors hover:bg-blue-50/50"
                                        onClick={(e) => { e.stopPropagation(); setEditingUser(user); }}
                                        title="Bấm để giao KPI chi tiết"
                                    >
                                        <div className="font-black text-[15px] text-blue-600 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border border-transparent group-hover/cell:border-blue-200 w-fit mx-auto bg-white shadow-sm">
                                            <Target size={14} className="opacity-60 shrink-0" />
                                            {user.targetValue > 0 ? (
                                                <div className="flex flex-col items-center leading-none gap-0.5 mt-0.5">
                                                    <span className="drop-shadow-sm leading-none">{user.targetValue}</span>
                                                    {user.targetDetails?.length > 0 && <span className="text-[8px] text-blue-500 font-bold uppercase tracking-widest bg-blue-50 px-1 rounded border border-blue-100">Chi tiết</span>}
                                                </div>
                                            ) : (
                                                <span className="text-blue-500 text-xs italic font-bold px-1">+ Gán</span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="border border-slate-200 p-3 text-center align-middle bg-inherit">
                                        <span className="font-black text-[15px] text-emerald-600 drop-shadow-sm">
                                            {user.actualValue}
                                        </span>
                                    </td>

                                    <td className="border border-slate-200 p-3 text-center align-middle bg-inherit">
                                        <span className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border shadow-sm w-[70px] ${percentColor}`}>
                                            <TrendingUp size={12} /> {user.percent}%
                                        </span>
                                    </td>

                                    <td className="border border-slate-200 p-3 text-center sticky right-0 z-20 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)] bg-inherit align-middle">
                                        <button 
                                            className="text-[10px] bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95 whitespace-nowrap shadow-md border border-slate-700 flex items-center justify-center gap-1.5 w-full"
                                        >
                                            <Eye size={12} /> Xem Log
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <TargetSettingModal 
                isOpen={!!editingUser} 
                onClose={() => setEditingUser(null)} 
                user={editingUser} 
                onSave={handleUpdateTarget} 
            />
        </>
    );
}