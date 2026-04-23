"use client";

import { X, Send, Loader2, CheckCircle2, FolderKanban } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface PushTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: any;
    session: any;
    onSubmit: (pushData: { teamId: string, projectId: string, contentId: string, editorId: string }) => Promise<void>;
    isSubmitting: boolean;
    teams?: any[]; // Dành cho Admin nếu muốn chọn Team khác
}

export default function PushTaskModal({ isOpen, onClose, task, session, onSubmit, isSubmitting, teams = [] }: PushTaskModalProps) {
    const [mounted, setMounted] = useState(false);
    const userRole = session?.user?.role;
    const defaultTeamId = session?.user?.teamId || "";

    // 🚀 State lưu trữ dữ liệu Form
    const [pushData, setPushData] = useState({
        teamId: defaultTeamId,
        projectId: "",
        contentId: "",
        editorId: ""
    });

    // 🚀 State lưu trữ dữ liệu từ API
    const [teamProjects, setTeamProjects] = useState<any[]>([]);
    const [teamContents, setTeamContents] = useState<any[]>([]);
    const [teamEditors, setTeamEditors] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    useEffect(() => setMounted(true), []);

    // Reset lại form khi đóng/mở Modal
    useEffect(() => {
        if (isOpen) {
            setPushData({ teamId: defaultTeamId, projectId: "", contentId: "", editorId: "" });
        }
    }, [isOpen, defaultTeamId]);

    // ==========================================
    // 🚀 ĐOẠN CODE FETCH DATA SẾP YÊU CẦU
    // ==========================================
    useEffect(() => {
        const fetchTeamData = async () => {
            if (!pushData.teamId) {
                setTeamProjects([]);
                setTeamContents([]);
                setTeamEditors([]);
                setPushData(prev => ({ ...prev, projectId: "", contentId: "", editorId: "" }));
                return;
            }

            setIsLoadingData(true);
            try {
                // 1. Kéo danh sách Dự án của Team
                const resProj = await fetch(`/api/projects?teamId=${pushData.teamId}`);
                const dataProj = await resProj.json();
                if (Array.isArray(dataProj)) setTeamProjects(dataProj);

                // 2. Kéo danh sách Nhân sự của Team
                const resUsers = await fetch(`/api/users?teamId=${pushData.teamId}`);
                const dataUsers = await resUsers.json();
                
                // Hỗ trợ cả 2 chuẩn API trả về: { users: [...] } hoặc trực tiếp [...]
                const listUsers = Array.isArray(dataUsers.users) ? dataUsers.users : (Array.isArray(dataUsers) ? dataUsers : []);
                
                if (Array.isArray(listUsers)) {
                    // Mở rộng thêm ADMIN/LEADER để sếp có thể tự test hoặc tự nhận việc
                    setTeamContents(listUsers.filter((u: any) => ['CONTENT', 'ADMIN', 'LEADER'].includes(u.role)));
                    setTeamEditors(listUsers.filter((u: any) => ['EDITOR', 'ADMIN', 'LEADER'].includes(u.role)));
                }
            } catch (error) {
                console.error("Lỗi fetch dữ liệu Team:", error);
            } finally {
                setIsLoadingData(false);
            }
        };

        if (isOpen) fetchTeamData();
    }, [pushData.teamId, isOpen]);
    // ==========================================

    if (!mounted || !isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(pushData);
    };

    const canChangeTeam = ["ADMIN", "BAN_GIAM_DOC"].includes(userRole);

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in transform transition-all">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                        <Send size={20} className="text-emerald-600"/> Xuất Kho & Giao Việc
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-5 relative">
                    {/* Hiệu ứng mờ khi đang tải data */}
                    {isLoadingData && (
                        <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center rounded-b-2xl">
                            <Loader2 className="animate-spin text-emerald-600" size={32} />
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-inner">
                        <p className="text-sm font-bold text-blue-900 line-clamp-2">"{task?.title}"</p>
                    </div>

                    {/* Dành cho ADMIN đổi team để giao việc chéo */}
                    {canChangeTeam && (
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Thuộc Team</label>
                            <select value={pushData.teamId} onChange={e => setPushData({...pushData, teamId: e.target.value})} className="w-full mt-1.5 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold text-slate-700 bg-slate-50 cursor-pointer">
                                <option value="">-- Chọn Team --</option>
                                {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5"><FolderKanban size={12}/> Thuộc Dự án (Project)</label>
                        <select value={pushData.projectId} onChange={e => setPushData({...pushData, projectId: e.target.value})} className="w-full mt-1.5 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-700 bg-slate-50 focus:bg-white cursor-pointer">
                            <option value="">-- Không xếp vào dự án nào --</option>
                            {teamProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nhân sự Content</label>
                            <select value={pushData.contentId} onChange={e => setPushData({...pushData, contentId: e.target.value})} className="w-full mt-1.5 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-700 bg-slate-50 focus:bg-white cursor-pointer">
                                <option value="">-- Ai viết? --</option>
                                {teamContents.map(u => (
                                    <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nhân sự Editor</label>
                            <select value={pushData.editorId} onChange={e => setPushData({...pushData, editorId: e.target.value})} className="w-full mt-1.5 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-700 bg-slate-50 focus:bg-white cursor-pointer">
                                <option value="">-- Ai dựng? --</option>
                                {teamEditors.map(u => (
                                    <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 transition-all active:scale-95">Hủy</button>
                        <button type="submit" disabled={isSubmitting || isLoadingData} className="flex-1 py-3.5 bg-emerald-600 font-bold text-white rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-emerald-600/20">
                            {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <><CheckCircle2 size={18}/> Giao Việc</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}