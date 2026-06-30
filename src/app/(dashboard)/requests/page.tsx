// src/app/requests/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { Plus, FileText, CheckCircle, Clock, XCircle, Search, Filter } from "lucide-react";
import CreateRequestModal from "./CreateRequestModal";
// Sếp nhớ đổi tên import nếu đã đổi file thành RequestDetailDrawer nhé
import RequestDetailModal from "./RequestDetailModal";
// 🚀 1. Bổ sung useRouter và usePathname
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const REQUEST_TYPES_CONFIG = [
    { id: "NGHI_PHEP", label: "Xin nghỉ phép", category: "HR", allowedRoles: ["ALL"] },
    { id: "DI_MUON_VE_SOM", label: "Đi muộn / Về sớm", category: "HR", allowedRoles: ["ALL"] },
    { id: "LAM_REMOTE", label: "Xin làm Remote", category: "HR", allowedRoles: ["ALL"] },
    { id: "MUA_SAM", label: "Đề xuất Mua sắm", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER"] },
    { id: "TAM_UNG", label: "Xin Tạm ứng", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER"] },
    { id: "THANH_TOAN", label: "Đề nghị Thanh toán", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "CHANNEL_MANAGER"] },
    { id: "THUONG", label: "Đề xuất Thưởng nóng", category: "ADMIN", allowedRoles: ["ADMIN", "BAN_GIAM_DOC", "LEADER"] },
];

export default function RequestsPage() {
    const searchParams = useSearchParams();
    // 🚀 2. Khởi tạo router và pathname
    const router = useRouter();
    const pathname = usePathname();

    const tabParam = searchParams.get("tab");
    const idParam = searchParams.get("id");

    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT";

    const APPROVER_ROLES = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER", "HR"];
    const isApprover = APPROVER_ROLES.includes(userRole);
    const isAdmin = userRole === "ADMIN" || userRole === "BAN_GIAM_DOC";
    const [activeTab, setActiveTab] = useState<'MY_REQUESTS' | 'NEED_APPROVAL'>(
        (tabParam as 'MY_REQUESTS' | 'NEED_APPROVAL') || 'MY_REQUESTS'
    );
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const allowedRequestTypes = REQUEST_TYPES_CONFIG.filter(req =>
        req.allowedRoles.includes("ALL") || req.allowedRoles.includes(userRole)
    );
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [dbTeams, setDbTeams] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 10;

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_1":
            case "PENDING_2":
                return <span className="bg-amber-100 text-amber-700 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide whitespace-nowrap">CHỜ DUYỆT</span>;
            case "APPROVED":
                return <span className="bg-green-100 text-green-700 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide whitespace-nowrap">ĐÃ DUYỆT</span>;
            case "REJECTED":
                return <span className="bg-red-100 text-red-700 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide whitespace-nowrap">TỪ CHỐI</span>;
            default:
                return <span className="bg-slate-100 text-slate-700 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide whitespace-nowrap">{status}</span>;
        }
    };

    useEffect(() => {
        if (tabParam === "MY_REQUESTS" || tabParam === "NEED_APPROVAL") setActiveTab(tabParam);
    }, [tabParam]);

    // 🚀 Lắng nghe URL: Tự động mở Modal/Drawer nếu có ID
    useEffect(() => {
        if (idParam && requests.length > 0) {
            const targetRequest = requests.find(r => r.id === idParam);
            if (targetRequest) {
                setSelectedRequest(targetRequest);
                setIsDetailModalOpen(true);
            }
        }
    }, [idParam, requests]);
    useEffect(() => {
        if (idParam) {
            setIsDetailModalOpen(true);
        } else {
            setIsDetailModalOpen(false);
        }
    }, [idParam]);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchRequests = () => {
        setIsLoading(true);
        fetch(`/api/requests?tab=${activeTab}&page=${currentPage}&limit=${limit}&search=${debouncedSearch}`)
            .then(res => res.json())
            .then(data => {
                if (data.requests) setRequests(data.requests);
                setTotalPages(data.totalPages || 1);
                setTotalCount(data.totalCount || 0);
                setIsLoading(false);
            })
            .catch(err => {
                setIsLoading(false);
            });
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    useEffect(() => { fetchRequests(); }, [activeTab, currentPage, debouncedSearch]);

    useEffect(() => {
        fetch("/api/teams").then(res => res.json()).then((data: any) => { if (Array.isArray(data)) setDbTeams(data); });
    }, []);

    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Đang tải...</div>}>
            <div className="h-full p-3 md:p-6 animate-fade-in flex flex-col bg-slate-50 overflow-hidden">

                {/* ================= HEADER ================= */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-0 shrink-0">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900">Quản lý Đơn từ & Đề xuất</h1>
                        <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Phê duyệt, theo dõi tiến độ các loại giấy tờ nội bộ</p>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-2.5 md:py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 active:scale-95 text-sm md:text-base"
                    >
                        <Plus size={18} className="md:w-5 md:h-5" /> Tạo đề xuất mới
                    </button>
                </div>

                {/* ================= TABS NAVIGATION ================= */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 mb-4 md:mb-6 gap-3">
                    <div className="flex items-center gap-4 md:gap-6 overflow-x-auto custom-scrollbar-thin shrink-0">
                        <button
                            onClick={() => setActiveTab('MY_REQUESTS')}
                            className={`pb-2.5 md:pb-3 text-sm md:text-[15px] font-bold transition-all relative whitespace-nowrap ${activeTab === 'MY_REQUESTS' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {isAdmin ? 'Tất cả đề xuất' : 'Đơn của tôi'}
                            {activeTab === 'MY_REQUESTS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full"></div>}
                        </button>

                        {isApprover && (
                            <button
                                onClick={() => setActiveTab('NEED_APPROVAL')}
                                className={`pb-2.5 md:pb-3 text-sm md:text-[15px] font-bold transition-all relative flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'NEED_APPROVAL' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Cần tôi duyệt
                                <span className="bg-red-100 text-red-600 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-black">3</span>
                                {activeTab === 'NEED_APPROVAL' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full"></div>}
                            </button>
                        )}
                    </div>

                    {/* Ô TÌM KIẾM BÊN PHẢI */}
                    <div className="relative w-full sm:w-64 pb-2 sm:pb-3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none pb-2 sm:pb-3">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="w-full pl-9 pr-4 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-slate-700 font-medium"
                            placeholder="Tìm theo mã đơn (VD: a1b2c)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* ================= MAIN CONTENT AREA ================= */}
                <div className="flex-1 bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mb-3"></div>
                            <p className="font-medium text-xs md:text-sm">Đang tải dữ liệu...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <FileText size={48} className="mb-3 md:mb-4 text-slate-200" />
                            <p className="font-bold text-base md:text-lg text-slate-500">Chưa có đơn từ nào</p>
                            <p className="text-xs md:text-sm mt-1 text-center px-4">Giao diện sẽ hiển thị danh sách khi có dữ liệu mới.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                            <table className="w-full text-left text-xs md:text-sm text-slate-600 min-w-[700px] md:min-w-full">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] md:text-xs border-b border-slate-200 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                    <tr>
                                        <th className="px-4 md:px-6 py-3 md:py-4">Mã đơn</th>
                                        <th className="px-4 md:px-6 py-3 md:py-4">Loại đề xuất</th>
                                        <th className="px-4 md:px-6 py-3 md:py-4">Người tạo</th>
                                        <th className="px-4 md:px-6 py-3 md:py-4">Phòng ban</th>
                                        <th className="px-4 md:px-6 py-3 md:py-4">Trạng thái</th>
                                        <th className="px-4 md:px-6 py-3 md:py-4">Thời gian tạo</th>
                                        <th className="px-4 md:px-6 py-3 md:py-4 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {requests.map((req) => (
                                        <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 md:px-6 py-3 md:py-4 font-medium text-slate-900">#{req.id.slice(0, 6).toUpperCase()}</td>
                                            <td className="px-4 md:px-6 py-3 md:py-4 font-bold text-red-600">
                                                {REQUEST_TYPES_CONFIG.find(t => t.id === req.type)?.label || req.type}
                                            </td>
                                            <td className="px-4 md:px-6 py-3 md:py-4 font-medium truncate max-w-[120px]">{req.requester?.fullName}</td>
                                            <td className="px-4 md:px-6 py-3 md:py-4 text-slate-500 truncate max-w-[100px]">{req.team?.name || "---"}</td>
                                            <td className="px-4 md:px-6 py-3 md:py-4">{renderStatusBadge(req.status)}</td>
                                            <td className="px-4 md:px-6 py-3 md:py-4 text-slate-500 whitespace-nowrap">
                                                {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        const params = new URLSearchParams(searchParams.toString());
                                                        params.set("id", req.id);
                                                        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 font-bold text-[11px] md:text-xs bg-blue-50 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                >
                                                    Chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!isLoading && requests.length > 0 && (
                        <div className="px-4 py-3 md:px-6 md:py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                            <p className="text-[11px] md:text-xs text-slate-500 font-medium">
                                Hiển thị {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, totalCount)} trên {totalCount} đề xuất
                            </p>

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                                >
                                    Trước
                                </button>

                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}

                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <CreateRequestModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    allowedTypes={allowedRequestTypes}
                    teams={dbTeams}
                />

                <RequestDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        // Đóng Drawer thì chùi ID khỏi URL
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete("id");
                        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                    }}
                    requestId={idParam} // Chỉ cần vứt ID vào, việc còn lại Drawer tự lo!
                    currentUserId={currentUser?.id}
                    onRefresh={fetchRequests}
                />
            </div>
        </Suspense>
    );
}