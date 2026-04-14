"use client";

import { useState, useEffect } from "react";
import { UserPlus, Shield, Briefcase, Trash2, Edit, X, Loader2, Filter, Users, UserCircle2 } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import UserFormDrawer from "./UserFormDrawer";
import PermissionGuard from "@/app/component/PermissionGuard";

export default function UsersPage() {
    const { showToast } = useToast();
    
    // --- DATA STATES ---
    const [users, setUsers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<string>("ALL"); // Lọc theo Team

    // --- MODAL STATES (Dùng chung cho cả Thêm và Sửa) ---
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null); // null = Thêm mới, có data = Sửa
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form Data
    const [formData, setFormData] = useState({
        username: "", password: "", fullName: "", role: "CONTENT", teamId: ""
    });

    // --- FETCH DATA ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const [resUsers, resTeams] = await Promise.all([
                    fetch("/api/users"),
                    fetch("/api/teams")
                ]);
                const usersData = resUsers.ok ? await resUsers.json() : [];
                const teamsData = resTeams.ok ? await resTeams.json() : [];
                
                setUsers(usersData);
                setTeams(teamsData);
            } catch (error) {
                showToast("error", "Lỗi tải dữ liệu!");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // --- CRUD FUNCTIONS ---
    
    // Mở Modal Thêm mới
    const openCreateDrawer = () => {
        setEditingUser(null);
        setFormData({ username: "", password: "", fullName: "", role: "CONTENT", teamId: "" });
        setIsDrawerOpen(true);
    };

    // Mở Modal Sửa
    const openEditDrawer = (user: any) => {
        setEditingUser(user);
        setFormData({ 
            username: user.username, 
            password: "", // Bỏ trống mật khẩu, nếu nhập mới update
            fullName: user.fullName, 
            role: user.role, 
            teamId: user.teamId || "" 
        });
        setIsDrawerOpen(true);
    };

    // Xử lý Submit (Gộp cả Thêm và Sửa)
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
                    // Update lại data trên giao diện
                    setUsers(users.map(u => u.id === savedUser.id ? savedUser : u));
                    showToast("success", "Cập nhật thông tin thành công!");
                } else {
                    // Thêm mới vào đầu danh sách
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

    // Xử lý Xóa nhân sự
    const handleDelete = async (userId: string, name: string) => {
        if (!window.confirm(`Sếp có chắc chắn muốn xóa tài khoản của "${name}" không? Thao tác này không thể hoàn tác.`)) return;
        
        try {
            const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
            if (res.ok) {
                setUsers(users.filter(u => u.id !== userId));
                showToast("success", "Đã xóa nhân sự!");
            } else {
                const error = await res.json();
                showToast("error", error.error || "Không thể xóa nhân sự này");
            }
        } catch (error) {
            showToast("error", "Lỗi kết nối máy chủ");
        }
    };

    // --- LỌC DATA HIỂN THỊ ---
    const displayedUsers = activeFilter === "ALL" 
        ? users 
        : activeFilter === "NO_TEAM" 
            ? users.filter(u => !u.teamId)
            : users.filter(u => u.teamId === activeFilter);

    // Tính toán tiêu đề cột phải
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

                <button onClick={openCreateDrawer} className="w-full sm:w-auto justify-center bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2.5 md:py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95 text-sm">
                    <UserPlus size={16} className="md:w-[18px] md:h-[18px]" /> Thêm nhân viên
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-medium gap-3">
                    <Loader2 size={24} className="animate-spin text-red-500 md:w-8 md:h-8" /> 
                    <span className="text-xs md:text-sm">Đang tải dữ liệu...</span>
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 min-h-0 overflow-hidden">
                    
                    {/* --- BỘ LỌC BÊN TRÁI --- */}
                    
                    {/* 1. GIAO DIỆN MOBILE: DẠNG SELECT DROPDOWN */}
                    <div className="md:hidden w-full bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 shrink-0">
                        <div className="flex items-center px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all">
                            <Filter size={16} className="text-slate-400 shrink-0 mr-2" />
                            <select 
                                className="w-full bg-transparent outline-none font-bold text-slate-700 text-sm cursor-pointer"
                                value={activeFilter}
                                onChange={(e) => setActiveFilter(e.target.value)}
                            >
                                <option value="ALL">Tất cả nhân sự ({users.length})</option>
                                <option value="NO_TEAM">Chưa phân Team ({users.filter(u => !u.teamId).length})</option>
                                <optgroup label="Danh sách Team">
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>
                                            {team.name} ({users.filter(u => u.teamId === team.id).length})
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    {/* 2. GIAO DIỆN DESKTOP: DẠNG CỘT DANH SÁCH */}
                    <div className="hidden md:flex w-[240px] lg:w-[280px] xl:w-[320px] shrink-0 bg-white rounded-[24px] border border-slate-200 shadow-sm flex-col min-h-0 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Filter size={14} /> Lọc theo Team
                            </h2>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                            <button onClick={() => setActiveFilter("ALL")} className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between ${activeFilter === "ALL" ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                                <div className="flex items-center gap-3 truncate">
                                    <Users size={18} className={activeFilter === "ALL" ? "text-red-500 shrink-0" : "text-slate-400 shrink-0"} />
                                    <span className="truncate">Tất cả nhân sự</span>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${activeFilter === "ALL" ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{users.length}</span>
                            </button>

                            <button onClick={() => setActiveFilter("NO_TEAM")} className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between ${activeFilter === "NO_TEAM" ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                                <div className="flex items-center gap-3 truncate">
                                    <UserCircle2 size={18} className={activeFilter === "NO_TEAM" ? "text-red-500 shrink-0" : "text-slate-400 shrink-0"} />
                                    <span className="truncate">Chưa phân Team</span>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${activeFilter === "NO_TEAM" ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{users.filter(u => !u.teamId).length}</span>
                            </button>

                            <div className="pt-4 pb-2 px-4">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Danh sách Team</p>
                            </div>

                            {teams.map(team => {
                                const count = users.filter(u => u.teamId === team.id).length;
                                return (
                                    <button key={team.id} onClick={() => setActiveFilter(team.id)} className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center justify-between ${activeFilter === team.id ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                                        <div className="flex items-center gap-3 truncate pr-2">
                                            <Briefcase size={18} className={activeFilter === team.id ? "text-red-500 shrink-0" : "text-slate-400 shrink-0"} />
                                            <span className="truncate">{team.name}</span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${activeFilter === team.id ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- CỘT PHẢI: BẢNG NHÂN SỰ --- */}
                    <div className="flex-1 bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden md:mt-0">
                        <div className="p-4 md:p-6 lg:p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50/50">
                            <div className="min-w-0 pr-4">
                                <h2 className="text-lg md:text-2xl font-black text-slate-800 truncate">{activeFilterInfo.name}</h2>
                                <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5 md:mt-1 truncate">{activeFilterInfo.desc}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-white">
                            {displayedUsers.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 md:space-y-4 p-6 md:p-8">
                                    <div className="bg-slate-100 p-4 md:p-6 rounded-full"><Users size={24} className="md:w-8 md:h-8 text-slate-300" /></div>
                                    <p className="font-medium text-xs md:text-sm">Không tìm thấy nhân sự nào.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[650px] md:min-w-[700px]">
                                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Họ và Tên</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Vai trò</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Thuộc Team</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Tác vụ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayedUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50 transition-colors group cursor-pointer md:cursor-default" onClick={() => {
                                                // Trên mobile, bấm vào cả dòng để sửa cho dễ
                                                if (window.innerWidth < 768) openEditDrawer(user);
                                            }}>
                                                <td className="px-4 md:px-6 py-3 md:py-4">
                                                    <div className="flex items-center gap-2.5 md:gap-3">
                                                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center font-black text-red-600 shrink-0 text-xs md:text-sm">
                                                            {user.fullName?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-bold text-slate-900 text-sm md:text-base truncate block">{user.fullName}</span>
                                                            <span className="text-[10px] md:hidden font-medium text-slate-500 truncate block mt-0.5">{user.username}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[11px] font-black uppercase tracking-wider ${user.role === 'ADMIN' || user.role === 'BAN_GIAM_DOC' ? 'bg-red-100 text-red-700' : user.role === 'LEADER' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 md:px-6 py-3 md:py-4">
                                                    <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium text-slate-500">
                                                        <Briefcase size={14} className="md:w-4 md:h-4 text-slate-400 shrink-0" />
                                                        <span className="truncate max-w-[120px] md:max-w-[200px]">{user.team?.name || "—"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                                                    {/* Trên mobile hiện luôn nút, trên PC cần hover mới hiện */}
                                                    <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); openEditDrawer(user); }} className="text-slate-400 hover:text-blue-600 p-1.5 md:p-2 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa">
                                                            <Edit size={16} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(user.id, user.fullName); }} className="text-slate-400 hover:text-red-600 p-1.5 md:p-2 hover:bg-red-50 rounded-lg transition-all" title="Xóa nhân sự">
                                                            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ================= DRAWER COMPONENT ================= */}
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