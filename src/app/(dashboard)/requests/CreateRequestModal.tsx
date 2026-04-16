"use client";

import { useState, useEffect } from "react";
import { XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";

interface CreateRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    allowedTypes: any[];
    teams: any[];
}

export default function CreateRequestModal({ isOpen, onClose, allowedTypes, teams }: CreateRequestModalProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedType, setSelectedType] = useState(allowedTypes[0]?.id || "");
    const [contentData, setContentData] = useState<any>({}); 
    const [firstApproverId, setFirstApproverId] = useState("");
    const [secondApproverId, setSecondApproverId] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [approvers, setApprovers] = useState<any[]>([]);
    const [isLoadingApprovers, setIsLoadingApprovers] = useState(false);
    const { data: session } = useSession();
    const currentUser = session?.user as any;

    useEffect(() => { setContentData({}); }, [selectedType]);

    useEffect(() => {
        if (!selectedTeamId) {
            setApprovers([]);
            return;
        }
        setIsLoadingApprovers(true);
        fetch(`/api/requests/approvers?teamId=${selectedTeamId}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setApprovers(data);
                setIsLoadingApprovers(false);
            })
            .catch(err => {
                console.error("Lỗi fetch:", err);
                setIsLoadingApprovers(false);
            });
    }, [selectedTeamId]);
    
    if (!isOpen) return null;

    const handleChange = (field: string, value: any) => {
        setContentData((prev: any) => ({ ...prev, [field]: value }));
    };

    const renderDynamicFields = () => {
        switch (selectedType) {
            case "NGHI_PHEP":
                return (
                    <div className="space-y-3 md:space-y-4 animate-fade-in">
                        {/* Mobile: 1 Cột, PC: 2 Cột */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <div>
                                <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">Từ ngày</label>
                                <input type="date" className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 text-sm"
                                    value={contentData.startDate || ""} onChange={(e) => handleChange("startDate", e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">Đến ngày</label>
                                <input type="date" className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 text-sm"
                                    value={contentData.endDate || ""} onChange={(e) => handleChange("endDate", e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">Lý do xin nghỉ</label>
                            <textarea rows={3} className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 resize-none text-sm"
                                placeholder="Nhập lý do chi tiết..."
                                value={contentData.reason || ""} onChange={(e) => handleChange("reason", e.target.value)} />
                        </div>
                    </div>
                );

            case "MUA_SAM":
            case "TAM_UNG":
            case "CHAY_ADS":
            case "THANH_TOAN":
                return (
                    <div className="space-y-3 md:space-y-4 animate-fade-in">
                        <div>
                            <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">
                                {selectedType === "MUA_SAM" ? "Tên thiết bị/Vật dụng" : selectedType === "CHAY_ADS" ? "Tên Chiến dịch" : "Hạng mục"}
                            </label>
                            <input type="text" className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 text-sm"
                                placeholder="VD: Mua chuột máy tính, Tạm ứng công tác..."
                                value={contentData.itemName || ""} onChange={(e) => handleChange("itemName", e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">Số tiền đề xuất (VNĐ)</label>
                            <input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 font-bold text-red-600 text-sm"
                                placeholder="0"
                                value={contentData.amount || ""} onChange={(e) => handleChange("amount", Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">Lý do / Mục đích</label>
                            <textarea rows={3} className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 resize-none text-sm"
                                placeholder="Nhập mục đích sử dụng số tiền này..."
                                value={contentData.reason || ""} onChange={(e) => handleChange("reason", e.target.value)} />
                        </div>
                    </div>
                );

            case "DI_MUON_VE_SOM":
            case "LAM_REMOTE":
                return (
                    <div className="space-y-3 md:space-y-4 animate-fade-in">
                        <div>
                            <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">Ngày áp dụng</label>
                            <input type="date" className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 text-sm"
                                value={contentData.date || ""} onChange={(e) => handleChange("date", e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[11px] md:text-xs font-bold text-slate-500 mb-1">Lý do</label>
                            <textarea rows={3} className="w-full bg-white border border-slate-200 rounded-lg p-2 md:p-2.5 outline-none focus:border-red-500 resize-none text-sm"
                                placeholder="Nhập lý do..."
                                value={contentData.reason || ""} onChange={(e) => handleChange("reason", e.target.value)} />
                        </div>
                    </div>
                );

            default:
                return <p className="text-slate-400 text-xs md:text-sm italic text-center py-4">Vui lòng chọn loại đề xuất để hiển thị form.</p>;
        }
    };

    const handleSubmit = async () => {
        if (selectedType === "NGHI_PHEP" && (!contentData.startDate || !contentData.endDate || !contentData.reason?.trim())) {
            showToast("error", "Sếp ơi, nhập đủ Từ ngày, Đến ngày và Lý do nhé!");
            return;
        }
        if (["DI_MUON_VE_SOM", "LAM_REMOTE"].includes(selectedType) && (!contentData.date || !contentData.reason?.trim())) {
            showToast("error", "Chưa chọn ngày hoặc thiếu lý do rồi sếp!");
            return;
        }
        if (["MUA_SAM", "TAM_UNG", "THANH_TOAN"].includes(selectedType)) {
            if (!contentData.itemName?.trim() || !contentData.amount || !contentData.reason?.trim()) {
                showToast("error", "Thiếu tên hạng mục, số tiền hoặc lý do!");
                return;
            }
        }
        setIsSubmitting(true);
        try {
            const payload = {
                type: selectedType, teamId: selectedTeamId, contentData: contentData,
                firstApproverId, secondApproverId: secondApproverId || null
            };

            const res = await fetch('/api/requests', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast("success", "Đã gửi đề xuất thành công.");
                window.dispatchEvent(new CustomEvent("local_system_noti", {
                    detail: {
                        targetId: firstApproverId, title: "Đơn từ mới cần duyệt",
                        message: `Bạn vừa nhận được một đề xuất mới cần phê duyệt.`, type: "info"
                    }
                }));
                onClose();
            } else {
                const data = await res.json();
                showToast("error", "Lỗi: " + (data.error || "Không thể gửi đề xuất."));
            }
        } catch (error) {
            showToast("error", "Mất kết nối tới Server. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
        }
    };
    const modalContent = (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-2xl md:rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden">
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <h2 className="text-base md:text-lg font-black text-slate-800">Tạo đề xuất mới</h2>
                    <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <XCircle size={20} className="md:w-6 md:h-6" />
                    </button>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 md:space-y-6">
                    {/* 1. Chọn loại đơn */}
                    <div>
                        <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">1. Loại đề xuất <span className="text-red-500">*</span></label>
                        <select
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs md:text-sm rounded-lg md:rounded-xl focus:ring-red-500 focus:border-red-500 block p-2.5 md:p-3 outline-none font-medium"
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                        >
                            <optgroup label="Hành chính - Nhân sự (HR)">
                                {allowedTypes.filter(r => r.category === 'HR').map(req => (
                                    <option key={req.id} value={req.id}>{req.label}</option>
                                ))}
                            </optgroup>
                            {allowedTypes.some(r => r.category === 'ADMIN') && (
                                <optgroup label="Tài chính - Mua sắm (Admin)">
                                    {allowedTypes.filter(r => r.category === 'ADMIN').map(req => (
                                        <option key={req.id} value={req.id}>{req.label}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    <hr className="border-slate-100" />

                    {/* 2. Form Nội Dung Động */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5">
                        <h3 className="text-xs md:text-sm font-black text-slate-700 mb-3 md:mb-4">2. Chi tiết đề xuất</h3>
                        {renderDynamicFields()}
                    </div>

                    <hr className="border-slate-100" />

                    {/* 3. CHỌN TEAM ÁP DỤNG */}
                    <div>
                        <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">3. Phòng ban / Team <span className="text-red-500">*</span></label>
                        <select
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs md:text-sm rounded-lg md:rounded-xl focus:ring-red-500 focus:border-red-500 block p-2.5 md:p-3 outline-none font-medium"
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                        >
                            <option value="">-- Vui lòng chọn Team --</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 4. CHỌN NGƯỜI DUYỆT */}
                    <div className={`transition-opacity ${selectedTeamId ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">4. Luồng phê duyệt <span className="text-red-500">*</span></label>

                        {!selectedTeamId && (
                            <p className="text-[10px] md:text-xs text-red-500 mb-2 italic">Vui lòng chọn Team ở bước 3 để hiển thị danh sách người duyệt.</p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            <div className="bg-white border border-slate-200 p-3 md:p-4 rounded-xl">
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 md:mb-2 block">Cấp 1 (Bắt buộc)</span>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs md:text-sm rounded-lg p-2 outline-none"
                                    value={firstApproverId}
                                    onChange={(e) => setFirstApproverId(e.target.value)}
                                >
                                    <option value="">{isLoadingApprovers ? "Đang tải..." : "-- Chọn Quản lý --"}</option>
                                    {approvers.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.fullName} ({u.role === 'BAN_GIAM_DOC' ? 'Giám Đốc' : u.team?.name || u.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="bg-white border border-slate-200 p-3 md:p-4 rounded-xl">
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 md:mb-2 block">Cấp 2 (Tùy chọn)</span>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs md:text-sm rounded-lg p-2 outline-none"
                                    value={secondApproverId}
                                    onChange={(e) => setSecondApproverId(e.target.value)}
                                >
                                    <option value="">{isLoadingApprovers ? "Đang tải..." : "-- Chọn Quản lý --"}</option>
                                    {approvers.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.fullName} ({u.role === 'BAN_GIAM_DOC' ? 'Giám Đốc' : u.team?.name || u.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                {/* Mobile: Các nút xếp dọc/ngang full width */}
                <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-2.5 md:gap-3 bg-slate-50/50 shrink-0">
                    <button onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm md:text-base">Hủy</button>

                    <button
                        onClick={handleSubmit}
                        disabled={!firstApproverId || !selectedTeamId || isSubmitting}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm md:text-base"
                    >
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        {isSubmitting ? "Đang gửi..." : "Gửi đề xuất"}
                    </button>
                </div>
            </div>
        </div>
    );
    if (!mounted) return null;
    return createPortal(modalContent, document.body);
}