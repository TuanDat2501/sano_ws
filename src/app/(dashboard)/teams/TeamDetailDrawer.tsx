import { Users, X, UserCircle2 } from "lucide-react";

export default function TeamDetailDrawer({ isOpen, onClose, team }: { isOpen: boolean, onClose: () => void, team: any }) {
    return (
        <>
            {/* Lớp màng mờ che phía sau */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[1000] bg-slate-900/20 backdrop-blur-[2px] transition-opacity"
                    onClick={onClose}
                ></div>
            )}

            {/* Khối trượt ra từ bên phải */}
            <div className={`fixed top-0 right-0 h-full  bg-white shadow-2xl z-[100] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {team && (
                    <>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-red-100 text-red-600 p-2.5 rounded-xl"><Users size={20} /></div>
                                    <h2 className="text-2xl font-black text-slate-900">{team.name}</h2>
                                </div>
                                <p className="text-sm font-medium text-slate-500">{team.description || "Chưa có mô tả."}</p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-white rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-100 transition-all active:scale-90">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 border-b border-slate-100 bg-white">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                <span style={{fontSize:"10px"}}>Danh sách thành viên</span>
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px]">{team.users?.length || 0} người</span>
                            </p>
                            
                            <div className="space-y-3">
                                {!team.users || team.users.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        Team này hiện chưa có thành viên nào.
                                    </div>
                                ) : (
                                    team.users.map((user: any) => (
                                        <div key={user.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                                            <div className="bg-slate-200 text-slate-500 p-2 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                <UserCircle2 size={24} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{user.fullName}</p>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{user.role}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}