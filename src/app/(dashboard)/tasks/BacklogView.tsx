"use client";

import { Plus, Link as LinkIcon, Send, Trash2, FileText, PlayCircle, Lightbulb, Tv } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";

// 🚀 THÊM prop `channels` VÀO ĐÂY
export default function BacklogView({ backlogTasks, channels, onQuickAdd, onPushToBoard, onDelete }: any) {
    const [quickTitle, setQuickTitle] = useState("");
    const [quickLink, setQuickLink] = useState("");
    const [quickChannelId, setQuickChannelId] = useState(""); // 🚀 STATE CHỨA KÊNH
    const { data: session } = useSession();
    
    const handleQuickAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickTitle.trim()) return;
        
        // 🚀 GỬI KÈM channelId LÊN API
        onQuickAdd({ 
            teamId: session?.user.teamId, 
            title: quickTitle, 
            linkContent: quickLink, 
            status: "BACKLOG",
            channelId: quickChannelId || undefined 
        });
        
        // Reset form sau khi lưu
        setQuickTitle("");
        setQuickLink("");
        setQuickChannelId("");
    };

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-fade-in">
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-[10px] md:text-xs uppercase font-black text-slate-500 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">STT</th>
                            <th className="px-6 py-4">Từ khóa / Tên Video (Key)</th>
                            <th className="px-6 py-4">Kênh</th>
                            <th className="px-6 py-4">Link Tham Khảo</th>
                            <th className="px-6 py-4 text-center">Tiến độ (Tự động)</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {/* HÀNG NHẬP LIỆU NHANH (QUICK ADD) */}
                        <tr className="bg-blue-50/30">
                            <td className="px-6 py-3 text-center text-blue-300 font-black">+</td>
                            <td className="px-6 py-3">
                                <form id="quickAddForm" onSubmit={handleQuickAdd}>
                                    <input autoFocus type="text" placeholder="Nhập tên video mới..." className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-3 py-2 outline-none font-bold text-slate-700 shadow-inner" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />
                                </form>
                            </td>
                            
                            {/* 🚀 SELECT CHỌN KÊNH TRỰC TIẾP */}
                            <td className="px-6 py-3">
                                <select 
                                    form="quickAddForm"
                                    className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-2 py-2 outline-none text-slate-600 shadow-inner text-xs font-bold"
                                    value={quickChannelId} 
                                    onChange={e => setQuickChannelId(e.target.value)}
                                >
                                    <option value="">-- Chọn Kênh --</option>
                                    {channels && channels.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </td>

                            <td className="px-6 py-3">
                                <input type="text" form="quickAddForm" placeholder="https://youtube.com/..." className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-3 py-2 outline-none text-slate-600 shadow-inner" value={quickLink} onChange={e => setQuickLink(e.target.value)} />
                            </td>
                            <td className="px-6 py-3 text-center text-xs font-bold text-slate-400 italic">Ý tưởng mới</td>
                            <td className="px-6 py-3 text-right">
                                <button type="submit" form="quickAddForm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 ml-auto shadow-md shadow-blue-500/20 active:scale-95 transition-all">
                                    <Plus size={16}/> Lưu
                                </button>
                            </td>
                        </tr>

                        {/* DANH SÁCH Ý TƯỞNG ĐÃ LƯU */}
                        {backlogTasks.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Kho ý tưởng đang trống. Hãy nhập thêm!</td></tr>
                        ) : (
                            backlogTasks.map((task: any, idx: number) => {
                                let statusBadge = (
                                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-black border border-slate-200">
                                        <Lightbulb size={12}/> Ý TƯỞNG THÔ
                                    </span>
                                );

                                if (task.videoLink) {
                                    statusBadge = (
                                        <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md text-[10px] font-black border border-purple-200 shadow-sm">
                                            <PlayCircle size={12}/> ĐÃ DỰNG XONG
                                        </span>
                                    );
                                } else if (task.scriptLink) {
                                    statusBadge = (
                                        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-black border border-amber-200 shadow-sm">
                                            <FileText size={12}/> ĐÃ CÓ KỊCH BẢN
                                        </span>
                                    );
                                }

                                return (
                                    <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{task.title}</td>
                                        
                                        <td className="px-6 py-4">
                                            {task.channel?.name ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-100 shadow-sm w-max">
                                                    <Tv size={12}/> {task.channel.name}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 italic">Chưa gán kênh</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            {task.linkContent ? (
                                                <a href={task.linkContent} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline text-xs bg-blue-50 px-2 py-1 rounded w-max"><LinkIcon size={12}/> Link Gốc</a>
                                            ) : <span className="text-xs text-slate-400 italic">Không có</span>}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-center">
                                            {statusBadge}
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onDelete(task.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa bỏ"><Trash2 size={16}/></button>
                                                
                                                <button onClick={() => onPushToBoard(task)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs transition-all shadow-sm">
                                                    <Send size={14}/> Giao Việc
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}