"use client";

import { Plus, Link as LinkIcon, Send, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function BacklogView({ backlogTasks, onQuickAdd, onPushToBoard, onDelete }: any) {
    const [quickTitle, setQuickTitle] = useState("");
    const [quickLink, setQuickLink] = useState("");
    const { data: session } = useSession();
    const handleQuickAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickTitle.trim()) return;
        onQuickAdd({ teamId: session?.user.teamId,title: quickTitle, linkContent: quickLink, status: "BACKLOG" });
        setQuickTitle("");
        setQuickLink("");
    };

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-fade-in">
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-[10px] md:text-xs uppercase font-black text-slate-500 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">STT</th>
                            <th className="px-6 py-4">Từ khóa / Tên Video (Key)</th>
                            <th className="px-6 py-4">Link Tham Khảo</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {/* 🚀 HÀNG NHẬP LIỆU NHANH (QUICK ADD) GIỐNG EXCEL */}
                        <tr className="bg-blue-50/30">
                            <td className="px-6 py-3 text-center text-blue-300 font-black">+</td>
                            <td className="px-6 py-3">
                                <form id="quickAddForm" onSubmit={handleQuickAdd}>
                                    <input autoFocus type="text" placeholder="Nhập tên video mới..." className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-3 py-2 outline-none font-bold text-slate-700 shadow-inner" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />
                                </form>
                            </td>
                            <td className="px-6 py-3">
                                <input type="text" form="quickAddForm" placeholder="https://youtube.com/..." className="w-full bg-white border border-blue-200 focus:border-blue-500 rounded-lg px-3 py-2 outline-none text-slate-600 shadow-inner" value={quickLink} onChange={e => setQuickLink(e.target.value)} />
                            </td>
                            <td className="px-6 py-3 text-right">
                                <button type="submit" form="quickAddForm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 ml-auto shadow-md shadow-blue-500/20 active:scale-95 transition-all">
                                    <Plus size={16}/> Lưu
                                </button>
                            </td>
                        </tr>

                        {/* DANH SÁCH Ý TƯỞNG ĐÃ LƯU */}
                        {backlogTasks.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Kho ý tưởng đang trống. Hãy nhập thêm!</td></tr>
                        ) : (
                            backlogTasks.map((task: any, idx: number) => (
                                <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{task.title}</td>
                                    <td className="px-6 py-4">
                                        {task.linkContent ? (
                                            <a href={task.linkContent} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline text-xs bg-blue-50 px-2 py-1 rounded w-max"><LinkIcon size={12}/> Link Gốc</a>
                                        ) : <span className="text-xs text-slate-400 italic">Không có</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onDelete(task.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa bỏ"><Trash2 size={16}/></button>
                                            
                                            {/* 🚀 NÚT ĐẨY SANG KANBAN */}
                                            <button onClick={() => onPushToBoard(task)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs transition-all shadow-sm">
                                                <Send size={14}/> Giao Việc
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}