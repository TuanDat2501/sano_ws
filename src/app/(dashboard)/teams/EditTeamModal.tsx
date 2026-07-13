"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";

export default function EditTeamModal({ 
    isOpen, onClose, onSubmit, 
    teamName, setTeamName, 
    teamDesc, setTeamDesc, 
    selectedDept, setSelectedDept, 
    departments, isSubmitting 
}: any) {
    // Xử lý Hydration mismatch trong Next.js khi dùng Portal
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!isOpen) return null;

    const content = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl md:rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                {/* Nút tắt */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 md:top-6 md:right-6 p-1.5 md:p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                    <X size={18} className="md:w-5 md:h-5" />
                </button>
                
                {/* Tiêu đề */}
                <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1.5 md:mb-2">Sửa Thông Tin Team</h2>
                <p className="text-slate-500 font-medium mb-5 md:mb-8 text-xs md:text-sm">
                    Cập nhật thông tin chi tiết của <span className="font-bold text-slate-800">{teamName || "Team"}</span>
                </p>

                <form onSubmit={onSubmit} className="space-y-4 md:space-y-5">
                    {/* Tên Team */}
                    <div>
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                            Tên Team <span className="text-red-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            required
                            placeholder="Nhập tên team..."
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 font-medium text-sm md:text-base transition-all"
                        />
                    </div>

                    {/* Phòng ban */}
                    <div>
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                            Thuộc Phòng ban
                        </label>
                        <select 
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 font-medium text-sm md:text-base cursor-pointer transition-all"
                        >
                            <option value="">-- Team Độc Lập --</option>
                            {departments.map((dept: any) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mô tả */}
                    <div>
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                            Mô tả (Không bắt buộc)
                        </label>
                        <textarea 
                            rows={3}
                            placeholder="Chức năng, nhiệm vụ của team..."
                            value={teamDesc}
                            onChange={(e) => setTeamDesc(e.target.value)}
                            className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 font-medium text-sm md:text-base resize-none transition-all"
                        ></textarea>
                    </div>

                    {/* Nút hành động */}
                    <div className="pt-2 md:pt-4 flex flex-col-reverse sm:flex-row gap-2.5 md:gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl text-sm md:text-base transition-all"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95 text-sm md:text-base disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    if (!mounted) return null;
    return createPortal(content, document.body); // Quan trọng nhất để fix lỗi đè UI
}