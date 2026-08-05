"use client";

import { X, Loader2, Youtube, Check, Edit3, Info, Calendar, Users, Shield, FolderKanban, Plus, UserPlus, UserCheck, UploadCloud, Image as ImageIcon } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/app/component/ToastProvider"; 

export default function ChannelFormDrawer({
    isOpen,
    onClose,
    editingId,
    isSubmitting,
    formData,
    setFormData,
    handleSubmit,
    teams,
    allUsers = []
}: any) {
    const { showToast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [isEditMode, setIsEditMode] = useState(!editingId);
    const [activeTab, setActiveTab] = useState("tong-quan");
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false); 

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (isOpen) {
            setIsEditMode(!editingId);
            setActiveTab("tong-quan");
            
            if (formData.avatarUrl) {
                setPreviewImage(formData.avatarUrl);
            } else {
                setPreviewImage(null);
            }
        }
    }, [isOpen, editingId, formData.avatarUrl]);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            showToast("error", "Vui lòng chọn ảnh có dung lượng dưới 2MB");
            return;
        }

        setIsUploading(true);
        try {
            const uploadData = new FormData();
            uploadData.append("file", file);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: uploadData,
            });

            if (!res.ok) {
                throw new Error("Lỗi khi tải ảnh lên server");
            }

            const data = await res.json();
            
            if (data.url) {
                setPreviewImage(data.url); 
                setFormData({ ...formData, avatarUrl: data.url }); 
                showToast("success", "Tải ảnh lên thành công!");
            } else {
                throw new Error(data.error || "Không nhận được link ảnh");
            }

        } catch (error) {
            console.error("Upload error:", error);
            showToast("error", "Lỗi tải ảnh lên. Vui lòng thử lại!");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const selectedTeam = teams.find((t: any) => t.id === formData.teamId);
    
    const teamMembers = useMemo(() => {
        if (!formData.teamId || !allUsers) return [];
        return allUsers.filter((u: any) => u.teamId === formData.teamId);
    }, [formData.teamId, allUsers]);

    const toggleMember = (userId: string) => {
        const currentMembers = [...(formData.members || [])];
        const index = currentMembers.findIndex(m => m.userId === userId);

        if (index > -1) currentMembers.splice(index, 1);
        else currentMembers.push({ userId, roleOnChannel: "EDITOR" });
        
        setFormData({ ...formData, members: currentMembers });
    };

    const updateMemberRole = (userId: string, role: string) => {
        const currentMembers = (formData.members || []).map((m: any) => 
            m.userId === userId ? { ...m, roleOnChannel: role } : m
        );
        setFormData({ ...formData, members: currentMembers });
    };

    const mockStats = { subs: "1.240.000", views: "15.4M", revenue: "$4,500", videos: "342", createdAt: "20/05/2022", manager: "Lê Văn A" };

    const drawerContent = (
        <>
            {isOpen && <div className="fixed inset-0 z-[99998] bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>}

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[650px] lg:w-[750px] bg-slate-50 shadow-2xl z-[99999] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <button onClick={onClose} className="absolute top-4 md:top-6 right-4 md:right-6 z-50 p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-200 transition-all active:scale-90">
                    <X size={20} />
                </button>

                {!isEditMode && (
                    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
                        <div className="p-6 md:p-8 bg-white border-b border-slate-100 shrink-0 pt-16 md:pt-8">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative">
                                {formData.avatarUrl ? (
                                    <img src={formData.avatarUrl} alt={formData.name} className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-slate-50 shadow-md shrink-0" />
                                ) : (
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-100 border-4 border-white flex items-center justify-center text-3xl font-black text-slate-300 shadow-md shrink-0">
                                        {formData.name.charAt(0)}
                                    </div>
                                )}
                                
                                <div className="flex-1 text-center md:text-left mt-2">
                                    <div className="flex items-center justify-center md:justify-start gap-3">
                                        <h3 className="text-xl md:text-2xl font-black text-slate-900">{formData.name}</h3>
                                        <button onClick={() => setIsEditMode(true)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa kênh"><Edit3 size={18} /></button>
                                    </div>
                                    <a href={`https:/${formData.link}`} target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 mt-0.5 inline-block transition-colors">{formData.link || "youtube.com/@..."}</a>
                                    
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-3.5">
                                        <div className={`px-3 py-1 rounded-full border text-[10px] font-black tracking-wide flex items-center gap-1.5 shadow-sm ${formData.category === 'AI' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                            {formData.category === 'AI' ? '🤖 KÊNH AI' : '🎬 TỔNG HỢP'}
                                        </div>
                                        <div className="px-3 py-1 rounded-full border border-slate-200 text-[10px] font-black tracking-wide flex items-center gap-1.5 bg-white shadow-sm">
                                            <span className={`w-1.5 h-1.5 rounded-full ${formData.status === 'HOAT_DONG' ? 'bg-emerald-500' : formData.status === 'XAY_DUNG' ? 'bg-slate-400' : formData.status === 'CANH_BAO' ? 'bg-orange-500' : 'bg-red-500'}`}></span>
                                            <span className="text-slate-700">TRẠNG THÁI: {formData.status === 'HOAT_DONG' ? 'HOẠT ĐỘNG' : formData.status === 'XAY_DUNG' ? 'ĐANG XÂY' : formData.status === 'CANH_BAO' ? 'CẢNH BÁO' : 'BAY KÊNH'}</span>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full border text-[10px] font-black tracking-wide flex items-center gap-1.5 shadow-sm ${formData.monetization === 'DA_BAT' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600 bg-white'}`}>
                                            {formData.monetization === 'DA_BAT' && <Check size={12} strokeWidth={3} className="text-emerald-500"/>}
                                            KIẾM TIỀN: {formData.monetization === 'DA_BAT' ? 'ĐÃ BẬT' : formData.monetization === 'CHO_DUYET' ? 'ĐANG DUYỆT' : formData.monetization === 'CHUA_DAT' ? 'CHƯA ĐẠT' : 'TẮT BKT'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 🚀 ĐÃ CẬP NHẬT: Lấy trực tiếp số lượng dự án từ mảng formData.projects */}
                        <div className="flex px-6 md:px-8 border-b border-slate-200 bg-white shrink-0 overflow-x-auto hide-scrollbar">
                            <button onClick={() => setActiveTab("tong-quan")} className={`px-5 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === "tong-quan" ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>Tổng quan</button>
                            <button onClick={() => setActiveTab("du-an")} className={`px-5 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "du-an" ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>Dự án (Series) <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{formData.projects?.length || 0}</span></button>
                            <button onClick={() => setActiveTab("nhan-su")} className={`px-5 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "nhan-su" ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>Nhân sự <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{formData.members?.length || 0}</span></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8">
                            
                            {activeTab === "tong-quan" && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-slate-100">
                                        <div className="space-y-6 md:space-y-8">
                                            <div className="flex flex-col md:flex-row md:items-center border-b border-slate-100 pb-5 md:pb-6 gap-2 md:gap-0">
                                                <div className="w-full md:w-1/3 text-sm font-medium text-slate-500 flex items-center gap-2"><Info size={16} className="text-slate-400"/> Định hướng kênh</div>
                                                <div className="w-full md:w-2/3 text-base md:text-lg font-black text-slate-800">{formData.category === 'AI' ? 'Trí tuệ nhân tạo (AI)' : 'Video Tổng hợp'}</div>
                                            </div>
                                            <div className="flex flex-col md:flex-row md:items-center border-b border-slate-100 pb-5 md:pb-6 gap-2 md:gap-0">
                                                <div className="w-full md:w-1/3 text-sm font-medium text-slate-500 flex items-center gap-2"><Info size={16} className="text-slate-400"/> Chủ đề</div>
                                                <div className="w-full md:w-2/3 text-base md:text-lg font-black text-slate-800">{formData.topic || "Chưa phân loại"}</div>
                                            </div>
                                            <div className="flex flex-col md:flex-row md:items-center border-b border-slate-100 pb-5 md:pb-6 gap-2 md:gap-0">
                                                <div className="w-full md:w-1/3 text-sm font-medium text-slate-500 flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> Ngày tạo</div>
                                                <div className="w-full md:w-2/3 text-base md:text-lg font-black text-slate-800">{mockStats.createdAt}</div>
                                            </div>
                                            <div className="flex flex-col md:flex-row md:items-center pb-2 gap-2 md:gap-0">
                                                <div className="w-full md:w-1/3 text-sm font-medium text-slate-500 flex items-center gap-2"><Users size={16} className="text-slate-400"/> Đội ngũ sở hữu</div>
                                                <div className="w-full md:w-2/3 text-base md:text-lg font-black text-slate-800">{selectedTeam?.name || "Chưa phân Team"}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 🚀 ĐÃ CẬP NHẬT: Render trực tiếp mảng formData.projects */}
                            {activeTab === "du-an" && (
                                <div className="animate-fade-in space-y-4">
                                    {(!formData.projects || formData.projects.length === 0) ? (
                                        <div className="text-center p-8 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                            Kênh này hiện chưa có dự án / series nào.
                                        </div>
                                    ) : (
                                        formData.projects.map((proj: any) => (
                                            <div key={proj.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-blue-300 transition-colors cursor-pointer">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                        <FolderKanban size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{proj.name}</h4>
                                                        <div className="flex items-center gap-4 mt-1.5">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${proj.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                {proj.status === 'ACTIVE' ? 'Đang chạy' : 'Đã đóng'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <a href={`/projects?channelId=${formData.id}`} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-center">
                                        <Plus size={18} /> Đi tới Quản lý Dự án
                                    </a>
                                </div>
                            )}

                            {activeTab === "nhan-su" && (
                                <div className="animate-fade-in space-y-3">
                                    {(!formData.members || formData.members.length === 0) ? (
                                        <div className="text-center p-8 text-slate-400 text-sm font-medium border-2 border-dashed rounded-2xl">Chưa có nhân sự nào được gán vào kênh này.</div>
                                    ) : (
                                        formData.members.map((m: any) => {
                                            const user = allUsers.find((u: any) => u.id === m.userId);
                                            return (
                                                <div key={m.userId} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        {user?.avatarUrl ? <img src={user.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt="" /> : <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">{user?.fullName?.charAt(0) || "?"}</div>}
                                                        <div>
                                                            <p className="font-bold text-slate-800">{user?.fullName || "Người dùng ẩn"}</p>
                                                            <p className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded w-max uppercase font-black tracking-widest mt-1">{m.roleOnChannel}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isEditMode && (
                    <div className="flex flex-col h-full animate-fade-in bg-white">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center bg-slate-50/50 shrink-0 pt-10 md:pt-8">
                            <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
                                <Youtube size={26} className="text-red-600"/> {editingId ? "Cập nhật Kênh" : "Thêm Kênh Mới"}
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                            <form id="channelForm" onSubmit={handleSubmit} className="flex flex-col h-full space-y-5 md:space-y-6">
                                
                                <div className="flex flex-col items-center justify-center mb-2">
                                    <div className="relative group">
                                        <div 
                                            onClick={() => !isUploading && fileInputRef.current?.click()}
                                            className={`w-24 h-24 md:w-28 md:h-28 rounded-full border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all shadow-sm relative ${isUploading ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-300 cursor-pointer group-hover:border-red-500 group-hover:bg-red-50'}`}
                                        >
                                            {isUploading ? (
                                                <Loader2 size={28} className="animate-spin text-red-500" />
                                            ) : previewImage ? (
                                                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <>
                                                    <ImageIcon size={28} className="text-slate-400 group-hover:text-red-500 mb-1" />
                                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-red-500">Avatar Kênh</span>
                                                </>
                                            )}
                                        </div>
                                        
                                        {previewImage && !isUploading && (
                                            <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                <UploadCloud size={24} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleImageChange} 
                                        accept="image/png, image/jpeg, image/jpg, image/webp" 
                                        className="hidden" 
                                    />
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Click để chọn ảnh (JPG, PNG. Max 2MB)</p>
                                </div>

                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Tên Kênh <span className="text-red-500">*</span></label>
                                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-bold outline-none focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 transition-all text-slate-900" placeholder="VD: BeastLore Anime" />
                                </div>

                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Định hướng nội dung (Loại kênh) <span className="text-red-500">*</span></label>
                                    <div className="flex gap-4">
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 border rounded-2xl cursor-pointer transition-all ${formData.category === 'AI' ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                            <input type="radio" name="category" value="AI" checked={formData.category === 'AI'} onChange={() => setFormData({...formData, category: 'AI'})} className="hidden" />
                                            <span className="font-bold text-sm">🤖 Kênh AI</span>
                                        </label>
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3.5 border rounded-2xl cursor-pointer transition-all ${formData.category === 'TONG_HOP' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                            <input type="radio" name="category" value="TONG_HOP" checked={formData.category === 'TONG_HOP'} onChange={() => setFormData({...formData, category: 'TONG_HOP'})} className="hidden" />
                                            <span className="font-bold text-sm">🎬 Kênh Tổng hợp</span>
                                        </label>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Link YouTube</label>
                                        <input value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-medium outline-none focus:border-red-500 focus:bg-white transition-all text-slate-900" placeholder="https://youtube.com/@..." />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Chủ đề / Topic</label>
                                        <input value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-medium outline-none focus:border-red-500 focus:bg-white transition-all text-slate-900" placeholder="VD: Tóm tắt Anime" />
                                    </div>
                                </div>

                                <hr className="border-slate-100 my-2" />

                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Team Sở Hữu <span className="text-red-500">*</span></label>
                                    <select 
                                        required 
                                        value={formData.teamId} 
                                        onChange={e => setFormData({...formData, teamId: e.target.value, members: []})}
                                        className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900 cursor-pointer"
                                    >
                                        <option value="">-- Chọn Team để hiện danh sách nhân sự --</option>
                                        {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                {formData.teamId && (
                                    <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100 animate-slide-up">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="text-[10px] md:text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                                <Users size={16}/> Gán nhân sự Team {selectedTeam?.name}
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">{teamMembers.length} người</span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                            {teamMembers.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">Team này hiện chưa có nhân sự nào.</p>
                                            ) : (
                                                teamMembers.map((user: any) => {
                                                    const isSelected = (formData.members || []).some((m: any) => m.userId === user.id);
                                                    const memberData = (formData.members || []).find((m: any) => m.userId === user.id);

                                                    return (
                                                        <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all bg-white ${isSelected ? 'border-red-200 shadow-sm' : 'border-slate-100 opacity-70 hover:opacity-100 cursor-pointer'}`}  >
                                                            <div className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
                                                                <button type="button" onClick={() => toggleMember(user.id)}  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                                                    {isSelected ? <UserCheck size={18}/> : <UserPlus size={18}/>}
                                                                </button>
                                                                <div>
                                                                    <p className={`text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>{user.fullName}</p>
                                                                    <p className="text-[10px] text-slate-400">{user.username}</p>
                                                                </div>
                                                            </div>

                                                            {isSelected && (
                                                                <select 
                                                                    value={memberData?.roleOnChannel} 
                                                                    onChange={(e) => updateMemberRole(user.id, e.target.value)}
                                                                    className="text-[10px] font-black uppercase bg-red-50 border-transparent text-red-600 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-red-100 transition-all cursor-pointer"
                                                                >
                                                                    <option value="CONTENT">Content / Kịch bản</option>
                                                                    {formData.category === 'AI' && (
                                                                        <option value="ANIMATION">Chuyển động (AI)</option>
                                                                    )}
                                                                    <option value="EDITOR">Editor / Dựng</option>
                                                                    <option value="SEO">SEO / Up Kênh</option>
                                                                    <option value="VOICE">Voice / Thu âm</option>
                                                                    <option value="MANAGER">Quản lý Kênh</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}

                                <hr className="border-slate-100 my-2" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Tình trạng Kênh</label>
                                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-bold outline-none focus:border-orange-500 focus:bg-white transition-all text-slate-900 cursor-pointer">
                                            <option value="XAY_DUNG">Đang Xây Dựng</option>
                                            <option value="HOAT_DONG" className="text-emerald-600">Đang Hoạt Động</option>
                                            <option value="CANH_BAO" className="text-orange-600">Cảnh Báo Vi Phạm</option>
                                            <option value="BAY_KENH" className="text-red-600 line-through">Bay Kênh (Khóa)</option>
                                            <option value="DUNG_HOAT_DONG" className="text-red-600 line-through">Dừng hoạt động</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Kiếm tiền</label>
                                        <select value={formData.monetization} onChange={e => setFormData({...formData, monetization: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-900 cursor-pointer">
                                            <option value="CHUA_DAT" className="text-slate-400">Chưa Đạt Yêu Cầu</option>
                                            <option value="CHO_DUYET" className="text-indigo-600">Đang Chờ YT Duyệt</option>
                                            <option value="DA_BAT" className="text-emerald-600">💲 Đã Bật BKT</option>
                                            <option value="TAT_KIEM_TIEN" className="text-red-600">Bị Tắt BKT</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="p-4 md:p-6 lg:p-8 bg-white border-t border-slate-100 flex gap-3 md:gap-4 shrink-0">
                            <button type="button" onClick={() => editingId ? setIsEditMode(false) : onClose()} disabled={isUploading || isSubmitting} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 md:py-4 rounded-2xl transition-all text-sm md:text-base disabled:opacity-50">Hủy</button>
                            <button type="submit" form="channelForm" disabled={isSubmitting || isUploading} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 md:py-4 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 shadow-xl shadow-red-600/20 text-sm md:text-base">
                                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> {editingId ? "Lưu thay đổi" : "Lưu Kênh Mới"}</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    if (!mounted) return null;
    return createPortal(drawerContent, document.body);
}