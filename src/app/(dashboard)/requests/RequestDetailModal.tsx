"use client";

import { useState } from "react";
import { XCircle, CheckCircle, XOctagon, Loader2 } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function RequestDetailModal({ isOpen, onClose, request, currentUserId, onRefresh }: any) {
    const { showToast } = useToast();
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !request) return null;

    const isMyTurnToApprove = 
        (request.status === "PENDING_1" && request.firstApproverId === currentUserId) ||
        (request.status === "PENDING_2" && request.secondApproverId === currentUserId);
        
    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_1": 
            case "PENDING_2": 
                return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">CHỜ DUYỆT</span>;
            case "APPROVED": 
                return <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">ĐÃ DUYỆT</span>;
            case "REJECTED": 
                return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">TỪ CHỐI</span>;
            default: 
                return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">{status}</span>;
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

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-xl rounded-2xl md:rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
                
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h2 className="text-base md:text-lg font-black text-slate-800">Chi tiết Đề xuất</h2>
                    <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <XCircle size={20} className="md:w-6 md:h-6" />
                    </button>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 md:space-y-6">
                    <div className="bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100">
                        <p className="text-xs md:text-sm text-slate-500 mb-1">Người gửi: <strong className="text-slate-800">{request.requester?.fullName}</strong></p>
                        <p className="text-xs md:text-sm text-slate-500 mb-2">Phòng ban: <strong className="text-slate-800">{request.team?.name || "---"}</strong></p>
                        <div className="flex items-center gap-2">
                            <span className="text-xs md:text-sm text-slate-500">Trạng thái:</span> 
                            {renderStatusBadge(request.status)}
                        </div>
                    </div>

                    {/* 🚀 ĐÃ SỬA LẠI LUỒNG RENDER HIỂN THỊ CÁC CỘT VẬT LÝ */}
                    <div>
                        <h3 className="text-xs md:text-sm font-bold text-slate-800 mb-2 md:mb-3 uppercase tracking-wider">Nội dung chi tiết</h3>
                        <div className="grid grid-cols-1 gap-2 md:gap-3 bg-white p-4 rounded-xl border border-slate-100">
                            
                            {request.startDate && request.endDate && (
                                <div className="border-b border-slate-100 pb-3 mb-1">
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-1">Thời gian xin nghỉ</p>
                                    <p className="text-sm md:text-base text-slate-800 font-medium">
                                        Từ {new Date(request.startDate).toLocaleDateString('vi-VN')} đến {new Date(request.endDate).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>
                            )}

                            {request.targetDate && (
                                <div className="border-b border-slate-100 pb-3 mb-1">
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-1">Ngày áp dụng</p>
                                    <p className="text-sm md:text-base text-slate-800 font-medium">
                                        {new Date(request.targetDate).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>
                            )}

                            {request.itemName && (
                                <div className="border-b border-slate-100 pb-3 mb-1">
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-1">Hạng mục / Thiết bị / Chiến dịch</p>
                                    <p className="text-sm md:text-base text-slate-800 font-medium">{request.itemName}</p>
                                </div>
                            )}

                            {request.amount !== null && request.amount !== undefined && (
                                <div className="border-b border-slate-100 pb-3 mb-1">
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-1">Số tiền đề xuất (VNĐ)</p>
                                    <p className="text-sm md:text-base text-red-600 font-black">{Number(request.amount).toLocaleString('vi-VN')} đ</p>
                                </div>
                            )}

                            {request.reason && (
                                <div className="pt-1">
                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-1">Lý do / Mục đích chi tiết</p>
                                    <p className="text-sm md:text-base text-slate-800 font-medium whitespace-pre-wrap">{request.reason}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {isMyTurnToApprove && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <label className="block text-xs md:text-sm font-bold text-slate-700 mb-2">Lời phê / Lý do từ chối (nếu có)</label>
                            <textarea 
                                rows={2} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 md:p-3 text-sm md:text-base outline-none focus:border-red-500 mb-3 md:mb-4 resize-none"
                                placeholder="Nhập ý kiến của sếp vào đây..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                            
                            <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3">
                                <button 
                                    onClick={() => handleAction('REJECT')} disabled={isSubmitting}
                                    className="w-full sm:flex-1 flex justify-center items-center gap-2 bg-red-100 text-red-700 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold hover:bg-red-200 transition-colors"
                                >
                                    <XOctagon size={18} className="md:w-5 md:h-5" /> Từ chối
                                </button>
                                <button 
                                    onClick={() => handleAction('APPROVE')} disabled={isSubmitting}
                                    className="w-full sm:flex-1 flex justify-center items-center gap-2 bg-green-600 text-white py-2.5 md:py-3 rounded-xl text-sm md:text-base font-bold hover:bg-green-700 shadow-md shadow-green-600/20 transition-all active:scale-95"
                                >
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} className="md:w-5 md:h-5" />} 
                                    Phê duyệt
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}