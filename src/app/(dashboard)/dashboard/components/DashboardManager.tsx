"use client";

import { useState, useEffect } from "react";
import { TrendingUp, AlertCircle, Clock, Trophy, Activity, Loader2 } from "lucide-react";
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
                <p className="font-medium text-sm">Đang vẽ biểu đồ...</p>
            </div>
        );
    }

    if (!data) return null;

    // 🚀 LẤY TRỰC TIẾP DỮ LIỆU TỪ BACKEND
    // Nếu chưa có dữ liệu 7 ngày gần nhất, khởi tạo mảng rỗng để Recharts không bị lỗi
    const chartData = data.chartData || [];

    return (
        <div className="space-y-6 md:space-y-8">
            {/* 1. KHỐI THỐNG KÊ NHANH: Ép mobile hiển thị 2 cột (grid-cols-2) thay vì 1 cột cho gọn màn hình */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-2 md:mb-4">
                        <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-xl"><Activity className="w-5 h-5 md:w-6 md:h-6" /></div>
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{data.stats?.activeTasks || 0}</p>
                    <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase mt-1 line-clamp-1">Task Đang Chạy</p>
                </div>
                
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-2 md:mb-4">
                        <div className="p-2 md:p-3 bg-green-50 text-green-600 rounded-xl"><TrendingUp className="w-5 h-5 md:w-6 md:h-6" /></div>
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{data.stats?.kpiPercent || 0}%</p>
                    <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase mt-1 line-clamp-1">Hoàn thành KPI</p>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-2 md:mb-4">
                        <div className="p-2 md:p-3 bg-yellow-50 text-yellow-600 rounded-xl"><Clock className="w-5 h-5 md:w-6 md:h-6" /></div>
                        {data.stats?.pendingQC > 0 && <span className="hidden sm:inline-block text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse">Cần duyệt!</span>}
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{data.stats?.pendingQC || 0}</p>
                    <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase mt-1 line-clamp-1">Chờ Đăng</p>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-2 md:mb-4">
                        <div className="p-2 md:p-3 bg-red-50 text-red-600 rounded-xl"><AlertCircle className="w-5 h-5 md:w-6 md:h-6" /></div>
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{data.stats?.overdue || 0}</p>
                    <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase mt-1 line-clamp-1">Tồn Đọng</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* 2. BIỂU ĐỒ SẢN LƯỢNG */}
                <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 min-w-0">
                    <h2 className="text-base md:text-lg font-black text-slate-800 mb-6 flex items-center gap-2">Năng suất Team 7 ngày qua</h2>
                    <div className="h-[250px] md:h-[300px] w-full">
                        {chartData.length === 0 ? (
                             <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-sm italic">
                                Team chưa cập nhật công việc trong 7 ngày qua.
                             </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }} 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                    />
                                    {/* 🚀 ĐÃ SỬA: Map đúng với key "done" trả về từ Backend */}
                                    <Bar dataKey="done" name="Số bài hoàn thành" fill="#15ff00" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                    {/* 3. BẢNG VÀNG */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-base md:text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <Trophy className="text-amber-500" size={18} /> Top Nhân Sự 
                        </h2>
                        <div className="space-y-4">
                            {!data.kpis || data.kpis.length === 0 ? (
                                <p className="text-xs md:text-sm text-slate-400">Chưa có dữ liệu KPI tuần này.</p>
                            ) : (
                                data.kpis.slice(0, 5).map((kpi: any, index: number) => (
                                    <div key={kpi.id} className="flex items-center gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-black text-xs md:text-sm shrink-0 ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-orange-600'}`}>
                                            #{index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 text-xs md:text-sm truncate">{kpi.user?.fullName}</p>
                                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase truncate">{kpi.user?.role}</p>
                                        </div>
                                        <span className="font-black text-slate-600 text-xs shrink-0 bg-slate-50 px-2 py-1 rounded-md">Target: {kpi.targetValue}</span>
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