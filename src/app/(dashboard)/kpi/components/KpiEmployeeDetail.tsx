"use client";

import { Clock, CheckCircle, Tv, Target, LayoutList } from "lucide-react";
import { getProgressColor, InlineLoading } from "../utils";

export default function KpiEmployeeDetail({ activeKpi, isLoading }: { activeKpi: any, isLoading: boolean }) {
    return (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
            {/* CỘT TRÁI: MỤC TIÊU & TIẾN ĐỘ TỔNG */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4 md:gap-6">
                
                {/* 1. Thẻ Vòng Tròn - Tiến độ tổng */}
                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center py-6 md:py-8 min-h-[220px] md:min-h-[300px]">
                    {isLoading ? <InlineLoading /> : activeKpi && (
                        <>
                            <h3 className="font-black text-slate-800 text-sm md:text-base uppercase tracking-widest mb-6 text-center">Tiến độ tổng hợp</h3>
                            <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="10%" fill="transparent" className="text-slate-100" />
                                    <circle cx="50%" cy="50%" r="42%" stroke="currentColor" strokeWidth="10%" fill="transparent" strokeDasharray="264%" strokeDashoffset={`${264 - (Math.min(activeKpi.percent, 100) * 2.64)}%`} className={`transition-all duration-1000 ease-out ${getProgressColor(activeKpi.percent).split(' ')[1]}`} strokeLinecap="round"/>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800">{activeKpi.percent}%</span>
                                </div>
                            </div>
                            
                            {/* 🚀 ĐÃ BỔ SUNG: Hiển thị Tổng Phút và Tổng Video ở dưới */}
                            <div className="flex flex-col gap-1 mt-6 text-center w-full">
                                <p className="text-slate-500 font-bold text-xs md:text-sm flex justify-center gap-1.5 items-center">
                                    Số Lượng Bài: <span className="text-slate-900 font-black">{activeKpi.actualValue} <span className="text-slate-400 font-medium text-xs">/ {activeKpi.targetValue}</span></span>
                                </p>
                                {(activeKpi.totalTargetMinutes > 0 || activeKpi.totalActualMinutes > 0) && (
                                    <div className="inline-flex flex-col items-center mt-1">
                                        <p className="text-[11px] md:text-xs font-black text-blue-700 bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-100">
                                            Khối lượng (Phút): {activeKpi.totalActualMinutes || 0} / {activeKpi.totalTargetMinutes}
                                        </p>
                                        {/* <span className="text-[9px] text-slate-400 font-medium italic mt-1">(Tất cả video được quy đổi ra tỷ lệ % theo số phút)</span> */}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 2. Thẻ Chi tiết Chỉ tiêu theo Kênh */}
                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">
                        <Target className="text-blue-500 w-5 h-5" />
                        <span className="text-sm md:text-base uppercase tracking-wider font-black">Chỉ tiêu chi tiết</span>
                    </div>

                    {isLoading ? <InlineLoading className="py-4" /> : (!activeKpi?.targetDetails || activeKpi.targetDetails.length === 0) ? (
                        <p className="text-sm text-slate-400 font-medium italic text-center py-4">Chưa có chỉ tiêu chi tiết phân bổ theo kênh.</p>
                    ) : (
                        <div className="space-y-4">
                            {activeKpi.targetDetails.map((detail: any, idx: number) => {
                                // Tính % cho từng kênh dựa trên số phút
                                const channelTargetMins = detail.targetCount * detail.duration;
                                const percent = channelTargetMins > 0 ? Math.round(((detail.actualMinutes || 0) / channelTargetMins) * 100) : 0;
                                
                                return (
                                    <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div className="flex justify-between items-start mb-2.5">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                                    <Tv size={14} className="text-slate-400" /> {detail.channelName}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide flex items-center gap-1">
                                                    <Clock size={10} /> Yêu cầu: {detail.duration} Phút/Video
                                                </p>
                                            </div>
                                            
                                            <div className="text-right">
                                                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 block">
                                                    {detail.actualCount} / {detail.targetCount} Bài
                                                </span>
                                                <p className="text-[10px] font-black text-slate-500 mt-1.5 uppercase tracking-wide">
                                                    {detail.actualMinutes || 0} / {channelTargetMins} Phút
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-700 ${getProgressColor(percent).split(' ')[0]}`} 
                                                style={{ width: `${Math.min(percent, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* CỘT PHẢI: LỊCH SỬ CÔNG VIỆC */}
            <div className="w-full lg:w-2/3 flex flex-col gap-4 md:gap-6">
                <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full min-h-[300px] md:min-h-[400px] flex flex-col">
                    {isLoading ? <InlineLoading className="h-full min-h-[300px]" /> : (
                        <div className="h-full flex flex-col min-h-0">
                            
                            <div className="p-4 md:p-5 border-b border-slate-100 shrink-0 flex items-center gap-2">
                                <LayoutList className="text-emerald-500 w-5 h-5" />
                                <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-wider">Sản phẩm thực tế đã nộp</h3>
                            </div>

                            <div className="block md:hidden flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50/30">
                                {(!activeKpi?.logs || activeKpi.logs.length === 0) ? (
                                    <p className="text-center text-slate-400 py-10 text-sm font-medium">Chưa có công việc.</p>
                                ) : (
                                    activeKpi.logs.map((log: any) => (
                                        <div key={log.id} className="p-3.5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col gap-2.5 relative overflow-hidden">
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${log.action === "PENDING" ? 'bg-slate-300' : 'bg-green-500'}`}></div>
                                            
                                            <div className="flex justify-between items-start pl-2">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{log.typeStr}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{new Date(log.createdAt).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            
                                            <p className="font-bold text-slate-800 text-sm pl-2 leading-snug">{log.task?.title || "Task không xác định"}</p>
                                            
                                            <div className="flex flex-wrap gap-2 pl-2">
                                                <span className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded flex items-center gap-1">
                                                    <Tv size={10} /> {log.task?.channel?.name || "Chưa gắn kênh"}
                                                </span>
                                                {log.task?.duration && (
                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded flex items-center gap-1">
                                                        <Clock size={10} /> {log.task.duration} Phút
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex justify-between items-center border-t border-slate-50 pt-2.5 mt-1 pl-2">
                                                <div className="flex items-center gap-2">
                                                    {log.action === "PENDING" ? (
                                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded">Chờ nộp link</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-green-700 bg-green-100 border border-green-200 px-2 py-1 rounded flex items-center gap-1"><CheckCircle size={10} /> Hoàn thành</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                                    {new Date(log.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="hidden md:block flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white">
                                <table className="w-full text-left text-sm text-slate-600 min-w-[750px]">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] sticky top-0 z-10 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                        <tr>
                                            <th className="px-5 py-4 w-28 text-center">Cột mốc</th>
                                            <th className="px-5 py-4">Sản phẩm / Video</th>
                                            <th className="px-5 py-4 w-40">Kênh đăng</th>
                                            <th className="px-5 py-4 w-28 text-center">Thời lượng</th>
                                            <th className="px-5 py-4 w-32 text-center">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(!activeKpi?.logs || activeKpi.logs.length === 0) ? (
                                            <tr><td colSpan={5} className="text-center py-12 text-slate-400 font-medium">Chưa có dữ liệu công việc.</td></tr>
                                        ) : (
                                            activeKpi?.logs?.map((log: any) => (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-4 text-center">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <span className="text-xs font-black text-slate-700">{new Date(log.createdAt).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}</span>
                                                            <span className="text-[10px] font-bold text-slate-400">{new Date(log.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                    </td>
                                                    
                                                    <td className="px-5 py-4">
                                                        <p className="font-bold text-slate-800 text-sm truncate max-w-[220px]" title={log.task?.title}>{log.task?.title}</p>
                                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 bg-blue-50 w-fit px-2 py-0.5 rounded">{log.typeStr}</p>
                                                    </td>

                                                    <td className="px-5 py-4 font-bold text-slate-600 text-xs truncate max-w-[150px]">
                                                        {log.task?.channel?.name ? (
                                                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                                                                <Tv size={12} className="text-slate-400" /> {log.task.channel.name}
                                                            </span>
                                                        ) : <span className="text-slate-300 italic">---</span>}
                                                    </td>
                                                    
                                                    <td className="px-5 py-4 text-center">
                                                        {log.task?.duration ? (
                                                            <span className="text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1">
                                                                <Clock size={12} className="text-amber-500" /> {log.task.duration} Phút
                                                            </span>
                                                        ) : <span className="text-slate-300 italic text-[11px]">---</span>}
                                                    </td>

                                                    <td className="px-5 py-4 text-center">
                                                        {log.action === "PENDING" ? (
                                                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 whitespace-nowrap">Chờ nộp link</span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-green-700 bg-green-100 px-2 py-1 rounded border border-green-200 inline-flex items-center justify-center gap-1 w-fit whitespace-nowrap"><CheckCircle size={12} /> Đã nộp</span>
                                                        )}
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