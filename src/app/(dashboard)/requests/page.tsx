// src/app/requests/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus, FileText, CheckCircle, Clock, XCircle, Search, Filter } from "lucide-react";
import CreateRequestModal from "./CreateRequestModal";
import RequestDetailModal from "./RequestDetailModal";
import { useSearchParams } from "next/navigation";

// 🚀 TỪ ĐIỂN PHÂN QUYỀN HIỂN THỊ LOẠI ĐƠN
const REQUEST_TYPES_CONFIG = [
    // --- NHÓM HR (AI CŨNG THẤY) ---
    { id: "NGHI_PHEP", label: "Xin nghỉ phép", category: "HR", allowedRoles: ["ALL"] },
    { id: "DI_MUON_VE_SOM", label: "Đi muộn / Về sớm", category: "HR", allowedRoles: ["ALL"] },
    { id: "LAM_REMOTE", label: "Xin làm Remote", category: "HR", allowedRoles: ["ALL"] },

    // --- NHÓM TÀI CHÍNH / ADMIN (CHỈ QUẢN LÝ THẤY) ---
    { id: "MUA_SAM", label: "Đề xuất Mua sắm", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER"] },
    { id: "TAM_UNG", label: "Xin Tạm ứng", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER"] },
    { id: "CHAY_ADS", label: "Ngân sách chạy Ads", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER"] },
    { id: "THANH_TOAN", label: "Đề nghị Thanh toán", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER"] },
    { id: "THUONG", label: "Đề xuất Thưởng nóng", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER"] },
];

export default function RequestsPage() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const idParam = searchParams.get("id");

    
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT"; // Mặc định nếu chưa load kịp

    const APPROVER_ROLES = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER", "HR"]; // Các role có quyền duyệt đơn
    const isApprover = APPROVER_ROLES.includes(userRole); // true nếu là sếp, false nếu là nhân viên
    const [activeTab, setActiveTab] = useState<'MY_REQUESTS' | 'NEED_APPROVAL'>(
        (tabParam as 'MY_REQUESTS' | 'NEED_APPROVAL') || 'MY_REQUESTS'
    );
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    // 🚀 BỘ LỌC ĐƠN: Dựa vào Role của User hiện tại để show ra các loại đơn được phép tạo
    const allowedRequestTypes = REQUEST_TYPES_CONFIG.filter(req =>
        req.allowedRoles.includes("ALL") || req.allowedRoles.includes(userRole)
    );
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedType, setSelectedType] = useState(allowedRequestTypes[0]?.id || "");
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [dbTeams, setDbTeams] = useState([]);

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_1": 
            case "PENDING_2": 
                // Gộp chung 2 cấp lại thành 1 chữ "Chờ duyệt"
                return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md text-xs font-black tracking-wide">CHỜ DUYỆT</span>;
            
            case "APPROVED": 
                return <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-black tracking-wide">ĐÃ DUYỆT</span>;
            
            case "REJECTED": 
                return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-xs font-black tracking-wide">TỪ CHỐI</span>;
            
            default: 
                return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-black tracking-wide">{status}</span>;
        }
    };

    useEffect(() => {
        if (tabParam === "MY_REQUESTS" || tabParam === "NEED_APPROVAL") {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    useEffect(() => {
        if (idParam && requests.length > 0) {
            const targetRequest = requests.find(r => r.id === idParam);
            if (targetRequest) {
                setSelectedRequest(targetRequest);
                setIsDetailModalOpen(true);
            }
        }
    }, [idParam, requests]);
    const fetchRequests = () => {
        setIsLoading(true);
        fetch(`/api/requests?tab=${activeTab}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setRequests(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Lỗi fetch đơn:", err);
                setIsLoading(false);
            });
    };
    useEffect(() => {
        fetchRequests();
    }, [activeTab]);

    useEffect(() => {
        // 1. Lấy danh sách Team
        fetch("/api/teams")
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setDbTeams(data); });

    }, []);

    return (
        <div className="h-full p-6 animate-fade-in flex flex-col bg-slate-50">
            {/* ================= HEADER ================= */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Quản lý Đơn từ & Đề xuất</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Phê duyệt, theo dõi tiến độ các loại giấy tờ nội bộ</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 active:scale-95"
                >
                    <Plus size={20} /> Tạo đề xuất mới
                </button>
            </div>

            {/* ================= TABS NAVIGATION ================= */}
            <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
                <button
                    onClick={() => setActiveTab('MY_REQUESTS')}
                    className={`pb-3 text-[15px] font-bold transition-all relative ${activeTab === 'MY_REQUESTS' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Đơn của tôi
                    {activeTab === 'MY_REQUESTS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full"></div>}
                </button>

                {/* 🚀 CHỈ HIỂN THỊ TAB NÀY NẾU USER CÓ QUYỀN DUYỆT ĐƠN */}
                {isApprover && (
                    <button
                        onClick={() => setActiveTab('NEED_APPROVAL')}
                        className={`pb-3 text-[15px] font-bold transition-all relative flex items-center gap-2 ${activeTab === 'NEED_APPROVAL' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        Cần tôi duyệt
                        {/* Cục badge đỏ báo hiệu có đơn đang chờ mình duyệt */}
                        <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-black">3</span>
                        {activeTab === 'NEED_APPROVAL' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full"></div>}
                    </button>
                )}
            </div>

            {/* ================= MAIN CONTENT AREA ================= */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mb-3"></div>
                        <p className="font-medium text-sm">Đang tải dữ liệu...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <FileText size={48} className="mb-4 text-slate-200" />
                        <p className="font-bold text-lg text-slate-500">Chưa có đơn từ nào</p>
                        <p className="text-sm mt-1">Giao diện sẽ hiển thị danh sách khi có dữ liệu mới.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Mã đơn</th>
                                    <th className="px-6 py-4">Loại đề xuất</th>
                                    <th className="px-6 py-4">Người tạo</th>
                                    <th className="px-6 py-4">Phòng ban</th>
                                    <th className="px-6 py-4">Trạng thái</th>
                                    <th className="px-6 py-4">Thời gian tạo</th>
                                    <th className="px-6 py-4 text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">#{req.id.slice(0, 6).toUpperCase()}</td>
                                        <td className="px-6 py-4 font-bold text-red-600">
                                            {REQUEST_TYPES_CONFIG.find(t => t.id === req.type)?.label || req.type}
                                        </td>
                                        <td className="px-6 py-4 font-medium">{req.requester?.fullName}</td>
                                        <td className="px-6 py-4 text-slate-500">{req.team?.name || "---"}</td>
                                        <td className="px-6 py-4">{renderStatusBadge(req.status)}</td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => {
                                                    setSelectedRequest(req);
                                                    setIsDetailModalOpen(true);
                                                }}
                                                className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Xem chi tiết
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ================= MODAL TẠO ĐƠN (FORM ĐỘNG) ================= */}

            <CreateRequestModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                allowedTypes={allowedRequestTypes}
                teams={dbTeams}
            />

            <RequestDetailModal 
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                request={selectedRequest}
                currentUserId={currentUser?.id}
                onRefresh={fetchRequests} // Truyền cái hàm để nó tải lại bảng khi duyệt xong
            />
        </div>
    );
}