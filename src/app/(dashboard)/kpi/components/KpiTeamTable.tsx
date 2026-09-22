"use client";

import { Eye, Target, TrendingUp, AlertCircle, Edit2, X, Plus, Trash2, CheckCircle2, Loader2, Layers, CheckSquare, Zap, Copy, ArrowDown, Lock, Unlock, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/app/component/ToastProvider";
import { useSession } from "next-auth/react"; 

// ========================================================
// 🚀 COMPONENT MODAL: SAO CHÉP TARGET TỪ TUẦN CŨ SANG TUẦN MỚI
// ========================================================
const CopyTargetModal = ({ isOpen, onClose, onConfirm, currentMonth, currentYear }: any) => {
    const [sourceMonth, setSourceMonth] = useState(currentMonth === 1 ? 12 : currentMonth - 1 || 1);
    const [sourceWeek, setSourceWeek] = useState(4);
    const [destMonth, setDestMonth] = useState(currentMonth);
    const [destWeek, setDestWeek] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);
    if (!isOpen || !mounted) return null;

    const handleConfirm = async () => {
        setIsProcessing(true);
        await onConfirm(sourceMonth, sourceWeek, destMonth, destWeek);
        setIsProcessing(false);
        onClose();
    };

    const modalContent = (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100000] animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg pointer-events-auto flex flex-col overflow-hidden animate-scale-in border border-slate-100">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Copy className="text-indigo-600" size={20} /> Sao Chép Target KPI
                            </h2>
                            <p className="text-xs font-bold text-slate-500 mt-1">
                                Chuyển dữ liệu chỉ tiêu từ tuần này sang tuần khác
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 bg-white space-y-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative shadow-inner">
                            <span className="absolute -top-2.5 left-4 bg-slate-100 px-3 py-0.5 text-[10px] font-black text-slate-500 uppercase tracking-widest rounded-full border border-slate-200">Từ (Nguồn)</span>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Tháng</label>
                                    <select className="w-full border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-800 bg-white outline-none focus:border-indigo-500 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors" value={sourceMonth} onChange={e => setSourceMonth(Number(e.target.value))}>
                                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Tuần</label>
                                    <select className="w-full border border-slate-200 rounded-xl p-3 text-sm font-black text-slate-800 bg-white outline-none focus:border-indigo-500 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors" value={sourceWeek} onChange={e => setSourceWeek(Number(e.target.value))}>
                                        {[1,2,3,4,5].map(w => <option key={w} value={w}>Tuần {w}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center -my-3 relative z-10">
                            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full border-4 border-white shadow-sm">
                                <ArrowDown size={18} strokeWidth={3} />
                            </div>
                        </div>
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 relative shadow-sm">
                            <span className="absolute -top-2.5 left-4 bg-indigo-100 px-3 py-0.5 text-[10px] font-black text-indigo-700 uppercase tracking-widest rounded-full border border-indigo-200 shadow-sm">Đến (Đích)</span>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label className="text-[11px] font-bold text-indigo-700 block mb-1.5">Tháng</label>
                                    <select className="w-full border border-indigo-200 rounded-xl p-3 text-sm font-black text-indigo-900 bg-white outline-none focus:border-indigo-500 cursor-pointer shadow-sm focus:ring-4 focus:ring-indigo-500/10 hover:bg-slate-50 transition-colors" value={destMonth} onChange={e => setDestMonth(Number(e.target.value))}>
                                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-indigo-700 block mb-1.5">Tuần</label>
                                    <select className="w-full border border-indigo-200 rounded-xl p-3 text-sm font-black text-indigo-900 bg-white outline-none focus:border-indigo-500 cursor-pointer shadow-sm focus:ring-4 focus:ring-indigo-500/10 hover:bg-slate-50 transition-colors" value={destWeek} onChange={e => setDestWeek(Number(e.target.value))}>
                                        {[1,2,3,4,5].map(w => <option key={w} value={w}>Tuần {w}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="bg-rose-50 text-rose-700 text-xs font-medium p-3 rounded-xl border border-rose-100 flex items-start gap-2 shadow-inner">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>Lưu ý: Thao tác này sẽ ghi đè toàn bộ chỉ tiêu của các nhân sự trong Tuần Đích bằng dữ liệu từ Tuần Nguồn.</span>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm">Hủy</button>
                        <button onClick={handleConfirm} disabled={isProcessing || (sourceMonth === destMonth && sourceWeek === destWeek)} className="px-6 py-2.5 rounded-xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-500/30 flex items-center gap-2 active:scale-95 disabled:opacity-50">
                            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Copy size={18} />} Bắt đầu Copy
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
    return createPortal(modalContent, document.body);
};


// ========================================================
// 🚀 COMPONENT MODAL: THIẾT LẬP KPI CHI TIẾT CÓ GHI CHÚ
// ========================================================
const TargetSettingModal = ({ isOpen, onClose, user, onSave }: any) => {
    const [mounted, setMounted] = useState(false);
    const [mode, setMode] = useState<'CHUNG' | 'CHI_TIET'>(user?.targetDetails?.length > 0 ? 'CHI_TIET' : 'CHUNG');
    const [generalTarget, setGeneralTarget] = useState<number | string>(user?.targetValue || 0);
    const [details, setDetails] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 🚀 THÊM STATE QUẢN LÝ GHI CHÚ
    const [note, setNote] = useState(user?.note || "");

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen && user) {
            setGeneralTarget(user.targetValue || 0);
            setMode(user.targetDetails?.length > 0 ? 'CHI_TIET' : 'CHUNG');
            setNote(user.note || ""); 
            
            if (user.targetDetails?.length > 0) {
                setDetails(user.targetDetails.map((d: any, idx: number) => ({ ...d, id: Date.now() + idx })));
            } else {
                setDetails([{ id: Date.now(), channelId: "", channelName: "", duration: 10, isRework: false, targetCount: 1 }]);
            }

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
            onSave(user.userId, isNaN(num) ? 0 : num, [], note); 
        } else {
            const cleanDetails = details.filter(d => Number(d.targetCount) > 0);
            const total = cleanDetails.reduce((sum, d) => sum + Number(d.targetCount), 0);
            onSave(user.userId, total, cleanDetails, note); 
        }
        onClose();
    };

    const totalDetailCount = details.reduce((sum, d) => sum + Number(d.targetCount || 0), 0);

    const modalContent = (
        <>
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100000] animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl pointer-events-auto flex flex-col max-h-[95vh] overflow-hidden animate-scale-in">
                    
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

                    <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar flex flex-col gap-6">
                        
                        <div>
                            <div className="flex p-1 bg-slate-100 rounded-xl mb-4 w-fit border border-slate-200 shadow-inner">
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
                                <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl animate-fade-in flex flex-col items-center justify-center py-8">
                                    <label className="text-sm font-black text-blue-800 uppercase tracking-widest mb-4">Tổng số lượng Video / Tuần</label>
                                    <input 
                                        type="number" min="0"
                                        className="w-32 text-center text-3xl font-black text-blue-600 bg-white border-2 border-blue-200 rounded-2xl py-3 shadow-inner focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                                        value={generalTarget}
                                        onChange={e => setGeneralTarget(e.target.value)}
                                        autoFocus
                                    />
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

                        {/* 🚀 VÙNG NHẬP GHI CHÚ */}
                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 shadow-sm">
                            <label className="text-xs font-black text-amber-800 flex items-center gap-1.5 mb-2">
                                <FileText size={14} className="text-amber-500" /> Lý do / Ghi chú sửa đổi
                            </label>
                            <textarea 
                                rows={2}
                                placeholder="Ví dụ: Giảm target từ 10 xuống 8 do bạn N.T.A xin nghỉ ốm 2 ngày..."
                                className="w-full bg-white border border-amber-200 rounded-xl p-3 text-sm font-medium text-slate-700 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 resize-none transition-all"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>

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
    month,
    week
}: any) {
    const { data: session } = useSession(); 
    const currentUser = session?.user as any;
    const isAdminOrHR = ["ADMIN", "BAN_GIAM_DOC", "HR", "KE_TOAN"].includes(currentUser?.role) || currentUser?.permissions?.includes("MENU_TEAMS");

    const { showToast } = useToast();
    const [editingUser, setEditingUser] = useState<any>(null);
    
    const [bulkTarget, setBulkTarget] = useState("");
    const [isBulking, setIsBulking] = useState(false);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

    const [isWeekLocked, setIsWeekLocked] = useState(false);
    const [isLocking, setIsLocking] = useState(false);

    useEffect(() => {
        const locked = kpiList.some((u: any) => u.isLocked);
        setIsWeekLocked(locked);
    }, [kpiList]);

    const handleToggleLockWeek = async () => {
        if (!confirm(`Sếp có chắc chắn muốn ${isWeekLocked ? 'MỞ KHÓA' : 'KHÓA'} chỉnh sửa KPI của tuần này không?`)) return;
        setIsLocking(true);
        try {
            const res = await fetch(`/api/kpi/lock`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, year, month, weekNumber: week, isLocked: !isWeekLocked })
            });
            if (res.ok) {
                showToast("success", `Đã ${isWeekLocked ? 'mở khóa' : 'khóa'} KPI tuần!`);
                setTimeout(() => window.location.reload(), 1000);
            } else { showToast("error", "Lỗi thao tác!"); }
        } catch (error) { showToast("error", "Mất kết nối server"); } 
        finally { setIsLocking(false); }
    };

    const handleBulkAssign = async () => {
        if (isWeekLocked && !isAdminOrHR) {
            showToast("error", "Tuần này đã bị khóa KPI, không thể chỉnh sửa!");
            return;
        }

        const num = parseInt(bulkTarget);
        if (isNaN(num) || num < 0) return;
        if (!confirm(`Sếp có chắc muốn gán đồng loạt chỉ tiêu [ ${num} ] cho TẤT CẢ ${kpiList.length} nhân sự bên dưới?`)) return;

        setIsBulking(true);
        try {
            for (const user of kpiList) {
                if (user.targetValue !== num) {
                    await handleUpdateTarget(user.userId, num, [], ""); // Bulk mặc định note rỗng
                }
            }
            setBulkTarget("");
            showToast("success", "Đã gán hàng loạt xong!");
        } catch (error) { showToast("error", "Lỗi gán hàng loạt"); } 
        finally { setIsBulking(false); }
    };

    const handleCopyFromPast = async (sMonth: number, sWeek: number, dMonth: number, dWeek: number) => {
        if (isWeekLocked && !isAdminOrHR && dWeek === week && dMonth === month) {
            showToast("error", "Tuần đích đã bị khóa KPI, không thể dán đè!");
            return;
        }
        try {
            const teamQuery = teamId ? `&teamId=${teamId}` : `&teamId=ALL`;
            const res = await fetch(`/api/kpi?year=${year}&month=${sMonth}&week=${sWeek}${teamQuery}`);
            const data = await res.json();
            const pastKpis = data.kpiList || [];

            let count = 0;
            for (const pKpi of pastKpis) {
                if (pKpi.targetValue > 0) {
                    await fetch("/api/kpi", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            userId: pKpi.userId, 
                            year: year, 
                            month: dMonth, 
                            weekNumber: dWeek,
                            targetValue: pKpi.targetValue, 
                            targetDetails: pKpi.targetDetails 
                        })
                    });
                    count++;
                }
            }
            showToast("success", `Đã kéo thành công chỉ tiêu của ${count} nhân sự sang Tháng ${dMonth} Tuần ${dWeek}!`);
            
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch(e) {
            console.error(e);
            showToast("error", "Có lỗi khi sao chép dữ liệu.");
        }
    };

    if (isLoading) return <div className="h-full flex items-center justify-center bg-slate-50/50"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
    if (!kpiList || kpiList.length === 0) return <div className="h-full flex flex-col items-center justify-center bg-slate-50/50"><AlertCircle className="w-12 h-12 text-slate-300" /></div>;

    return (
        <>
            <div className="w-full h-full flex flex-col bg-white">
                <div className="shrink-0 p-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 z-20">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-lg shadow-sm"><Zap size={16} /></div>
                        <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                Gán Hàng Loạt 
                                {isWeekLocked && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1 shadow-sm"><Lock size={10}/> ĐÃ KHÓA</span>}
                            </h3>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isAdminOrHR && (
                            <button onClick={handleToggleLockWeek} disabled={isLocking} className={`font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 ${isWeekLocked ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'}`}>
                                {isLocking ? <Loader2 size={14} className="animate-spin" /> : isWeekLocked ? <Unlock size={14} /> : <Lock size={14} />}
                                {isWeekLocked ? 'Mở khóa sửa KPI' : 'Chốt KPI Tuần này'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="bg-slate-100 text-[10px] md:text-[11px] uppercase font-black text-slate-500 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                            <tr>
                                <th className="border border-slate-200 p-3 text-center sticky left-0 bg-slate-200 z-40 w-[50px] shadow-[1px_0_0_0_#e2e8f0]">STT</th>
                                <th className="border border-slate-200 p-3 sticky left-[50px] bg-slate-200 z-40 w-[220px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Nhân sự</th>
                                <th className="border border-slate-200 p-3 w-[100px] text-center">Team</th>
                                <th className="border border-slate-200 p-3 w-[100px] text-center">Vai trò</th>
                                <th className="border border-slate-200 p-3 w-[120px] text-center text-blue-700 bg-blue-50/50">Chỉ tiêu (Target)</th>
                                <th className="border border-slate-200 p-3 w-[120px] text-center text-emerald-700 bg-emerald-50/50">Đã làm (Actual)</th>
                                <th className="border border-slate-200 p-3 w-[100px] text-center text-purple-700 bg-purple-50/50">Tiến độ (%)</th>
                                <th className="border border-slate-200 p-3 w-[200px] text-center">Ghi chú sửa đổi</th>
                                <th className="border border-slate-200 p-3 text-center sticky right-0 bg-slate-200 z-40 w-[90px] shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {kpiList.map((user: any, index: number) => {
                                let percentColor = "text-slate-600 bg-slate-100";
                                if (user.percent >= 100) percentColor = "text-emerald-700 bg-emerald-100 border-emerald-300";
                                else if (user.percent >= 80) percentColor = "text-blue-700 bg-blue-100 border-blue-300";
                                else if (user.percent >= 50) percentColor = "text-amber-700 bg-amber-100 border-amber-300";
                                else if (user.percent > 0) percentColor = "text-rose-700 bg-rose-100 border-rose-300";

                                const isLockedStatus = user.isLocked;
                                const isCellBlocked = isLockedStatus && !isAdminOrHR;

                                return (
                                    <tr key={user.userId} className="transition-colors group odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/40 cursor-pointer" onClick={() => onRowClick(user.userId)}>
                                        <td className="border border-slate-200 p-3 text-center font-bold text-slate-400 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] bg-inherit align-middle">{index + 1}</td>
                                        <td className="border border-slate-200 p-3 sticky left-[50px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] bg-inherit align-middle">
                                            <div className="flex items-center gap-3">
                                                {user.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200" /> : <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[10px] shadow-sm">{user.fullName.charAt(0)}</div>}
                                                <span className="font-bold text-slate-800 text-[13px] truncate">{user.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="border border-slate-200 p-3 text-center align-middle bg-inherit"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">{user.teamName}</span></td>
                                        <td className="border border-slate-200 p-3 text-center align-middle bg-inherit"><span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">{user.role}</span></td>

                                        <td 
                                            className={`border border-slate-200 p-2 text-center align-middle bg-inherit transition-colors ${isCellBlocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer group/cell hover:bg-blue-50/50'}`}
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                if (isCellBlocked) { showToast("error", "KPI tuần này đã bị chốt!"); return; }
                                                setEditingUser(user); 
                                            }}
                                        >
                                            <div className={`font-black text-[15px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border w-fit mx-auto shadow-sm ${isLockedStatus ? 'bg-slate-100 border-slate-200' : 'text-blue-600 bg-white border-transparent group-hover/cell:border-blue-200'}`}>
                                                {isLockedStatus ? <Lock size={14} className={`shrink-0 ${isAdminOrHR ? 'text-red-500' : 'text-slate-500 opacity-60'}`} /> : <Target size={14} className="opacity-60 shrink-0" />}
                                                {user.targetValue > 0 ? (
                                                    <div className="flex flex-col items-center leading-none gap-0.5 mt-0.5">
                                                        <span className={`drop-shadow-sm leading-none ${isLockedStatus ? 'text-slate-600' : ''}`}>{user.targetValue}</span>
                                                        {user.targetDetails?.length > 0 && <span className={`text-[8px] font-bold uppercase tracking-widest px-1 rounded border ${isCellBlocked ? 'text-slate-500 bg-slate-200 border-slate-300' : 'text-blue-500 bg-blue-50 border-blue-100'}`}>Chi tiết</span>}
                                                    </div>
                                                ) : <span className={`text-xs italic font-bold px-1 ${isLockedStatus ? 'text-slate-500' : ''}`}>+ Gán</span>}
                                            </div>
                                        </td>

                                        <td className="border border-slate-200 p-3 text-center align-middle bg-inherit"><span className="font-black text-[15px] text-emerald-600 drop-shadow-sm">{user.actualValue}</span></td>
                                        <td className="border border-slate-200 p-3 text-center align-middle bg-inherit"><span className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border shadow-sm w-[70px] ${percentColor}`}><TrendingUp size={12} /> {user.percent}%</span></td>
                                        
                                        <td className="border border-slate-200 p-3 text-[11px] md:text-xs font-medium text-slate-500 align-middle bg-inherit">
                                            <div className="flex flex-col gap-1.5 text-center md:text-left items-center md:items-start">
                                                {user.oldTargetValue !== null && user.oldTargetValue !== user.targetValue && (
                                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 w-fit inline-flex items-center gap-1 shadow-sm">
                                                        Chỉ tiêu cũ: <span className="line-through opacity-70">{user.oldTargetValue}</span>
                                                    </span>
                                                )}
                                                <div className="line-clamp-3 whitespace-pre-wrap leading-snug text-center md:text-left" title={user.note}>
                                                    {user.note ? user.note : <span className="italic text-slate-300">Không có ghi chú</span>}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="border border-slate-200 p-3 text-center sticky right-0 z-20 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)] bg-inherit align-middle">
                                            <button className="text-[10px] bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95 whitespace-nowrap shadow-md border border-slate-700 flex items-center justify-center gap-1.5 w-full"><Eye size={12} /> Xem Log</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <TargetSettingModal isOpen={!!editingUser} onClose={() => setEditingUser(null)} user={editingUser} onSave={handleUpdateTarget} />
            <CopyTargetModal isOpen={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} onConfirm={handleCopyFromPast} currentMonth={month} currentYear={year} />
        </>
    );
}