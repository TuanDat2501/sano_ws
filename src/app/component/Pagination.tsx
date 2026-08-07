"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  itemName?: string; // Ví dụ: "task", "video", "người dùng"...
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  itemName = "mục"
}: PaginationProps) {
  if (totalPages <= 1 && totalItems === 0) return null;

  // Thuật toán rút gọn số trang (hiển thị dấu ...)
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white border-t border-slate-100 shrink-0 gap-3 md:gap-0 w-full">
      {/* Thông tin số lượng */}
      <span className="text-xs md:text-sm text-slate-500 font-medium text-center sm:text-left">
        Hiển thị <span className="font-bold text-slate-700">{totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, totalItems)}</span> / <span className="font-bold text-slate-700">{totalItems}</span> {itemName}
      </span>

      {/* Cụm nút điều hướng */}
      <div className="flex items-center gap-1 md:gap-1.5">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors active:scale-95"
          title="Trang trước"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            page === "..." ? (
              <div key={`ellipsis-${index}`} className="px-1.5 text-slate-300 flex items-center justify-center">
                <MoreHorizontal size={16} />
              </div>
            ) : (
              <button
                key={index}
                onClick={() => onPageChange(page as number)}
                className={`min-w-[32px] h-8 md:min-w-[36px] md:h-9 flex items-center justify-center rounded-lg text-xs md:text-sm font-bold transition-all active:scale-95 ${
                  currentPage === page
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {page}
              </button>
            )
          ))}
        </div>

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors active:scale-95"
          title="Trang sau"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}