"use client";

import { useState, useEffect } from "react";
import { UserPlus, Briefcase, Edit, Loader2, Filter, Users, Search, Lock, Unlock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import UserFormDrawer from "./UserFormDrawer";
import PermissionGuard from "@/app/component/PermissionGuard";

export default function UsersPage() {
    const { showToast } = useToast();
    
    // --- DATA STATES ---
    const [users, setUsers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // 🚀 BỘ LỌC TỐI ƯU CHO HR
    const [filterTeam, setFilterTeam] = useState<string>("ALL"); 
    const [filterRole, setFilterRole] = useState<string>("ALL"); 
    const [filterStatus, setFilterStatus] = useState<string>("ALL"); 

    const [searchTerm, setSearchTerm] = useState<string>(""); 
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 10;

    // --- MODAL STATES ---
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null); 
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        username: "", password: "", fullName: "", role: "CONTENT", teamId: "", isActive: true,
        employeeCode: "", dob: "", ethnicity: "", cccdNumber: "", cccdDate: "", cccdPlace: "",
        permanentAddress: "", currentAddress: "", phone: "", personalEmail: "",
        relativeName: "", relativePhone: "", relativeRelation: "",
        bankAccount: "", bankName: "", joinDate: "", bhxhNumber: ""
    });

    const formatDateForInput = (dateString: string) => {
        if (!dateString) return "";
        return new Date(dateString).toISOString().split('T')[0];
    };

    // Debounce tìm kiếm
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); 
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset về trang 1 khi đổi bất kỳ bộ lọc nào
    useEffect(() => {
        setCurrentPage(1);
    }, [filterTeam, filterRole, filterStatus]);

    // --- FETCH DATA ---
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                if (teams.length === 0) {
                    const resTeams = await fetch("/api/teams");
                    if (resTeams.ok) setTeams(await resTeams.json());
                }

                // 🚀 ĐẨY ĐẦY ĐỦ 3 BỘ LỌC LÊN API
                const query = new URLSearchParams({
                    page: currentPage.toString(),
                    limit: limit.toString(),
                    teamId: filterTeam,
                    role: filterRole,
                    status: filterStatus,
                    search: debouncedSearch
                });

                const resUsers = await fetch(`/api/users?${query.toString()}`);
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
    }, [currentPage, filterTeam, filterRole, filterStatus, debouncedSearch]);

    // --- CRUD FUNCTIONS (Giữ nguyên) ---
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
            username: user.username, password: "", fullName: user.fullName, role: user.role, teamId: user.teamId || "", isActive: user.isActive,
            employeeCode: user.employeeCode || "", dob: formatDateForInput(user.dob), ethnicity: user.ethnicity || "",
            cccdNumber: user.cccdNumber || "", cccdDate: formatDateForInput(user.cccdDate), cccdPlace: user.cccdPlace || "",
            permanentAddress: user.permanentAddress || "", currentAddress: user.currentAddress || "", phone: user.phone || "", personalEmail: user.personalEmail || "",
            relativeName: user.relativeName || "", relativePhone: user.relativePhone || "", relativeRelation: user.relativeRelation || "",
            bankAccount: user.bankAccount || "", bankName: user.bankName || "", joinDate: formatDateForInput(user.joinDate), bhxhNumber: user.bhxhNumber || ""
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
                method, headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, teamId: formData.teamId === "" ? null : formData.teamId })
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

    const handleToggleStatus = async (user: any) => {
        const actionText = user.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản";
        if (!window.confirm(`Sếp có chắc chắn muốn ${actionText} của "${user.fullName}"?`)) return;
        
        try {
            const res = await fetch(`/api/users/${user.id}`, { 
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !user.isActive }) 
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

    return (
        <PermissionGuard moduleId="MENU_USERS">
        <div className="h-full flex flex-col p-3 md:p-6 lg:p-8 animate-fade-in bg-slate-50">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 mb-4 md:mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Quản lý <span className="text-red-600">Nhân sự</span></h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Quản trị hồ sơ và phân quyền tài khoản.</p>
                </div>

                <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 items-stretch sm:items-center">
                    {/* SEARCH INPUT */}
                    <div className="relative flex-1 sm:w-64 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium shadow-sm"
                            placeholder="Tìm tên, mã NV, tài khoản..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button onClick={openCreateDrawer} className="w-full sm:w-auto shrink-0 justify-center bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95 text-sm">
                        <UserPlus size={16} className="md:w-[18px] md:h-[18px]" /> <span>Thêm nhân sự</span>
                    </button>
                </div>
            </div>

            {/* 🚀 TOOLBAR BỘ LỌC DÀNH CHO HR */}
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6 overflow-x-auto custom-scrollbar-thin shrink-0 pb-1">
                <div className="flex items-center gap-1.5 md:gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm shrink-0">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="ALL">Tất cả Trạng thái</option>
                        <option value="ACTIVE">Đang hoạt động</option>
                        <option value="INACTIVE">Đã nghỉ / Khóa</option>
                    </select>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm shrink-0">
                    <ShieldAlert size={16} className="text-amber-500" />
                    <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                        <option value="ALL">Tất cả Vị trí</option>
                        <option value="CONTENT">Content Creator</option>
                        <option value="EDITOR">Video Editor</option>
                        <option value="LEADER">Leader / Quản lý</option>
                        <option value="HR">Hành chính NS</option>
                        <option value="KE_TOAN">Kế toán</option>
                        <option value="BAN_GIAM_DOC">Ban Giám Đốc</option>
                    </select>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm shrink-0">
                    <Briefcase size={16} className="text-blue-500" />
                    <select className="bg-transparent text-xs md:text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2 max-w-[150px] md:max-w-[200px]" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
                        <option value="ALL">Toàn bộ Team</option>
                        <option value="NO_TEAM">Chưa phân Team</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-medium gap-3">
                    <Loader2 size={24} className="animate-spin text-red-500 md:w-8 md:h-8" /> 
                    <span className="text-xs md:text-sm">Đang tải dữ liệu...</span>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden md:mt-0">
                        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-white">
                            {users.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-6">
                                    <div className="bg-slate-100 p-4 rounded-full"><Users size={24} className="text-slate-300" /></div>
                                    <p className="font-medium text-sm">Không tìm thấy nhân sự nào khớp với bộ lọc.</p>
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
                                                                <span className="text-[10px] font-medium text-slate-500 truncate block">{user.employeeCode ? `${user.employeeCode} • ${user.username}` : user.username}</span>
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
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                    {user.isActive ? (
                                                        <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold border border-green-100">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Đang làm
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold border border-slate-200">
                                                            <Lock size={12} /> Đã khóa
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); openEditDrawer(user); }} className="text-slate-400 hover:text-blue-600 p-1.5 md:p-2 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa">
                                                            <Edit size={16} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
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