import { Users, X, UserCircle2 } from "lucide-react";

export default function TeamDetailDrawer({ isOpen, onClose, team }: { isOpen: boolean, onClose: () => void, team: any }) {
    return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                ></div>
            )}

            {/* Responsive Width: Tràn viền trên Mobile, max 400px trên PC */}
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[100] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {team && (
                    <>
                        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 shrink-0">
                            <div className="min-w-0 pr-4">
                                <div className="flex items-center gap-2.5 md:gap-3 mb-1.5 md:mb-2">
                                    <div className="bg-red-100 text-red-600 p-2 md:p-2.5 rounded-lg md:rounded-xl shrink-0"><Users size={18} className="md:w-5 md:h-5" /></div>
                                    <h2 className="text-lg md:text-2xl font-black text-slate-900 truncate">{team.name}</h2>
                                </div>
                                <p className="text-xs md:text-sm font-medium text-slate-500 truncate" title={team.description || "Chưa có mô tả."}>{team.description || "Chưa có mô tả."}</p>
                            </div>
                            <button onClick={onClose} className="p-1.5 md:p-2 bg-white rounded-lg md:rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-100 transition-all active:scale-90 shrink-0">
                                <X size={18} className="md:w-5 md:h-5" />
                            </button>
                        </div>

                        <div className="flex-1 p-4 md:p-6 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                            <div className="flex items-center justify-between mb-3 md:mb-4 shrink-0">
                                <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Danh sách thành viên</span>
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 md:py-1 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-bold">{team.users?.length || 0} người</span>
                            </div>
                            
                            <div className="space-y-2 md:space-y-3 flex-1">
                                {!team.users || team.users.length === 0 ? (
                                    <div className="text-center py-6 md:py-8 text-slate-400 font-medium bg-slate-50 rounded-xl md:rounded-2xl border border-dashed border-slate-200 text-xs md:text-sm">
                                        Team này hiện chưa có thành viên nào.
                                    </div>
                                ) : (
                                    team.users.map((user: any) => (
                                        <div key={user.id} className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-lg md:rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                                            <div className="bg-slate-200 text-slate-500 p-1.5 md:p-2 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                                <UserCircle2 size={20} className="md:w-6 md:h-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{user.fullName}</p>
                                                <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">{user.role}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Nút đóng dưới đáy cho dễ bấm trên Mobile */}
                        <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0">
                            <button 
                                onClick={onClose}
                                className="w-full py-2.5 md:py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl md:rounded-2xl transition-all active:scale-95 text-sm md:text-base"
                            >
                                Đóng cửa sổ
                            </button>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}