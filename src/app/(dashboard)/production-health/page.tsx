"use client";

import { useState, useEffect } from "react";
import { Loader2, Activity } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function ProductionHealthPage() {
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
        <div className="p-4 md:p-8 bg-slate-50 min-h-full animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <Activity className="text-indigo-600" /> Kiểm Soát Năng Suất (Bài Dư)
                </h1>
                <p className="text-sm text-slate-500 font-medium mt-1">Hệ thống tự động quét và đếm bài dư dựa trên tiến độ công việc thực tế.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-center border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-cyan-100 text-cyan-900 text-[11px] font-black uppercase tracking-widest border-b-2 border-cyan-300">
                                <th className="p-3 border-r border-cyan-200 w-[50px]">STT</th>
                                <th className="p-3 border-r border-cyan-200 w-[120px]">TEAM</th>
                                <th className="p-3 border-r border-cyan-200 min-w-[200px]">KÊNH</th>
                                <th className="p-3 border-r border-cyan-200 w-[120px]">SỐ LƯỢNG<br />VIDEO DƯ</th>
                                <th className="p-3 border-r border-cyan-200 w-[120px]">THỜI LƯỢNG<br />VIDEO</th>
                                <th className="p-3 border-r border-cyan-200 w-[120px]">SỐ LƯỢNG<br />CONTENT DƯ</th>
                                <th className="p-3 border-r border-cyan-200 w-[120px]">THỜI LƯỢNG<br />CONTENT</th>
                                <th className="p-3 w-[200px] bg-indigo-100 text-indigo-900">CHÚ THÍCH (Tự động)</th>
                            </tr>
                        </thead>

                        <tbody>
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
                                    <tr key={`${row.id}-${index}`} className="border-b border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700">

                                        {/* 1. GỘP Ô TEAM */}
                                        {row.isFirstChannelOfTeam && (
                                            <>
                                                <td rowSpan={row.teamRowSpan} className="p-3 border-r border-slate-200 bg-white font-bold">{row.stt}</td>
                                                <td rowSpan={row.teamRowSpan} className="p-3 border-r border-slate-200 bg-emerald-50/50 font-black uppercase text-emerald-800">{row.teamName}</td>
                                            </>
                                        )}

                                        {/* 2. GỘP Ô TÊN KÊNH (NẾU CÓ NHIỀU THỜI LƯỢNG KHÁC NHAU) */}
                                        {row.isFirstOfChannel && (
                                            <td rowSpan={row.channelRowSpan} className="p-3 border-r border-slate-200 text-left font-bold">{row.channelName}</td>
                                        )}

                                        <td className="p-3 border-r border-slate-200 font-black text-blue-600">{row.videoCount > 0 ? row.videoCount : "-"}</td>
                                        <td className="p-3 border-r border-slate-200">{row.videoDuration}</td>

                                        <td className="p-3 border-r border-slate-200 font-black text-orange-600">{row.contentCount > 0 ? row.contentCount : "-"}</td>
                                        <td className="p-3 border-r border-slate-200">{row.contentDuration}</td>

                                        {/* Render Cột Chú Thích */}
                                        <td className="p-2 text-xs text-left bg-slate-50/50">
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
        </div>
    );
}