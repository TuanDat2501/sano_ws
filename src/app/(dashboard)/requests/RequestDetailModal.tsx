"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, XOctagon, Loader2, UserCheck, Trash2, FileText, Clock } from "lucide-react";
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
        
    const isRequester = request?.requesterId === currentUserId;
    const canCancel = isRequester && ["PENDING_1", "PENDING_2"].includes(request?.status);

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_1": return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">CHỜ DUYỆT CẤP 1</span>;
            case "PENDING_2": return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">CHỜ DUYỆT CẤP 2</span>;
            case "APPROVED": return <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">ĐÃ DUYỆT</span>;
            case "REJECTED": return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">BỊ TỪ CHỐI</span>;
            case "CANCELLED": return <span className="bg-slate-200 text-slate-600 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">ĐÃ HỦY</span>;
            default: return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide">{status}</span>;
        }
    };

    const renderRequestType = (type: string) => {
        switch (type) {
            case "NGHI_PHEP": return "Xin nghỉ phép";
            case "DI_MUON_VE_SOM": return "Đi muộn / Về sớm";
            case "LAM_REMOTE": return "Làm Remote (Từ xa)";
            case "MUA_SAM": return "Mua sắm / Cấp thiết bị";
            case "TAM_UNG": return "Tạm ứng";
            case "CHAY_ADS": return "Ngân sách chạy Ads";
            case "THANH_TOAN": return "Thanh toán chi phí";
            case "THUONG": return "Đề xuất thưởng";
            default: return type || "Không xác định";
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

    const handleCancelRequest = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn hủy đề xuất này không? Trạng thái sẽ chuyển thành 'Đã hủy'.")) {
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/requests/${request.id}`, {
                method: 'PATCH',
            });

            if (res.ok) {
                showToast("success", "Đã hủy đề xuất thành công!");
                onRefresh();
                onClose();
            } else {
                const data = await res.json();
                showToast("error", data.error || "Không thể hủy đề xuất");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối server!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getVal = (key: string) => {
        if (!request) return null;
        if (request[key] !== null && request[key] !== undefined) return request[key];
        if (request.contentData && request.contentData[key] !== undefined) return request.contentData[key];
        return null;
    };

    const startDate = getVal('startDate');
    const endDate = getVal('endDate');
    const targetDate = getVal('targetDate') || getVal('date'); 
    const time = getVal('time'); // 🚀 Hứng giá trị time
    const leaveType = getVal('leaveType');
    const itemName = getVal('itemName');
    const amount = getVal('amount');
    const reason = getVal('reason');

    // 🚀 BỔ SUNG: Tính toán số ngày nghỉ để in ra phiếu
    let numDays = 0;
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end >= start) {
            numDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        }
    }

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
                            {/* BLOCK 1: THÔNG TIN CƠ BẢN */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                                    <div className="p-4 flex-1">
                                        <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Người đề xuất</p>
                                        <p className="text-sm font-bold text-slate-900">{request.requester?.fullName}</p>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">Team: {request.team?.name || "Không rõ"}</p>
                                        
                                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 text-blue-700">
                                            <FileText size={14} />
                                            <span className="text-[11px] font-black uppercase tracking-wider">{renderRequestType(request.type)}</span>
                                        </div>
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
                                    {startDate && endDate && (
                                        <div className="border-b border-slate-50 pb-3">
                                            <p className="text-[11px] text-slate-400 font-bold mb-2">Thời gian & Chế độ nghỉ</p>
                                            <p className="text-sm text-slate-900 font-black flex items-center gap-2 mb-2">
                                                Từ <span className="text-blue-600">{new Date(startDate).toLocaleDateString('vi-VN')}</span> đến <span className="text-blue-600">{new Date(endDate).toLocaleDateString('vi-VN')}</span>
                                                {numDays > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[11px]">({numDays} ngày)</span>}
                                            </p>
                                            
                                            {/* 🚀 HIỂN THỊ LOẠI NGHỈ PHÉP */}
                                            {leaveType && (
                                                <div className="mt-1.5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${leaveType === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                        {leaveType === 'PAID' ? '✅ Nghỉ phép có lương' : '⚠️ Nghỉ không lương'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {targetDate && (
                                        <div className="border-b border-slate-50 pb-3">
                                            <p className="text-[11px] text-slate-400 font-bold mb-1">Ngày & Giờ áp dụng</p>
                                            <p className="text-sm text-slate-900 font-black flex items-center gap-2">
                                                {new Date(targetDate).toLocaleDateString('vi-VN')}
                                                {/* 🚀 HIỂN THỊ MỐC THỜI GIAN CỤ THỂ NẾU LÀ ĐI MUỘN/VỀ SỚM */}
                                                {time && <span className="text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md text-[11px]"><Clock size={12} className="inline mr-1 mb-0.5" />{time}</span>}
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

                            {/* BLOCK 3: LỊCH SỬ PHÊ DUYỆT / Ý KIẾN CHỈ ĐẠO */}
                            {request.logs && request.logs.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider ml-1">Lịch sử phê duyệt / Lời phê</h3>
                                    <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="space-y-4">
                                            {request.logs.map((log: any, index: number) => (
                                                <div key={log.id} className="flex gap-3 relative">
                                                    <div className="flex flex-col items-center">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm z-10 ${
                                                            log.action === 'REJECTED' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                        }`}>
                                                            {log.action === 'REJECTED' ? <XOctagon size={16} /> : <CheckCircle size={16} />}
                                                        </div>
                                                        {/* Đường line nối các bước */}
                                                        {index < request.logs.length - 1 && <div className="absolute top-8 bottom-[-16px] left-4 w-px bg-slate-200"></div>}
                                                    </div>
                                                    <div className="pb-2 flex-1">
                                                        <p className="text-sm font-bold text-slate-900 flex items-center flex-wrap gap-2">
                                                            {log.approver?.fullName} 
                                                            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                                                                {new Date(log.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' })}
                                                            </span>
                                                        </p>
                                                        <p className="text-[11px] font-black mt-1 uppercase tracking-wide opacity-80" 
                                                           style={{ color: log.action === 'REJECTED' ? '#dc2626' : '#059669' }}>
                                                            {log.action === 'APPROVED_LEVEL_1' && "Đã duyệt (Cấp 1)"}
                                                            {log.action === 'APPROVED_LEVEL_2' && "Đã chốt duyệt (Cấp 2)"}
                                                            {log.action === 'REJECTED' && "Đã từ chối"}
                                                        </p>
                                                        
                                                        {/* HIỂN THỊ LỜI PHÊ */}
                                                        {log.comment && (
                                                            <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm text-slate-700 font-medium relative italic shadow-inner">
                                                                <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-50 border-t border-l border-slate-100 rotate-45"></div>
                                                                <span className="text-slate-400 mr-1 font-bold">↳ Lời phê:</span> "{log.comment}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p className="font-bold">Không tìm thấy thông tin đề xuất</p>
                        </div>
                    )}
                </div>

                {!isFetching && request && (isMyTurnToApprove || canCancel) && (
                    <div className="shrink-0 p-4 md:p-6 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                        {isMyTurnToApprove && (
                            <>
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
                            </>
                        )}

                        {canCancel && !isMyTurnToApprove && (
                            <button 
                                onClick={handleCancelRequest} disabled={isSubmitting}
                                className="w-full flex justify-center items-center gap-2 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl text-sm font-black hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors active:scale-95"
                            >
                                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} 
                                Hủy đề xuất này
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );

    return createPortal(drawerContent, document.body);
}