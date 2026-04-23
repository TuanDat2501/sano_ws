"use client";

import { X, Loader2, Youtube, Check, Edit3, Info, Calendar, Users, Shield, FolderKanban, Plus, UserPlus, UserCheck } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";

export default function ChannelFormDrawer({
    isOpen,
    onClose,
    editingId,
    isSubmitting,
    formData,
    setFormData,
    handleSubmit,
    teams,
    allUsers = [] // 🚀 Nhận thêm danh sách toàn bộ user từ page.tsx
}: any) {
    const [mounted, setMounted] = useState(false);
    const [isEditMode, setIsEditMode] = useState(!editingId);
    
    // Quản lý Tab ở chế độ xem
    const [activeTab, setActiveTab] = useState("tong-quan");

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (isOpen) {
            setIsEditMode(!editingId);
            setActiveTab("tong-quan"); // Reset về tab tổng quan khi mở
        }
    }, [isOpen, editingId]);

    const selectedTeam = teams.find((t: any) => t.id === formData.teamId);
    
    // 🚀 LOGIC LỌC NHÂN SỰ CHỈ THUỘC TEAM ĐÃ CHỌN
    const teamMembers = useMemo(() => {
        if (!formData.teamId || !allUsers) return [];
        return allUsers.filter((u: any) => u.teamId === formData.teamId);
    }, [formData.teamId, allUsers]);

    // 🚀 HÀM XỬ LÝ CHỌN/BỎ CHỌN NHÂN SỰ
    const toggleMember = (userId: string) => {
        const currentMembers = [...(formData.members || [])];
        const index = currentMembers.findIndex(m => m.userId === userId);

        if (index > -1) {
            currentMembers.splice(index, 1); // Đã có -> Bỏ chọn
        } else {
            currentMembers.push({ userId, roleOnChannel: "EDITOR" }); // Chưa có -> Chọn (Mặc định Editor)
        }
        setFormData({ ...formData, members: currentMembers });
    };

    // 🚀 HÀM CẬP NHẬT VAI TRÒ NHÂN SỰ
    const updateMemberRole = (userId: string, role: string) => {
        const currentMembers = (formData.members || []).map((m: any) => 
            m.userId === userId ? { ...m, roleOnChannel: role } : m
        );
        setFormData({ ...formData, members: currentMembers });
    };

    const mockStats = {
        subs: "1.240.000",
        views: "15.4M",
        revenue: "$4,500",
        videos: "342",
        createdAt: "20/05/2022",
        manager: "Lê Văn A"
    };

    const mockProjects = [
        { id: "p1", name: "Series Phân Tích Boruto Two Blue Vortex", status: "HOAT_DONG", videos: 12 },
        { id: "p2", name: "Tóm Tắt Nhanh One Piece Arc Egghead", status: "HOAT_DONG", videos: 45 },
        { id: "p3", name: "Review Manga Kinh Dị", status: "DUNG_HOAT_DONG", videos: 8 }
    ];

    const drawerContent = (
        <>
            {isOpen && (
                <div className="fixed inset-0 z-[99998] bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            )}

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] md:w-[650px] lg:w-[750px] bg-slate-50 shadow-2xl z-[99999] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <button onClick={onClose} className="absolute top-4 md:top-6 right-4 md:right-6 z-50 p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-200 transition-all active:scale-90">
                    <X size={20} />
                </button>

                {/* =======================================================
                    CHẾ ĐỘ 1: XEM HỒ SƠ KÊNH
                ======================================================= */}
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
                                    <h3 className="text-xl md:text-2xl font-black text-slate-900">{formData.name}</h3>
                                    <a href={formData.link} target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 mt-0.5 inline-block transition-colors">
                                        {formData.link || "youtube.com/@..."}
                                    </a>
                                    
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mt-3.5">
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

                                <button onClick={() => setIsEditMode(true)} className="absolute top-0 right-0 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Chỉnh sửa kênh">
                                    <Edit3 size={20} />
                                </button>
                            </div>
                        </div>

                        {/* 🚀 THANH ĐIỀU HƯỚNG 3 TABS */}
                        <div className="flex px-6 md:px-8 border-b border-slate-200 bg-white shrink-0 overflow-x-auto hide-scrollbar">
                            <button onClick={() => setActiveTab("tong-quan")} className={`px-5 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === "tong-quan" ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                                Tổng quan
                            </button>
                            <button onClick={() => setActiveTab("du-an")} className={`px-5 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "du-an" ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                                Dự án (Series) <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{mockProjects.length}</span>
                            </button>
                            <button onClick={() => setActiveTab("nhan-su")} className={`px-5 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === "nhan-su" ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                                Nhân sự <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{formData.members?.length || 0}</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8">
                            
                            {/* TAB 1: TỔNG QUAN */}
                            {activeTab === "tong-quan" && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white rounded-[24px] p-6 md:p-8 shadow-sm border border-slate-100">
                                        <div className="space-y-6 md:space-y-8">
                                            <div className="flex flex-col md:flex-row md:items-center border-b border-slate-100 pb-5 md:pb-6 gap-2 md:gap-0">
                                                <div className="w-full md:w-1/3 text-sm font-medium text-slate-500 flex items-center gap-2"><Info size={16} className="text-slate-400"/> Chủ đề</div>
                                                <div className="w-full md:w-2/3 text-base md:text-lg font-black text-slate-800">{formData.topic || "Chưa phân loại"}</div>
                                            </div>
                                            <div className="flex flex-col md:flex-row md:items-center border-b border-slate-100 pb-5 md:pb-6 gap-2 md:gap-0">
                                                <div className="w-full md:w-1/3 text-sm font-medium text-slate-500 flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> Ngày tạo</div>
                                                <div className="w-full md:w-2/3 text-base md:text-lg font-black text-slate-800">{mockStats.createdAt}</div>
                                            </div>
                                            <div className="flex flex-col md:flex-row md:items-center border-b border-slate-100 pb-5 md:pb-6 gap-2 md:gap-0">
                                                <div className="w-full md:w-1/3 text-sm font-medium text-slate-500 flex items-center gap-2"><Users size={16} className="text-slate-400"/> Đội ngũ sở hữu</div>
                                                <div className="w-full md:w-2/3 text-base md:text-lg font-black text-slate-800">{selectedTeam?.name || "Chưa phân Team"}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: DỰ ÁN */}
                            {activeTab === "du-an" && (
                                <div className="animate-fade-in space-y-4">
                                    {mockProjects.map(proj => (
                                        <div key={proj.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-blue-300 transition-colors cursor-pointer">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                    <FolderKanban size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{proj.name}</h4>
                                                    <div className="flex items-center gap-4 mt-1.5">
                                                        <span className="text-[11px] font-medium text-slate-500">{proj.videos} Videos</span>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${proj.status === 'HOAT_DONG' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {proj.status === 'HOAT_DONG' ? 'Đang chạy' : 'Đã đóng'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button className="text-sm font-bold text-slate-400 hover:text-blue-600 whitespace-nowrap self-start md:self-center">Xem chi tiết &rarr;</button>
                                        </div>
                                    ))}
                                    <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                                        <Plus size={18} /> Mở dự án mới cho Kênh này
                                    </button>
                                </div>
                            )}

                            {/* 🚀 TAB 3: NHÂN SỰ KÊNH (CHẾ ĐỘ XEM) */}
                            {activeTab === "nhan-su" && (
                                <div className="animate-fade-in space-y-3">
                                    {(!formData.members || formData.members.length === 0) ? (
                                        <div className="text-center p-8 text-slate-400 text-sm font-medium border-2 border-dashed rounded-2xl">
                                            Chưa có nhân sự nào được gán vào kênh này.
                                        </div>
                                    ) : (
                                        formData.members.map((m: any) => {
                                            const user = allUsers.find((u: any) => u.id === m.userId);
                                            return (
                                                <div key={m.userId} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        {user?.avatarUrl ? (
                                                            <img src={user.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt="" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">{user?.fullName?.charAt(0) || "?"}</div>
                                                        )}
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

                {/* =======================================================
                    CHẾ ĐỘ 2: SỬA / THÊM MỚI KÊNH (CÓ CHỌN NHÂN SỰ)
                ======================================================= */}
                {isEditMode && (
                    <div className="flex flex-col h-full animate-fade-in bg-white">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center bg-slate-50/50 shrink-0 pt-10 md:pt-8">
                            <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
                                <Youtube size={26} className="text-red-600"/> 
                                {editingId ? "Cập nhật Kênh" : "Thêm Kênh Mới"}
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                            <form id="channelForm" onSubmit={handleSubmit} className="flex flex-col h-full space-y-5 md:space-y-6">
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Tên Kênh <span className="text-red-500">*</span></label>
                                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-bold outline-none focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 transition-all text-slate-900" placeholder="VD: BeastLore Anime" />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Link YouTube</label>
                                        <input value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-medium outline-none focus:border-red-500 focus:bg-white transition-all text-slate-900" placeholder="https://youtube.com/@..." />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Link Avatar Kênh</label>
                                        <input value={formData.avatarUrl} onChange={e => setFormData({...formData, avatarUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-900" placeholder="https://i.pravatar.cc/150?img=..." />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Chủ đề / Topic</label>
                                    <input value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-medium outline-none focus:border-red-500 focus:bg-white transition-all text-slate-900" placeholder="VD: Tóm tắt Anime" />
                                </div>

                                <hr className="border-slate-100 my-2" />

                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 inline-block">Team Sở Hữu <span className="text-red-500">*</span></label>
                                    <select 
                                        required 
                                        value={formData.teamId} 
                                        onChange={e => setFormData({...formData, teamId: e.target.value, members: []})} // Reset members khi đổi team
                                        className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-sm md:text-base font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900 cursor-pointer"
                                    >
                                        <option value="">-- Chọn Team để hiện danh sách nhân sự --</option>
                                        {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                {/* 🚀 KHU VỰC CHỌN NHÂN SỰ TEAM */}
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
                                                        <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all bg-white ${isSelected ? 'border-red-200 shadow-sm' : 'border-slate-100 opacity-70 hover:opacity-100 cursor-pointer'}`}  onClick={() => toggleMember(user.id)}>
                                                            <div className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
                                                                <button type="button"  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
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
                            <button type="button" onClick={() => editingId ? setIsEditMode(false) : onClose()} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 md:py-4 rounded-2xl transition-all text-sm md:text-base">Hủy</button>
                            <button type="submit" form="channelForm" disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 md:py-4 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 shadow-xl shadow-red-600/20 text-sm md:text-base">
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