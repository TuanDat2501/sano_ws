import { Users, FileSpreadsheet, Loader2 } from "lucide-react";

export default function KpiTeamTable({ kpiList, handleUpdateTarget, onRowClick, isLoading, month }: any) {
    
    // Hàm xử lý xuất Excel (Sếp có thể gắn API xuất file thật vào đây sau)
    const handleExportReport = () => {
        alert(`Đang xuất báo cáo KPI Tháng ${month}...`);
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            
            {/* ================= PHẦN HEADER CỐ ĐỊNH ================= */}
            <div className="p-6 md:p-8 border-b border-slate-100 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white z-20">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Users className="text-blue-600" size={24} /> Thành Tích Team
                </h2>
                <button 
                    onClick={handleExportReport}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm shadow-emerald-600/20 active:scale-95 text-sm"
                >
                    <FileSpreadsheet size={18} /> Xuất báo cáo tháng {month}
                </button>
            </div>

            {/* ================= PHẦN BẢNG CÓ THANH CUỘN ================= */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-white">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 gap-3">
                        <Loader2 size={32} className="animate-spin text-blue-500" />
                        <p className="font-medium">Đang tải dữ liệu KPI...</p>
                    </div>
                ) : kpiList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 gap-3">
                        <div className="bg-slate-100 p-6 rounded-full"><Users size={32} className="text-slate-300" /></div>
                        <p className="font-medium">Không có dữ liệu nhân sự.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        {/* 🚀 THEAD STICKY GIỮ CỐ ĐỊNH */}
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Nhân sự</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-32">Target (Bài)</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center w-32">Thực đạt</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-48">Tiến độ (%)</th>
                            </tr>
                        </thead>
                        
                        <tbody className="divide-y divide-slate-100">
                            {kpiList.map((user: any) => {
                                const isCompleted = user.actualValue >= user.targetValue && user.targetValue > 0;
                                
                                return (
                                    <tr 
                                        key={user.userId} 
                                        onClick={() => onRowClick(user.userId)}
                                        className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    >
                                        {/* Cột Nhân sự */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 shrink-0">
                                                    {user.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{user.fullName}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{user.role}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cột Nhập Target */}
                                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="number"
                                                defaultValue={user.targetValue}
                                                onBlur={(e) => {
                                                    if (e.target.value !== String(user.targetValue)) {
                                                        handleUpdateTarget(user.userId, e.target.value);
                                                    }
                                                }}
                                                className="w-20 text-center bg-slate-50 border border-slate-200 rounded-xl py-2 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all hover:bg-white"
                                                title="Sửa số và click ra ngoài để lưu"
                                            />
                                        </td>

                                        {/* Cột Thực đạt */}
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-lg font-black text-slate-800">{user.actualValue}</span>
                                        </td>

                                        {/* Cột Tiến độ (Progress Bar) */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className={`font-black ${isCompleted ? 'text-emerald-600' : 'text-slate-700'}`}>
                                                    {user.percent}%
                                                </span>
                                                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${Math.min(user.percent, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}