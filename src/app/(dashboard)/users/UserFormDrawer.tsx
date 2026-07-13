import { X, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const handleChange = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value });
    };

    const drawerContent = (
        <>
            {isOpen && (
                <div className="fixed inset-0 z-[99998] bg-slate-900/40 backdrop-blur-[2px] transition-opacity" onClick={onClose}></div>
            )}

            {/* 🚀 ĐÃ MỞ RỘNG ĐỘ RỘNG (w-[800px]) ĐỂ HIỂN THỊ 2 CỘT */}
            <div className={`fixed top-0 right-0 h-full w-full md:w-[600px] lg:w-[800px] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900">
                        {editingUser ? "Sửa Hồ Sơ Nhân Sự" : "Thêm Nhân Sự Mới"}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-white rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-slate-100 transition-all shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    <form id="userForm" onSubmit={handleSubmit} className="flex flex-col space-y-8">

                        {/* 1. THÔNG TIN HỆ THỐNG */}
                        <div>
                            <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">1. Thông tin hệ thống</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Tài khoản đăng nhập <span className="text-red-500">*</span></label>
                                    <input required type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.username} onChange={e => handleChange('username', e.target.value)} placeholder="VD: user123" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Mật khẩu {editingUser && <span className="normal-case font-medium">(Bỏ trống nếu giữ nguyên)</span>}</label>
                                    <input required={!editingUser} type="password" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.password} onChange={e => handleChange('password', e.target.value)} placeholder={editingUser ? "**********" : "Nhập mật khẩu..."} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Vai trò (Role)</label>
                                    <select className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.role} onChange={e => handleChange('role', e.target.value)}>
                                        <option value="CONTENT">Content (Kịch bản)</option>
                                        <option value="EDITOR">Editor (Dựng Video)</option>
                                        <option value="PUBLISHER">Quản lý Kênh</option>
                                        <option value="HR">Hành Chính / HR</option>
                                        <option value="KE_TOAN">Kế Toán</option>
                                        <option value="LEADER">Leader</option>
                                        <option value="BAN_GIAM_DOC">Ban Giám Đốc</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Thuộc Team</label>
                                    <select className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.teamId} onChange={e => handleChange('teamId', e.target.value)}>
                                        <option value="">-- Chưa phân Team --</option>
                                        {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 2. SƠ YẾU LÝ LỊCH */}
                        <div>
                            <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">2. Sơ yếu lý lịch</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Họ và tên <span className="text-red-500">*</span></label>
                                    <input required type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.fullName} onChange={e => handleChange('fullName', e.target.value)} placeholder="VD: Nguyễn Văn A" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Mã nhân viên</label>
                                    <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.employeeCode} onChange={e => handleChange('employeeCode', e.target.value)} placeholder="VD: NV001" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Ngày sinh</label>
                                        <input type="date" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.dob} onChange={e => handleChange('dob', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Dân tộc</label>
                                        <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.ethnicity} onChange={e => handleChange('ethnicity', e.target.value)} placeholder="Kinh" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Số CCCD</label>
                                    <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.cccdNumber} onChange={e => handleChange('cccdNumber', e.target.value)} placeholder="0123456789" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Ngày cấp</label>
                                        <input type="date" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.cccdDate} onChange={e => handleChange('cccdDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Nơi cấp</label>
                                        <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.cccdPlace} onChange={e => handleChange('cccdPlace', e.target.value)} placeholder="Cục CSQLHC..." />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Địa chỉ thường trú</label>
                                    <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.permanentAddress} onChange={e => handleChange('permanentAddress', e.target.value)} placeholder="Xã/Phường, Quận/Huyện, Tỉnh/TP" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Nơi ở hiện nay</label>
                                    <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.currentAddress} onChange={e => handleChange('currentAddress', e.target.value)} placeholder="Nhập nơi ở hiện tại..." />
                                </div>
                            </div>
                        </div>

                        {/* 3. LIÊN HỆ & NGƯỜI THÂN */}
                        <div>
                            <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">3. Liên hệ & Khẩn cấp</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Số điện thoại</label>
                                    <input type="tel" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="09xxxx..." />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Email cá nhân</label>
                                    <input type="email" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.personalEmail} onChange={e => handleChange('personalEmail', e.target.value)} placeholder="email@gmail.com" />
                                </div>
                                <div className="md:col-span-2 p-4 bg-red-50 border border-red-100 rounded-xl">
                                    <p className="text-xs font-bold text-red-800 mb-3">Người liên hệ khi khẩn cấp</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <input type="text" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm" value={formData.relativeName} onChange={e => handleChange('relativeName', e.target.value)} placeholder="Họ tên người thân" />
                                        </div>
                                        <div>
                                            <input type="tel" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm" value={formData.relativePhone} onChange={e => handleChange('relativePhone', e.target.value)} placeholder="Số điện thoại" />
                                        </div>
                                        <div>
                                            <input type="text" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm" value={formData.relativeRelation} onChange={e => handleChange('relativeRelation', e.target.value)} placeholder="Quan hệ (Bố/Mẹ/Vợ...)" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. THANH TOÁN & BHXH */}
                        <div>
                            <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">4. Thanh toán & Hợp đồng</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Ngân hàng</label>
                                    <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.bankName} onChange={e => handleChange('bankName', e.target.value)} placeholder="MB Bank, VCB..." />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Số tài khoản</label>
                                    <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.bankAccount} onChange={e => handleChange('bankAccount', e.target.value)} placeholder="Nhập STK..." />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Ngày vào làm</label>
                                    <input type="date" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.joinDate} onChange={e => handleChange('joinDate', e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Số sổ BHXH (Nếu có)</label>
                                    <input type="text" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" value={formData.bhxhNumber} onChange={e => handleChange('bhxhNumber', e.target.value)} placeholder="Mã số BHXH..." />
                                </div>
                            </div>
                        </div>

                        {/* TRẠNG THÁI HOẠT ĐỘNG */}
                        {editingUser && (
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">Trạng thái hoạt động</h4>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Khóa tài khoản nếu nhân viên đã nghỉ việc.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>
                        )}
                        
                        {!formData.isActive && (
                            <div className="flex items-start gap-2 bg-orange-50 text-orange-700 p-3 rounded-lg border border-orange-100">
                                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                <p className="text-xs font-medium">Tài khoản này đang bị khóa. Người dùng sẽ không thể đăng nhập hoặc nhận việc mới.</p>
                            </div>
                        )}
                    </form>
                </div>

                <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-all">Hủy</button>
                    <button form="userForm" type="submit" disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70">
                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingUser ? "Lưu hồ sơ" : "Tạo nhân sự")}
                    </button>
                </div>
            </div>
        </>
    );

    if (!mounted) return null;
    return createPortal(drawerContent, document.body);
}