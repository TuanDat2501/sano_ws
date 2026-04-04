"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

// 1. Định nghĩa kiểu dữ liệu cho Toast
type ToastType = "success" | "error";

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
        <div className="fixed top-6 right-6 z-[9999] transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-5 slide-in-from-right-8">
          <div className="bg-white rounded-[24px] shadow-2xl shadow-slate-900/10 p-5 w-96 border border-slate-100 flex items-start gap-4">
            
            {/* ICON */}
            {toast.type === "success" ? (
              <CheckCircle2 className="w-10 h-10 text-green-500 bg-green-50 rounded-xl p-2 shrink-0" />
            ) : (
              <AlertCircle className="w-10 h-10 text-red-600 bg-red-50 rounded-xl p-2 shrink-0" />
            )}
            
            {/* NỘI DUNG */}
            <div className="flex-grow pt-0.5">
              <h4 className={`font-black text-slate-900 mb-1 leading-none ${toast.type === "error" ? "text-red-700" : ""}`}>
                {toast.type === "success" ? "Thành công!" : "Thông báo"}
              </h4>
              <p className={`text-sm font-medium ${toast.type === "error" ? "text-red-600/90" : "text-slate-600"}`}>
                {toast.message}
              </p>
            </div>

            {/* NÚT TẮT */}
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-700 p-1.5 -m-1.5 rounded-lg hover:bg-slate-50 shrink-0 transition-colors"
            >
              <X size={16} />
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