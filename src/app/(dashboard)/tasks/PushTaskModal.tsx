"use client";

import { X, Send, Loader2, CheckCircle2, FolderKanban, FileEdit, Film, MonitorPlay } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface PushTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: any;
    session: any;
    onSubmit: (pushData: any) => Promise<void>;
    isSubmitting: boolean;
    teams?: any[];
}

// 🚀 TÁI SỬ DỤNG LẠI COMPONENT CHỌN NHIỀU NGƯỜI
const MultiSelectUser = ({ label, icon: Icon, options, selectedIds, onChange, disabled }: any) => {
    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (e.target.value) {
        onChange([...selectedIds, e.target.value]);
        e.target.value = ""; 
      }
    };
  
    const handleRemove = (idToRemove: string) => {
      onChange(selectedIds.filter((id: string) => id !== idToRemove));
    };
  
    return (
      <div className="bg-white/50 p-2 rounded-xl border border-slate-100">
        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
          <Icon size={12} /> {label}
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px] p-1 bg-white border border-emerald-100 rounded-lg shadow-inner">
          {selectedIds.length === 0 && <span className="text-xs text-slate-400 italic px-1">Chưa chọn ai...</span>}
          {selectedIds.map((id: string) => {
            const opt = options.find((o: any) => o.id === id);
            return (
              <span key={id} className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                {opt?.fullName || "Loading..."} 
                <X size={12} className="cursor-pointer hover:text-red-500 hover:bg-emerald-200 rounded-full transition-colors p-0.5" onClick={() => handleRemove(id)} />
              </span>
            );
          })}
        </div>
        <select disabled={disabled} value="" onChange={handleSelect} className="w-full border rounded-xl p-2 outline-none font-bold text-sm text-slate-700 bg-emerald-50/50 border-emerald-200 disabled:opacity-50 focus:border-emerald-500 transition-all cursor-pointer">
          <option value="">+ Thêm nhân sự</option>
          {options.filter((o: any) => !selectedIds.includes(o.id)).map((o: any) => (
            <option key={o.id} value={o.id}>{o.fullName}</option>
          ))}
        </select>
      </div>
    );
};

export default function PushTaskModal({ isOpen, onClose, task, session, onSubmit, isSubmitting, teams = [] }: PushTaskModalProps) {
    const [mounted, setMounted] = useState(false);
    const userRole = session?.user?.role;
    const defaultTeamId = session?.user?.teamId || "";

    // 🚀 ĐÃ SỬA: Đổi state hứng dữ liệu sang dạng Mảng (Array)
    const [pushData, setPushData] = useState({
        teamId: defaultTeamId,
        projectId: "",
        contentIds: [] as string[],
        editorIds: [] as string[],
        animatorIds: [] as string[],
    });

    const [teamProjects, setTeamProjects] = useState<any[]>([]);
    const [teamContents, setTeamContents] = useState<any[]>([]);
    const [teamEditors, setTeamEditors] = useState<any[]>([]);
    const [teamAnimators, setTeamAnimators] = useState<any[]>([]); // Animator List
    const [isLoadingData, setIsLoadingData] = useState(false);

    useEffect(() => setMounted(true), []);

    // Reset lại form khi đóng/mở Modal
    useEffect(() => {
        if (isOpen) {
            setPushData({ 
                teamId: task?.teamId || defaultTeamId, 
                projectId: task?.projectId || "", 
                contentIds: [], 
                editorIds: [],
                animatorIds: []
            });
        }
    }, [isOpen, defaultTeamId, task]);

    useEffect(() => {
        const fetchTeamData = async () => {
            if (!pushData.teamId) {
                setTeamProjects([]);
                setTeamContents([]);
                setTeamEditors([]);
                setTeamAnimators([]);
                setPushData(prev => ({ ...prev, projectId: "", contentIds: [], editorIds: [], animatorIds: [] }));
                return;
            }

            setIsLoadingData(true);
            try {
                const resProj = await fetch(`/api/projects?teamId=${pushData.teamId}`);
                const dataProj = await resProj.json();
                if (Array.isArray(dataProj)) setTeamProjects(dataProj);

                const resUsers = await fetch(`/api/users?teamId=${pushData.teamId}`);
                const dataUsers = await resUsers.json();
                
                const listUsers = Array.isArray(dataUsers.users) ? dataUsers.users : (Array.isArray(dataUsers) ? dataUsers : []);
                
                if (Array.isArray(listUsers)) {
                    setTeamContents(listUsers.filter((u: any) => ['CONTENT', 'ADMIN', 'LEADER'].includes(u.role)));
                    setTeamEditors(listUsers.filter((u: any) => ['EDITOR', 'ADMIN', 'LEADER'].includes(u.role)));
                    setTeamAnimators(listUsers.filter((u: any) => ['CONTENT', 'EDITOR', 'ADMIN', 'LEADER'].includes(u.role)));
                }
            } catch (error) {
                console.error("Lỗi fetch dữ liệu Team:", error);
            } finally {
                setIsLoadingData(false);
            }
        };

        if (isOpen) fetchTeamData();
    }, [pushData.teamId, isOpen]);

    if (!mounted || !isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(pushData);
    };

    const canChangeTeam = ["ADMIN", "BAN_GIAM_DOC"].includes(userRole);
    // 🚀 Lọc dự án theo Kênh (Channel) của Task nếu có
    const filteredProjects = task?.channelId 
        ? teamProjects.filter(p => p.channelId === task.channelId) 
        : teamProjects;

    const isTongHopChannel = task?.channel?.category === 'TONG_HOP';

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in transform transition-all flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                        <Send size={20} className="text-emerald-600"/> Đẩy ý tưởng ra Kanban
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-5 md:p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar relative flex-1">
                    {isLoadingData && (
                        <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                            <Loader2 className="animate-spin text-emerald-600" size={32} />
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-inner shrink-0">
                        <p className="text-xs font-black text-blue-500 mb-1 tracking-widest uppercase">Tên Video:</p>
                        <p className="text-sm font-bold text-blue-900 line-clamp-2">"{task?.title}"</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                        {canChangeTeam && (
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Thuộc Team</label>
                                <select value={pushData.teamId} onChange={e => setPushData({...pushData, teamId: e.target.value})} className="w-full mt-1.5 border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 font-bold text-slate-700 bg-slate-50 cursor-pointer">
                                    <option value="">-- Chọn Team --</option>
                                    {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className={!canChangeTeam ? "md:col-span-2" : ""}>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5"><FolderKanban size={12}/> Thuộc Dự án</label>
                            <select value={pushData.projectId} onChange={e => setPushData({...pushData, projectId: e.target.value})} className="w-full mt-1.5 border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 font-medium text-slate-700 bg-slate-50 focus:bg-white cursor-pointer">
                                <option value="">{task?.channelId && filteredProjects.length === 0 ? "-- Kênh trống --" : "-- Chọn --"}</option>
                                {filteredProjects.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 🚀 ĐÃ SỬA: SỬ DỤNG COMPONENT CHỌN NHIỀU NGƯỜI */}
                    <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl flex flex-col gap-4">
                        <MultiSelectUser 
                            label="Nhóm Content" 
                            icon={FileEdit} 
                            options={teamContents} 
                            selectedIds={pushData.contentIds} 
                            onChange={(val: any) => setPushData({ ...pushData, contentIds: val })} 
                            disabled={!pushData.teamId || isLoadingData} 
                        />
                        
                        <MultiSelectUser 
                            label="Nhóm Editor" 
                            icon={Film} 
                            options={teamEditors} 
                            selectedIds={pushData.editorIds} 
                            onChange={(val: any) => setPushData({ ...pushData, editorIds: val })} 
                            disabled={!pushData.teamId || isLoadingData} 
                        />

                        {!isTongHopChannel && (
                            <MultiSelectUser 
                                label="Nhóm Chuyển Động" 
                                icon={MonitorPlay} 
                                options={teamAnimators} 
                                selectedIds={pushData.animatorIds} 
                                onChange={(val: any) => setPushData({ ...pushData, animatorIds: val })} 
                                disabled={!pushData.teamId || isLoadingData} 
                            />
                        )}
                    </div>
                </form>

                <div className="p-4 md:p-5 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 font-bold text-slate-600 rounded-xl hover:bg-slate-100 transition-all active:scale-95">Hủy</button>
                    <button type="submit" onClick={handleSubmit} disabled={isSubmitting || isLoadingData} className="flex-[2] py-3 bg-emerald-600 font-bold text-white rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-emerald-600/20">
                        {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <><CheckCircle2 size={18}/> Chuyển vào Kanban</>}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}