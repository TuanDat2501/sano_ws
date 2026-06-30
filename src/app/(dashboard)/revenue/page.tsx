"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, DollarSign, Check, Loader2, Eye } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/app/component/PermissionProvider";

interface RevenueEntry {
    views?: number | string;
    revenue?: number | string;
}

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
    const [focusedCol, setFocusedCol] = useState<number | null>(null);
    const [activeTooltip, setActiveTooltip] = useState<{
        content: string;
        x: number;
        y: number;
    } | null>(null);
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
        if (!loading && !hasPermission("MENU_REVENUE")) {
            router.push("/dashboard");
        }
    }, [loading, hasPermission, router]);

    // 🚀 1. GỌI API FETCH DỮ LIỆU THẬT TỪ DATABASE
    useEffect(() => {
        const fetchChannels = async () => {
            try {
                // Gọi API kéo cả danh sách Kênh + Data Doanh thu trong tuần
                const res = await fetch(`/api/revenue?startDate=${startDateStr}&endDate=${endDateStr}`);
                const data = await res.json();

                if (Array.isArray(data)) {
                    setChannels(data);

                    // Map data từ DB vào mảng State để render ra Grid Excel
                    const initialData: Record<string, RevenueEntry> = {};
                    data.forEach(channel => {
                        // Tùy thuộc vào tên relation trong Prisma (revenues hoặc dailyRevenues)
                        const revList = channel.revenues || channel.dailyRevenues || [];
                        revList.forEach((rev: any) => {
                            const dateKey = new Date(rev.date).toISOString().split('T')[0];
                            initialData[`${channel.id}_${dateKey}`] = {
                                views: rev.views || 0,
                                // Hỗ trợ cả 2 trường hợp sếp đặt tên cột là revenue hoặc amount
                                revenue: rev.revenue !== undefined ? rev.revenue : (rev.amount || 0)
                            };
                        });
                    });
                    setRevenueData(initialData);
                }
            } catch (error) {
                showToast("error", "Lỗi tải dữ liệu");
            }
        };
        if (status === "authenticated") {
            fetchChannels();
        }
    }, [startDateStr, endDateStr, showToast, status]);

    // Chuyển tuần
    const changeWeek = (offset: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + offset * 7);
        setCurrentDate(newDate);
    };

    // 🚀 2. HÀM LƯU DỮ LIỆU XUỐNG DATABASE KHI RỜI Ô (ONBLUR)
    const handleCellBlur = async (channelId: string, dateObj: Date, field: 'views' | 'revenue', value: string) => {
        const dateKey = dateObj.toISOString().split('T')[0];
        const cellKey = `${channelId}_${dateKey}`;

        // Chuyển chuỗi rỗng thành 0 để tính toán không bị lỗi
        const numValue = value.trim() === "" ? 0 : parseFloat(value);
        if (isNaN(numValue)) return;

        // Lấy lại dữ liệu cũ của ô này (để giữ nguyên trường còn lại chưa sửa)
        const currentData = revenueData[cellKey] || { views: 0, revenue: 0 };

        // Nếu số không đổi so với hiện tại thì không gọi API cho đỡ nặng Server
        if (currentData[field] === numValue) return;

        // Cập nhật State để UI hiển thị vòng quay loading
        const newData = { ...currentData, [field]: numValue };
        setSavingCells(prev => ({ ...prev, [cellKey]: 'saving' }));
        setRevenueData(prev => ({ ...prev, [cellKey]: newData }));

        try {
            const res = await fetch('/api/revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelId,
                    date: dateKey,
                    views: newData.views,
                    revenue: newData.revenue
                })
            });

            if (res.ok) {
                setSavingCells(prev => ({ ...prev, [cellKey]: 'saved' }));
                setTimeout(() => setSavingCells(prev => ({ ...prev, [cellKey]: null })), 2000);
            } else {
                showToast("error", "Lưu thất bại!");
                setSavingCells(prev => ({ ...prev, [cellKey]: null }));
                // Nếu lỗi thì hoàn tác lại UI
                setRevenueData(prev => ({ ...prev, [cellKey]: currentData }));
            }
        } catch (error) {
            showToast("error", "Lỗi Server!");
            setSavingCells(prev => ({ ...prev, [cellKey]: null }));
            setRevenueData(prev => ({ ...prev, [cellKey]: currentData }));
        }
    };

    // 🚀 BƯỚC 1: SẮP XẾP VÀ ĐẾM SỐ LƯỢNG KÊNH ĐỂ GỘP Ô
    const sortedChannels = [...channels].sort((a, b) => {
        const nameA = a.team?.name || "ZZZ";
        const nameB = b.team?.name || "ZZZ";
        return nameA.localeCompare(nameB);
    });

    const teamCounts: Record<string, number> = {};
    sortedChannels.forEach(ch => {
        const tName = ch.team?.name || "No Team";
        teamCounts[tName] = (teamCounts[tName] || 0) + 1;
    });

    let currentTeamForRender = "";

    return (
        <div className="p-4 md:p-6 bg-slate-50 h-full max-h-[calc(100vh-80px)] flex flex-col overflow-hidden animate-fade-in">

            {/* Header Bộ lọc giữ nguyên */}
            <div className="mb-4 md:mb-6 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-4 relative z-10">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                        <DollarSign className="text-emerald-500" /> Bảng Kê Doanh Thu Kênh
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Nhập liệu doanh thu hằng ngày (USD).</p>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto justify-between">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"><ChevronLeft size={20} /></button>
                    <div className="text-sm font-black text-slate-700 px-2 uppercase tracking-widest whitespace-nowrap">
                        {days[0].toLocaleDateString('vi-VN')} - {days[6].toLocaleDateString('vi-VN')}
                    </div>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* 🚀 VÙNG CHỨA BẢNG CÓ THANH CUỘN */}
            <div className="flex-1 overflow-auto custom-scrollbar relative bg-white border border-slate-200 rounded-2xl shadow-sm">
                
                {/* 🚀 THÊM h-full VÀO ĐÂY LÀ CHÌA KHÓA: Bảng luôn cao bằng thẻ div cha, đẩy tfoot xuống đáy */}
                <table className="w-full h-full text-left border-separate border-spacing-0 min-w-[1000px]">

                    <thead className="sticky top-0 z-[60] bg-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-b-2 border-slate-300">
                        <tr className="text-slate-700 text-[10px] font-black uppercase tracking-widest">
                            <th className="p-3 border-r border-slate-300 sticky left-0 z-[70] bg-slate-200 w-[100px] text-center">Team</th>
                            <th className="p-3 border-r border-slate-300 sticky left-[100px] z-[70] bg-slate-200 w-[50px] text-center">STT</th>
                            <th className="p-3 border-r border-slate-300 sticky left-[150px] z-[70] bg-slate-200 w-[200px]">Tên Kênh</th>

                            {days.map((day, idx) => (
                                <th key={idx} className={`p-3 border-r border-slate-300 text-center w-[10%] transition-colors duration-300 ${focusedCol === idx ? 'bg-blue-100 border-blue-300 shadow-inner' : 'bg-slate-100'}`}>
                                    <div className={`mb-1 transition-colors ${focusedCol === idx ? 'text-blue-700 font-black' : 'text-slate-500'}`}>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][idx]}</div>
                                    <div className={`text-sm ${day.toDateString() === new Date().toDateString() ? 'text-red-600 font-black' : (focusedCol === idx ? 'text-blue-800 font-black' : '')}`}>
                                        {day.getDate()}/{day.getMonth() + 1}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {sortedChannels.length === 0 ? (
                            <tr><td colSpan={10} className="p-8 h-full text-center align-top pt-20 text-slate-400 italic">Chưa có dữ liệu.</td></tr>
                        ) : (
                            sortedChannels.map((channel, index) => {
                                const teamName = channel.team?.name || "No Team";
                                const isFirstRowOfTeam = teamName !== currentTeamForRender;
                                if (isFirstRowOfTeam) currentTeamForRender = teamName;
                                const rowSpanCount = teamCounts[teamName];
                                const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-[#f4f5f7]";

                                return (
                                    <tr key={channel.id} className={`${rowBgClass} hover:bg-[#e2e8f0] focus-within:bg-blue-50/50 transition-colors group`}>

                                        {isFirstRowOfTeam && (
                                            <td rowSpan={rowSpanCount} className={`p-2 border-b border-r border-slate-300 sticky left-0 z-40 bg-slate-100 align-middle text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`}>
                                                <span className="font-black text-slate-600 text-xs md:text-sm uppercase tracking-widest">{teamName}</span>
                                            </td>
                                        )}

                                        <td className={`p-2 border-b border-r border-slate-200 sticky left-[100px] z-30 ${rowBgClass} group-hover:bg-[#e2e8f0] group-focus-within:bg-blue-50/50 transition-colors text-center font-bold text-slate-500`}>
                                            {index + 1}
                                        </td>

                                        <td className={`p-3 border-b border-r border-slate-200 sticky left-[150px] z-30 ${rowBgClass} group-hover:bg-[#e2e8f0] group-focus-within:bg-blue-50/50 transition-colors shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]`}>
                                            <p className="font-bold text-sm text-slate-800 line-clamp-2" title={channel.name}>{channel.name}</p>
                                        </td>

                                        {days.map((day, idx) => {
                                            const dateKey = day.toISOString().split('T')[0];
                                            const cellKey = `${channel.id}_${dateKey}`;
                                            const data = revenueData[cellKey] || { revenue: "", views: "" };
                                            const cellState = savingCells[cellKey];
                                            const isMonetized = channel.monetization;
                                            
                                            // 🚀 TOOLTIP LOGIC ĐÃ ĐƯỢC RESTORE
                                            const handleFocus = (e: React.FocusEvent<HTMLInputElement>, channelName: string, day: Date, currentData: any, type: 'views' | 'revenue') => {
                                                setFocusedCol(idx);
                                                const rect = e.target.getBoundingClientRect();
                                                const dateStr = `${day.getDate()}/${day.getMonth() + 1}`;
                                                
                                                let info = "";
                                                if (type === 'views') {
                                                    const views = currentData.views !== "" ? Number(currentData.views).toLocaleString() : "0";
                                                    info = `Views`;
                                                } else {
                                                    const revenue = currentData.revenue !== "" ? `$${Number(currentData.revenue).toLocaleString()}` : "$0";
                                                    info = `Doanh thu`;
                                                }

                                                setActiveTooltip({
                                                    content: `${dateStr} - ${channelName} - ${info}`,
                                                    x: rect.left + rect.width / 2,
                                                    y: rect.top - 40
                                                });
                                            };

                                            return (
                                                <td key={idx} className={`p-1.5 border-b border-r border-slate-200/50 last:border-r-0 relative transition-colors duration-300 ${focusedCol === idx ? 'bg-blue-50/40' : ''}`}>
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                placeholder="0"
                                                                className="w-full text-right pr-2 py-1.5 text-xs font-bold bg-transparent border border-slate-200/60 rounded-md focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-slate-700 hover:bg-black/5"
                                                                defaultValue={data.views !== "" && data.views !== 0 ? Number(data.views).toLocaleString('en-US') : ""}
                                                                onFocus={(e) => handleFocus(e, channel.name, day, data, 'views')}
                                                                onChange={(e) => {
                                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                                    e.target.value = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                                }}
                                                                onBlur={(e) => {
                                                                    setFocusedCol(null);
                                                                    setActiveTooltip(null);
                                                                    const rawVal = e.target.value.replace(/,/g, '');
                                                                    handleCellBlur(channel.id, day, 'views', rawVal);
                                                                }}
                                                            />
                                                            <Eye className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 opacity-60 pointer-events-none" size={13} strokeWidth={3} />
                                                        </div>

                                                        <div className="relative min-h-[32px] flex items-center">
                                                            {isMonetized === 'DA_BAT' ? (
                                                                <>
                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        placeholder="0"
                                                                        className="w-full text-right pr-2 py-1.5 text-xs font-black bg-emerald-50/30 border border-emerald-200/60 rounded-md focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all text-emerald-700 hover:bg-emerald-50/80"
                                                                        defaultValue={data.revenue !== "" && data.revenue !== 0 ? Number(data.revenue).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ""}
                                                                        onFocus={(e) => handleFocus(e, channel.name, day, data, 'revenue')}
                                                                        onChange={(e) => {
                                                                            let rawValue = e.target.value.replace(/[^\d.]/g, '');
                                                                            const parts = rawValue.split('.');
                                                                            if (parts.length > 2) parts.pop();
                                                                            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                                            e.target.value = parts.join('.');
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            setFocusedCol(null);
                                                                            setActiveTooltip(null);
                                                                            const rawVal = e.target.value.replace(/,/g, '');
                                                                            handleCellBlur(channel.id, day, 'revenue', rawVal);
                                                                        }}
                                                                    />
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500 uppercase select-none pointer-events-none">$</span>
                                                                </>
                                                            ) : (
                                                                <div className="w-full py-1.5 px-2 bg-black/5 rounded-md border border-dashed border-black/10 text-center">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none italic">
                                                                        Chưa BKT
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {cellState === 'saving' && <Loader2 className="absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-slate-400" size={14} />}
                                                    {cellState === 'saved' && <Check className="absolute top-1/2 right-4 -translate-y-1/2 text-emerald-500" size={14} />}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )
                            })
                        )}
                        {/* Dòng ma để đẩy tbody full height nếu cần thiết (không bắt buộc) */}
                        {sortedChannels.length > 0 && <tr><td colSpan={10} className="h-full border-0 p-0"></td></tr>}
                    </tbody>

                    {/* 🚀 TFOOT GHIM ĐÁY, CỘT ĐẦU CŨNG GHIM TRÁI */}
                    <tfoot className="sticky bottom-0 z-[60] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-slate-800">
                        <tr className="text-white font-black">
                            <td colSpan={3} className="p-4 border-r border-slate-700 uppercase tracking-widest text-xs sticky left-0 z-[70] bg-slate-800 text-center">
                                Tổng Cả Hệ Thống
                            </td>
                            {dailyTotals.map((total, idx) => (
                                <td key={idx} className="p-2 border-r border-slate-700 last:border-r-0 bg-slate-800">
                                    <div className="flex flex-col gap-1.5 text-right pr-2">
                                        <div className="text-[11px] text-blue-300 font-bold tracking-tight flex items-center justify-end gap-1">
                                            {total.views.toLocaleString()} <Eye size={11} strokeWidth={3} className="opacity-60" />
                                        </div>
                                        <div className="text-sm text-emerald-400 font-black tracking-tight drop-shadow-sm">
                                            <span className="text-[10px] font-black opacity-50 uppercase mr-0.5">$</span>
                                            {total.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* 🚀 BƯỚC 3: UI TOOLTIP BAY (Dùng Portal hoặc Fixed) */}
            {activeTooltip && (
                <div
                    className="fixed z-[9999] pointer-events-none transition-all duration-200"
                    style={{ left: activeTooltip.x, top: activeTooltip.y, transform: 'translateX(-50%)' }}
                >
                    <div className="bg-slate-800 text-white px-3 py-2 rounded-xl text-[11px] font-black shadow-2xl flex items-center gap-2 whitespace-nowrap animate-bounce-subtle border border-slate-700">
                        {activeTooltip.content}
                        {/* Mũi tên nhỏ phía dưới */}
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45 border-r border-b border-slate-700"></div>
                    </div>
                </div>
            )}
        </div>
    );
}