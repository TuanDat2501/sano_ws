"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, ListChecks, AlertCircle, Save, Loader2, RefreshCw } from "lucide-react";
import { createPortal } from "react-dom";

interface CriteriaDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | null; // 🚀 Chỉ cần truyền ID vào là đủ
    onSave: (criteria: any) => Promise<void>;
}

export default function CriteriaDrawer({ isOpen, onClose, projectId, onSave }: CriteriaDrawerProps) {
    const [mounted, setMounted] = useState(false);
    const [groups, setGroups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false); // 🚀 State Loading cho Drawer
    const [isSaving, setIsSaving] = useState(false);
    const [projectName, setProjectName] = useState("");

    useEffect(() => { setMounted(true); }, []);

    // 🚀 LOGIC: MỖI KHI MỞ DRAWER THÌ GỌI API LẤY DATA MỚI NHẤT
    useEffect(() => {
        const fetchProjectCriteria = async () => {
            if (!isOpen || !projectId) return;

            setIsLoading(true);
            try {
                const res = await fetch(`/api/projects/${projectId}`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                
                setProjectName(data.name);

                // Kiểm tra và đổ dữ liệu criteria
                if (data.criteria) {
                    const saved = typeof data.criteria === 'string' ? JSON.parse(data.criteria) : data.criteria;
                    setGroups(saved);
                } else {
                    // Nếu dự án chưa có tiêu chuẩn thì tạo mẫu mặc định
                    setGroups([{ id: Date.now(), name: "NHÓM TIÊU CHÍ MỚI", weight: 100, standards: [""] }]);
                }
            } catch (error) {
                console.error("LỖI FETCH CRITERIA:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProjectCriteria();
    }, [isOpen, projectId]);

    if (!isOpen || !mounted) return null;

    const totalWeight = groups.reduce((sum, g) => sum + Number(g.weight || 0), 0);

    const updateGroup = (id: number, field: string, value: any) => {
        setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleSave = async () => {
        if (totalWeight !== 100) return;
        setIsSaving(true);
        await onSave(groups);
        setIsSaving(false);
    };

    const drawerContent = (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100000]" onClick={onClose} />
            <div className="fixed top-0 right-0 h-full w-full md:w-[550px] bg-white shadow-2xl z-[100001] flex flex-col animate-slide-in-right">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <ListChecks className="text-red-600" /> Sườn điểm dự án
                        </h2>
                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase truncate max-w-[300px]">
                            {isLoading ? "Đang tải dữ liệu..." : projectName}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2.5 bg-white text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 shadow-sm"><X size={20}/></button>
                </div>

                {/* Body - Hiển thị Loading hoặc Form */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                    {isLoading ? (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin text-red-600" size={40} />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang đồng bộ dữ liệu...</p>
                        </div>
                    ) : (
                        <>
                            {groups.map((group) => (
                                <div key={group.id} className="bg-white rounded-[24px] p-5 border-2 border-slate-100 relative group shadow-sm hover:shadow-md transition-all">
                                    <button 
                                        onClick={() => setGroups(groups.filter(g => g.id !== group.id))}
                                        className="absolute -top-3 -right-3 bg-white text-slate-400 hover:text-red-600 p-2 rounded-xl border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="flex gap-4 mb-5">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên nhóm / Tầng đánh giá</label>
                                            <input 
                                                className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:border-red-500 focus:bg-white transition-all"
                                                value={group.name} onChange={e => updateGroup(group.id, 'name', e.target.value.toUpperCase())}
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trọng số %</label>
                                            <input 
                                                type="number" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:border-red-500 text-center"
                                                value={group.weight} onChange={e => updateGroup(group.id, 'weight', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {group.standards.map((std: string, sIdx: number) => (
                                            <div key={sIdx} className="flex gap-2">
                                                <input 
                                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                                                    value={std}
                                                    onChange={e => {
                                                        const newStds = [...group.standards];
                                                        newStds[sIdx] = e.target.value;
                                                        updateGroup(group.id, 'standards', newStds);
                                                    }}
                                                />
                                                <button 
                                                    onClick={() => {
                                                        const newStds = group.standards.filter((_: any, i: number) => i !== sIdx);
                                                        updateGroup(group.id, 'standards', newStds);
                                                    }}
                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => updateGroup(group.id, 'standards', [...group.standards, ""])}
                                            className="w-full py-2 border-2 border-dashed border-slate-100 rounded-xl text-[10px] font-black text-blue-500 hover:bg-blue-50 transition-all uppercase"
                                        >
                                            + Thêm tiêu chí con
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button 
                                onClick={() => setGroups([...groups, { id: Date.now(), name: "", weight: 0, standards: [""] }])}
                                className="w-full border-2 border-dashed border-slate-200 p-5 rounded-[24px] text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-white transition-all font-black text-xs flex items-center justify-center gap-2 uppercase tracking-widest"
                            >
                                <Plus size={20} /> Thêm Nhóm Tầng Mới
                            </button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-white">
                    <div className={`mb-5 p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${totalWeight === 100 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                        <span className="text-xs font-black uppercase tracking-widest">Tổng tỉ trọng:</span>
                        <span className="text-xl font-black">{totalWeight}% / 100%</span>
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl active:scale-95 transition-all">Đóng</button>
                        <button 
                            onClick={handleSave}
                            disabled={totalWeight !== 100 || isSaving || isLoading}
                            className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            LƯU CẤU HÌNH
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(drawerContent, document.body);
}