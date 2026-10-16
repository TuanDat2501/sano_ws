"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { Plus, FileText, CheckCircle, Clock, XCircle, Search, Filter, Download, Loader2 } from "lucide-react";
import CreateRequestModal from "./CreateRequestModal";
import RequestDetailModal from "./RequestDetailModal";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useToast } from "@/app/component/ToastProvider";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Pagination from "@/app/component/Pagination";

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
    const router = useRouter();
    const pathname = usePathname();
    const { showToast } = useToast();

    const tabParam = searchParams.get("tab");
    const idParam = searchParams.get("id");

    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const userRole = currentUser?.role || "CONTENT";

    const isTeamLeader = currentUser?.isTeamLeader || userRole === "LEADER";

    const canViewAll = currentUser?.permissions?.includes("DEPARTMENT_LEADER") || 
                       currentUser?.permissions?.includes("MENU_TEAMS") || 
                       ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(userRole) || 
                       isTeamLeader;
    
    const isApprover = currentUser?.permissions?.includes("ACTION_APPROVE_REQUEST") || currentUser?.permissions?.includes("DEPARTMENT_LEADER") || ["ADMIN", "BAN_GIAM_DOC", "LEADER", "CHANNEL_MANAGER", "HR"].includes(userRole); 

    const [activeTab, setActiveTab] = useState<'ALL_REQUESTS' | 'MY_REQUESTS' | 'NEED_APPROVAL'>(
        (tabParam as 'ALL_REQUESTS' | 'MY_REQUESTS' | 'NEED_APPROVAL') || 'MY_REQUESTS'
    );
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const allowedRequestTypes = REQUEST_TYPES_CONFIG.filter(req =>
        req.allowedRoles.includes("ALL") || req.allowedRoles.includes(userRole)
    );
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const [dbTeams, setDbTeams] = useState<any[]>([]);
    const [dbUsers, setDbUsers] = useState<any[]>([]);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterType, setFilterType] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterTeamId, setFilterTeamId] = useState("");
    const [filterUserId, setFilterUserId] = useState("");

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
            case "CANCELLED":
                return <span className="bg-slate-100 text-slate-700 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide whitespace-nowrap">ĐÃ HUỶ</span>;
            default:
                return <span className="bg-slate-100 text-slate-700 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-black tracking-wide whitespace-nowrap">{status}</span>;
        }
    };

    useEffect(() => {
        if (tabParam === "ALL_REQUESTS" || tabParam === "MY_REQUESTS" || tabParam === "NEED_APPROVAL") {
            if (tabParam === "ALL_REQUESTS" && !canViewAll) {
                setActiveTab('MY_REQUESTS');
            } else {
                setActiveTab(tabParam);
            }
        }
    }, [tabParam, canViewAll]);

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
    
    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, filterStatus, filterTeamId, filterUserId, activeTab]);

    const fetchRequests = () => {
        setIsLoading(true);
        fetch(`/api/requests?tab=${activeTab}&page=${currentPage}&limit=${limit}&search=${debouncedSearch}&type=${filterType}&status=${filterStatus}&teamId=${filterTeamId}&requesterId=${filterUserId}`)
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

    useEffect(() => { fetchRequests(); }, [activeTab, currentPage, debouncedSearch, filterType, filterStatus, filterTeamId, filterUserId]);

    // 🚀 LẤY DANH SÁCH TEAM VÀ USER CHO DROPDOWN (Đã sửa logic trả về)
    useEffect(() => {
        fetch("/api/teams").then(res => res.json()).then((data: any) => { if (Array.isArray(data)) setDbTeams(data); });
        
        fetch("/api/users?limit=1000") // Lấy tối đa để dropown không bị thiếu
            .then(res => res.json())
            .then((data: any) => { 
                if (data.users && Array.isArray(data.users)) setDbUsers(data.users); 
            }).catch(err => console.log("Lỗi tải users: ", err));
    }, []);

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const res = await fetch(`/api/requests?tab=${activeTab}&limit=5000&search=${debouncedSearch}&type=${filterType}&status=${filterStatus}&teamId=${filterTeamId}&requesterId=${filterUserId}`);
            const data = await res.json();
            const exportData = data.requests || [];

            if (exportData.length === 0) {
                showToast("error", "Không có dữ liệu để xuất!");
                setIsExporting(false);
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Danh_Sach_Don_Tu');

            worksheet.columns = [
                { header: 'Mã Đơn', key: 'id', width: 12 },
                { header: 'Loại Đề Xuất', key: 'type', width: 22 },
                { header: 'Người Tạo', key: 'requester', width: 22 },
                { header: 'Phòng Ban', key: 'team', width: 20 },
                { header: 'Trạng Thái', key: 'status', width: 18 },
                { header: 'Ngày Tạo Đơn', key: 'createdAt', width: 15 },
                { header: 'Chế Độ Nghỉ', key: 'leaveType', width: 18 },
                { header: 'Nghỉ Từ Ngày', key: 'startDate', width: 15 },
                { header: 'Nghỉ Đến Ngày', key: 'endDate', width: 15 },
                { header: 'Số Ngày Nghỉ', key: 'numDays', width: 15 },
                { header: 'Ngày Áp Dụng', key: 'targetDate', width: 15 },
                { header: 'Giờ Áp Dụng', key: 'time', width: 15 },
                { header: 'Hạng Mục / Thiết Bị', key: 'itemName', width: 30 },
                { header: 'Lý Do / Mục Đích', key: 'reason', width: 50 },
                { header: 'Số Tiền Đề Xuất', key: 'amount', width: 18 },
                { header: 'Quản Lý Cấp 1', key: 'approver1', width: 22 },
                { header: 'Quản Lý Cấp 2', key: 'approver2', width: 22 },
            ];

            const getTypeLabel = (type: string) => REQUEST_TYPES_CONFIG.find(t => t.id === type)?.label || type;
            const getStatusLabel = (status: string) => {
                switch (status) {
                    case "PENDING_1": return "Chờ duyệt Cấp 1";
                    case "PENDING_2": return "Chờ duyệt Cấp 2";
                    case "APPROVED": return "Đã duyệt";
                    case "REJECTED": return "Từ chối";
                    case "CANCELLED": return "Đã huỷ";
                    default: return status;
                }
            };

            exportData.forEach((req: any) => {
                const content = req.contentData || {};
                
                let calculatedDays = "";
                if (req.startDate && req.endDate) {
                    const start = new Date(req.startDate);
                    const end = new Date(req.endDate);
                    if (end >= start) {
                        calculatedDays = (Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1).toString();
                    }
                }

                let leaveTypeLabel = "";
                if (content.leaveType === "PAID") leaveTypeLabel = "Có lương";
                else if (content.leaveType === "UNPAID") leaveTypeLabel = "Không lương";
                else if (content.leaveType === "KHAM_THAI") leaveTypeLabel = "Khám thai";
                else if (content.leaveType === "THAI_SAN") leaveTypeLabel = "Nghỉ thai sản";
                else if (content.leaveType === "NGHIA_VU") leaveTypeLabel = "Khám NVQS";
                else if (content.leaveType === "CUOI_HOI") leaveTypeLabel = "Cưới hỏi";
                else if (content.leaveType === "DAM_HIEU") leaveTypeLabel = "Đám hiếu";
                worksheet.addRow({
                    id: req.id.slice(0, 6).toUpperCase(),
                    type: getTypeLabel(req.type),
                    requester: req.requester?.fullName || "---",
                    team: req.team?.name || "---",
                    status: getStatusLabel(req.status),
                    createdAt: new Date(req.createdAt).toLocaleDateString('vi-VN'),
                    leaveType: leaveTypeLabel,
                    startDate: req.startDate ? new Date(req.startDate).toLocaleDateString('vi-VN') : "",
                    endDate: req.endDate ? new Date(req.endDate).toLocaleDateString('vi-VN') : "",
                    numDays: calculatedDays ? Number(calculatedDays) : "", 
                    targetDate: req.targetDate ? new Date(req.targetDate).toLocaleDateString('vi-VN') : "",
                    time: content.time || "",
                    itemName: req.itemName || "",
                    reason: req.reason || "",
                    amount: req.amount ? req.amount : "", 
                    approver1: req.firstApprover?.fullName || "---",
                    approver2: req.secondApprover?.fullName || "---",
                });
            });

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }; 
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 25;

            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' },
                        bottom: { style: 'thin' }, right: { style: 'thin' }
                    };
                    if (rowNumber > 1) {
                        cell.alignment = { 
                            vertical: 'middle', 
                            horizontal: (colNumber === 10 || colNumber === 15) ? 'right' : 'left', 
                            wrapText: colNumber === 14 
                        };
                    }
                });
            });

            worksheet.views = [{ state: 'frozen', ySplit: 1 }];

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Danh_Sach_Don_Tu_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast("success", "Xuất file Excel thành công!");
        } catch (error) {
            console.error(error);
            showToast("error", "Lỗi xuất file Excel!");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Đang tải...</div>}>
            <div className="h-full p-3 md:p-6 animate-fade-in flex flex-col bg-slate-50 overflow-hidden">

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3 md:gap-0 shrink-0">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900">Quản lý Đơn từ & Đề xuất</h1>
                        <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Phê duyệt, theo dõi tiến độ các loại giấy tờ nội bộ</p>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 md:py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 active:scale-95 text-sm md:text-base disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} className="md:w-5 md:h-5" />}
                            <span className="hidden sm:block">Xuất Excel</span>
                        </button>
                        
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex-[2] md:flex-none flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-2.5 md:py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 active:scale-95 text-sm md:text-base"
                        >
                            <Plus size={18} className="md:w-5 md:h-5" /> Tạo đề xuất mới
                        </button>
                    </div>
                </div>

                <div className="flex flex-col xl:flex-row xl:items-end justify-between border-b border-slate-200 mb-4 md:mb-6 gap-3">
                    
                    <div className="flex items-center gap-4 md:gap-6 overflow-x-auto custom-scrollbar-thin shrink-0 pb-1">
                        {canViewAll && (
                            <button
                                onClick={() => setActiveTab('ALL_REQUESTS')}
                                className={`pb-2.5 md:pb-3 text-sm md:text-[15px] font-bold transition-all relative whitespace-nowrap ${activeTab === 'ALL_REQUESTS' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Tất cả đề xuất
                                {activeTab === 'ALL_REQUESTS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full"></div>}
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('MY_REQUESTS')}
                            className={`pb-2.5 md:pb-3 text-sm md:text-[15px] font-bold transition-all relative whitespace-nowrap ${activeTab === 'MY_REQUESTS' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Đơn của tôi
                            {activeTab === 'MY_REQUESTS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full"></div>}
                        </button>
                        {isApprover && (
                            <button
                                onClick={() => setActiveTab('NEED_APPROVAL')}
                                className={`pb-2.5 md:pb-3 text-sm md:text-[15px] font-bold transition-all relative flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'NEED_APPROVAL' ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Cần tôi duyệt
                                {activeTab === 'NEED_APPROVAL' && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600 rounded-t-full"></div>}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:flex md:flex-row items-center gap-2 w-full xl:w-auto pb-2 sm:pb-3">
                        
                        {activeTab !== 'MY_REQUESTS' && (!isTeamLeader || canViewAll) && (
                            <select
                                className="w-full md:w-[150px] px-3 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-700 font-medium"
                                value={filterTeamId}
                                onChange={(e) => {
                                    setFilterTeamId(e.target.value);
                                    setFilterUserId(""); 
                                }}
                            >
                                <option value="">Tất cả Team</option>
                                {dbTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        )}

                        {activeTab !== 'MY_REQUESTS' && (
                            <select
                                className="w-full md:w-[150px] px-3 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-700 font-medium"
                                value={filterUserId}
                                onChange={(e) => setFilterUserId(e.target.value)}
                            >
                                <option value="">Tất cả nhân sự</option>
                                {dbUsers
                                    .filter(u => {
                                        if (filterTeamId) return u.teamId === filterTeamId; 
                                        if (isTeamLeader && !canViewAll) return u.teamId === currentUser?.teamId; 
                                        return true;
                                    })
                                    .map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)
                                }
                            </select>
                        )}

                        <select
                            className="w-full md:w-[150px] px-3 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-700 font-medium"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="">Tất cả loại đơn</option>
                            {REQUEST_TYPES_CONFIG.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>

                        <select
                            className="w-full md:w-[150px] px-3 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-700 font-medium"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="PENDING_1">Chờ duyệt Cấp 1</option>
                            <option value="PENDING_2">Chờ duyệt Cấp 2</option>
                            <option value="APPROVED">Đã duyệt hoàn tất</option>
                            <option value="REJECTED">Bị Từ chối</option>
                            <option value="CANCELLED">Đã huỷ bỏ</option>
                        </select>

                        <div className="relative w-full md:w-[170px] col-span-2 md:col-span-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-slate-400" />
                            </div>
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-1.5 md:py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-slate-700 font-medium placeholder:text-slate-400"
                                placeholder="Mã đơn, Tên người tạo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin mb-3"></div>
                            <p className="font-medium text-xs md:text-sm">Đang tải dữ liệu...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <FileText size={48} className="mb-3 md:mb-4 text-slate-200" />
                            <p className="font-bold text-base md:text-lg text-slate-500">Không tìm thấy đơn từ nào</p>
                            <p className="text-xs md:text-sm mt-1 text-center px-4">Hãy thử điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.</p>
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
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalCount}
                            itemsPerPage={limit}
                            onPageChange={setCurrentPage}
                            itemName="đề xuất"
                        />
                    )}
                </div>

                <CreateRequestModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    allowedTypes={allowedRequestTypes}
                    teams={dbTeams}
                    onRefresh={fetchRequests} 
                />

                <RequestDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete("id");
                        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                    }}
                    requestId={idParam}
                    currentUserId={currentUser?.id}
                    onRefresh={fetchRequests}
                />
            </div>
        </Suspense>
    );
}