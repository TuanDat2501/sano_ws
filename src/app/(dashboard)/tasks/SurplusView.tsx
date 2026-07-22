"use client";

import { useState, useEffect } from "react";
import { Loader2, Activity } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function SurplusView() {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
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

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            {/* <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Activity size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">Kiểm Soát Năng Suất (Bài Dư)</h2>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Hệ thống tự động quét và đếm bài dư dựa trên tiến độ công việc thực tế.</p>
                </div>
            </div> */}
            
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
                                <tr key={`${row.id}-${index}`} className="hover:bg-slate-50/50 transition-colors text-sm font-medium text-slate-700">
                                    {row.isFirstChannelOfTeam && (
                                        <>
                                            <td rowSpan={row.teamRowSpan} className="p-3 border-r border-slate-100 bg-white font-bold">{row.stt}</td>
                                            <td rowSpan={row.teamRowSpan} className="p-3 border-r border-slate-100 bg-slate-50 font-black uppercase text-slate-600">{row.teamName}</td>
                                        </>
                                    )}

                                    {row.isFirstOfChannel && (
                                        <td rowSpan={row.channelRowSpan} className="p-3 border-r border-slate-100 text-left font-bold">{row.channelName}</td>
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
        </div>
    );
}