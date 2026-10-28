import { X, UserCircle2, Briefcase, Target, Tv, Layers, Clock, Users, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/app/component/ToastProvider";

const translateRole = (role: string) => {
    if (!role) return "";
    const r = String(role).toUpperCase();
    switch (r) {
        case 'LEADER': return 'LEADER';
        case 'CHANNEL_MANAGER': 
        case 'PUBLISH':
        case 'PUBLISHER': return 'Quản Lý Kênh';
        case 'CONTENT': return 'CONTENT';
        case 'EDIT':
        case 'EDITOR': return 'EDITOR';
        case 'ANIMATOR':
        case 'ANIMATION': return 'Chuyển Động';
        default: return role;
    }
};

export default function OrgNodeDrawer({ 
    isOpen, onClose, nodeData, year, month, week, onRefresh 
}: { 
    isOpen: boolean, onClose: () => void, nodeData: any, year: number, month: number, week: number, onRefresh: () => void 
}) {
    const { showToast } = useToast();
    const [mounted, setMounted] = useState(false);
    
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [selectedUserInGroup, setSelectedUserInGroup] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"info" | "surplus">("info");
    
    const [allSurplusData, setAllSurplusData] = useState<any[]>([]); 
    const [surplusForms, setSurplusForms] = useState<any[]>([]);
    
    const [isSavingSurplus, setIsSavingSurplus] = useState(false);
    const [isLoadingSurplus, setIsLoadingSurplus] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!isOpen) return;

        if (nodeData?.nodeId !== currentNodeId) {
            setCurrentNodeId(nodeData?.nodeId || null);
            setActiveTab("info"); 
            if (nodeData?.isGroup && nodeData.users?.length > 0) {
                setSelectedUserInGroup(nodeData.users[0]);
            } else {
                setSelectedUserInGroup(null);
            }
        } else {
            if (nodeData?.isGroup && nodeData.users?.length > 0) {
                if (selectedUserInGroup) {
                    const updatedUser = nodeData.users.find((u: any) => u.id === selectedUserInGroup.id);
                    setSelectedUserInGroup(updatedUser || nodeData.users[0]);
                }
            }
        }
    }, [nodeData, isOpen, currentNodeId]);

    const activeData = nodeData?.isGroup ? (selectedUserInGroup ? {
            ...selectedUserInGroup, label: selectedUserInGroup.fullName, role: nodeData.role, fullUserObj: selectedUserInGroup.fullUserObj
        } : null) : nodeData;

    const activeUserId = activeData?.id || activeData?.fullUserObj?.id;
    const activeUserRole = activeData?.role;
    
    const fallbackChannelName = activeData?.targetDetails?.[0]?.channelName || "";
    const defaultChannelName = nodeData?.resolvedChannelName || activeData?.channelName || fallbackChannelName || "";

    useEffect(() => {
        if (activeTab === "surplus" && activeUserId) {
            setIsLoadingSurplus(true);
            fetch(`/api/org-chart/surplus?userId=${activeUserId}&year=${year}&month=${month}&week=${week}`)
                .then(res => res.json())
                .then(resData => {
                    const rawData = resData.data || [];
                    setAllSurplusData(rawData); 

                    let currentChannelData = rawData;
                    if (defaultChannelName) {
                        currentChannelData = rawData.filter((r: any) => 
                            r.channelName?.trim().toLowerCase() === defaultChannelName.trim().toLowerCase()
                        );
                    }

                    if (currentChannelData.length > 0) {
                        setSurplusForms(currentChannelData.map((r: any) => ({ 
                            ...r, 
                            channelName: r.channelName || defaultChannelName, 
                            id: Math.random().toString(36).substr(2, 9) 
                        })));
                    } else {
                        setSurplusForms([{ id: "1", channelName: defaultChannelName, jobCategory: activeUserRole || "EDITOR", duration: 10, count: 1 }]);
                    }
                    setIsLoadingSurplus(false);
                })
                .catch(err => {
                    console.error("Lỗi lấy dữ liệu bài dư:", err);
                    setSurplusForms([{ id: "1", channelName: defaultChannelName, jobCategory: activeUserRole || "EDITOR", duration: 10, count: 1 }]);
                    setIsLoadingSurplus(false);
                });
        }
    }, [activeTab, activeUserId, year, month, week, defaultChannelName, activeUserRole]);

    if (!nodeData) return null;

    const targetDetails = activeData?.targetDetails || []; 

    const handleAddSurplusRow = () => {
        setSurplusForms([...surplusForms, { 
            id: Math.random().toString(36).substr(2, 9), 
            channelName: defaultChannelName, 
            jobCategory: activeUserRole || "EDITOR", 
            duration: 10, count: 1 
        }]);
    };

    const handleRemoveSurplusRow = (id: string) => {
        setSurplusForms(surplusForms.filter(f => f.id !== id));
    };

    const handleUpdateSurplus = (id: string, field: string, value: any) => {
        setSurplusForms(surplusForms.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const handleSaveSurplus = async () => {
        if (!activeUserId) return;
        setIsSavingSurplus(true);
        try {
            let otherChannelData: any[] = [];
            if (defaultChannelName) {
                otherChannelData = allSurplusData.filter((r: any) => 
                    r.channelName?.trim().toLowerCase() !== defaultChannelName.trim().toLowerCase()
                );
            }

            const currentFormsPayload = surplusForms.map(f => ({
                channelName: f.channelName,
                jobCategory: f.jobCategory,
                duration: Number(f.duration) || 0,
                count: Number(f.count) || 0
            }));

            const finalPayload = [...otherChannelData, ...currentFormsPayload];

            const res = await fetch('/api/org-chart/surplus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: activeUserId, 
                    year: year, 
                    month: month, 
                    week: week, 
                    surplusData: finalPayload 
                })
            });

            if (res.ok) {
                showToast("success", "Đã lưu số liệu bài dư thành công!");
                setAllSurplusData(finalPayload); 
                if (onRefresh) onRefresh(); 
            } else {
                showToast("error", "Lỗi khi lưu bài dư.");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối đến máy chủ.");
        } finally {
            setIsSavingSurplus(false);
        }
    };
    
    const drawerContent = (
        <>
            {isOpen && <div className="fixed inset-0 z-[99998] bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>}
            
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[600px] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 shrink-0">
                    <div className="flex gap-3 md:gap-4 items-center">
                        {!nodeData.isSystemNode && !nodeData.isGroup && (
                            nodeData.avatar ? (
                                <img src={nodeData.avatar} alt="avatar" className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white shadow-md shrink-0" />
                            ) : (
                                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-white text-lg md:text-xl border-2 border-white shadow-md shrink-0 ${nodeData.role === 'Kênh' ? 'bg-teal-500' : 'bg-slate-200 text-slate-500'}`}>
                                    {nodeData.role === 'Kênh' ? <Tv size={24} /> : (nodeData.label ? nodeData.label.charAt(0).toUpperCase() : 'U')}
                                </div>
                            )
                        )}
                        {nodeData.isGroup && (
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black bg-purple-100 text-purple-600 border-2 border-white shadow-md shrink-0">
                                <Users size={24} />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                                {nodeData.isGroup ? translateRole(nodeData.role) : nodeData.label}
                            </h2>
                            <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest mt-1 ${nodeData.textColor || 'text-purple-600'}`}>
                                {nodeData.isGroup ? `Nhóm nhân sự (${nodeData.users?.length || 0} thành viên)` : translateRole(nodeData.role)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 md:p-2.5 bg-white rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-100 transition-all active:scale-95 shrink-0">
                        <X size={18} className="md:w-5 md:h-5" />
                    </button>
                </div>

                {nodeData.isGroup && nodeData.users && (
                    <div className="px-4 py-3 bg-slate-100 flex gap-2 overflow-x-auto shrink-0 custom-scrollbar">
                        {nodeData.users.map((u: any, idx: number) => {
                            const isSelected = selectedUserInGroup?.id === u.id;
                            return (
                                <button key={idx} onClick={() => { setSelectedUserInGroup(u); setActiveTab("info"); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shadow-sm ${isSelected ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-200'}`}>
                                    {u.fullName}
                                </button>
                            );
                        })}
                    </div>
                )}

                {activeData && (
                    <div className="flex border-b border-slate-200 shrink-0 px-4 md:px-6 mt-2">
                        <button onClick={() => setActiveTab("info")} className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 ${activeTab === "info" ? "border-red-500 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                            Tổng Quan KPI
                        </button>
                        <button onClick={() => setActiveTab("surplus")} className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "surplus" ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                            Quản Lý Bài Dư
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 custom-scrollbar">
                    {activeTab === "info" && activeData && (
                        <div className="space-y-4 md:space-y-5 animate-fade-in">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Hồ sơ nhân sự</h3>
                                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                                    <UserCircle2 size={16} className="text-slate-400" /> 
                                    Họ tên: <span className="font-bold text-slate-900">{activeData.label}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                                    <Briefcase size={16} className="text-slate-400" /> 
                                    {/* 🚀 ĐÃ SỬA: Lấy teamName từ mọi cấp độ trả về của Data */}
                                    Thuộc team: <span className="font-bold text-slate-900">{activeData.fullUserObj?.teamName || activeData.fullUserObj?.team?.name || activeData.teamName || "Độc lập"}</span>
                                </div>
                            </div>

                            <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-3">
                                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1.5"><Target size={14} /> Chỉ tiêu KPI tuần này</h3>
                                {targetDetails.length > 0 ? (
                                    <div className="space-y-2">
                                        {targetDetails.map((td: any, idx: number) => (
                                            <div key={idx} className="bg-white p-3 rounded-lg border border-blue-100 flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Tv size={12} className="text-blue-500" /> {td.channelName || "Kênh chung"}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase">Khâu: <span className="font-bold text-slate-700">{translateRole(td.jobCategory)}</span></p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">{td.actualCount || 0} / {td.targetCount} bài</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{td.duration} Phút</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-slate-400 italic">Chưa có chỉ tiêu KPI.</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === "surplus" && activeData && (
                        <div className="animate-fade-in flex flex-col h-full">
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col relative min-h-[300px]">
                                
                                {isLoadingSurplus && (
                                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                        <Loader2 size={24} className="animate-spin text-orange-500 mb-2" />
                                        <span className="text-xs font-bold text-slate-500">Đang tải dữ liệu bài dư...</span>
                                    </div>
                                )}

                                <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex justify-between items-center shrink-0">
                                    <h3 className="text-xs font-black text-orange-700 uppercase tracking-widest flex items-center gap-1.5"><Layers size={14} /> Khai báo Bài Dư Tuần</h3>
                                    <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">Tổng: {surplusForms.reduce((sum, f) => sum + (Number(f.count)||0), 0)} bài</span>
                                </div>
                                
                                <div className="p-2 space-y-2 bg-slate-50/50 flex-1 overflow-y-auto">
                                    <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-2 px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div>Kênh</div><div>Khâu</div><div>Phút</div><div>SL</div><div className="w-8"></div>
                                    </div>

                                    {surplusForms.map((form) => (
                                        <div key={form.id} className="bg-white p-3 sm:p-2 sm:px-3 rounded-lg border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-3 sm:gap-2 items-end sm:items-center">
                                            
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Kênh</label>
                                                <input type="text" placeholder="Tên kênh..." value={form.channelName} onChange={(e) => handleUpdateSurplus(form.id, 'channelName', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-orange-400 transition-colors" />
                                            </div>

                                            <div>
                                                <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Khâu</label>
                                                <select value={form.jobCategory} onChange={(e) => handleUpdateSurplus(form.id, 'jobCategory', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-orange-400 transition-colors">
                                                    <option value="CONTENT">Content</option>
                                                    <option value="EDITOR">Editor</option>
                                                    <option value="ANIMATOR">Chuyển động</option>
                                                    <option value="PUBLISHER">Quản lý kênh</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Phút</label>
                                                <input type="number" min="0" value={form.duration} onChange={(e) => handleUpdateSurplus(form.id, 'duration', Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold text-slate-700 text-center outline-none focus:border-orange-400 transition-colors" />
                                            </div>

                                            <div>
                                                <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">SL</label>
                                                <input type="number" min="1" value={form.count} onChange={(e) => handleUpdateSurplus(form.id, 'count', Number(e.target.value))} className="w-full bg-orange-50 border border-orange-200 text-orange-700 rounded-md px-2 py-1.5 text-xs font-bold text-center outline-none focus:border-orange-400 transition-colors" />
                                            </div>

                                            <button onClick={() => handleRemoveSurplusRow(form.id)} className="col-span-2 sm:col-span-1 p-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-md transition-colors flex items-center justify-center h-[30px] w-full sm:w-8">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="p-3 border-t border-slate-100 bg-slate-50">
                                    <button onClick={handleAddSurplusRow} className="w-full py-2 bg-white border border-dashed border-slate-300 hover:border-orange-400 hover:text-orange-600 text-slate-500 font-bold text-xs rounded-lg flex justify-center items-center gap-1.5 transition-all">
                                        <Plus size={14} /> Thêm Dòng Bài Dư
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveSurplus}
                                disabled={isSavingSurplus || isLoadingSurplus}
                                className="w-full py-3 mt-4 bg-orange-600 hover:bg-orange-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSavingSurplus ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Lưu Dữ Liệu Bài Dư
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
    if (!mounted) return null;
    return createPortal(drawerContent, document.body);
}