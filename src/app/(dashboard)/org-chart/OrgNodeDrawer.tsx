import { X, UserCircle2, Briefcase, Target, CheckCircle2 } from "lucide-react";

export default function OrgNodeDrawer({ isOpen, onClose, nodeData }: { isOpen: boolean, onClose: () => void, nodeData: any }) {
    if (!nodeData) return null;

    return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                    onClick={onClose}
                ></div>
            )}
            
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[420px] bg-white shadow-2xl z-[100] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* --- HEADER DRAWER --- */}
                <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 shrink-0">
                    <div className="flex gap-3 md:gap-4 items-center">
                        {!nodeData.isSystemNode && (
                            nodeData.avatar ? (
                                <img src={nodeData.avatar} alt="avatar" className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white shadow-md shrink-0" />
                            ) : (
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-500 text-lg md:text-xl border-2 border-white shadow-md shrink-0">
                                    {nodeData.label.charAt(0).toUpperCase()}
                                </div>
                            )
                        )}
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{nodeData.label}</h2>
                            <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest mt-1 ${nodeData.textColor}`}>{nodeData.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 md:p-2.5 bg-white rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-100 transition-all active:scale-95 shrink-0">
                        <X size={18} className="md:w-5 md:h-5" />
                    </button>
                </div>

                {/* --- BODY DRAWER --- */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-white custom-scrollbar">
                    {nodeData.fullUserObj ? (
                        <div className="space-y-4 md:space-y-6">
                            <div className="bg-slate-50 p-4 rounded-xl md:rounded-2xl border border-slate-100 space-y-2 md:space-y-3">
                                <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2 md:mb-3">Thông tin hồ sơ</h3>
                                <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-slate-600">
                                    <UserCircle2 size={16} className="text-slate-400" /> 
                                    Tài khoản: <span className="font-bold text-slate-900 truncate">{nodeData.fullUserObj.username}</span>
                                </div>
                                <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-slate-600">
                                    <Briefcase size={16} className="text-slate-400" /> 
                                    Thuộc team: <span className="font-bold text-slate-900 truncate">{nodeData.fullUserObj.team?.name || "Độc lập"}</span>
                                </div>
                            </div>

                            {nodeData.target !== undefined && (
                                <div className="bg-blue-50/50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-blue-100 space-y-3 md:space-y-4">
                                    <h3 className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
                                        <Target size={14} /> Hiệu suất tuần này
                                    </h3>
                                    
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-2xl md:text-3xl font-black text-blue-700 leading-none">{nodeData.actual}</p>
                                            <p className="text-[10px] md:text-xs font-bold text-blue-500 uppercase tracking-widest mt-1.5">Đã hoàn thành</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg md:text-xl font-bold text-slate-400 leading-none">/ {nodeData.target}</p>
                                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Chỉ tiêu (Target)</p>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <div className="h-1.5 md:h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-700 ${nodeData.actual >= nodeData.target && nodeData.target > 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                                style={{ width: `${Math.min(nodeData.target > 0 ? (nodeData.actual / nodeData.target) * 100 : 0, 100)}%` }}
                                            ></div>
                                        </div>
                                        {nodeData.actual >= nodeData.target && nodeData.target > 0 && (
                                            <p className="text-[10px] md:text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle2 size={12} className="md:w-3.5 md:h-3.5" /> Đã đạt KPI tuần!</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 py-8 md:py-12 bg-slate-50 rounded-xl md:rounded-2xl border border-dashed border-slate-200 mx-4 md:mx-0">
                            <p className="text-xs md:text-sm font-medium">{nodeData.desc || "Khối quản trị hệ thống."}</p>
                        </div>
                    )}
                </div>

                {/* 🚀 --- NÚT ĐÓNG DƯỚI ĐÁY CHO DỄ BẤM TRÊN MOBILE --- */}
                <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0">
                    <button 
                        onClick={onClose}
                        className="w-full py-3 md:py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95"
                    >
                        Đóng cửa sổ
                    </button>
                </div>
            </div>
        </>
    );
}