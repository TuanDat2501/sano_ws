// File: src/app/kpi/utils.tsx (Nhớ đổi đuôi thành .tsx nhé sếp)

import * as XLSX from 'xlsx';

export const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500 text-green-500";
    if (percent >= 50) return "bg-amber-400 text-amber-400";
    return "bg-red-500 text-red-500";
};

// Bây giờ file có đuôi .tsx rồi thì viết thẻ <div> thoải mái
export const InlineLoading = ({ className = "" }: { className?: string }) => (
    <div className={`flex flex-col justify-center items-center gap-3 py-10 w-full h-full text-slate-400 ${className}`}>
        <div className="w-9 h-9 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin"></div>
        <span className="text-sm font-medium">Đang tải dữ liệu...</span>
    </div>
);

export const exportKpiToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bao-cao-KPI");
    
    // Tự động căn chỉnh độ rộng cột
    const wscols = [
        {wch: 25}, {wch: 15}, 
        {wch: 12}, {wch: 12}, {wch: 12}, // Tuần 1
        {wch: 12}, {wch: 12}, {wch: 12}, // Tuần 2
        {wch: 12}, {wch: 12}, {wch: 12}, // Tuần 3
        {wch: 12}, {wch: 12}, {wch: 12}, // Tuần 4
        {wch: 18}, {wch: 18}, {wch: 18}, // Tổng kết
        {wch: 18}, {wch: 18}, {wch: 18}, {wch: 12}, {wch: 25}, {wch: 15} // Phân loại & Đánh giá
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};