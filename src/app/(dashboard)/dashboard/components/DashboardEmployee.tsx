"use client";

import { useState, useEffect } from "react";
import { Target, Flame, Medal, Clock, CheckCircle2, History, Zap, Loader2, AlertOctagon, Trophy } from "lucide-react";
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

    // 🚀 XỬ LÝ BIỂU ĐỒ 7 NGÀY QUA
    const chartData = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i)); // Lùi về 6 ngày trước -> hôm nay
        return {
            name: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
            dateStr: d.toDateString(),
            done: 0
        };
    });

    data.recentLogs?.forEach((log: any) => {
        const logDateStr = new Date(log.createdAt).toDateString();
        const match = chartData.find(c => c.dateStr === logDateStr);
        if (match) match.done++;
    });

    return (
        <div className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                
                {/* Ví KPI */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        <Target className="text-blue-600" size={20} /> Mục tiêu Tuần này
                    </h2>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-4xl font-black text-slate-800">
                                {stats.actualThisWeek || 0}<span className="text-xl text-slate-400">/{stats.targetThisWeek || 0}</span>
                            </p>
                            <p className="text-sm font-bold text-slate-500 mt-1">Bài đã hoàn thành</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-amber-500">{percent}%</p>
                            <p className="text-[10px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded-md mt-1">Tạm tính: {evalStr}</p>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mt-4">
                        <div className={`h-full rounded-full transition-all duration-1000 ${percent >= 100 ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                    </div>
                </div>

                {/* Góc Thành Tựu */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Medal size={120} /></div>
                    <h2 className="text-lg font-black text-slate-100 mb-6 flex items-center gap-2 relative z-10">
                        <Trophy className="text-yellow-400" size={20} /> Góc Thành Tựu
                    </h2>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div>
                            <p className="text-3xl font-black text-white">{stats.lifetimeLogs || 0}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Sản phẩm xuất xưởng</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-3xl font-black text-white">
                                0 <Flame className="text-slate-600 fill-slate-600" size={24} />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Chuỗi Đạt KPI</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Việc Khẩn (Pending Tasks) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <Clock className="text-slate-400" size={20} /> Đang chờ dán Link báo cáo
                        </h2>
                        <div className="space-y-3">
                            {!stats.pendingTasks || stats.pendingTasks.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-4">Bạn không nợ công việc nào. Quá tuyệt vời!</p>
                            ) : (
                                stats.pendingTasks.map((task: any) => (
                                    <div key={task.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{task.title}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-1">Giao lúc: {new Date(task.createdAt).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black whitespace-nowrap hover:bg-blue-700 shadow-md">Dán Link Ngay</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Biểu đồ cá nhân & Lịch sử */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider">Năng suất 7 ngày qua</h2>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                                    <Bar dataKey="done" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <History size={16} /> Vừa hoàn thành
                        </h2>
                        <div className="space-y-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                            {!data.recentLogs || data.recentLogs.length === 0 ? (
                                <p className="text-xs text-slate-400">Chưa có lịch sử.</p>
                            ) : (
                                data.recentLogs.slice(0, 5).map((log: any) => (
                                    <div key={log.id} className="flex gap-3">
                                        <div className="mt-0.5 text-green-500"><CheckCircle2 size={16} /></div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 line-clamp-1">{log.task?.title || "Công việc"}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(log.createdAt).toLocaleTimeString('vi-VN')} • +1 điểm</p>
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