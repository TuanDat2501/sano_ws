"use client";

import { Clock, CheckCircle, Upload, AlertCircle } from "lucide-react";
import { getProgressColor, InlineLoading } from "../utils";

export default function KpiEmployeeDetail({ activeKpi, isLoading }: { activeKpi: any, isLoading: boolean }) {
    return (
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
            {/* CỘT TRÁI: MỤC TIÊU */}
            <div className="w-full lg:w-1/3 flex flex-col gap-6">
                {/* Thẻ Target */}
                <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 font-bold text-slate-800 mb-4">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600">1</span>
                        <span className="text-lg">Chỉ tiêu Tuần</span>
                    </div>
                    {isLoading ? <InlineLoading className="py-2" /> : activeKpi && (
                        <>
                            <div className="flex justify-between text-sm font-bold mb-3 mt-6">
                                <span className="text-slate-500">Thực tế:</span>
                                <span className="text-slate-900 text-lg font-black">{activeKpi.actualValue} / {activeKpi.targetValue}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div className={`h-3 rounded-full transition-all duration-1000 ${getProgressColor(activeKpi.percent).split(' ')[0]}`} style={{ width: `${Math.min(activeKpi.percent, 100)}%` }}></div>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Thẻ Vòng Tròn - Tự co giãn theo màn hình */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center py-8 md:py-12 min-h-[280px] md:min-h-[350px]">
                    {isLoading ? <InlineLoading /> : activeKpi && (
                        <>
                            <div className="relative w-40 h-40 md:w-56 md:h-56 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="10%" fill="transparent" className="text-slate-100" />
                                    <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="10%" fill="transparent" strokeDasharray="264%" strokeDashoffset={`${264 - (Math.min(activeKpi.percent, 100) * 2.64)}%`} className={`transition-all duration-1000 ease-out ${getProgressColor(activeKpi.percent).split(' ')[1]}`} strokeLinecap="round"/>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl md:text-5xl font-black text-slate-800">{activeKpi.percent}%</span>
                                </div>
                            </div>
                            <p className="mt-6 md:mt-8 font-black text-slate-800 text-base md:text-lg">Tổng % Tuần</p>
                        </>
                    )}
                </div>
            </div>

            {/* CỘT PHẢI: CÔNG VIỆC (Mobile: Card, Desktop: Table) */}
            <div className="w-full lg:w-2/3 flex flex-col gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full min-h-[400px]">
                    {isLoading ? <InlineLoading className="h-[300px]" /> : (
                        <div className="h-full">
                            {/* --- MOBILE VIEW: DẠNG CARD (Hiện dưới 768px) --- */}
                            <div className="block md:hidden p-4 space-y-4">
                                {(!activeKpi?.logs || activeKpi.logs.length === 0) ? (
                                    <p className="text-center text-slate-400 py-10">Chưa có công việc.</p>
                                ) : (
                                    activeKpi.logs.map((log: any) => (
                                        <div key={log.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{log.typeStr}</span>
                                                <span className="text-xs font-bold text-slate-500">{new Date(log.createdAt).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <p className="font-bold text-slate-800 text-sm mb-3 line-clamp-2">{log.task?.title || "Task không xác định"}</p>
                                            <div className="flex justify-between items-center">
                                                {/* Badge logic cũ */}
                                                {log.action === "PENDING" ? (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Chưa nộp</span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-green-600 uppercase">Hoàn thành +1</span>
                                                )}
                                                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                                    {new Date(log.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* --- DESKTOP VIEW: DẠNG BẢNG (Hiện trên 768px) --- */}
                            <div className="hidden md:block overflow-x-auto overflow-y-auto h-full max-h-[calc(100vh-200px)] custom-scrollbar">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] sticky top-0 z-10 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-5">Tên Công việc</th>
                                            <th className="px-6 py-5 w-24">Loại</th>
                                            <th className="px-6 py-5 w-40">Trạng thái</th>
                                            <th className="px-6 py-5 w-24 text-center">Ghi nhận</th>
                                            <th className="px-6 py-5 w-36 text-right">Thời gian</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {activeKpi?.logs?.map((log: any) => (
                                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800 text-sm truncate max-w-[200px]">{log.task?.title}</td>
                                                <td className="px-6 py-4 font-bold text-slate-500">{log.typeStr}</td>
                                                <td className="px-6 py-4">
                                                    {/* Badge giữ nguyên như cũ */}
                                                </td>
                                                <td className="px-6 py-4 text-center font-black text-green-600">{log.action === "PENDING" ? "-" : "+1"}</td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-500">
                                                    {new Date(log.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                                </td>
                                            </tr>
                                        ))}
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