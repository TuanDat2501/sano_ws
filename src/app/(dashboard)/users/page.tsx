"use client";

import { useState, useEffect } from "react";
import { UserPlus, Briefcase, Edit, Loader2, Filter, Users, UserCircle2, Search, Lock, Unlock } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import UserFormDrawer from "./UserFormDrawer";
import PermissionGuard from "@/app/component/PermissionGuard";

export default function UsersPage() {
    const { showToast } = useToast();
    
    // --- DATA STATES ---
    const [users, setUsers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<string>("ALL"); 
    const [searchTerm, setSearchTerm] = useState<string>(""); 
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 10;

    // 🚀 BỔ SUNG: State tìm kiếm


    // --- MODAL STATES ---
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    


    

    // Form Data (Thêm thuộc tính isActive)
    const [formData, setFormData] = useState({
        username: "", password: "", fullName: "", role: "CONTENT", teamId: "", isActive: true,
        employeeCode: "", dob: "", ethnicity: "", 
        cccdNumber: "", cccdDate: "", cccdPlace: "",
        permanentAddress: "", currentAddress: "", 
        phone: "", personalEmail: "",
        relativeName: "", relativePhone: "", relativeRelation: "",
        bankAccount: "", bankName: "", joinDate: "", bhxhNumber: ""
    });

    // Tiện ích format ngày cho thẻ input type="date"
    const formatDateForInput = (dateString: string) => {
        if (!dateString) return "";
        return new Date(dateString).toISOString().split('T')[0];
    };
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Gõ tìm kiếm thì reset về trang 1
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter]);
    // --- FETCH DATA ---
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch Teams (Chỉ cần lấy 1 lần đầu)
                if (teams.length === 0) {
                    const resTeams = await fetch("/api/teams");
                    if (resTeams.ok) setTeams(await resTeams.json());
                }

                // Fetch Users với thông số phân trang và lọc
                const resUsers = await fetch(`/api/users?page=${currentPage}&limit=${limit}&teamId=${activeFilter}&search=${debouncedSearch}`);
                if (resUsers.ok) {
                    const data = await resUsers.json();
                    setUsers(data.users || []);
                    setTotalPages(data.totalPages || 1);
                    setTotalCount(data.totalCount || 0);
                }
            } catch (error) {
                showToast("error", "Lỗi tải dữ liệu!");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [currentPage, activeFilter, debouncedSearch]);

    // --- CRUD FUNCTIONS ---
    const openCreateDrawer = () => {
        setEditingUser(null);
        setFormData({ 
            username: "", password: "", fullName: "", role: "CONTENT", teamId: "", isActive: true,
            employeeCode: "", dob: "", ethnicity: "", cccdNumber: "", cccdDate: "", cccdPlace: "",
            permanentAddress: "", currentAddress: "", phone: "", personalEmail: "",
            relativeName: "", relativePhone: "", relativeRelation: "",
            bankAccount: "", bankName: "", joinDate: "", bhxhNumber: ""
        });
        setIsDrawerOpen(true);
    };

    const openEditDrawer = (user: any) => {
        setEditingUser(user);
        setFormData({ 
            username: user.username, 
            password: "", 
            fullName: user.fullName, 
            role: user.role, 
            teamId: user.teamId || "",
            isActive: user.isActive,
            // 🚀 Đổ dữ liệu HR cũ (nếu có)
            employeeCode: user.employeeCode || "",
            dob: formatDateForInput(user.dob),
            ethnicity: user.ethnicity || "",
            cccdNumber: user.cccdNumber || "",
            cccdDate: formatDateForInput(user.cccdDate),
            cccdPlace: user.cccdPlace || "",
            permanentAddress: user.permanentAddress || "",
            currentAddress: user.currentAddress || "",
            phone: user.phone || "",
            personalEmail: user.personalEmail || "",
            relativeName: user.relativeName || "",
            relativePhone: user.relativePhone || "",
            relativeRelation: user.relativeRelation || "",
            bankAccount: user.bankAccount || "",
            bankName: user.bankName || "",
            joinDate: formatDateForInput(user.joinDate),
            bhxhNumber: user.bhxhNumber || ""
        });
        setIsDrawerOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const isUpdate = !!editingUser;
        const url = isUpdate ? `/api/users/${editingUser.id}` : "/api/users";
        const method = isUpdate ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    teamId: formData.teamId === "" ? null : formData.teamId
                })
            });
            
            if (res.ok) {
                const savedUser = await res.json();
                if (isUpdate) {
                    setUsers(users.map(u => u.id === savedUser.id ? savedUser : u));
                    showToast("success", "Cập nhật thông tin thành công!");
                } else {
                    setUsers([savedUser, ...users]);
                    showToast("success", "Đã thêm nhân sự mới!");
                }
                setIsDrawerOpen(false);
            } else {
                const error = await res.json();
                showToast("error", error.error || "Có lỗi xảy ra");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 🚀 ĐỔI TÊN & LOGIC: Thay vì Xóa cứng (DELETE), ta Khóa/Mở khóa (Toggle isActive)
    const handleToggleStatus = async (user: any) => {
        const actionText = user.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản";
        if (!window.confirm(`Sếp có chắc chắn muốn ${actionText} của "${user.fullName}"?`)) return;
        
        try {
            const res = await fetch(`/api/users/${user.id}`, { 
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !user.isActive }) // Đảo ngược trạng thái
            });
            if (res.ok) {
                const updatedUser = await res.json();
                setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
                showToast("success", `Đã ${actionText} thành công!`);
            } else {
                showToast("error", "Không thể thay đổi trạng thái nhân sự này");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        }
    };


    const activeFilterInfo = activeFilter === "ALL" 
        ? { name: "Tất Cả Nhân Sự", desc: "Toàn bộ nhân viên của Sano Workspace" }
        : activeFilter === "NO_TEAM"
            ? { name: "Chưa Phân Team", desc: "Nhân sự hoạt động độc lập hoặc mới vào" }
            : { name: teams.find(t => t.id === activeFilter)?.name || "Team", desc: "Danh sách thành viên thuộc team này" };

    return (
        <PermissionGuard moduleId="MENU_USERS">
        <div className="h-full flex flex-col p-3 md:p-6 lg:p-8 animate-fade-in bg-slate-50">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 mb-4 md:mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Quản lý <span className="text-red-600">Nhân sự</span></h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Quản trị tài khoản và phân quyền hệ thống.</p>
                </div>

                <div className="flex w-full sm:w-auto gap-3">
                    {/* 🚀 Ô TÌM KIẾM */}
                    <div className="relative flex-1 sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium"
                            placeholder="Tìm tên, tài khoản..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={openCreateDrawer} className="w-auto shrink-0 justify-center bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95 text-sm">
                        <UserPlus size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Thêm mới</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-medium gap-3">
                    <Loader2 size={24} className="animate-spin text-red-500 md:w-8 md:h-8" /> 
                    <span className="text-xs md:text-sm">Đang tải dữ liệu...</span>
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 min-h-0 overflow-hidden">
                    {/* ... (CỘT TRÁI - BỘ LỌC TEAM GIỮ NGUYÊN NHƯ CŨ CỦA SẾP) ... */}
                    {/* Bỏ qua phần render Cột trái để tránh code quá dài, sếp giữ nguyên đoạn <div className="hidden md:flex w-[240px]..."> nhé */}

                    {/* --- CỘT PHẢI: BẢNG NHÂN SỰ --- */}
                    <div className="flex-1 bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden md:mt-0">
                        {/* Header bảng */}
                        {/* <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50/50">
                            <div className="min-w-0 pr-4">
                                <h2 className="text-lg md:text-2xl font-black text-slate-800 truncate">{activeFilterInfo.name}</h2>
                                <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5 md:mt-1 truncate">
                                    Đang hiển thị {displayedUsers.length} nhân sự
                                </p>
                            </div>
                        </div> */}

                        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-white">
                            {users.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-6">
                                    <div className="bg-slate-100 p-4 rounded-full"><Users size={24} className="text-slate-300" /></div>
                                    <p className="font-medium text-sm">Không tìm thấy nhân sự nào.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Họ và Tên</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Vai trò</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Trạng thái</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Tác vụ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map(user => (
                                            <tr key={user.id} className={`hover:bg-slate-50 transition-colors group cursor-pointer md:cursor-default ${!user.isActive ? 'opacity-60' : ''}`} onClick={() => {
                                                if (window.innerWidth < 768) openEditDrawer(user);
                                            }}>
                                                <td className="px-4 md:px-6 py-3 md:py-4">
                                                    <div className="flex items-center gap-2.5 md:gap-3">
                                                        <div className={`h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center font-black shrink-0 text-xs md:text-sm ${user.isActive ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-slate-200 border border-slate-300 text-slate-500'}`}>
                                                           
                                                            {user.avatarUrl ? (
                                                            <img src={user.avatarUrl} alt={user.fullName} className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover" />
                                                        ) :  user.fullName?.charAt(0).toUpperCase()}
                                                        </div>
                                                        
                                                        <div className="min-w-0">
                                                            <span className={`font-bold text-sm md:text-base truncate block ${user.isActive ? 'text-slate-900' : 'text-slate-500 line-through'}`}>{user.fullName}</span>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] font-medium text-slate-500 truncate block">{user.username}</span>
                                                                <span className="hidden md:inline-flex text-[10px] text-slate-400">• {user.team?.name || "Chưa có team"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[11px] font-black uppercase tracking-wider ${user.role === 'ADMIN' || user.role === 'BAN_GIAM_DOC' ? 'bg-red-100 text-red-700' : user.role === 'LEADER' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                {/* 🚀 BỔ SUNG CỘT TRẠNG THÁI */}
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                    {user.isActive ? (
                                                        <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Đang làm
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold">
                                                            <Lock size={12} /> Đã khóa
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); openEditDrawer(user); }} className="text-slate-400 hover:text-blue-600 p-1.5 md:p-2 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa">
                                                            <Edit size={16} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                        {/* 🚀 ĐỔI NÚT THÀNH KHÓA/MỞ KHÓA TÀI KHOẢN */}
                                                        <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(user); }} className={`p-1.5 md:p-2 rounded-lg transition-all ${user.isActive ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`} title={user.isActive ? "Khóa tài khoản" : "Mở khóa"}>
                                                            {user.isActive ? <Lock size={16} className="md:w-[18px] md:h-[18px]" /> : <Unlock size={16} className="md:w-[18px] md:h-[18px]" />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        {!loading && users.length > 0 && (
                            <div className="px-4 py-3 md:px-6 md:py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 shrink-0 gap-3">
                                <p className="text-[11px] md:text-xs text-slate-500 font-medium">
                                    Hiển thị {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, totalCount)} trên tổng số {totalCount} nhân sự
                                </p>
                                
                                <div className="flex items-center gap-1.5 md:gap-2">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                                    >
                                        Trước
                                    </button>
                                    
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-7 h-7 md:w-8 md:h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}

                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <UserFormDrawer 
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                editingUser={editingUser}
                isSubmitting={isSubmitting}
                formData={formData}
                setFormData={setFormData}
                handleSubmit={handleSubmit}
                teams={teams}
            />
        </div>
        </PermissionGuard>
    );
}