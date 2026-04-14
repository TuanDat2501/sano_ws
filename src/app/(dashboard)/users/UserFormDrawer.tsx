import { X, Loader2 } from "lucide-react";

export default function UserFormDrawer({
    isOpen,
    onClose,
    editingUser,
    isSubmitting,
    formData,
    setFormData,
    handleSubmit,
    teams
}: any) {
    return (
        <>
            {/* Lớp màng mờ che phía sau */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
                    onClick={onClose}
                ></div>
            )}

            {/* Khối Panel trượt ra từ bên phải */}
            {/* Mobile tràn viền (w-full), Tablet/PC giữ nguyên max-width */}
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] md:w-[450px] bg-white shadow-2xl z-[100] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header Drawer */}
                <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <h2 className="text-lg md:text-2xl font-black text-slate-900">
                        {editingUser ? "Sửa Thông Tin" : "Thêm Nhân Sự"}
                    </h2>
                    <button onClick={onClose} className="p-1.5 md:p-2 bg-white rounded-lg md:rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-100 transition-all active:scale-90 shrink-0">
                        <X size={18} className="md:w-5 md:h-5" />
                    </button>
                </div>

                {/* Body Drawer (Chứa form nhập liệu) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4 md:space-y-5">

                        <div>
                            <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Họ và tên <span className="text-red-500">*</span></label>
                            <input required type="text" className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-900 font-medium text-sm md:text-base" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder="VD: Nguyễn Văn A" />
                        </div>

                        <div>
                            <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tài khoản đăng nhập <span className="text-red-500">*</span></label>
                            <input required type="text" className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-900 font-medium text-sm md:text-base" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="VD: user123" />
                        </div>

                        <div>
                            <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Mật khẩu {editingUser && <span className="text-slate-400 normal-case font-medium">(Bỏ trống nếu giữ nguyên)</span>}</label>
                            <input required={!editingUser} type="password" className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-900 font-medium text-sm md:text-base" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={editingUser ? "**********" : "Nhập mật khẩu..."} />
                        </div>

                        <div>
                            <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Vai trò phân quyền</label>
                            <select className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-900 font-medium cursor-pointer text-sm md:text-base" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                <option value="CONTENT">Content (Kịch bản)</option>
                                <option value="EDITOR">Editor (Dựng Video)</option>
                                <option value="PUBLISHER">Quản lý Kênh</option>
                                <option value="HR">Hành Chính / HR</option>
                                <option value="LEADER">Leader</option>
                                <option value="BAN_GIAM_DOC">Ban Giám Đốc</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Thuộc Team</label>
                            <select className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-900 font-medium cursor-pointer text-sm md:text-base" value={formData.teamId} onChange={e => setFormData({ ...formData, teamId: e.target.value })}>
                                <option value="">-- Chưa phân Team --</option>
                                {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        {/* Footer Button: Tràn viền, đẩy xuống đáy */}
                        <div className="pt-6 md:pt-8 pb-2 md:pb-4 flex gap-2.5 md:gap-3 mt-auto border-t border-slate-100">
                            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl transition-all text-sm md:text-base">Hủy</button>
                            <button type="submit" disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 shadow-md shadow-red-600/20 text-sm md:text-base">
                                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingUser ? "Lưu thay đổi" : "Tạo tài khoản")}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}