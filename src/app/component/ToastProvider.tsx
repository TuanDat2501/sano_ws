"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

// 1. Định nghĩa kiểu dữ liệu cho Toast (Thêm "info" để linh hoạt hơn)
type ToastType = "success" | "error" | "info";

interface ToastData {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

// 2. Khởi tạo Context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// 3. Tạo Provider bọc toàn bộ App
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now();
    setToast({ id, type, message });

    // Tự động đóng sau 3 giây
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* GIAO DIỆN TOAST (Sẽ nổi lên trên mọi trang web) */}
      {toast && (
        // 🚀 RESPONSIVE: Mobile căn giữa đỉnh màn hình (left-4 right-4), PC dồn góc phải (md:left-auto md:right-6)
        <div className="fixed top-4 left-4 right-4 md:left-auto md:top-6 md:right-6 z-[9999] transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-4 md:slide-in-from-right-8 flex justify-center md:justify-end pointer-events-none">
          
          {/* Box Toast: Chiếm w-full (nhưng bị giới hạn max-w-sm) trên Mobile, w-96 trên PC */}
          <div className="bg-white/95 backdrop-blur-md rounded-[20px] md:rounded-[24px] shadow-2xl shadow-slate-900/10 p-3.5 md:p-5 w-full max-w-sm md:max-w-none md:w-96 border border-slate-200/60 flex items-start gap-3 md:gap-4 pointer-events-auto">
            
            {/* ICON (Tự động co nhỏ trên mobile) */}
            {toast.type === "success" ? (
              <div className="bg-green-50 rounded-lg md:rounded-xl p-1.5 md:p-2 shrink-0">
                <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
              </div>
            ) : toast.type === "error" ? (
              <div className="bg-red-50 rounded-lg md:rounded-xl p-1.5 md:p-2 shrink-0">
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
              </div>
            ) : (
              <div className="bg-blue-50 rounded-lg md:rounded-xl p-1.5 md:p-2 shrink-0">
                <Info className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
              </div>
            )}
            
            {/* NỘI DUNG */}
            <div className="flex-grow pt-0.5 min-w-0">
              <h4 className={`font-black text-[13px] md:text-sm mb-0.5 md:mb-1 leading-none ${toast.type === "error" ? "text-red-700" : "text-slate-900"}`}>
                {toast.type === "success" ? "Thành công!" : toast.type === "error" ? "Lỗi!" : "Thông báo"}
              </h4>
              <p className={`text-[11px] md:text-sm font-medium leading-snug break-words ${toast.type === "error" ? "text-red-600/90" : "text-slate-600"}`}>
                {toast.message}
              </p>
            </div>

            {/* NÚT TẮT */}
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-700 p-1 md:p-1.5 -m-1 md:-m-1.5 rounded-lg hover:bg-slate-100 shrink-0 transition-colors active:scale-90"
            >
              <X size={16} className="md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

// 4. Hook tùy chỉnh để sử dụng gọn nhẹ ở mọi nơi
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast phải được sử dụng bên trong ToastProvider");
  }
  return context;
};