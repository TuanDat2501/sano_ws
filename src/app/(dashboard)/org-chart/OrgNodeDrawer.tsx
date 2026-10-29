import { X, UserCircle2, Briefcase, Target, Tv, Layers, Users, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
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
    const [activeTab, setActiveTab] = useState<"info" | "surplus">("info");
    
    // Lưu trữ toàn bộ bài dư của Kênh (để trộn lại khi lưu)
    const [allChannelSurplus, setAllChannelSurplus] = useState<any[]>([]); 
    // Dữ liệu bài dư hiển thị trên form (Đã được lọc theo Khâu)
    const [surplusForms, setSurplusForms] = useState<any[]>([]);
    
    const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
    
    const [isSavingSurplus, setIsSavingSurplus] = useState(false);
    const [isLoadingSurplus, setIsLoadingSurplus] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!isOpen) return;

        if (nodeData?.nodeId !== currentNodeId) {
            setCurrentNodeId(nodeData?.nodeId || null);
            setActiveTab("info"); 
        }
    }, [nodeData, isOpen, currentNodeId]);
    
    const fallbackChannelName = nodeData?.isGroup 
        ? nodeData?.users?.[0]?.targetDetails?.[0]?.channelName || ""
        : nodeData?.targetDetails?.[0]?.channelName || "";

    const defaultChannelName = nodeData?.resolvedChannelName || nodeData?.channelName || fallbackChannelName || "";

    // LỌC CHÍNH XÁC KHÂU CÔNG VIỆC CỦA NODE HIỆN TẠI
    const validJobCategories = useMemo(() => {
        if (!nodeData?.role) return ["CONTENT"];
        const str = String(nodeData.role).toUpperCase();
        const valid: string[] = [];
        if (str.includes('CONTENT')) valid.push('CONTENT');
        if (str.includes('EDITOR') || str.includes('EDIT')) valid.push('EDITOR');
        if (str.includes('CHUYỂN ĐỘNG') || str.includes('ANIMAT') || str.includes('ANIMATION')) valid.push('ANIMATOR');
        if (str.includes('QUẢN LÝ KÊNH') || str.includes('PUBLISH') || str.includes('LEADER')) valid.push('PUBLISHER');
        return valid.length > 0 ? valid : ["CONTENT"];
    }, [nodeData?.role]);

    useEffect(() => {
        if (activeTab === "surplus" && defaultChannelName) {
            setIsLoadingSurplus(true);
            fetch(`/api/surplus/channel?year=${year}&month=${month}&week=${week}`)
                .then(res => res.json())
                .then(resData => {
                    const allChannels = resData.data || []; 
                    const channelData = allChannels.find((c: any) => 
                        c.channelName?.trim().toLowerCase() === defaultChannelName.trim().toLowerCase()
                    );

                    if (channelData) {
                        setCurrentChannelId(channelData.channelId);
                        const channelDetails = channelData.details || [];
                        setAllChannelSurplus(channelDetails); 

                        // CHỈ LẤY NHỮNG DÒNG BÀI DƯ THUỘC VỀ NODE NÀY
                        const nodeSpecificDetails = channelDetails.filter((d: any) => 
                            validJobCategories.includes(String(d.jobCategory).toUpperCase())
                        );

                        if (nodeSpecificDetails.length > 0) {
                            setSurplusForms(nodeSpecificDetails.map((r: any) => ({ ...r, id: Math.random().toString(36).substr(2, 9) })));
                        } else {
                            setSurplusForms([{ id: "1", jobCategory: validJobCategories[0], duration: 10, count: 1 }]);
                        }
                    } else {
                        setCurrentChannelId(null);
                        setAllChannelSurplus([]);
                        setSurplusForms([{ id: "1", jobCategory: validJobCategories[0], duration: 10, count: 1 }]);
                    }
                    setIsLoadingSurplus(false);
                })
                .catch(err => {
                    console.error("Lỗi lấy dữ liệu bài dư:", err);
                    setSurplusForms([{ id: "1", jobCategory: validJobCategories[0], duration: 10, count: 1 }]);
                    setIsLoadingSurplus(false);
                });
        }
    }, [activeTab, defaultChannelName, year, month, week, validJobCategories]);

    if (!nodeData) return null;

    const handleAddSurplusRow = () => {
        setSurplusForms([...surplusForms, { 
            id: Math.random().toString(36).substr(2, 9), 
            jobCategory: validJobCategories[0], 
            duration: 10, count: 1 
        }]);
    };

    const handleRemoveSurplusRow = (id: string) => {
        setSurplusForms(surplusForms.filter(f => f.id !== id));
    };

    const handleUpdateSurplus = (id: string, field: string, value: any) => {
        setSurplusForms(surplusForms.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    // LƯU VÀO API (GỘP KHÂU ĐANG SỬA VỚI KHÂU BỊ ẨN)
    const handleSaveSurplus = async () => {
        if (!currentChannelId) {
            showToast("error", "Kênh này không còn hoạt động hoặc không xác định!");
            return;
        }
        setIsSavingSurplus(true);
        try {
            // Tách những dữ liệu bài dư của các khâu KHÁC ra để không bị ghi đè mất
            const otherRolesSurplus = allChannelSurplus.filter(d => 
                !validJobCategories.includes(String(d.jobCategory).toUpperCase())
            );

            // Dữ liệu khâu hiện tại mà người dùng vừa sửa trên form
            const finalNodeDetails = surplusForms
                .filter(f => f.count > 0)
                .map(f => ({
                    jobCategory: f.jobCategory,
                    duration: Number(f.duration) || 0,
                    count: Number(f.count) || 0
                }));

            // Trộn lại thành payload hoàn chỉnh của toàn bộ Kênh
            const payload = [{
                channelId: currentChannelId,
                details: [...otherRolesSurplus, ...finalNodeDetails]
            }];

            const res = await fetch('/api/surplus/channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, month, week, surplusData: payload })
            });

            if (res.ok) {
                showToast("success", `Đã lưu số liệu bài dư thành công!`);
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

    // 🚀 HÀM RENDER KHỐI THÔNG TIN CÓ TÍCH HỢP AVATAR URL
    const renderUserInfo = (targets: any[], label: string, teamName: string, avatarUrl: string | null, idx: number) => (
        <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5 last:mb-0 animate-fade-in">
            {/* Header: Hồ sơ nhân sự */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={label} className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black shrink-0 border border-indigo-200 shadow-sm">
                        {label ? label.charAt(0).toUpperCase() : <UserCircle2 size={20} strokeWidth={2.5} />}
                    </div>
                )}
                
                <div>
                    <h3 className="font-black text-slate-800 text-sm md:text-base leading-tight">{label}</h3>
                    <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Briefcase size={12} className="text-slate-400" /> {teamName}
                    </p>
                </div>
            </div>

            {/* Body: Chỉ tiêu KPI */}
            <div className="p-4 bg-white">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Target size={14} className="text-blue-500" /> Chỉ tiêu KPI tuần
                </h4>
                {targets.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                        {targets.map((td: any, i: number) => (
                            <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-3 hover:border-blue-200 transition-colors group">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 group-hover:text-blue-700 transition-colors">
                                        <Tv size={13} className="text-blue-500" /> {td.channelName || "Kênh chung"}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1.5 uppercase flex items-center gap-1">
                                        Khâu: <span className="font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm">{translateRole(td.jobCategory)}</span>
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <span className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md shadow-sm border border-blue-200">
                                        {td.actualCount || 0} / {td.targetCount} bài
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {td.duration} Phút
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 font-medium italic">Chưa có chỉ tiêu KPI.</p>
                    </div>
                )}
            </div>
        </div>
    );
    
    const drawerContent = (
        <>
            {isOpen && <div className="fixed inset-0 z-[99998] bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>}
            
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[600px] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 shrink-0">
                    <div className="flex gap-3 md:gap-4 items-center">
                        {!nodeData.isSystemNode && !nodeData.isGroup && (
                            nodeData.fullUserObj?.avatarUrl ? (
                                <img src={nodeData.fullUserObj.avatarUrl} alt="avatar" className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white shadow-md shrink-0" />
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

                <div className="flex border-b border-slate-200 shrink-0 px-4 md:px-6 mt-2">
                    <button onClick={() => setActiveTab("info")} className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 ${activeTab === "info" ? "border-red-500 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                        Tổng Quan KPI
                    </button>
                    {defaultChannelName && (
                        <button onClick={() => setActiveTab("surplus")} className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "surplus" ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                            Quản Lý Bài Dư
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 custom-scrollbar">
                    {/* HIỂN THỊ KPI CHO TẤT CẢ CÁC THÀNH VIÊN TRONG NODE THEO KHUNG MỚI */}
                    {activeTab === "info" && nodeData && (
                        <div className="animate-fade-in">
                            {nodeData.isGroup ? (
                                nodeData.users.map((u: any, idx: number) => {
                                    const teamName = u.fullUserObj?.teamName || u.fullUserObj?.team?.name || u.teamName || "Độc lập";
                                    const avatar = u.fullUserObj?.avatarUrl || null;
                                    return renderUserInfo(u.targetDetails || [], u.fullName, teamName, avatar, idx);
                                })
                            ) : (
                                renderUserInfo(
                                    nodeData.targetDetails || [], 
                                    nodeData.label, 
                                    nodeData.fullUserObj?.teamName || nodeData.fullUserObj?.team?.name || nodeData.teamName || "Độc lập", 
                                    nodeData.fullUserObj?.avatarUrl || null,
                                    0
                                )
                            )}
                        </div>
                    )}

                    {activeTab === "surplus" && nodeData && (
                        <div className="animate-fade-in flex flex-col h-full">
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col relative min-h-[300px]">
                                
                                {isLoadingSurplus && (
                                    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                        <Loader2 size={24} className="animate-spin text-orange-500 mb-2" />
                                        <span className="text-xs font-bold text-slate-500">Đang tải dữ liệu bài dư...</span>
                                    </div>
                                )}

                                <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex justify-between items-center shrink-0">
                                    <h3 className="text-xs font-black text-orange-700 uppercase tracking-widest flex items-center gap-1.5"><Layers size={14} /> Bài Dư Của Node ({translateRole(nodeData.role)})</h3>
                                    <span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">{defaultChannelName}</span>
                                </div>
                                
                                <div className="p-2 space-y-2 bg-slate-50/50 flex-1 overflow-y-auto">
                                    <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div>Khâu Công Việc</div><div>Số Phút</div><div>Số Lượng</div><div className="w-8"></div>
                                    </div>

                                    {surplusForms.map((form) => (
                                        <div key={form.id} className="bg-white p-3 sm:p-2 sm:px-3 rounded-lg border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 sm:gap-2 items-end sm:items-center">
                                            
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Khâu</label>
                                                {/* CHỈ RENDER CÁC KHÂU HỢP LỆ VỚI NODE NÀY */}
                                                <select 
                                                    value={form.jobCategory} 
                                                    onChange={(e) => handleUpdateSurplus(form.id, 'jobCategory', e.target.value)} 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-orange-400 transition-colors cursor-pointer appearance-none text-center"
                                                >
                                                    {validJobCategories.includes("CONTENT") && <option value="CONTENT">✍️ Content</option>}
                                                    {validJobCategories.includes("EDITOR") && <option value="EDITOR">🎬 Editor</option>}
                                                    {validJobCategories.includes("ANIMATOR") && <option value="ANIMATOR">✨ Chuyển động</option>}
                                                    {validJobCategories.includes("PUBLISHER") && <option value="PUBLISHER">🚀 Quản lý kênh</option>}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">Phút</label>
                                                <input type="number" min="0" value={form.duration} onChange={(e) => handleUpdateSurplus(form.id, 'duration', Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-black text-amber-600 text-center outline-none focus:border-orange-400 transition-colors" />
                                            </div>

                                            <div>
                                                <label className="sm:hidden text-[10px] font-bold text-slate-400 uppercase mb-1 block">SL</label>
                                                <input type="number" min="1" value={form.count} onChange={(e) => handleUpdateSurplus(form.id, 'count', Number(e.target.value))} className="w-full bg-orange-50 border border-orange-200 text-orange-700 rounded-md px-2 py-1.5 text-xs font-black text-center outline-none focus:border-orange-400 transition-colors" />
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
                                disabled={isSavingSurplus || isLoadingSurplus || !currentChannelId}
                                className="w-full py-3 mt-4 bg-orange-600 hover:bg-orange-700 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSavingSurplus ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Cập Nhật Sơ Đồ
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