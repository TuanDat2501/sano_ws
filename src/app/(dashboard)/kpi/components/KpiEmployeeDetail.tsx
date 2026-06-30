"use client";

import { Clock, CheckCircle, Upload, AlertCircle } from "lucide-react";
import { getProgressColor, InlineLoading } from "../utils";

export default function KpiEmployeeDetail({ activeKpi, isLoading }: { activeKpi: any, isLoading: boolean }) {
    return (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
            {/* CỘT TRÁI: MỤC TIÊU */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4 md:gap-6">
                {/* Thẻ Target */}
                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 md:gap-3 font-bold text-slate-800 mb-3 md:mb-4">
                        <span className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs md:text-sm font-black text-slate-600 shrink-0">1</span>
                        <span className="text-base md:text-lg">Chỉ tiêu Tuần</span>
                    </div>
                    {isLoading ? <InlineLoading className="py-2" /> : activeKpi && (
                        <>
                            <div className="flex justify-between items-end text-xs md:text-sm font-bold mb-2 md:mb-3 mt-4 md:mt-6">
                                <span className="text-slate-500">Thực tế:</span>
                                <span className="text-slate-900 text-lg md:text-xl font-black leading-none">{activeKpi.actualValue} <span className="text-slate-400 text-sm md:text-base">/ {activeKpi.targetValue}</span></span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 md:h-3 overflow-hidden mt-2 md:mt-0">
                                <div className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(activeKpi.percent).split(' ')[0]}`} style={{ width: `${Math.min(activeKpi.percent, 100)}%` }}></div>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Thẻ Vòng Tròn - Responsive Donut Chart */}
                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center py-6 md:py-12 min-h-[220px] md:min-h-[350px]">
                    {isLoading ? <InlineLoading /> : activeKpi && (
                        <>
                            <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-56 md:h-56 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="10%" fill="transparent" className="text-slate-100" />
                                    <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="10%" fill="transparent" strokeDasharray="264%" strokeDashoffset={`${264 - (Math.min(activeKpi.percent, 100) * 2.64)}%`} className={`transition-all duration-1000 ease-out ${getProgressColor(activeKpi.percent).split(' ')[1]}`} strokeLinecap="round"/>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-800">{activeKpi.percent}%</span>
                                </div>
                            </div>
                            <p className="mt-4 md:mt-8 font-black text-slate-800 text-sm md:text-lg">Tổng % Tuần</p>
                        </>
                    )}
                </div>
            </div>

            {/* CỘT PHẢI: CÔNG VIỆC (Mobile: Card, Desktop: Table) */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4 md:gap-6">
                <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full min-h-[300px] md:min-h-[400px] flex flex-col">
                    {isLoading ? <InlineLoading className="h-full min-h-[300px]" /> : (
                        <div className="h-full flex flex-col min-h-0">
                            
                            <div className="p-4 md:p-5 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-wider">Lịch sử Ghi Nhận</h3>
                            </div>

                            {/* --- MOBILE VIEW: DẠNG CARD (Dưới 768px) --- */}
                            <div className="block md:hidden flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50/30">
                                {(!activeKpi?.logs || activeKpi.logs.length === 0) ? (
                                    <p className="text-center text-slate-400 py-10 text-sm font-medium">Chưa có công việc.</p>
                                ) : (
                                    activeKpi.logs.map((log: any) => (
                                        <div key={log.id} className="p-3.5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-2 relative overflow-hidden">
                                            {/* Viền trái đánh dấu màu trạng thái */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${log.action === "PENDING" ? 'bg-slate-300' : 'bg-green-500'}`}></div>
                                            
                                            <div className="flex justify-between items-start pl-2">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{log.typeStr}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{new Date(log.createdAt).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            
                                            <p className="font-bold text-slate-800 text-sm pl-2 leading-snug">{log.task?.title || "Task không xác định"}</p>
                                            
                                            <div className="flex justify-between items-center border-t border-slate-50 pt-2.5 mt-1 pl-2">
                                                <div className="flex items-center gap-2">
                                                    {log.action === "PENDING" ? (
                                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">Chờ nộp link</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-green-700 bg-green-100 border border-green-200 px-2 py-1 rounded flex items-center gap-1"><CheckCircle size={10} /> Hoàn thành</span>
                                                    )}
                                                    <span className={`text-xs font-black ${log.action === "PENDING" ? 'text-slate-400' : 'text-green-600'}`}>{log.action === "PENDING" ? "-" : "+1"}</span>
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                                    {new Date(log.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* --- DESKTOP VIEW: DẠNG BẢNG (Trên 768px) --- */}
                            <div className="hidden md:block flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white">
                                <table className="w-full text-left text-sm text-slate-600 min-w-[600px]">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                        <tr>
                                            <th className="px-5 lg:px-6 py-4">Tên Công việc</th>
                                            <th className="px-5 lg:px-6 py-4 w-28">Loại</th>
                                            <th className="px-5 lg:px-6 py-4 w-32">Trạng thái</th> {/* ĐÃ VÁ LỖI CỘT NÀY */}
                                            <th className="px-5 lg:px-6 py-4 w-28 text-center">Ghi nhận</th>
                                            <th className="px-5 lg:px-6 py-4 w-36 text-right">Thời gian</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(!activeKpi?.logs || activeKpi.logs.length === 0) ? (
                                            <tr><td colSpan={5} className="text-center py-12 text-slate-400 font-medium">Chưa có dữ liệu công việc.</td></tr>
                                        ) : (
                                            activeKpi?.logs?.map((log: any) => (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 lg:px-6 py-4 font-bold text-slate-800 text-sm truncate max-w-[200px]" title={log.task?.title}>{log.task?.title}</td>
                                                    <td className="px-5 lg:px-6 py-4 font-bold text-slate-500 text-xs">{log.typeStr}</td>
                                                    
                                                    {/* 🚀 ĐÃ BỔ SUNG TRẠNG THÁI VÀO BẢNG DESKTOP */}
                                                    <td className="px-5 lg:px-6 py-4">
                                                        {log.action === "PENDING" ? (
                                                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">Chờ nộp link</span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-green-700 bg-green-100 px-2 py-1 rounded border border-green-200 flex items-center gap-1 w-fit whitespace-nowrap"><CheckCircle size={12} /> Đã nộp</span>
                                                        )}
                                                    </td>

                                                    <td className={`px-5 lg:px-6 py-4 text-center font-black text-base ${log.action === "PENDING" ? "text-slate-400" : "text-green-600"}`}>{log.action === "PENDING" ? "-" : "+1"}</td>
                                                    <td className="px-5 lg:px-6 py-4 text-right font-bold text-slate-500 text-xs">
                                                        {new Date(log.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}