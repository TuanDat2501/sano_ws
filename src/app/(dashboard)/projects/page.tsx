"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, Edit, Trash2, ChevronLeft, ChevronRight, FolderKanban, Star, Users, Clock, CheckCircle2, GitBranch, ListChecks, Sparkles } from "lucide-react";
import PermissionGuard from "@/app/component/PermissionGuard";
import { useToast } from "@/app/component/ToastProvider";
import ProjectModal from "./ProjectModal"; // 🚀 Sửa lại đường dẫn import cho đúng thư mục của sếp
import Link from "next/link";
import CriteriaDrawer from "./CriteriaDrawer";
import { useSession } from "next-auth/react";
import SampleCriteriaDrawer from "./SampleCriteriaDrawer";

export default function ProjectsPage() {
    const { data: session } = useSession();
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [projects, setProjects] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [criteriaProjectId, setCriteriaProjectId] = useState<string | null>(null);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [isCriteriaOpen, setIsCriteriaOpen] = useState(false);
    const [selectedProjectForCriteria, setSelectedProjectForCriteria] = useState<any>(null);
    const [isSampleDrawerOpen, setIsSampleDrawerOpen] = useState(false);
    const isAdmin = (session?.user as any)?.role === "ADMIN";
    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch Projects
            const resProj = await fetch("/api/projects");
            const dataProj = await resProj.json();
            if (Array.isArray(dataProj)) setProjects(dataProj);

            // Fetch Teams để cho vào Select Box
            const resTeam = await fetch("/api/teams");
            const dataTeam = await resTeam.json();
            if (Array.isArray(dataTeam)) setTeams(dataTeam);
        } catch (error) {
            showToast("error", "Lỗi tải dữ liệu!");
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    // ===== LƯU DỰ ÁN (CREATE / UPDATE) =====
    const handleSaveProject = async (formData: any) => {
        try {
            const isEditing = !!editingProject;
            const url = isEditing ? `/api/projects/${editingProject.id}` : "/api/projects";
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error("Lỗi lưu dự án");

            showToast("success", isEditing ? "Cập nhật thành công!" : "Tạo dự án thành công!");
            setIsModalOpen(false);
            setEditingProject(null);
            loadData(); // Cập nhật lại bảng
        } catch (error) {
            showToast("error", "Có lỗi xảy ra, vui lòng thử lại!");
        }
    };

    // ===== XÓA DỰ ÁN =====
    const handleDelete = async (id: string) => {
        if (!confirm("Sếp có chắc chắn muốn xóa dự án này? Các Task bên trong có thể bị ảnh hưởng!")) return;
        try {
            const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            showToast("success", "Đã xóa dự án!");
            loadData();
        } catch (error) {
            showToast("error", "Lỗi khi xóa dự án!");
        }
    };

    return (
        <PermissionGuard moduleId="MENU_PROJECTS">
            <div className="h-full flex flex-col p-4 md:p-8 bg-slate-50 animate-fade-in">

                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Hệ thống <span className="text-red-600">Dự án</span></h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">Quản lý quy trình và tiêu chuẩn chất lượng tập trung.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        {/* 🚀 NÚT TIÊU CHUẨN MẪU (CHỈ ADMIN THẤY) */}
                        {isAdmin && (
                            <button
                                onClick={() => setIsSampleDrawerOpen(true)}
                                className="flex-1 lg:flex-none bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-indigo-200"
                            >
                                <Sparkles size={20} /> Tiêu chuẩn mẫu
                            </button>
                        )}

                        <button
                            onClick={() => { setEditingProject(null); setIsModalOpen(true); }}
                            className="flex-1 lg:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95"
                        >
                            <Plus size={20} /> Tạo Dự án mới
                        </button>
                    </div>
                </div>

                {/* Bảng Dữ liệu */}
                <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Dự án</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Team thực hiện</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Người Giám Sát</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Điểm TB</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Trạng thái</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Cập nhật</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium">Đang tải dữ liệu...</td></tr>
                                ) : projects.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium">Chưa có dự án nào.</td></tr>
                                ) : (
                                    projects.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((proj) => (
                                        <tr key={proj.id} className="hover:bg-slate-50/80 transition-colors group">

                                            {/* Cột 1: Tên Dự Án */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-red-50 text-red-600 rounded-xl shrink-0"><FolderKanban size={18} /></div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm max-w-[200px] truncate">{proj.name}</p>

                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cột 2: Team Thực Hiện */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px] shrink-0 border border-white shadow-sm">
                                                        {(proj.team?.name || '?').charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">
                                                        {proj.team?.name || 'Chưa gắn team'}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Cột 3: Người Giám Sát */}
                                            <td className="px-4 py-3">
                                                {proj.supervisor ? (
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="relative">
                                                            {proj.supervisor.avatarUrl ? (
                                                                <img
                                                                    src={proj.supervisor.avatarUrl}
                                                                    alt={proj.supervisor.fullName}
                                                                    className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border-2 border-white shadow-sm">
                                                                    {proj.supervisor.fullName.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-700 leading-none">{proj.supervisor.fullName}</p>

                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-300 italic">Chưa chỉ định</span>
                                                )}
                                            </td>
                                            {/* Cột 3: Điểm Trung Bình */}
                                            <td className="px-6 py-4 text-center">
                                                {/* Tạm thời hiển thị "-" vì chưa có API tính điểm tổng quát */}
                                                <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg text-xs font-black border border-amber-100/50">
                                                    <Star size={12} fill="currentColor" /> {proj.score || "-.-"}
                                                </div>
                                            </td>

                                            {/* Cột 4: Trạng thái */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${proj.status === 'ACTIVE' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100/50' : 'text-slate-600 bg-slate-100'}`}>
                                                    {proj.status === 'ACTIVE' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                    {proj.status}
                                                </span>
                                            </td>

                                            {/* Cột 5: Cập nhật */}
                                            <td className="px-6 py-4 text-xs font-bold text-slate-400 italic">
                                                {proj.updatedAt ? new Date(proj.updatedAt).toLocaleDateString('vi-VN') : 'Mới tạo'}
                                            </td>

                                            {/* Cột 6: Thao tác */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-50 lg:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setCriteriaProjectId(proj.id)} // Gán ID phát là Drawer nó tự "tỉnh dậy" đi fetch data
                                                        className="px-3 py-1.5 flex items-center gap-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        <ListChecks size={14} /> Tiêu chuẩn
                                                    </button>
                                                    {/* 🚀 NÚT VÀO TRANG THIẾT KẾ QUY TRÌNH (WORKFLOW) */}
                                                    <Link href={`/workflow/${proj.id}?name=${encodeURIComponent(proj.name)}`}>
                                                        <button
                                                            className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:shadow-md hover:shadow-indigo-600/20 rounded-lg text-xs font-bold transition-all active:scale-95"
                                                            title="Thiết lập Quy trình (Workflow)"
                                                        >
                                                            <GitBranch size={14} /> Quy trình
                                                        </button>
                                                    </Link>

                                                    {/* Nút Sửa / Xóa */}
                                                    <button
                                                        onClick={() => { setEditingProject(proj); setIsModalOpen(true); }}
                                                        className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-400 transition-colors" title="Sửa thông tin"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(proj.id)}
                                                        className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors" title="Xóa dự án"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Khởi chạy Modal */}
            <ProjectModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingProject(null); }}
                teams={teams}
                initialData={editingProject}
                onSubmit={handleSaveProject}
            />
            <CriteriaDrawer
                isOpen={!!criteriaProjectId} // Nếu có ID thì mở
                onClose={() => setCriteriaProjectId(null)} // Đóng thì xóa ID
                projectId={criteriaProjectId}
                onSave={async (newCriteria: any) => {
                    // Logic gọi API PUT để lưu (như cũ)
                    const res = await fetch(`/api/projects/${criteriaProjectId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ criteria: JSON.stringify(newCriteria) })
                    });
                    if (res.ok) {
                        showToast('success', 'Đã lưu sườn điểm!');
                        setCriteriaProjectId(null); // Đóng drawer
                        loadData(); // Cập nhật lại list
                    }
                }}
            />
            <SampleCriteriaDrawer
                isOpen={isSampleDrawerOpen}
                onClose={() => setIsSampleDrawerOpen(false)}
            />
        </PermissionGuard>
    );
}