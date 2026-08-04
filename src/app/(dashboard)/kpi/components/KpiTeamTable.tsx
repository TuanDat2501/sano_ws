import { Users, FileSpreadsheet, Loader2, Plus, Target, X, Check, Clock, Tv } from "lucide-react";
import { useState, useEffect } from "react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useToast } from "@/app/component/ToastProvider"; 
import { createPortal } from "react-dom";

export default function KpiTeamTable({ kpiList, handleUpdateTarget, onRowClick, isLoading, month }: any) {
    const [isExporting, setIsExporting] = useState(false);
    const { showToast } = useToast();
    
    // --- STATE CHO MODAL GIAO KPI ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [targetDetails, setTargetDetails] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [isSavingTarget, setIsSavingTarget] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Lấy danh sách Kênh khi mở Modal
    useEffect(() => {
        if (isModalOpen && channels.length === 0) {
            fetch("/api/channels").then(res => res.json()).then((data: any) => {
                if (Array.isArray(data)) setChannels(data);
            });
        }
    }, [isModalOpen]);

    const handleOpenTargetModal = (e: React.MouseEvent, user: any) => {
        e.stopPropagation();
        setSelectedUser(user);
        if (user.targetDetails && user.targetDetails.length > 0) {
            setTargetDetails([...user.targetDetails]);
        } else {
            setTargetDetails([]);
        }
        setIsModalOpen(true);
    };

    const handleAddTargetRow = () => {
        setTargetDetails([...targetDetails, { channelId: "", channelName: "", targetCount: 1, duration: 30 }]);
    };

    const handleRemoveTargetRow = (index: number) => {
        const newDetails = [...targetDetails];
        newDetails.splice(index, 1);
        setTargetDetails(newDetails);
    };

    const handleTargetChange = (index: number, field: string, value: any) => {
        const newDetails = [...targetDetails];
        newDetails[index][field] = value;
        
        if (field === "channelId") {
            const selectedChannel = channels.find(c => c.id === value);
            newDetails[index].channelName = selectedChannel ? selectedChannel.name : "";
        }
        
        setTargetDetails(newDetails);
    };

    const handleSaveTarget = async () => {
        const isValid = targetDetails.every(t => t.channelId && t.targetCount > 0 && t.duration > 0);
        if (targetDetails.length > 0 && !isValid) {
            showToast("error", "Vui lòng nhập đầy đủ thông tin (Kênh, Số lượng, Thời lượng)!");
            return;
        }

        setIsSavingTarget(true);
        const totalTargetCount = targetDetails.reduce((sum, item) => sum + Number(item.targetCount), 0);
        
        await handleUpdateTarget(selectedUser.userId, totalTargetCount, targetDetails);
        
        setIsSavingTarget(false);
        setIsModalOpen(false);
    };

    // 🚀 HÀM XUẤT EXCEL (ĐÃ CẬP NHẬT TÁCH CHI TIẾT CỘT THỰC ĐẠT)
    const handleExportReport = async () => {
        if (!kpiList || kpiList.length === 0) {
            showToast("error", "Chưa có dữ liệu KPI để xuất!");
            return;
        }

        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`KPI Tháng ${month}`);

            // 1. ĐỊNH NGHĨA CỘT 
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 5 },
                { header: 'Họ và tên', key: 'name', width: 25 },
                { header: 'Vị trí (Role)', key: 'role', width: 15 },
                { header: 'Kênh', key: 'channel', width: 25 },
                { header: 'Mục tiêu (Bài)', key: 'targetCount', width: 15 },
                { header: 'Thời lượng (Phút)', key: 'duration', width: 18 },
                { header: 'Thực đạt (Chi tiết)', key: 'actual', width: 20 }, // Đổi tên cột
                { header: 'Tiến độ (%)', key: 'percent', width: 15 },
                { header: 'Đánh giá', key: 'status', width: 15 },
            ];

            let currentRowIndex = 2; // Dòng 1 là Tiêu đề

            // 2. ĐỔ DỮ LIỆU VÀ GỘP Ô
            kpiList.forEach((user: any, idx: number) => {
                const isCompleted = user.percent >= 100;
                const percentText = `${user.percent}%`;
                const statusText = isCompleted ? "Đạt chỉ tiêu" : "Chưa đạt";
                const hasDetails = user.targetDetails && user.targetDetails.length > 0;
                const rowCount = hasDetails ? user.targetDetails.length : 1;
                const startRow = currentRowIndex;
                const endRow = currentRowIndex + rowCount - 1;

                if (hasDetails) {
                    user.targetDetails.forEach((detail: any) => {
                        // 🚀 Tính toán chuỗi hiển thị Thực đạt riêng cho dòng này
                        const detailActualText = detail.actualMinutes > 0 
                            ? `${detail.actualCount} bài (${detail.actualMinutes}p)` 
                            : (detail.actualCount > 0 ? `${detail.actualCount} bài` : "0");

                        worksheet.addRow({
                            stt: idx + 1,
                            name: user.fullName || "Chưa cập nhật",
                            role: user.role || "---",
                            channel: detail.channelName,
                            targetCount: detail.targetCount,
                            duration: detail.duration,
                            actual: detailActualText,
                            percent: percentText,
                            status: statusText
                        });
                    });
                } else {
                    // Fallback
                    const fallbackActualText = user.totalActualMinutes > 0 ? `${user.actualValue} bài (${user.totalActualMinutes}p)` : user.actualValue;
                    worksheet.addRow({
                        stt: idx + 1,
                        name: user.fullName || "Chưa cập nhật",
                        role: user.role || "---",
                        channel: user.targetValue > 0 ? "Mục tiêu chung" : "Chưa có chỉ tiêu",
                        targetCount: user.targetValue > 0 ? user.targetValue : 0,
                        duration: "---",
                        actual: fallbackActualText,
                        percent: percentText,
                        status: statusText
                    });
                }

                // 🚀 Gộp Ô (Chỉ gộp STT, Tên, Role, Tiến độ, Đánh giá - BỎ GỘP Thực đạt)
                if (rowCount > 1) {
                    worksheet.mergeCells(startRow, 1, endRow, 1); // STT
                    worksheet.mergeCells(startRow, 2, endRow, 2); // Tên
                    worksheet.mergeCells(startRow, 3, endRow, 3); // Role
                    // KHÔNG gộp cột 7 (Thực đạt) nữa để giữ chi tiết từng dòng
                    worksheet.mergeCells(startRow, 8, endRow, 8); // Tiến độ
                    worksheet.mergeCells(startRow, 9, endRow, 9); // Đánh giá
                }

                currentRowIndex += rowCount;
            });

            // 3. THIẾT KẾ STYLE 
            const headerRow = worksheet.getRow(1);
            headerRow.height = 30;
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
                cell.font = { name: 'Arial', bold: true, size: 11, color: { argb: '000000' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.eachCell((cell, colNumber) => {
                        cell.border = { 
                            top: { style: 'thin', color: { argb: 'E2E8F0' } }, 
                            left: { style: 'thin', color: { argb: 'E2E8F0' } }, 
                            bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, 
                            right: { style: 'thin', color: { argb: 'E2E8F0' } } 
                        };
                        
                        if (colNumber === 2 || colNumber === 4) {
                            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                        } else {
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        }
                        
                        if (colNumber === 9) {
                            if (cell.value === "Đạt chỉ tiêu") {
                                cell.font = { color: { argb: '10B981' }, bold: true }; 
                            } else if (cell.value === "Chưa đạt") {
                                cell.font = { color: { argb: 'EF4444' }, bold: true }; 
                            }
                        }
                    });
                }
            });

            worksheet.views = [{ state: 'frozen', ySplit: 1 }];
            worksheet.autoFilter = 'A1:I1';

            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `SanoWS_Bao_Cao_KPI_Thang_${month}_${new Date().getTime()}.xlsx`;
            saveAs(new Blob([buffer]), fileName);

            showToast("success", `Đã xuất báo cáo KPI tháng ${month} thành công!`);
        } catch (error) {
            console.error("Lỗi xuất Excel:", error);
            showToast("error", "Không thể xuất file Excel lúc này.");
        } finally {
            setIsExporting(false);
        }
    };

    const modalContent = isModalOpen && mounted ? createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-3xl rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Target className="text-blue-500 w-5 h-5" /> 
                        Giao Chỉ Tiêu: <span className="text-blue-600">{selectedUser?.fullName}</span>
                    </h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                    {targetDetails.length === 0 ? (
                        <div className="text-center py-10">
                            <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium mb-4">Nhân sự này chưa có chỉ tiêu phân bổ theo kênh.</p>
                            <button 
                                onClick={handleAddTargetRow}
                                className="bg-white border border-slate-200 hover:border-blue-300 text-blue-600 font-bold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-2 mx-auto"
                            >
                                <Plus size={16} /> Thêm Kênh Mục Tiêu
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {targetDetails.map((item, index) => (
                                <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-end animate-in slide-in-from-bottom-2">
                                    <div className="w-full sm:w-2/5">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                            <Tv size={12}/> Kênh Đăng
                                        </label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none font-bold"
                                            value={item.channelId}
                                            onChange={(e) => handleTargetChange(index, "channelId", e.target.value)}
                                        >
                                            <option value="" disabled>-- Chọn Kênh --</option>
                                            {channels.map((ch: any) => (
                                                <option key={ch.id} value={ch.id}>{ch.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-full sm:w-1/4">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                            <FileSpreadsheet size={12}/> Số Lượng
                                        </label>
                                        <input 
                                            type="number" min="1"
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none font-black text-center"
                                            value={item.targetCount}
                                            onChange={(e) => handleTargetChange(index, "targetCount", Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="w-full sm:w-1/4">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                            <Clock size={12}/> Phút/Video
                                        </label>
                                        <input 
                                            type="number" min="1"
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none font-black text-center text-amber-600"
                                            value={item.duration}
                                            onChange={(e) => handleTargetChange(index, "duration", Number(e.target.value))}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveTargetRow(index)}
                                        className="h-10 w-full sm:w-10 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                                        title="Xóa dòng này"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                            
                            <button 
                                onClick={handleAddTargetRow}
                                className="w-full bg-blue-50/50 hover:bg-blue-50 border border-dashed border-blue-200 text-blue-600 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Thêm Kênh Mục Tiêu Khác
                            </button>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0">
                    <button onClick={() => setIsModalOpen(false)} disabled={isSavingTarget} className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors">Hủy</button>
                    <button 
                        onClick={handleSaveTarget} 
                        disabled={isSavingTarget} 
                        className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSavingTarget ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                        {isSavingTarget ? "Đang lưu..." : "Chốt Chỉ Tiêu"}
                    </button>
                </div>
            </div>
        </div>
    , document.body) : null;

    return (
        <div className="flex flex-col h-full min-h-0">
            {modalContent}
            
            <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 bg-white z-20">
                <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2">
                    <Users className="text-blue-600 w-5 h-5 md:w-6 md:h-6" /> Thành Tích Team
                </h2>
                
                <button 
                    onClick={handleExportReport}
                    disabled={isExporting || isLoading}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-600/20 active:scale-95 text-xs md:text-sm disabled:opacity-50"
                >
                    {isExporting ? <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" /> : <FileSpreadsheet size={16} className="md:w-[18px] md:h-[18px]" />} 
                    {isExporting ? "Đang xuất..." : "Xuất báo cáo"}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar relative bg-white">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 gap-3">
                        <Loader2 size={24} className="animate-spin text-blue-500 md:w-8 md:h-8" />
                        <p className="font-medium text-xs md:text-sm">Đang tải dữ liệu KPI...</p>
                    </div>
                ) : kpiList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 gap-3">
                        <div className="bg-slate-100 p-4 md:p-6 rounded-full"><Users size={24} className="text-slate-300 md:w-8 md:h-8" /></div>
                        <p className="font-medium text-xs md:text-sm">Không có dữ liệu nhân sự.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[650px] md:min-w-[800px]">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                            <tr>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Nhân sự</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest text-left w-64">Target Chi Tiết</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest text-center w-24 md:w-32">Thực đạt</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest text-right w-32 md:w-48">Tiến độ (%)</th>
                            </tr>
                        </thead>
                        
                        <tbody className="divide-y divide-slate-100">
                            {kpiList.map((user: any) => {
                                const isCompleted = user.percent >= 100;
                                
                                return (
                                    <tr 
                                        key={user.userId} 
                                        onClick={() => onRowClick(user.userId)}
                                        className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-4 md:px-6 py-3 md:py-4">
                                            <div className="flex items-center gap-2.5 md:gap-3">
                                                <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 shrink-0 text-xs md:text-base">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt={user.fullName} className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover" />
                                                    ) :  user.fullName?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xs md:text-sm text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">{user.fullName}</p>
                                                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{user.role}</p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 md:px-6 py-3 md:py-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex flex-col gap-2 items-start">
                                                
                                                {user.targetDetails && user.targetDetails.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {user.targetDetails.map((t: any, i: number) => (
                                                            <div key={i} className="text-[10px] md:text-xs font-medium text-slate-600 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
                                                                <span className="font-bold text-slate-800">{t.channelName}</span> 
                                                                <span className="text-slate-300">|</span> 
                                                                <span className="text-blue-600 font-bold">{t.targetCount} vid</span> 
                                                                <span className="text-amber-500">({t.duration}p)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : user.targetValue > 0 ? (
                                                    <div className="text-[10px] md:text-xs font-medium text-slate-600 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
                                                        <span className="font-bold text-slate-800">Mục tiêu chung</span> 
                                                        <span className="text-slate-300">|</span> 
                                                        <span className="text-blue-600 font-bold">{user.targetValue} bài</span> 
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] md:text-xs font-bold text-slate-400 italic">Chưa giao cụ thể</span>
                                                )}
                                                
                                                <button 
                                                    onClick={(e) => handleOpenTargetModal(e, user)}
                                                    className="text-[10px] md:text-xs font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors mt-1"
                                                >
                                                    {(user.targetDetails && user.targetDetails.length > 0) || user.targetValue > 0 ? "Sửa Chỉ Tiêu" : "Giao Chỉ Tiêu"}
                                                </button>
                                            </div>
                                        </td>

                                        <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-base md:text-lg font-black text-slate-800">{user.actualValue}</span>
                                                {user.totalActualMinutes > 0 && (
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded mt-0.5 whitespace-nowrap">
                                                        {user.totalActualMinutes} Phút
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 md:gap-3">
                                                <span className={`text-xs md:text-sm font-black ${isCompleted ? 'text-emerald-600' : 'text-slate-700'}`}>
                                                    {user.percent}%
                                                </span>
                                                <div className="w-16 md:w-24 h-1.5 md:h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
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