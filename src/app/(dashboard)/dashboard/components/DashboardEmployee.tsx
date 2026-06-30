"use client";

import { useState, useEffect } from "react";
import { Target, Flame, Medal, Clock, CheckCircle2, History, Loader2, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/app/component/ToastProvider";

export default function DashboardEmployee() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

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

    // Data đã dọn dẹp sạch sẽ
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

    return (
        <div className="space-y-4 md:space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">

                {/* VÍ KPI: Responsive flex-col sang flex-row */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <h2 className="text-base md:text-lg font-black text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                        <Target className="text-blue-600" size={18} /> Mục tiêu Tuần này
                    </h2>
                    <div className="flex flex-row justify-between items-end mb-2">
                        <div>
                            <p className="text-3xl md:text-4xl font-black text-slate-800">
                                {stats.actualThisWeek || 0}<span className="text-lg md:text-xl text-slate-400">/{stats.targetThisWeek || 0}</span>
                            </p>
                            <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">Bài đã hoàn thành</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl md:text-3xl font-black text-amber-500">{percent}%</p>
                            <p className="text-[9px] md:text-[10px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded-md mt-1">Tạm tính: {evalStr}</p>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 md:h-3 rounded-full overflow-hidden mt-2 md:mt-4">
                        <div className={`h-full rounded-full transition-all duration-1000 ${percent >= 100 ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                    </div>
                </div>

                {/* GÓC THÀNH TỰU */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 md:p-6 rounded-2xl shadow-lg border border-slate-700 text-white relative overflow-hidden">
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
                {/* VIỆC KHẨN: Responsive flex-col sang flex-row */}
                <div className="lg:col-span-2 space-y-4 md:space-y-6">
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-base md:text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <Clock className="text-slate-400" size={18} /> Đang chờ dán Link báo cáo
                        </h2>
                        <div className="space-y-3">
                            {!stats.pendingTasks || stats.pendingTasks.length === 0 ? (
                                <p className="text-xs md:text-sm text-slate-400 italic py-4">Bạn không nợ công việc nào. Quá tuyệt vời!</p>
                            ) : (
                                stats.pendingTasks?.map((task: any) => (
                                    // Thay đổi ở đây: flex-col trên mobile, sm:flex-row để ngang trên máy to
                                    <div key={task.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm truncate">{task.title}</p>
                                            <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-1">Giao lúc: {new Date(task.createdAt).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                        {/* Nút bấm tự động dàn ngang 100% trên điện thoại (w-full sm:w-auto) */}
                                        <button className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs md:text-sm font-black whitespace-nowrap hover:bg-blue-700 shadow-md transition-colors active:scale-95 text-center">
                                            Dán Link Ngay
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* BIỂU ĐỒ & LỊCH SỬ */}
                <div className="space-y-4 md:space-y-6">
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
        </div>
    );
}