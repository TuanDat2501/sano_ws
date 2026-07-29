"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, UserPlus, Trash2, Loader2, AlertCircle, Users } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function Level2ApproversPage() {
    const { showToast } = useToast();
    const [approvers, setApprovers] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/approvers/level2");
            if (res.ok) {
                const data = await res.json();
                setApprovers(data.level2Approvers || []);
                setAllUsers(data.allActiveUsers || []);
            } else {
                showToast("error", "Lỗi tải dữ liệu người duyệt!");
            }
        } catch (error) {
            showToast("error", "Mất kết nối máy chủ");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Lọc những user CHƯA có trong danh sách để hiển thị ở Dropdown
    const availableUsers = allUsers.filter(
        user => !approvers.some(approver => approver.userId === user.id)
    );

    const handleAddApprover = async () => {
        if (!selectedUserId) {
            showToast("error", "Vui lòng chọn một nhân sự!");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/approvers/level2", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: selectedUserId })
            });

            if (res.ok) {
                const newApprover = await res.json();
                setApprovers([newApprover, ...approvers]);
                setSelectedUserId("");
                showToast("success", "Đã thêm người duyệt Cấp 2 thành công!");
            } else {
                const error = await res.json();
                showToast("error", error.error || "Có lỗi xảy ra!");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveApprover = async (id: string, fullName: string) => {
        if (!window.confirm(`Sếp có chắc chắn muốn gỡ quyền Duyệt Cấp 2 của "${fullName}"?`)) return;

        try {
            const res = await fetch("/api/approvers/level2", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });

            if (res.ok) {
                setApprovers(approvers.filter(a => a.id !== id));
                showToast("success", "Đã gỡ quyền thành công!");
            } else {
                showToast("error", "Không thể gỡ quyền người này!");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        }
    };

    if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-red-600 h-8 w-8" /></div>;

    return (
        <div className="h-full flex flex-col p-3 md:p-6 lg:p-8 bg-slate-50 animate-fade-in max-w-5xl mx-auto w-full">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="text-red-600 w-8 h-8" /> Người Duyệt <span className="text-red-600">Cấp 2</span>
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Danh sách các nhân sự có thẩm quyền chốt duyệt cuối cùng cho các đơn từ.
                    </p>
                </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
                <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-blue-800 font-medium leading-relaxed">
                    Những người có tên trong danh sách này sẽ mặc định được xổ ra ở ô "Người duyệt Cấp 2" khi nhân viên làm đơn xin phép. Trưởng nhóm (Leader) sẽ tự động là Người duyệt Cấp 1, không cần thêm vào đây.
                </p>
            </div>

            {/* FORM THÊM MỚI */}
            <div className="bg-white p-5 rounded-[20px] border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-end md:items-center gap-4">
                <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Chọn nhân sự cấp quyền</label>
                    <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                        <option value="">-- Chọn nhân sự từ danh sách --</option>
                        {availableUsers.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.fullName} ({user.role}) {user.team ? `- ${user.team.name}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <button 
                    onClick={handleAddApprover}
                    disabled={isSubmitting || !selectedUserId}
                    className="w-full md:w-auto bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} 
                    Thêm Quyền
                </button>
            </div>

            {/* DANH SÁCH HIỆN TẠI */}
            <div className="flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Users size={18} className="text-slate-500" /> Danh sách hiện hành ({approvers.length})
                    </h3>
                </div>
                
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                    {approvers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-8">
                            <ShieldCheck size={48} className="text-slate-200" />
                            <p className="font-medium text-sm">Chưa có ai được phân quyền duyệt Cấp 2.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Họ và Tên</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Vai trò</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Tác vụ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {approvers.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full flex items-center justify-center font-black bg-red-50 text-red-600 border border-red-100 shrink-0">
                                                    {item.user.avatarUrl ? (
                                                        <img src={item.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                                                    ) : item.user.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-sm text-slate-900 block">{item.user.fullName}</span>
                                                    <span className="text-[11px] font-medium text-slate-500">
                                                        {item.user.username} {item.user.team ? `• ${item.user.team.name}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                                {item.user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleRemoveApprover(item.id, item.user.fullName)}
                                                className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100" 
                                                title="Gỡ quyền"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}