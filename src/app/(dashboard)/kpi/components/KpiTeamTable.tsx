"use client";

import { Users, MousePointerClick, FileDown, Loader2 } from "lucide-react";
import { getProgressColor, InlineLoading } from "../utils";
import { useState } from "react";
import { exportKpiToExcel } from "../utils";

export default function KpiTeamTable({ kpiList, handleUpdateTarget, onRowClick, isLoading, teamId, year, month }: any) {
    const [isExporting, setIsExporting] = useState(false);

    const handleMonthlyExport = async () => {
        setIsExporting(true);
        try {
            const res = await fetch(`/api/kpi/monthly?teamId=${teamId}&year=${year}&month=${month}`);
            const data = await res.json();
            if (res.ok) exportKpiToExcel(data, `Bao-cao-KPI-Thang-${month}-${year}`);
        } catch (error) { console.error(error); } finally { setIsExporting(false); }
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
            <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Users size={20} className="text-blue-600" /> Thành Tích Team
                </h2>
                <button
                    onClick={handleMonthlyExport}
                    disabled={isExporting}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-green-600/20"
                >
                    {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
                    Xuất báo cáo tháng {month}
                </button>
            </div>

            {isLoading ? <InlineLoading className="h-[300px]" /> : (
                <div className="h-full">
                    {/* MOBILE LIST VIEW */}
                    <div className="md:hidden p-4 space-y-4">
                        {kpiList.map((kpi: any) => (
                            <div
                                key={kpi.userId}
                                onClick={() => onRowClick(kpi.userId)}
                                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl active:scale-[0.98] transition-transform"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-slate-900 text-base">{kpi.fullName}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">{kpi.role}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-slate-800">{kpi.actualValue}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Thực đạt</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-slate-500">Tiến độ: {kpi.percent}%</span>
                                        <span className="text-slate-800">Target: {kpi.targetValue}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                        <div className={`h-full ${getProgressColor(kpi.percent).split(' ')[0]}`} style={{ width: `${Math.min(kpi.percent, 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP TABLE VIEW (Giữ nguyên logic table cũ) */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                        {/* <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Users size={20} className="text-blue-600" /> Bảng Thành Tích Team
                            </h2>
                            <button
                                onClick={handleMonthlyExport}
                                disabled={isExporting}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                            >
                                {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
                                Xuất báo cáo tháng {month}
                            </button>
                        </div> */}

                        {/* 🚀 Ô 3: LOADING XOAY TRÒN Ở ĐÂY (PHỦ LÊN CẢ BẢNG) */}
                        {isLoading ? (
                            <InlineLoading className="h-[400px]" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600 sticky-header">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-5">Nhân sự</th>
                                            <th className="px-6 py-5 text-center w-32">Target (Bài)</th>
                                            <th className="px-6 py-5 text-center w-32">Thực đạt</th>
                                            <th className="px-6 py-5 w-64">Tiến độ (%)</th>
                                            <th className="px-6 py-5 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {kpiList.map((kpi) => (
                                            <tr
                                                key={kpi.userId}
                                                onClick={() => onRowClick(kpi.userId)}
                                                className="cursor-pointer transition-colors hover:bg-blue-50/50"
                                            >
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900 text-base">{kpi.fullName}</p>
                                                    <p className="text-xs font-black text-slate-400 mt-0.5">{kpi.role}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="number" defaultValue={kpi.targetValue}
                                                        onBlur={(e) => handleUpdateTarget(kpi.userId, e.target.value)}
                                                        className="w-20 text-center text-lg font-black text-slate-800 bg-white border border-slate-200 rounded-lg py-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-2xl font-black text-slate-800">{kpi.actualValue}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 bg-slate-200/50 rounded-full h-2.5 overflow-hidden">
                                                            <div className={`h-2.5 rounded-full ${getProgressColor(kpi.percent).split(' ')[0]}`} style={{ width: `${Math.min(kpi.percent, 100)}%` }}></div>
                                                        </div>
                                                        <span className="font-black text-sm w-12 text-right" style={{ color: kpi.percent >= 100 ? '#16a34a' : kpi.percent >= 50 ? '#d97706' : '#ef4444' }}>{kpi.percent}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <MousePointerClick size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}