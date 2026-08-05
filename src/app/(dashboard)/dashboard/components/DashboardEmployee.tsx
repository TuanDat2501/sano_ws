"use client";

import { useState, useEffect } from "react";
import { Target, Flame, Medal, Clock, CheckCircle2, History, Loader2, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/app/component/ToastProvider";
import { useRouter } from "next/navigation";

export default function DashboardEmployee() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await fetch("/api/dashboard");
                const json = await res.json();
                if (res.ok) setData(json);
                else showToast("error", "Lỗi tải dữ liệu");
            } catch (error) {
                showToast("error", "Lỗi kết nối");
            } finally {
                setIsLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 gap-3">
                <Loader2 className="animate-spin text-blue-600" size={40} />
            </div>
        );
    }

    if (!data) return null;

    const stats = data.stats || {};
    const percent = stats.kpiPercent || 0;
    let evalStr = "Cố lên!";
    if (percent >= 100) evalStr = "Xuất sắc";
    else if (percent >= 80) evalStr = "Khá";
    else if (percent >= 50) evalStr = "Trung bình";

    const chartData = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }).replace('/', '-');
        const apiMatch = (data.chartData || []).find((c: any) => c.date === dateStr);

        return {
            name: dateStr,
            done: apiMatch ? apiMatch.done : 0
        };
    });

    // 🚀 BỔ SUNG: Tính toán cho biểu đồ vòng tròn
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(percent, 100) / 100) * circumference;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">
            
            {/* ======================= */}
            {/* CỘT TRÁI (Chiếm 2 phần) */}
            {/* ======================= */}
            <div className="lg:col-span-2 flex flex-col gap-4 md:gap-6">
                
                {/* 1. MỤC TIÊU TUẦN NÀY (ĐÃ REDESIGN) */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    
                    {/* Phần Header & Vòng Tròn Progress */}
                    <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-6">
                        
                        <div className="flex flex-col text-center sm:text-left w-full sm:w-auto">
                            <h2 className="text-base md:text-lg font-black text-slate-800 mb-2 flex items-center justify-center sm:justify-start gap-2">
                                <Target className="text-blue-600" size={18} /> Mục tiêu Tuần này
                            </h2>
                            <p className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter mt-1">
                                {stats.actualThisWeek || 0}<span className="text-xl md:text-2xl text-slate-400 font-bold">/{stats.targetThisWeek || 0}</span>
                            </p>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                                <p className="text-xs md:text-sm font-bold text-slate-500">Bài đã hoàn thành</p>
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md shadow-sm ${percent >= 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {evalStr}
                                </span>
                            </div>
                        </div>

                        {/* SVG Vòng tròn hiển thị % */}
                        <div className="relative flex items-center justify-center shrink-0">
                            <svg width="110" height="110" className="transform -rotate-90 drop-shadow-sm">
                                <circle cx="55" cy="55" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-100" />
                                <circle cx="55" cy="55" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    className={`${percent >= 100 ? 'text-green-500' : 'text-amber-400'} transition-all duration-1000 ease-out`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center text-center mt-0.5">
                                <span className={`text-2xl font-black ${percent >= 100 ? 'text-green-500' : 'text-amber-500'}`}>{percent}%</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* CHI TIẾT TỪNG KÊNH (CHIA LÀM 2 CỘT) */}
                    {stats.targetDetails && stats.targetDetails.length > 0 && (
                        <div className="mt-6 pt-5 border-t border-slate-100">
                            <h3 className="text-[11px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Chi tiết chỉ tiêu</h3>
                            
                            {/* 🚀 ĐÃ SỬA: Dùng grid-cols-1 md:grid-cols-2 để thanh progress ngắn lại, gọn gàng */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                {stats.targetDetails.map((detail: any, idx: number) => {
                                    const detailPercent = detail.targetCount > 0 ? Math.round((detail.actualCount / detail.targetCount) * 100) : 0;
                                    return (
                                        <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100/60 transition-colors hover:bg-slate-100">
                                            <div className="flex justify-between items-start mb-2.5">
                                                <div className="min-w-0 pr-3">
                                                    <p className="text-xs md:text-sm font-bold text-slate-700 truncate">{detail.channelName || "Kênh ẩn"}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Mục tiêu: {detail.duration} phút/bài</p>
                                                </div>
                                                <div className="text-right shrink-0 flex flex-col justify-between items-end">
                                                    <p className="text-xs md:text-sm font-black text-slate-800">
                                                        {detail.actualCount || 0} <span className="text-slate-400 font-medium">/ {detail.targetCount}</span>
                                                    </p>
                                                    <p className={`text-[10px] font-black uppercase mt-1 ${detailPercent >= 100 ? 'text-green-600' : 'text-blue-600'}`}>{detailPercent}%</p>
                                                </div>
                                            </div>
                                            {/* <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-1000 ${detailPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(detailPercent, 100)}%` }}></div>
                                            </div> */}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. ĐANG CHỜ DÁN LINK */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-base md:text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Clock className="text-slate-400" size={18} /> Đang chờ dán Link báo cáo
                    </h2>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {!stats.pendingTasks || stats.pendingTasks?.length === 0 ? (
                            <p className="text-xs md:text-sm text-slate-400 italic py-4">Bạn không nợ công việc nào. Quá tuyệt vời!</p>
                        ) : (
                            stats.pendingTasks?.map((task: any) => (
                                <div key={task.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">{task.title}</p>
                                        <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-1">Giao lúc: {new Date(task.createdAt).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                    <button
                                        onClick={() => router.push(`/tasks?taskId=${task.id}`)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all shrink-0 w-full sm:w-auto"
                                    >
                                        Dán link ngay
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>

            {/* ======================= */}
            {/* CỘT PHẢI (Chiếm 1 phần) */}
            {/* ======================= */}
            <div className="lg:col-span-1 flex flex-col gap-4 md:gap-6">
                
                {/* 1. GÓC THÀNH TỰU */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 md:p-6 rounded-2xl shadow-lg border border-slate-700 text-white relative overflow-hidden h-fit">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Medal size={100} className="md:w-[120px] md:h-[120px]" /></div>
                    <h2 className="text-base md:text-lg font-black text-slate-100 mb-4 md:mb-6 flex items-center gap-2 relative z-10">
                        <Trophy className="text-yellow-400" size={18} /> Góc Thành Tựu
                    </h2>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div>
                            <p className="text-2xl md:text-3xl font-black text-white">{stats.lifetimeLogs || 0}</p>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mt-1">Sản phẩm xuất xưởng</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 md:gap-2 text-2xl md:text-3xl font-black text-white">
                                0 <Flame className="text-slate-600 fill-slate-600 w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase mt-1">Chuỗi Đạt KPI</p>
                        </div>
                    </div>
                </div>

                {/* 2. BIỂU ĐỒ NĂNG SUẤT */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 min-w-0">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 mb-4 md:mb-6 uppercase tracking-wider">Năng suất 7 ngày qua</h2>
                    <div className="h-[180px] md:h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '11px' }} />
                                <Bar dataKey="done" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. LỊCH SỬ HOÀN THÀNH */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-xs md:text-sm font-black text-slate-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <History size={14} className="md:w-4 md:h-4" /> Vừa hoàn thành
                    </h2>
                    <div className="space-y-3 md:space-y-4 max-h-[180px] md:max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                        {!data.recentLogs || data.recentLogs.length === 0 ? (
                            <p className="text-xs text-slate-400">Chưa có lịch sử.</p>
                        ) : (
                            data.recentLogs.slice(0, 5).map((log: any) => (
                                <div key={log.id} className="flex gap-2.5 md:gap-3">
                                    <div className="mt-0.5 text-green-500 shrink-0"><CheckCircle2 size={14} className="md:w-4 md:h-4" /></div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] md:text-xs font-bold text-slate-800 line-clamp-1">{log.task?.title || "Công việc"}</p>
                                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleTimeString('vi-VN')} • +1 điểm</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}