"use client";

import { useState, useEffect } from "react";
import { TrendingUp, AlertCircle, Clock, CheckCircle, Trophy, Activity, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/app/component/ToastProvider";

export default function DashboardManager() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await fetch("/api/dashboard");
                const json = await res.json();
                if (res.ok) setData(json);
                else showToast("error", "Không thể tải dữ liệu Dashboard");
            } catch (error) {
                showToast("error", "Lỗi kết nối máy chủ");
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
                <p className="font-medium">Đang vẽ biểu đồ...</p>
            </div>
        );
    }

    if (!data) return null;

    // 🚀 XỬ LÝ DATA CHO BIỂU ĐỒ SẢN LƯỢNG TUẦN NÀY (T2 -> CN)
    const chartData = [
        { name: "T2", script: 0, video: 0, publish: 0 },
        { name: "T3", script: 0, video: 0, publish: 0 },
        { name: "T4", script: 0, video: 0, publish: 0 },
        { name: "T5", script: 0, video: 0, publish: 0 },
        { name: "T6", script: 0, video: 0, publish: 0 },
        { name: "T7", script: 0, video: 0, publish: 0 },
        { name: "CN", script: 0, video: 0, publish: 0 },
    ];

    data.logs?.forEach((log: any) => {
        const day = new Date(log.createdAt).getDay(); // 0 (CN) -> 6 (T7)
        const index = day === 0 ? 6 : day - 1; // Chuyển đổi để T2 là index 0
        if (log.action === "SUBMIT_SCRIPT") chartData[index].script++;
        else if (log.action === "SUBMIT_VIDEO") chartData[index].video++;
        else if (log.action === "PUBLISH_VIDEO") chartData[index].publish++;
    });

    return (
        <div className="space-y-6 md:space-y-8">
            {/* 1. KHỐI THỐNG KÊ NHANH (Data thật từ API) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Activity size={24} /></div>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{data.stats?.activeTasks || 0}</p>
                    <p className="text-sm font-bold text-slate-500 uppercase mt-1">Task Đang Chạy</p>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl"><TrendingUp size={24} /></div>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{data.stats?.kpiPercent || 0}%</p>
                    <p className="text-sm font-bold text-slate-500 uppercase mt-1">Hoàn thành KPI Tuần</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl"><Clock size={24} /></div>
                        {data.stats?.pendingQC > 0 && <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse">Cần duyệt!</span>}
                    </div>
                    <p className="text-3xl font-black text-slate-800">{data.stats?.pendingQC || 0}</p>
                    <p className="text-sm font-bold text-slate-500 uppercase mt-1">Chờ Nghiệm Thu</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl"><AlertCircle size={24} /></div>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{data.stats?.overdue || 0}</p>
                    <p className="text-sm font-bold text-slate-500 uppercase mt-1">Cảnh Báo Tồn Đọng</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* 2. BIỂU ĐỒ SẢN LƯỢNG (Đã gắn Data) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">Biểu đồ Sản lượng Tuần</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="script" name="Kịch bản" stackId="a" fill="#eab308" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="video" name="Dựng Video" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="publish" name="Đăng Kênh" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                    {/* 3. BẢNG VÀNG (Lấy từ mảng kpis) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <Trophy className="text-amber-500" size={20} /> Top Nhân Sự (Chỉ tiêu)
                        </h2>
                        <div className="space-y-4">
                            {!data.kpis || data.kpis.length === 0 ? (
                                <p className="text-sm text-slate-400">Chưa có dữ liệu KPI tuần này.</p>
                            ) : (
                                data.kpis.slice(0, 5).map((kpi: any, index: number) => (
                                    <div key={kpi.id} className="flex items-center gap-4 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-orange-600'}`}>
                                            #{index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800 text-sm truncate">{kpi.user?.fullName}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase">{kpi.user?.role}</p>
                                        </div>
                                        <span className="font-black text-slate-600 text-xs">Target: {kpi.targetValue}</span>
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