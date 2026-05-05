"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, XOctagon, Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { createPortal } from "react-dom";

export default function RequestDetailDrawer({ isOpen, onClose, requestId, currentUserId, onRefresh }: any) {
    const { showToast } = useToast();
    const [request, setRequest] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && requestId) {
            setIsFetching(true);
            fetch(`/api/requests/${requestId}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.error) setRequest(data);
                    setIsFetching(false);
                })
                .catch(() => {
                    showToast("error", "Không tải được dữ liệu đơn từ.");
                    setIsFetching(false);
                });
        } else {
            setRequest(null);
            setComment("");
        }
    }, [isOpen, requestId]);

    if (!isOpen || !mounted) return null;

    const isMyTurnToApprove = request && 
        ((request.status === "PENDING_1" && request.firstApproverId === currentUserId) ||
        (request.status === "PENDING_2" && request.secondApproverId === currentUserId));
        
    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_1": return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">CHỜ DUYỆT CẤP 1</span>;
            case "PENDING_2": return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">CHỜ DUYỆT CẤP 2</span>;
            case "APPROVED": return <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">ĐÃ DUYỆT</span>;
            case "REJECTED": return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">BỊ TỪ CHỐI</span>;
            default: return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">{status}</span>;
        }
    };

    const handleAction = async (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            showToast("error", "Vui lòng nhập lý do từ chối!");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/requests/${request.id}/action`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, comment })
            });

            if (res.ok) {
                showToast("success", `Đã ${action === 'APPROVE' ? 'duyệt' : 'từ chối'} đơn thành công!`);
                
                window.dispatchEvent(new CustomEvent("local_system_noti", {
                    detail: {
                        targetId: request.requesterId,
                        title: action === 'APPROVE' ? "Đơn đã được duyệt" : "Đơn bị từ chối",
                        message: action === 'APPROVE' 
                            ? `Đơn ${request.type} của bạn đã được phê duyệt.` 
                            : `Đơn của bạn đã bị từ chối với lý do: ${comment}`,
                        type: action === 'APPROVE' ? "success" : "error"
                    }
                }));

                if (action === 'APPROVE' && request.status === "PENDING_1" && request.secondApproverId) {
                    window.dispatchEvent(new CustomEvent("local_system_noti", {
                        detail: {
                            targetId: request.secondApproverId,
                            title: "Đơn từ mới chờ chốt hạ",
                            message: `Quản lý cấp 1 vừa duyệt một đề xuất, đang chờ bạn phê duyệt cuối cùng.`,
                            type: "info"
                        }
                    }));
                }

                onRefresh();
                onClose();
            } else {
                const data = await res.json();
                showToast("error", data.error || "Có lỗi xảy ra");
            }
        } catch (error) {
            showToast("error", "Mất kết nối server!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getVal = (key: string) => {
        if (!request) return null; // 🚀 THÊM DÒNG NÀY LÀ HẾT LỖI NGAY
        if (request[key] !== null && request[key] !== undefined) return request[key];
        if (request.contentData && request.contentData[key] !== undefined) return request.contentData[key];
        return null;
    };

    // Lấy trước các biến để code JSX bên dưới gọn hơn
    const startDate = getVal('startDate');
    const endDate = getVal('endDate');
    const targetDate = getVal('targetDate') || getVal('date'); // Xử lý trường hợp data cũ ghi là 'date'
    const itemName = getVal('itemName');
    const amount = getVal('amount');
    const reason = getVal('reason');

    const drawerContent = (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100000] animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 z-[100001] w-full max-w-lg md:max-w-xl bg-slate-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                
                <div className="px-5 py-4 md:py-5 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-sm z-10">
                    <h2 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-wide">Chi tiết Đề xuất</h2>
                    <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-full transition-colors active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                    {isFetching ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <p className="font-medium text-sm">Đang tải dữ liệu đơn từ...</p>
                        </div>
                    ) : request ? (
                        <div className="space-y-5 md:space-y-6">
                            {/* BLOCK 1: THÔNG TIN NGƯỜI GỬI & LUỒNG DUYỆT */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                                    <div className="p-4 flex-1">
                                        <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Người đề xuất</p>
                                        <p className="text-sm font-bold text-slate-900">{request.requester?.fullName}</p>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">Team: {request.team?.name || "Không rõ"}</p>
                                    </div>
                                    <div className="p-4 flex-1 bg-blue-50/30">
                                        <p className="text-[10px] md:text-[11px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <UserCheck size={14} /> Luồng phê duyệt
                                        </p>
                                        <div className="space-y-2 text-sm font-medium">
                                            <p className="text-slate-700 flex justify-between gap-2">
                                                <span className="text-slate-500 shrink-0 text-xs">Cấp 1:</span> 
                                                <strong className="text-slate-900 text-right">{request.firstApprover?.fullName || "---"}</strong>
                                            </p>
                                            {request.secondApprover && (
                                                <p className="text-slate-700 flex justify-between gap-2 border-t border-blue-100/50 pt-2">
                                                    <span className="text-slate-500 shrink-0 text-xs">Cấp 2:</span> 
                                                    <strong className="text-slate-900 text-right">{request.secondApprover?.fullName}</strong>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 border-t border-slate-200 p-3 md:p-4 flex items-center justify-between gap-4">
                                    <span className="text-xs md:text-sm font-bold text-slate-600">Trạng thái:</span> 
                                    {renderStatusBadge(request.status)}
                                </div>
                            </div>

                            {/* BLOCK 2: NỘI DUNG CHI TIẾT */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider ml-1">Nội dung chi tiết</h3>
                                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                    
                                    {/* 🚀 ĐÃ CẬP NHẬT: Render dựa trên biến getVal() */}
                                    {startDate && endDate && (
                                        <div className="border-b border-slate-50 pb-3">
                                            <p className="text-[11px] text-slate-400 font-bold mb-1">Thời gian xin nghỉ</p>
                                            <p className="text-sm text-slate-900 font-black">
                                                Từ <span className="text-blue-600">{new Date(startDate).toLocaleDateString('vi-VN')}</span> đến <span className="text-blue-600">{new Date(endDate).toLocaleDateString('vi-VN')}</span>
                                            </p>
                                        </div>
                                    )}

                                    {targetDate && (
                                        <div className="border-b border-slate-50 pb-3">
                                            <p className="text-[11px] text-slate-400 font-bold mb-1">Ngày áp dụng</p>
                                            <p className="text-sm text-slate-900 font-black">
                                                {new Date(targetDate).toLocaleDateString('vi-VN')}
                                            </p>
                                        </div>
                                    )}

                                    {itemName && (
                                        <div className="border-b border-slate-50 pb-3">
                                            <p className="text-[11px] text-slate-400 font-bold mb-1">Hạng mục / Thiết bị / Chiến dịch</p>
                                            <p className="text-sm text-slate-900 font-black">{itemName}</p>
                                        </div>
                                    )}

                                    {amount !== null && amount !== undefined && (
                                        <div className="border-b border-slate-50 pb-3">
                                            <p className="text-[11px] text-slate-400 font-bold mb-1">Số tiền đề xuất (VNĐ)</p>
                                            <p className="text-base text-red-600 font-black bg-red-50 inline-block px-3 py-1 rounded-lg border border-red-100">
                                                {Number(amount).toLocaleString('vi-VN')} đ
                                            </p>
                                        </div>
                                    )}

                                    {reason ? (
                                        <div className="bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100 mt-2">
                                            <p className="text-[11px] text-slate-500 font-bold mb-2 uppercase tracking-wide">Lý do / Mục đích chi tiết</p>
                                            <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap break-words leading-relaxed">{reason}</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">Không có nội dung chi tiết.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p className="font-bold">Không tìm thấy thông tin đề xuất</p>
                        </div>
                    )}
                </div>

                {isMyTurnToApprove && !isFetching && request && (
                    <div className="shrink-0 p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                        <label className="block text-xs font-bold text-slate-700 mb-2">Lời phê / Phản hồi (Bắt buộc nếu từ chối) <span className="text-red-500">*</span></label>
                        <textarea 
                            rows={2} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 mb-4 resize-none transition-all"
                            placeholder="Nhập ý kiến chỉ đạo vào đây..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleAction('REJECT')} disabled={isSubmitting}
                                className="flex-1 flex justify-center items-center gap-2 bg-white border border-red-200 text-red-600 py-3 rounded-xl text-sm font-black hover:bg-red-50 transition-colors active:scale-95"
                            >
                                <XOctagon size={18} /> Từ chối
                            </button>
                            <button 
                                onClick={() => handleAction('APPROVE')} disabled={isSubmitting}
                                className="flex-[1.5] flex justify-center items-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-black hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
                            >
                                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} 
                                Phê duyệt
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );

    return createPortal(drawerContent, document.body);
}