import { X, UserCircle2, Briefcase, Target, CheckCircle2, Tv, Layers, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function OrgNodeDrawer({ isOpen, onClose, nodeData }: { isOpen: boolean, onClose: () => void, nodeData: any }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!nodeData) return null;
    
    const surplusTaskList = nodeData.surplusTaskList || []; 
    
    const drawerContent = (
        <>
            {isOpen && (
                <div className="fixed inset-0 z-[99998] bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            )}
            
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[420px] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 shrink-0">
                    <div className="flex gap-3 md:gap-4 items-center">
                        {!nodeData.isSystemNode && (
                            nodeData.avatar ? (
                                <img src={nodeData.avatar} alt="avatar" className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white shadow-md shrink-0" />
                            ) : (
                                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-white text-lg md:text-xl border-2 border-white shadow-md shrink-0 ${nodeData.role === 'Kênh' ? 'bg-teal-500' : 'bg-slate-200 text-slate-500'}`}>
                                    {nodeData.role === 'Kênh' ? <Tv size={24} /> : nodeData.label.charAt(0).toUpperCase()}
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

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-white custom-scrollbar">
                    {nodeData.fullUserObj ? (
                        <div className="space-y-4 md:space-y-6">
                            <div className="bg-slate-50 p-4 rounded-xl md:rounded-2xl border border-slate-100 space-y-2 md:space-y-3">
                                <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2 md:mb-3">Thông tin hồ sơ</h3>
                                <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-slate-600">
                                    <UserCircle2 size={16} className="text-slate-400" /> 
                                    Tài khoản: <span className="font-bold text-slate-900 truncate">{nodeData.fullUserObj.username || "Chưa cập nhật"}</span>
                                </div>
                                <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-slate-600">
                                    <Briefcase size={16} className="text-slate-400" /> 
                                    Thuộc team: <span className="font-bold text-slate-900 truncate">{nodeData.fullUserObj.teamName || "Độc lập"}</span>
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
                                        
                                        <div className="flex justify-between items-center mt-3">
                                            {nodeData.actual >= nodeData.target && nodeData.target > 0 ? (
                                                <p className="text-[10px] md:text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} className="md:w-4 md:h-4" /> Đã đạt KPI tuần!</p>
                                            ) : <div></div>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {surplusTaskList.length > 0 && (
                                <div className="bg-orange-50/50 p-4 md:p-5 rounded-xl md:rounded-2xl border border-orange-100 space-y-3">
                                    <h3 className="text-[9px] md:text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center justify-between border-b border-orange-200/50 pb-2 mb-2">
                                        <span className="flex items-center gap-1.5"><Layers size={14} /> Danh sách Hàng Tồn</span>
                                        <span className="bg-orange-200 text-orange-700 px-2 py-0.5 rounded text-[10px]">Tổng: {surplusTaskList.length} bài</span>
                                    </h3>
                                    
                                    <div className="space-y-2.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                                        {surplusTaskList.map((task: any, idx: number) => (
                                            <div key={idx} className="bg-white p-3 rounded-xl border border-orange-100 shadow-sm flex flex-col gap-1.5 hover:border-orange-300 transition-colors">
                                                <p className="text-[11px] md:text-xs font-bold text-slate-800 line-clamp-2 leading-snug" title={task.title}>
                                                    {task.title || "Video không tên"}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                    {/* 🚀 ĐÃ BỔ SUNG: Hiển thị ảnh Avatar Kênh thu gọn ngay cạnh tên kênh */}
                                                    <span className="text-[9px] font-black uppercase text-teal-600 bg-teal-50 pr-1.5 pl-0.5 py-0.5 rounded-full border border-teal-100 flex items-center gap-1.5 shadow-sm w-fit">
                                                        {task.channelAvatar ? (
                                                            <img src={task.channelAvatar} alt={task.channelName} className="w-3.5 h-3.5 rounded-full object-cover border border-teal-200/50" />
                                                        ) : (
                                                            <div className="w-3.5 h-3.5 rounded-full bg-teal-200 flex items-center justify-center ml-1">
                                                                <Tv size={8} className="text-teal-600" />
                                                            </div>
                                                        )}
                                                        {task.channelName}
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                                                        <Clock size={10} /> {task.duration} Phút
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : nodeData.fullChannelObj ? (
                        <div className="space-y-4 md:space-y-6">
                            <div className="bg-teal-50 p-4 rounded-xl md:rounded-2xl border border-teal-100 space-y-2 md:space-y-3">
                                <h3 className="text-[9px] md:text-[10px] font-black text-teal-500 uppercase tracking-widest border-b border-teal-200 pb-2 mb-2 md:mb-3">Thông tin Kênh</h3>
                                <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-teal-800">
                                    <Tv size={16} className="text-teal-500" />
                                    Loại kênh: <span className="font-bold uppercase bg-teal-100 px-2 py-0.5 rounded border border-teal-200">{nodeData.fullChannelObj.category === 'AI' ? 'Kênh AI' : 'Kênh Tổng Hợp'}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 py-8 md:py-12 bg-slate-50 rounded-xl md:rounded-2xl border border-dashed border-slate-200 mx-4 md:mx-0">
                            <p className="text-xs md:text-sm font-medium">{nodeData.desc || "Khối quản trị hệ thống."}</p>
                        </div>
                    )}
                </div>

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
    if (!mounted) return null;
    return createPortal(drawerContent, document.body);
}