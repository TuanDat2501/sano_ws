"use client";

import { useState, useEffect } from "react";
import { Loader2, Activity, X, Video, FileText } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { createPortal } from "react-dom";

export default function SurplusView() {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();
    
    // 🚀 BỔ SUNG: State quản lý việc mở Drawer và lưu dữ liệu dòng được chọn
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const fetchData = async () => {
            try {
                const res = await fetch("/api/production-health");
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                } else {
                    showToast("error", "Không thể tải dữ liệu");
                }
            } catch (error) {
                showToast("error", "Lỗi máy chủ");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // 🚀 GIAO DIỆN DRAWER (Sẽ được đẩy ra ngoài bằng Portal)
    const drawerContent = selectedRow && (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99998] transition-opacity" onClick={() => setSelectedRow(null)} />
            
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[500px] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 flex flex-col ${selectedRow ? "translate-x-0" : "translate-x-full"}`}>
                
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-slate-800">Chi tiết Bài Dư</h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            Kênh: <span className="font-bold text-slate-700">{selectedRow.channelName}</span> 
                            <span className="mx-2">•</span> 
                            Thời lượng: <span className="font-bold text-slate-700">{selectedRow.videoDuration || selectedRow.contentDuration || "Không rõ"} phút</span>
                        </p>
                    </div>
                    <button onClick={() => setSelectedRow(null)} className="p-2 bg-white rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm border border-slate-200 active:scale-95">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 space-y-6 custom-scrollbar">
                    
                    {/* KHỐI CONTENT DƯ */}
                    <div>
                        <h3 className="text-[11px] font-black text-orange-600 flex items-center gap-2 mb-3 uppercase tracking-widest bg-orange-50 w-max px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">
                            <FileText size={14} /> Kịch bản / Content Dư ({selectedRow.contentCount || 0})
                        </h3>
                        {selectedRow.contentTasks && selectedRow.contentTasks.length > 0 ? (
                            <div className="space-y-2">
                                {selectedRow.contentTasks.map((task: any, idx: number) => (
                                    <div key={task.id} className="bg-white p-3.5 rounded-xl border border-orange-100 shadow-sm flex gap-3 items-start transition-colors hover:border-orange-300">
                                        <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-0.5 rounded mt-0.5 shrink-0">{idx + 1}</span>
                                        <span className="text-sm font-bold text-slate-700 leading-snug">{task.title}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400 italic font-medium p-4 text-center border-2 border-dashed border-slate-200 rounded-xl">Không có Kịch bản dư ở mốc thời gian này.</div>
                        )}
                    </div>

                    {/* KHỐI VIDEO DƯ */}
                    <div>
                        <h3 className="text-[11px] font-black text-blue-600 flex items-center gap-2 mb-3 uppercase tracking-widest bg-blue-50 w-max px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
                            <Video size={14} /> Video Dư ({selectedRow.videoCount || 0})
                        </h3>
                        {selectedRow.videoTasks && selectedRow.videoTasks.length > 0 ? (
                            <div className="space-y-2">
                                {selectedRow.videoTasks.map((task: any, idx: number) => (
                                    <div key={task.id} className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm flex gap-3 items-start transition-colors hover:border-blue-300">
                                        <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded mt-0.5 shrink-0">{idx + 1}</span>
                                        <span className="text-sm font-bold text-slate-700 leading-snug">{task.title}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400 italic font-medium p-4 text-center border-2 border-dashed border-slate-200 rounded-xl">Không có Video dư ở mốc thời gian này.</div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-center border-collapse min-w-[900px]">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-emerald-50 text-emerald-800 text-[10px] md:text-[11px] font-black uppercase tracking-widest border-b border-emerald-200 shadow-sm">
                            <th className="p-3 border-r border-emerald-100 w-[50px]">STT</th>
                            <th className="p-3 border-r border-emerald-100 w-[120px]">TEAM</th>
                            <th className="p-3 border-r border-emerald-100 min-w-[200px]">KÊNH</th>
                            <th className="p-3 border-r border-emerald-100 w-[120px]">SỐ LƯỢNG<br />VIDEO DƯ</th>
                            <th className="p-3 border-r border-emerald-100 w-[120px]">THỜI LƯỢNG<br />VIDEO</th>
                            <th className="p-3 border-r border-emerald-100 w-[120px]">SỐ LƯỢNG<br />CONTENT DƯ</th>
                            <th className="p-3 border-r border-emerald-100 w-[120px]">THỜI LƯỢNG<br />CONTENT</th>
                            <th className="p-3 w-[200px] bg-emerald-100 text-emerald-900">CHÚ THÍCH (Tự động)</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium">Chưa có dữ liệu sản xuất.</td>
                            </tr>
                        ) : (
                            data.map((row, index) => (
                                <tr 
                                    key={`${row.id}-${index}`} 
                                    // 🚀 BỔ SUNG: Cho phép click vào dòng và đổi hiệu ứng trỏ chuột
                                    className="hover:bg-emerald-50/50 transition-colors text-sm font-medium text-slate-700 cursor-pointer"
                                    onClick={() => setSelectedRow(row)}
                                >
                                    {row.isFirstChannelOfTeam && (
                                        <>
                                            <td rowSpan={row.teamRowSpan} className="p-3 border-r border-slate-100 bg-white font-bold cursor-default" onClick={e => e.stopPropagation()}>{row.stt}</td>
                                            <td rowSpan={row.teamRowSpan} className="p-3 border-r border-slate-100 bg-slate-50 font-black uppercase text-slate-600 cursor-default" onClick={e => e.stopPropagation()}>{row.teamName}</td>
                                        </>
                                    )}

                                    {row.isFirstOfChannel && (
                                        <td rowSpan={row.channelRowSpan} className="p-3 border-r border-slate-100 text-left font-bold cursor-default" onClick={e => e.stopPropagation()}>{row.channelName}</td>
                                    )}

                                    <td className="p-3 border-r border-slate-100 font-black text-blue-600">{row.videoCount > 0 ? row.videoCount : "-"}</td>
                                    <td className="p-3 border-r border-slate-100">{row.videoDuration}</td>

                                    <td className="p-3 border-r border-slate-100 font-black text-orange-600">{row.contentCount > 0 ? row.contentCount : "-"}</td>
                                    <td className="p-3 border-r border-slate-100">{row.contentDuration}</td>

                                    <td className="p-2 text-xs text-left bg-slate-50/30">
                                        {row.notes.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {row.notes.map((n: string, i: number) => (
                                                    <span key={i} className="bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 italic shadow-sm">{n}</span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 italic text-center block">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 🚀 Render Drawer thông qua Portal */}
            {mounted && createPortal(drawerContent, document.body)}
        </div>
    );
}