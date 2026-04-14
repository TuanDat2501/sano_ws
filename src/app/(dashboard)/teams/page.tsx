"use client";

import { useState, useEffect } from "react";
import { Plus, Users, Trash2, X, Loader2, Building2, ArrowRightLeft, LayoutGrid, FolderTree } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import TeamDetailDrawer from "./TeamDetailDrawer";
import PermissionGuard from "@/app/component/PermissionGuard";

export default function TeamsPage() {
    const { showToast } = useToast();

    // --- DATA STATES ---
    const [teams, setTeams] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDept, setActiveDept] = useState<string>("ALL");

    // --- MODAL STATES ---
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [teamName, setTeamName] = useState("");
    const [teamDesc, setTeamDesc] = useState("");
    const [selectedDept, setSelectedDept] = useState("");
    const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);

    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [deptName, setDeptName] = useState("");
    const [deptDesc, setDeptDesc] = useState("");
    const [isSubmittingDept, setIsSubmittingDept] = useState(false);

    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [teamToMove, setTeamToMove] = useState<any>(null);
    const [targetDeptId, setTargetDeptId] = useState("");
    const [isMoving, setIsMoving] = useState(false);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<any>(null);

    // --- FETCH DATA ---
    useEffect(() => {
        Promise.all([
            fetch("/api/teams").then(res => res.ok ? res.json() : []),
            fetch("/api/departments").then(res => res.ok ? res.json() : [])
        ]).then(([teamsData, deptsData]) => {
            setTeams(teamsData);
            setDepartments(deptsData);
            setLoading(false);
        }).catch(() => {
            showToast("error", "Lỗi tải dữ liệu Đội ngũ");
            setLoading(false);
        });
    }, []);

    // --- CRUD DEPARTMENTS ---
    const handleCreateDept = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingDept(true);
        try {
            const res = await fetch("/api/departments", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: deptName, description: deptDesc }),
            });
            if (res.ok) {
                const newDept = await res.json();
                setDepartments([newDept, ...departments]);
                setIsDeptModalOpen(false); setDeptName(""); setDeptDesc("");
                showToast("success", "Tạo Phòng ban thành công!");
                setActiveDept(newDept.id);
            } else {
                const err = await res.json(); showToast("error", err.error || "Lỗi tạo Phòng ban");
            }
        } catch (error) { showToast("error", "Đã xảy ra lỗi hệ thống!"); }
        finally { setIsSubmittingDept(false); }
    };

    const handleDeleteDept = async (deptId: string, deptName: string) => {
        if (!window.confirm(`Sếp có chắc chắn muốn xóa phòng "${deptName}" không? Các Team bên trong sẽ trở thành Team Độc Lập.`)) return;
        try {
            const res = await fetch(`/api/departments/${deptId}`, { method: "DELETE" });
            if (res.ok) {
                setDepartments(departments.filter(d => d.id !== deptId));
                setTeams(teams.map(t => t.departmentId === deptId ? { ...t, departmentId: null } : t));
                if (activeDept === deptId) setActiveDept("ALL");
                showToast("success", "Đã xóa Phòng ban!");
            } else {
                const err = await res.json(); showToast("error", err.error || "Không thể xóa Phòng ban");
            }
        } catch (error) { showToast("error", "Lỗi hệ thống"); }
    };

    // --- CRUD TEAMS ---
    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingTeam(true);
        try {
            const res = await fetch("/api/teams", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: teamName, description: teamDesc, departmentId: selectedDept || null }),
            });
            if (res.ok) {
                const newTeam = await res.json();
                setTeams([{ ...newTeam, _count: { users: 0 } }, ...teams]);
                setIsTeamModalOpen(false); setTeamName(""); setTeamDesc(""); setSelectedDept("");
                showToast("success", "Tạo Team thành công!");
                if (selectedDept) setActiveDept(selectedDept);
            } else {
                const err = await res.json(); showToast("error", err.error || "Lỗi tạo Team");
            }
        } catch (error) { showToast("error", "Đã xảy ra lỗi hệ thống!"); }
        finally { setIsSubmittingTeam(false); }
    };

    const handleDeleteTeam = async (teamId: string, teamName: string) => {
        if (!window.confirm(`Xác nhận giải tán "${teamName}"? Nhân sự sẽ được đẩy ra ngoài.`)) return;
        try {
            const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
            if (res.ok) {
                setTeams(teams.filter(t => t.id !== teamId));
                showToast("success", "Đã giải tán Team!");
            } else {
                const err = await res.json(); showToast("error", err.error || "Không thể xóa Team này");
            }
        } catch (error) { showToast("error", "Lỗi kết nối"); }
    };

    const handleMoveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamToMove) return;
        setIsMoving(true);
        try {
            const res = await fetch(`/api/teams/${teamToMove.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ departmentId: targetDeptId === "" ? null : targetDeptId }),
            });
            if (res.ok) {
                setTeams(teams.map(t => t.id === teamToMove.id ? { ...t, departmentId: targetDeptId === "" ? null : targetDeptId } : t));
                setIsMoveModalOpen(false); setTeamToMove(null);
                showToast("success", "Đã điều chuyển Team!");
            } else {
                const err = await res.json(); showToast("error", err.error || "Lỗi di chuyển");
            }
        } catch (error) { showToast("error", "Đã xảy ra lỗi hệ thống!"); }
        finally { setIsMoving(false); }
    };

    const displayedTeams = activeDept === "ALL"
        ? teams
        : activeDept === "INDEPENDENT"
            ? teams.filter(t => !t.departmentId)
            : teams.filter(t => t.departmentId === activeDept);

    return (
        <PermissionGuard moduleId="MENU_TEAMS">
        <div className="h-full flex flex-col p-3 md:p-6 lg:p-8 animate-fade-in bg-slate-50">

            {/* ================= HEADER ================= */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 mb-4 md:mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Cơ Cấu <span className="text-red-600">Đội Ngũ</span></h1>
                    <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Phân bổ nhân sự theo Mô hình Phòng Ban.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3 w-full lg:w-auto">
                    <button onClick={() => setIsDeptModalOpen(true)} className="w-full sm:w-auto justify-center bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 px-4 md:px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 text-sm">
                        <Building2 size={16} className="md:w-5 md:h-5" /> Thêm Phòng ban
                    </button>
                    <button onClick={() => setIsTeamModalOpen(true)} className="w-full sm:w-auto justify-center bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95 text-sm">
                        <Plus size={16} className="md:w-5 md:h-5" /> Thêm Team
                    </button>
                </div>
            </div>

            {/* ================= BODY AREA ================= */}
            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-medium gap-3">
                    <Loader2 size={24} className="animate-spin text-red-500 md:w-8 md:h-8" /> 
                    <span className="text-sm">Đang đồng bộ sơ đồ...</span>
                </div>
            ) : (
                <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 min-h-0 overflow-hidden">

                    {/* --- BỘ LỌC PHÒNG BAN --- */}
                    
                    {/* 1. GIAO DIỆN MOBILE: DẠNG SELECT DROPDOWN */}
                    <div className="md:hidden w-full bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 shrink-0">
                        <div className="flex items-center px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all">
                            <LayoutGrid size={16} className="text-slate-400 shrink-0 mr-2" />
                            <select 
                                className="w-full bg-transparent outline-none font-bold text-slate-700 text-sm cursor-pointer"
                                value={activeDept}
                                onChange={(e) => setActiveDept(e.target.value)}
                            >
                                <option value="ALL">Tất Cả Team</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                                <option value="INDEPENDENT">Team Độc Lập ({teams.filter(t => !t.departmentId).length})</option>
                            </select>
                        </div>
                    </div>

                    {/* 2. GIAO DIỆN DESKTOP: DẠNG CỘT DANH SÁCH */}
                    <div className="hidden md:flex w-[240px] lg:w-[280px] xl:w-[320px] shrink-0 bg-white rounded-[24px] border border-slate-200 shadow-sm flex-col min-h-0 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <LayoutGrid size={14} /> Danh sách Phòng Ban
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 bg-white">
                            <button onClick={() => setActiveDept("ALL")} className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 text-sm ${activeDept === "ALL" ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                                <LayoutGrid size={18} className={activeDept === "ALL" ? "text-red-500" : "text-slate-400"} />
                                Tất Cả Team
                            </button>

                            {departments.map(dept => (
                                <div key={dept.id} className={`group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all cursor-pointer text-sm ${activeDept === dept.id ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`} onClick={() => setActiveDept(dept.id)}>
                                    <div className="flex items-center gap-3 truncate">
                                        <Building2 size={18} className={`shrink-0 ${activeDept === dept.id ? "text-red-500" : "text-slate-400"}`} />
                                        <span className="truncate">{dept.name}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteDept(dept.id, dept.name); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 p-1 transition-all shrink-0" title="Xóa phòng ban">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            <button onClick={() => setActiveDept("INDEPENDENT")} className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 text-sm ${activeDept === "INDEPENDENT" ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                                <FolderTree size={18} className={activeDept === "INDEPENDENT" ? "text-red-500" : "text-slate-400"} />
                                Team Độc Lập
                                <span className="ml-auto text-[10px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{teams.filter(t => !t.departmentId).length}</span>
                            </button>
                        </div>
                    </div>

                    {/* --- CỘT PHẢI: BẢNG TEAM --- */}
                    <div className="flex-1 bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden mt-0">
                        <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar relative bg-white">
                            {displayedTeams.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 md:space-y-4 p-6 md:p-8">
                                    <div className="bg-slate-100 p-4 md:p-6 rounded-full"><Users size={24} className="md:w-8 md:h-8 text-slate-300" /></div>
                                    <p className="font-medium text-xs md:text-sm">Chưa có Team nào trong mục này.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[550px] md:min-w-[600px]">
                                    <thead className="bg-slate-50 sticky top-0 z-5 shadow-sm">
                                        <tr>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Tên Team</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Mô tả</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Nhân sự</th>
                                            <th className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Tác vụ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayedTeams.map(team => (
                                            <tr key={team.id} className="hover:bg-red-50/50 transition-colors group cursor-pointer" onClick={() => {
                                                setSelectedTeam(team);
                                                setIsDrawerOpen(true);
                                            }}>
                                                <td className="px-4 md:px-6 py-3 md:py-4">
                                                    <div className="flex items-center gap-2.5 md:gap-3">
                                                        <div className="bg-slate-100 text-slate-600 p-2 md:p-2.5 rounded-lg md:rounded-xl group-hover:bg-red-50 group-hover:text-red-600 transition-colors shrink-0">
                                                            <Users size={16} className="md:w-[18px] md:h-[18px]" />
                                                        </div>
                                                        <span className="font-bold text-slate-900 text-xs md:text-[15px]">{team.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-slate-500 font-medium max-w-[150px] md:max-w-[200px] truncate" title={team.description}>
                                                    {team.description || "—"}
                                                </td>
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                                                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-bold px-2.5 md:px-3 py-1 rounded-full text-[10px] md:text-xs whitespace-nowrap">
                                                        {team._count?.users || 0} mem
                                                    </span>
                                                </td>
                                                <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setTeamToMove(team);
                                                                setTargetDeptId(team.departmentId || "");
                                                                setIsMoveModalOpen(true);
                                                            }}
                                                            className="text-slate-400 hover:text-blue-600 p-1.5 md:p-2 hover:bg-blue-100 rounded-lg transition-all"
                                                            title="Điều chuyển Team"
                                                        >
                                                            <ArrowRightLeft size={14} className="md:w-4 md:h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteTeam(team.id, team.name);
                                                            }}
                                                            className="text-slate-400 hover:text-red-600 p-1.5 md:p-2 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Giải tán Team"
                                                        >
                                                            <Trash2 size={14} className="md:w-4 md:h-4" />
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

            {/* ================= MODALS ================= */}
            {/* Modal: Thêm Phòng Ban */}
            {isDeptModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl md:rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button onClick={() => setIsDeptModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-1.5 md:p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><X size={18} className="md:w-5 md:h-5" /></button>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1.5 md:mb-2">Tạo Phòng Ban</h2>
                        <form onSubmit={handleCreateDept} className="space-y-4 md:space-y-5 mt-4 md:mt-6">
                            <div>
                                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tên Phòng Ban <span className="text-red-500">*</span></label>
                                <input required type="text" placeholder="VD: Phòng Sản Xuất" className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 text-sm md:text-base" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Mô tả</label>
                                <textarea rows={3} className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none text-slate-900 text-sm md:text-base" value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} />
                            </div>
                            <div className="pt-2 md:pt-4 flex flex-col-reverse sm:flex-row gap-2.5 md:gap-3">
                                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl text-sm md:text-base">Hủy</button>
                                <button type="submit" disabled={isSubmittingDept} className="w-full sm:flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95 text-sm md:text-base">
                                    {isSubmittingDept ? <Loader2 className="animate-spin" size={18} /> : "Tạo Phòng Ban"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Thêm Team */}
            {isTeamModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl md:rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button onClick={() => setIsTeamModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-1.5 md:p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><X size={18} className="md:w-5 md:h-5" /></button>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1.5 md:mb-2">Tạo Team Mới</h2>
                        <form onSubmit={handleCreateTeam} className="space-y-4 md:space-y-5 mt-4 md:mt-6">
                            <div>
                                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Thuộc Phòng Ban</label>
                                <select className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 font-medium cursor-pointer text-sm md:text-base" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                                    <option value="">-- Hoạt động Độc lập --</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tên Team <span className="text-red-500">*</span></label>
                                <input required type="text" placeholder="VD: Team Anime" className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 outline-none text-slate-900 text-sm md:text-base" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Mô tả</label>
                                <textarea rows={2} className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-red-500/20 outline-none resize-none text-slate-900 text-sm md:text-base" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} />
                            </div>
                            <div className="pt-2 md:pt-4 flex flex-col-reverse sm:flex-row gap-2.5 md:gap-3">
                                <button type="button" onClick={() => setIsTeamModalOpen(false)} className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl text-sm md:text-base">Hủy</button>
                                <button type="submit" disabled={isSubmittingTeam} className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95 shadow-md shadow-red-600/20 text-sm md:text-base">
                                    {isSubmittingTeam ? <Loader2 className="animate-spin" size={18} /> : "Tạo Team"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Điều chuyển Team */}
            {isMoveModalOpen && teamToMove && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl md:rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button onClick={() => setIsMoveModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-1.5 md:p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><X size={18} className="md:w-5 md:h-5" /></button>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1.5 md:mb-2">Điều Chuyển Team</h2>
                        <p className="text-slate-500 font-medium mb-5 md:mb-8 text-xs md:text-sm">Đang chọn: <span className="font-bold text-slate-800">{teamToMove.name}</span></p>

                        <form onSubmit={handleMoveTeam} className="space-y-4 md:space-y-5">
                            <div>
                                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Chuyển đến Phòng Ban</label>
                                <select className="w-full mt-1 md:mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-3 md:p-3.5 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 font-medium text-sm md:text-base" value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)}>
                                    <option value="">-- Tách ra Hoạt động Độc lập --</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>

                            <div className="pt-2 md:pt-4 flex flex-col-reverse sm:flex-row gap-2.5 md:gap-3">
                                <button type="button" onClick={() => setIsMoveModalOpen(false)} className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl text-sm md:text-base">Hủy</button>
                                <button type="submit" disabled={isMoving || targetDeptId === (teamToMove.departmentId || "")} className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 md:py-3.5 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95 text-sm md:text-base">
                                    {isMoving ? <Loader2 className="animate-spin" size={18} /> : "Xác nhận chuyển"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <TeamDetailDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                team={selectedTeam}
            />
        </div>
        </PermissionGuard>
    );
}