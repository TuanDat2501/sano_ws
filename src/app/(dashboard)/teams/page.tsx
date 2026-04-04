"use client";

import { useState, useEffect } from "react";
import { Plus, Users, Trash2, X, Loader2, Building2, ArrowRightLeft, LayoutGrid, FolderTree } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import TeamDetailDrawer from "./TeamDetailDrawer";
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

    // --- TÍNH TOÁN DATA HIỂN THỊ ---
    const displayedTeams = activeDept === "ALL"
        ? teams
        : activeDept === "INDEPENDENT"
            ? teams.filter(t => !t.departmentId)
            : teams.filter(t => t.departmentId === activeDept);

    const activeDeptInfo = activeDept === "ALL"
        ? { name: "Tất Cả Team", desc: "Toàn bộ danh sách team trong công ty" }
        : activeDept === "INDEPENDENT"
            ? { name: "Team Độc Lập", desc: "Các team hoạt động không thuộc phòng ban nào" }
            : departments.find(d => d.id === activeDept) || { name: "", desc: "" };

    return (
        <div className="h-full flex flex-col p-4 md:p-8 animate-fade-in bg-slate-50">

            {/* ================= HEADER ================= */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cơ Cấu <span className="text-red-600">Đội Ngũ</span></h1>
                    <p className="text-slate-500 font-medium mt-1">Phân bổ nhân sự theo Mô hình Phòng Ban.</p>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setIsDeptModalOpen(true)} className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 text-sm">
                        <Building2 size={18} /> Thêm Phòng ban
                    </button>
                    <button onClick={() => setIsTeamModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-600/20 active:scale-95 text-sm">
                        <Plus size={18} /> Thêm Team
                    </button>
                </div>
            </div>

            {/* ================= BODY AREA ================= */}
            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-medium gap-3">
                    <Loader2 size={32} className="animate-spin text-red-500" /> Đang đồng bộ sơ đồ...
                </div>
            ) : (
                // 🚀 DÙNG md:flex-row ĐỂ CHIA 2 CỘT NẰM NGANG
                <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">

                    {/* --- CỘT TRÁI: PHÒNG BAN --- */}
                    <div className="md:w-[280px] xl:w-[320px] shrink-0 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <LayoutGrid size={14} /> Danh sách Phòng Ban
                            </h2>
                        </div>

                        {/* Thanh cuộn riêng cho cột trái */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 bg-white">
                            <button onClick={() => setActiveDept("ALL")} className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${activeDept === "ALL" ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                                <LayoutGrid size={18} className={activeDept === "ALL" ? "text-red-500" : "text-slate-400"} />
                                Tất Cả Team
                            </button>

                            {departments.map(dept => (
                                <div key={dept.id} className={`group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all cursor-pointer ${activeDept === dept.id ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`} onClick={() => setActiveDept(dept.id)}>
                                    <div className="flex items-center gap-3 truncate">
                                        <Building2 size={18} className={activeDept === dept.id ? "text-red-500 shrink-0" : "text-slate-400 shrink-0"} />
                                        <span className="truncate">{dept.name}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteDept(dept.id, dept.name); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 p-1 transition-all" title="Xóa phòng ban">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            <button onClick={() => setActiveDept("INDEPENDENT")} className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${activeDept === "INDEPENDENT" ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                                <FolderTree size={18} className={activeDept === "INDEPENDENT" ? "text-red-500" : "text-slate-400"} />
                                Team Độc Lập
                                <span className="ml-auto text-[10px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{teams.filter(t => !t.departmentId).length}</span>
                            </button>
                        </div>
                    </div>

                    {/* --- CỘT PHẢI: BẢNG TEAM --- */}
                    <div className="flex-1 bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden md:mt-0">
                        {/* <div className="p-6 md:p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50/50">
                            <div className="min-w-0 pr-4">
                                <h2 className="text-xl md:text-2xl font-black text-slate-800 truncate">{activeDeptInfo.name}</h2>
                                {activeDeptInfo.desc && <p className="text-sm font-medium text-slate-500 mt-1 truncate">{activeDeptInfo.desc}</p>}
                            </div>
                            <div className="bg-white border border-slate-200 px-4 py-1.5 rounded-lg shrink-0">
                                <span className="text-sm font-black text-slate-800">{displayedTeams.length} <span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Teams</span></span>
                            </div>
                        </div> */}
                        {/* <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <LayoutGrid size={14} /> Các Team {activeDeptInfo.name !== "Tất Cả Team" && `trong "${activeDeptInfo.name}"`}
                            </h2>
                        </div>    */}
                        {/* Thanh cuộn riêng cho cột phải (chứa Bảng) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-white">
                            {displayedTeams.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 p-8">
                                    <div className="bg-slate-100 p-6 rounded-full"><Users size={32} className="text-slate-300" /></div>
                                    <p className="font-medium">Chưa có Team nào trong mục này.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead className="bg-slate-50 sticky top-0 z-5 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Tên Team</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Mô tả</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Nhân sự</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Tác vụ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayedTeams.map(team => (
                                            <tr key={team.id} className="hover:bg-red-50/50 transition-colors group cursor-pointer" onClick={() => {
                                                setSelectedTeam(team);
                                                setIsDrawerOpen(true);
                                            }}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-slate-100 text-slate-600 p-2.5 rounded-xl group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                                                            <Users size={18} />
                                                        </div>
                                                        <span className="font-bold text-slate-900 text-[15px]">{team.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 font-medium max-w-[200px] truncate" title={team.description}>
                                                    {team.description || "—"}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full text-xs">
                                                        {team._count?.users || 0} mem
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button

                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setTeamToMove(team);
                                                                setTargetDeptId(team.departmentId || "");
                                                                setIsMoveModalOpen(true);
                                                            }}
                                                            className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-100 rounded-lg transition-all"
                                                            title="Điều chuyển Team"
                                                        >
                                                            <ArrowRightLeft size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTeam(team.id, team.name)}
                                                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Giải tán Team"
                                                        >
                                                            <Trash2 size={16} />
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
            {isDeptModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button onClick={() => setIsDeptModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><X size={20} /></button>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Tạo Phòng Ban</h2>
                        <form onSubmit={handleCreateDept} className="space-y-5 mt-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tên Phòng Ban <span className="text-red-500">*</span></label>
                                <input required type="text" placeholder="VD: Phòng Sản Xuất" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Mô tả</label>
                                <textarea rows={3} className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none text-slate-900" value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl">Hủy</button>
                                <button type="submit" disabled={isSubmittingDept} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95">
                                    {isSubmittingDept ? <Loader2 className="animate-spin" size={20} /> : "Tạo Phòng Ban"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isTeamModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button onClick={() => setIsTeamModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><X size={20} /></button>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Tạo Team Mới</h2>
                        <form onSubmit={handleCreateTeam} className="space-y-5 mt-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Thuộc Phòng Ban</label>
                                <select className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 font-medium cursor-pointer" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                                    <option value="">-- Hoạt động Độc lập --</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tên Team <span className="text-red-500">*</span></label>
                                <input required type="text" placeholder="VD: Team Anime" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-red-500/20 outline-none text-slate-900" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Mô tả</label>
                                <textarea rows={2} className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-red-500/20 outline-none resize-none text-slate-900" value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsTeamModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl">Hủy</button>
                                <button type="submit" disabled={isSubmittingTeam} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95 shadow-md shadow-red-600/20">
                                    {isSubmittingTeam ? <Loader2 className="animate-spin" size={20} /> : "Tạo Team"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isMoveModalOpen && teamToMove && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button onClick={() => setIsMoveModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><X size={20} /></button>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Điều Chuyển Team</h2>
                        <p className="text-slate-500 font-medium mb-8 text-sm">Đang chọn: <span className="font-bold text-slate-800">{teamToMove.name}</span></p>

                        <form onSubmit={handleMoveTeam} className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Chuyển đến Phòng Ban</label>
                                <select className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-900 font-medium" value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)}>
                                    <option value="">-- Tách ra Hoạt động Độc lập --</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsMoveModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl">Hủy</button>
                                <button type="submit" disabled={isMoving || targetDeptId === (teamToMove.departmentId || "")} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95">
                                    {isMoving ? <Loader2 className="animate-spin" size={20} /> : "Xác nhận chuyển"}
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
    );
}