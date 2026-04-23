"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, DollarSign, Check, Loader2, Eye } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/app/component/PermissionProvider";
// 🚀 1. DATA MOCKUP CHO DANH SÁCH KÊNH (Lấy từ Excel thật của sếp)

interface RevenueEntry {
    views?: number | string;
    revenue?: number | string;
}
const MOCK_CHANNELS = [
    { id: "c1", name: "Kova - Wild Animals", team: { name: "NOVA" } },
    { id: "c2", name: "WUFO - Space Documentary", team: { name: "WEVIC" } },
    { id: "c3", name: "Hider Planet", team: { name: "PUNCH" } },
    { id: "c4", name: "Banana Planet TV", team: { name: "AVENGER" } },
    { id: "c5", name: "Rabo Science", team: { name: "RAMBO" } }
];

// 🚀 2. HÀM TẠO SỐ LIỆU ĐỘNG (Bám theo các ngày sếp đang xem trên màn hình)
const generateMockRevenueData = (days: Date[]) => {
    const data: Record<string, { views: number, revenue: number }> = {};

    // Ngày 1 (Thứ 2 trong tuần) - Tương đương cột 1/4 trong Excel
    const d0 = days[0].toISOString().split('T')[0];
    data[`c1_${d0}`] = { views: 171000, revenue: 164 };
    data[`c2_${d0}`] = { views: 91000, revenue: 463 };
    data[`c3_${d0}`] = { views: 1900000, revenue: 3490 };
    data[`c4_${d0}`] = { views: 100000, revenue: 818 };
    data[`c5_${d0}`] = { views: 231, revenue: 169 };

    // Ngày 2 (Thứ 3 trong tuần) - Tương đương cột 2/4 trong Excel
    const d1 = days[1].toISOString().split('T')[0];
    data[`c1_${d1}`] = { views: 177600, revenue: 0 }; // Chỗ này bôi đỏ "dừng"
    data[`c2_${d1}`] = { views: 90000, revenue: 211 };
    data[`c3_${d1}`] = { views: 2000000, revenue: 3205 };
    data[`c4_${d1}`] = { views: 122000, revenue: 422 };
    data[`c5_${d1}`] = { views: 0, revenue: 0 };

    return data;
};
// Tiện ích lấy ra mảng 7 ngày của 1 tuần (Tính từ ngày đang chọn)
const getDaysOfWeek = (currentDate: Date) => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Đưa về Thứ 2
    startOfWeek.setDate(diff);

    return Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        return date;
    });
};

export default function RevenueEntryPage() {
    const { showToast } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [channels, setChannels] = useState<any[]>([]);
    const [revenueData, setRevenueData] = useState<Record<string, RevenueEntry>>({});
    const [savingCells, setSavingCells] = useState<Record<string, 'saving' | 'saved' | null>>({});

    const days = getDaysOfWeek(currentDate);
    const startDateStr = days[0].toISOString().split('T')[0];
    const endDateStr = days[6].toISOString().split('T')[0];
    const { data: session, status } = useSession();
    const router = useRouter();

    const { hasPermission, loading } = usePermission();


    // 🚀 TÍNH TOÁN TỔNG NGÀY TRONG TUẦN
    const dailyTotals = useMemo(() => {
        return days.map(day => {
            const dateKey = day.toISOString().split('T')[0];
            let totalViews = 0;
            let totalRevenue = 0;

            // Quét qua tất cả các kênh để cộng dồn theo ngày
            channels.forEach(channel => {
                const cellKey = `${channel.id}_${dateKey}`;
                const data = revenueData[cellKey];
                if (data) {
                    totalViews += Number(data.views || 0);
                    totalRevenue += Number(data.revenue || 0);
                }
            });

            return { views: totalViews, revenue: totalRevenue };
        });
    }, [days, channels, revenueData]);
    useEffect(() => {
        // Chỉ xử lý khi hệ thống đã load quyền xong
        if (!loading) {
            if (!hasPermission("MENU_REVENUE")) {
                router.push("/dashboard"); // Không có mã quyền thì đuổi ra ngoài
            }
        }
    }, [loading, hasPermission, router]);




    // Fetch dữ liệu khi đổi tuần
    useEffect(() => {
        const fetchChannels = async () => {
            try {
                /* const res = await fetch(`/api/revenue?startDate=${startDateStr}&endDate=${endDateStr}`);
                const data = await res.json();

                if (Array.isArray(data)) {
                    setChannels(data);
                    // Map data từ DB vào mảng State để render ra Grid Excel
                    const initialData: Record<string, number> = {};
                    data.forEach(channel => {
                        channel.revenues.forEach((rev: any) => {
                            const dateKey = new Date(rev.date).toISOString().split('T')[0];
                            initialData[`${channel.id}_${dateKey}`] = rev.amount;
                        });
                    });
                    setRevenueData(initialData);
                } */
                setChannels(MOCK_CHANNELS);
                const mockData = generateMockRevenueData(days);
                setRevenueData(mockData);
            } catch (error) {
                showToast("error", "Lỗi tải dữ liệu");
            }
        };
        fetchChannels();
    }, [startDateStr, endDateStr, showToast]);

    // Chuyển tuần
    const changeWeek = (offset: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + offset * 7);
        setCurrentDate(newDate);
    };

    // Khi Kế toán nhập và rời khỏi ô (onBlur) -> Auto Save
    const handleCellBlur = async (channelId: string, dateObj: Date, value: string) => {
        const dateKey = dateObj.toISOString().split('T')[0];
        const cellKey = `${channelId}_${dateKey}`;
        const numValue = parseFloat(value);

        // Nếu ô trống hoặc không phải số thì bỏ qua
        if (isNaN(numValue)) return;

        // Nếu số không đổi so với DB thì không cần gọi API
        if (revenueData[cellKey] === numValue) return;

        setSavingCells(prev => ({ ...prev, [cellKey]: 'saving' }));
        setRevenueData(prev => ({ ...prev, [cellKey]: numValue as any }));

        try {
            const res = await fetch('/api/revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, date: dateKey, amount: numValue })
            });

            if (res.ok) {
                setSavingCells(prev => ({ ...prev, [cellKey]: 'saved' }));
                setTimeout(() => setSavingCells(prev => ({ ...prev, [cellKey]: null })), 2000);
            } else {
                showToast("error", "Lưu thất bại!");
                setSavingCells(prev => ({ ...prev, [cellKey]: null }));
            }
        } catch (error) {
            showToast("error", "Lỗi Server!");
            setSavingCells(prev => ({ ...prev, [cellKey]: null }));
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <DollarSign className="text-emerald-500" /> Bảng Kê Doanh Thu Kênh
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">Nhập liệu doanh thu hằng ngày (USD).</p>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"><ChevronLeft size={20} /></button>
                    <div className="text-sm font-black text-slate-700 px-2 uppercase tracking-widest">
                        {days[0].toLocaleDateString('vi-VN')} - {days[6].toLocaleDateString('vi-VN')}
                    </div>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                            <th className="p-4 border-b border-r border-slate-200 w-1/4">Tên Kênh</th>
                            {days.map((day, idx) => (
                                <th key={idx} className="p-4 border-b border-slate-200 text-center w-[10%]">
                                    <div className="text-slate-400 mb-1">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][idx]}</div>
                                    <div className={`text-sm ${day.toDateString() === new Date().toDateString() ? 'text-emerald-600 bg-emerald-100 rounded-md py-0.5' : ''}`}>
                                        {day.getDate()}/{day.getMonth() + 1}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {channels.map((channel) => (
                            <tr key={channel.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                <td className="p-4 border-r border-slate-200">
                                    <p className="font-bold text-sm text-slate-800">{channel.name}</p>
                                    <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50 inline-block px-2 py-0.5 rounded mt-1">{channel.team?.name}</p>
                                </td>

                                {days.map((day, idx) => {
                                    const dateKey = day.toISOString().split('T')[0];
                                    const cellKey = `${channel.id}_${dateKey}`;

                                    // Giả sử revenueData lúc này chứa object: { revenue: 100, views: 50000 }
                                    const data = revenueData[cellKey] || { revenue: "", views: "" };
                                    const cellState = savingCells[cellKey];

                                    return (
                                        <td key={idx} className="p-1 border-r border-slate-100 last:border-0 relative group">
                                            <div className="flex flex-col gap-1.5 p-1">
                                                {/* 🚀 1. Input nhập VIEW (Tview) - Chỉ cho phép số nguyên */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="0"
                                                        className="w-full text-right pr-2 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200/60 rounded-md focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700 placeholder:text-slate-300"
                                                        defaultValue={data.views !== "" ? Number(data.views).toLocaleString('en-US') : ""}

                                                        // XỬ LÝ FORMAT REAL-TIME KHI GÕ
                                                        onChange={(e) => {
                                                            // Bước 1: Lọc bỏ mọi thứ không phải là số (để tránh gõ chữ)
                                                            const rawValue = e.target.value.replace(/\D/g, '');
                                                            // Bước 2: Tự động chèn dấu phẩy mỗi 3 số và gán ngược lại vào ô input
                                                            e.target.value = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                        }}

                                                        // KHI CLICK RA NGOÀI -> LƯU DATABASE
                                                        onBlur={(e) => {
                                                            const rawVal = e.target.value.replace(/,/g, '');
                                                            const numVal = parseFloat(rawVal);

                                                            if (!isNaN(numVal)) {
                                                                handleCellBlur(channel.id, day, "views"); // Chỉ truyền chuỗi "views"
                                                            } else {
                                                                e.target.value = "";
                                                                handleCellBlur(channel.id, day, "views"); // Chỉ truyền chuỗi "views"
                                                            }
                                                        }}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase select-none pointer-events-none">V</span>
                                                </div>

                                                {/* 🚀 2. Input nhập TIỀN (DThu) - Cho phép số thập phân */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0"
                                                        className="w-full text-right pr-2 py-1.5 text-xs font-black bg-emerald-50/50 border border-emerald-100 rounded-md focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-emerald-700 placeholder:text-emerald-200"
                                                        defaultValue={data.revenue !== "" ? Number(data.revenue).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ""}

                                                        // XỬ LÝ FORMAT REAL-TIME KHI GÕ
                                                        onChange={(e) => {
                                                            // Bước 1: Lọc bỏ chữ, CHỈ giữ lại số và đúng 1 dấu chấm (.) thập phân
                                                            let rawValue = e.target.value.replace(/[^\d.]/g, '');
                                                            const parts = rawValue.split('.');
                                                            if (parts.length > 2) parts.pop(); // Chặn gõ 2 dấu chấm (VD: 1.5.0)

                                                            // Bước 2: Thêm dấu phẩy cho phần nguyên, giữ nguyên phần thập phân
                                                            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                            e.target.value = parts.join('.');
                                                        }}

                                                        // KHI CLICK RA NGOÀI -> LƯU DATABASE
                                                        onBlur={(e) => {
                                                            const rawVal = e.target.value.replace(/,/g, '');
                                                            const numVal = parseFloat(rawVal);

                                                            if (!isNaN(numVal)) {
                                                                handleCellBlur(channel.id, day, String(numVal)); // Tham số 3 là string, 4 là value
                                                            } else {
                                                                e.target.value = "";
                                                                handleCellBlur(channel.id, day, ""); // Tham số 3 là string, 4 là rỗng
                                                            }
                                                        }}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-400 uppercase select-none pointer-events-none">$</span>
                                                </div>
                                            </div>
                                            {/* Hiệu ứng Auto-save */}
                                            {cellState === 'saving' && <Loader2 className="absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-slate-400" size={14} />}
                                            {cellState === 'saved' && <Check className="absolute top-1/2 right-4 -translate-y-1/2 text-emerald-500" size={14} />}
                                        </td>
                                    );
                                })}
                            </tr>

                        ))}
                        <tr className="bg-slate-800 text-white font-black shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] relative z-20">
                            <td className="p-4 border-r border-slate-700 uppercase tracking-widest text-xs">
                                Tổng Ngày
                            </td>
                            {dailyTotals.map((total, idx) => (
                                <td key={idx} className="p-2 border-r border-slate-700 last:border-0 bg-slate-900/40">
                                    <div className="flex flex-col gap-1.5 text-right pr-2">
                                        {/* Tổng View Ngày - Format số phẩy */}
                                        <div className="text-[11px] text-blue-300 font-bold tracking-tight">
                                            {total.views > 0 ? total.views.toLocaleString() : "0"} <span className="text-[9px] font-black opacity-50 uppercase ml-0.5">V</span>
                                        </div>
                                        {/* Tổng Doanh Thu Ngày - Format số phẩy */}
                                        <div className="text-sm text-emerald-400 font-black tracking-tight drop-shadow-sm">
                                            <span className="text-[10px] font-black opacity-50 uppercase mr-0.5">$</span>
                                            {total.revenue > 0 ? total.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "0"}
                                        </div>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}