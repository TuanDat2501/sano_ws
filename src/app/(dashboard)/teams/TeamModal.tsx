"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";

export default function TeamModal({ isOpen, onClose, onSubmit, teamName, setTeamName, teamDesc, setTeamDesc, selectedDept, setSelectedDept, departments, isSubmitting }: any) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!isOpen) return null;

    const content = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl md:rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                <button onClick={onClose} className="absolute top-4 right-4 md:top-6 md:right-6 p-1.5 md:p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><X size={18} className="md:w-5 md:h-5" /></button>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1.5 md:mb-2">Tạo Team Mới</h2>
                <form onSubmit={onSubmit} className="space-y-4 md:space-y-5 mt-4 md:mt-6">
                    <div>
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Thuộc Phòng Ban</label>
                        <select className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 font-medium cursor-pointer text-sm md:text-base" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                            <option value="">-- Hoạt động Độc lập --</option>
                            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tên Team <span className="text-red-500">*</span></label>
                        <input required type="text" placeholder="VD: Team Anime" className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 outline-none text-slate-900 text-sm md:text-base" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Mô tả</label>
                        <textarea rows={2} className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 outline-none resize-none text-slate-900 text-sm md:text-base" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} />
                    </div>
                    <div className="pt-2 md:pt-4 flex flex-col-reverse sm:flex-row gap-2.5 md:gap-3">
                        <button type="button" onClick={onClose} className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl text-sm md:text-base">Hủy</button>
                        <button type="submit" disabled={isSubmitting} className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95 shadow-md shadow-red-600/20 text-sm md:text-base">
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Tạo Team"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    if (!mounted) return null;
    return createPortal(content, document.body);
}