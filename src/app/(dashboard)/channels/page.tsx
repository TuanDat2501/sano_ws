"use client";

import { useState, useEffect } from "react";
import { Youtube, Plus, ExternalLink, Edit, Trash2, ShieldAlert, Loader2, AlertCircle, Check } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import ChannelFormDrawer from "./ChannelFormDrawer";

export default function ChannelsPage() {
    const { showToast } = useToast();
    const [channels, setChannels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [teams, setTeams] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]); 

    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "", link: "", topic: "", teamId: "", avatarUrl: "", projects:[] ,
        status: "XAY_DUNG", monetization: "CHUA_DAT",
        category: "TONG_HOP", // 🚀 MỚI: Thêm category
        members: [] 
    });
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [chRes, optRes] = await Promise.all([
                fetch('/api/channels'),
                fetch('/api/channels?action=get_options')
            ]);
            
            if (!chRes.ok || !optRes.ok) throw new Error("Lỗi API");

            const channelsData = await chRes.json();
            const options = await optRes.json();

            setChannels(Array.isArray(channelsData) ? channelsData : []);
            setTeams(options.teams || []);
            setAllUsers(options.users || []); 

        } catch (error) {
            console.error("LỖI FETCH CHANNELS:", error);
            showToast("error", "Lỗi tải dữ liệu");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const url = editingId ? `/api/channels/${editingId}` : '/api/channels';
            const method = editingId ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
            });
            const data = await res.json();
            
            if (res.ok) {
                showToast("success", editingId ? "Đã cập nhật kênh!" : "Đã thêm kênh mới!");
                setIsDrawerOpen(false);
                fetchData();
            } else {
                showToast("error", data.error || "Có lỗi xảy ra");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối Server");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDrawer = (channel: any = null) => {
        if (channel) {
            setEditingId(channel.id);
            setFormData({
                name: channel.name, link: channel.link || "", topic: channel.topic || "", 
                teamId: channel.teamId, avatarUrl: channel.avatarUrl || "",
                status: channel.status, monetization: channel.monetization,
                category: channel.category || "TONG_HOP",
                members: channel.members || [],
                // 🚀 ĐÃ BỔ SUNG TRƯỜNG NÀY ĐỂ TRUYỀN DỮ LIỆU XUỐNG DRAWER
                projects: channel.projects || [] 
            });
        } else {
            setEditingId(null);
            setFormData({ 
                name: "", link: "", topic: "", teamId: teams[0]?.id || "", 
                avatarUrl: "", status: "XAY_DUNG", monetization: "CHUA_DAT",
                category: "TONG_HOP",
                members: [],
                // 🚀 TẠO MỚI THÌ CHO NÓ LÀ MẢNG RỖNG
                projects: [] 
            });
        }
        setIsDrawerOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Sếp có chắc muốn xóa kênh ${name}?`)) return;
        try {
            const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast("success", "Đã xóa kênh!");
                fetchData();
            }
        } catch (error) {
            showToast("error", "Lỗi xóa kênh");
        }
    };

    return (
        <div className="p-4 md:p-6 bg-slate-50 h-full max-h-[calc(100vh-80px)] flex flex-col overflow-hidden">
            <div className="mb-4 md:mb-6 shrink-0 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative z-10">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Youtube className="text-red-600" /> Hệ thống Kênh
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Quản lý mạng lưới YouTube Studio.</p>
                </div>
                <button onClick={() => openDrawer()} className="bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 text-sm md:text-base">
                    <Plus size={18} className="md:w-5 md:h-5" /> <span className="hidden sm:inline">Thêm Kênh</span>
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center flex-1"><Loader2 className="animate-spin text-red-500" size={32} /></div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-auto custom-scrollbar relative z-0">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                <th className="p-4 border-b border-slate-200">Thông tin Kênh</th>
                                <th className="p-4 border-b border-slate-200">Phân loại</th>
                                <th className="p-4 border-b border-slate-200">Trạng thái HĐ</th>
                                <th className="p-4 border-b border-slate-200">Kiếm tiền</th>
                                <th className="p-4 border-b border-slate-200 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        
                        <tbody>
                            {channels.map((ch) => (
                                <tr key={ch.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                    <td className="p-4 border-r border-slate-200 last:border-0">
                                        <div className="flex items-center gap-3 md:gap-4 relative group/item">
                                            {ch.avatarUrl ? (
                                                <img src={ch.avatarUrl} alt={ch.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-slate-100 shadow-inner shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-100 flex items-center justify-center text-xs md:text-base font-black text-slate-400 border border-slate-200 shadow-inner shrink-0">
                                                    {ch.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2 relative z-10 group/link">
                                                    <p className="font-black text-slate-800 text-sm md:text-base">{ch.name}</p>
                                                    {ch.link && (
                                                        <a href={`https:/${ch.link}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 active:scale-95 transition-all" title="Mở kênh YouTube"><ExternalLink size={14} className="md:w-4 md:h-4"/></a>
                                                    )}
                                                </div>
                                                <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-0.5 md:mt-1 truncate max-w-[120px] md:max-w-[180px]">{ch.topic || "Chưa phân loại"}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {/* 🚀 MỚI: Hiển thị nhãn AI hoặc Tổng Hợp */}
                                        {ch.category === 'AI' ? (
                                            <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase border border-purple-200">🤖 Kênh AI</span>
                                        ) : (
                                            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase border border-blue-200">🎬 Tổng hợp</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {ch.status === 'XAY_DUNG' && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black uppercase">Đang xây</span>}
                                        {ch.status === 'HOAT_DONG' && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-black uppercase">Hoạt động</span>}
                                        {ch.status === 'CANH_BAO' && <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-[10px] font-black uppercase flex items-center gap-1 w-max"><ShieldAlert size={12} className="shrink-0"/> Cảnh báo</span>}
                                        {ch.status === 'BAY_KENH' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-[10px] font-black uppercase line-through">Bay kênh</span>}
                                    </td>
                                    <td className="p-4">
                                        {ch.monetization === 'CHUA_DAT' && <span className="text-slate-400 text-xs font-bold">Chưa đạt</span>}
                                        {ch.monetization === 'CHO_DUYET' && <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-[10px] font-black uppercase">Đang duyệt</span>}
                                        {ch.monetization === 'DA_BAT' && <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase flex items-center gap-1 w-max shadow-[0_0_12px_rgba(16,185,129,0.3)]">💲 Đã Bật</span>}
                                        {ch.monetization === 'TAT_KIEM_TIEN' && <span className="bg-red-50 text-red-600 px-2 py-1 rounded-md text-[10px] font-black uppercase border border-red-200">Tắt BKT</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5 md:gap-2">
                                            <button onClick={() => openDrawer(ch)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors active:scale-95" title="Sửa thông tin"><Edit size={16} className="md:w-5 md:h-5"/></button>
                                            <button onClick={() => handleDelete(ch.id, ch.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-95" title="Xóa kênh"><Trash2 size={16} className="md:w-5 md:h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ChannelFormDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                editingId={editingId}
                isSubmitting={isSubmitting}
                formData={formData}
                setFormData={setFormData}
                handleSubmit={handleSubmit}
                teams={teams}
                allUsers={allUsers}
            />
        </div>
    );
}