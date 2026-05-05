"use client";

import { useState, useEffect } from "react";
import { X, UsersIcon, Loader2, FolderKanban, FileEdit, Film, Clock, Tv, Link as LinkIcon, FileText } from "lucide-react";
import { createPortal } from "react-dom";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: any[];
  users?: any[];
  projects?: any[];
  initialData?: any;
  onSubmit: (taskData: any) => Promise<void>;
  isSubmitting: boolean;
  errors: { [key: string]: string };
}

export default function CreateTaskModal({ isOpen, onClose, teams, initialData, onSubmit, isSubmitting, errors }: CreateTaskModalProps) {
  const [mounted, setMounted] = useState(false);

  const [newTask, setNewTask] = useState({
    id: "", title: "", linkContent: "", contentId: "", editorId: "", teamId: "", projectId: "", duration: "", channelId: ""
  });

  const [teamProjects, setTeamProjects] = useState<any[]>([]);
  const [teamContents, setTeamContents] = useState<any[]>([]);
  const [teamEditors, setTeamEditors] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [teamChannels, setTeamChannels] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNewTask({
          id: initialData.id,
          title: initialData.title || "",
          linkContent: initialData.linkContent || "",
          contentId: initialData.contentId || "",
          channelId: initialData.channelId || "",
          editorId: initialData.editorId || "",
          teamId: initialData.teamId || "",
          projectId: initialData.projectId || "",
          duration: initialData.duration || ""
        });
      } else {
        setNewTask({ id: "", title: "", linkContent: "", contentId: "", editorId: "", teamId: "", projectId: "", duration: "", channelId: "" });
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!newTask.teamId) {
        setTeamProjects([]); setTeamContents([]); setTeamEditors([]); setTeamChannels([]);
        return;
      }

      setIsLoadingData(true);
      try {
        const resProj = await fetch(`/api/projects?teamId=${newTask.teamId}`);
        const dataProj = await resProj.json();
        if (Array.isArray(dataProj)) setTeamProjects(dataProj);

        const resChan = await fetch(`/api/channels?teamId=${newTask.teamId}`);
        const dataChan = await resChan.json();
        if (Array.isArray(dataChan)) setTeamChannels(dataChan);

        const resUsers = await fetch(`/api/users?teamId=${newTask.teamId}`);
        const dataUsers = await resUsers.json();
        const listUsers = Array.isArray(dataUsers.users) ? dataUsers.users : [];
        if (Array.isArray(listUsers)) {
          setTeamContents(listUsers.filter((u: any) => ['CONTENT'].includes(u.role)));
          setTeamEditors(listUsers.filter((u: any) => ['EDITOR'].includes(u.role)));
        }
      } catch (error) {
        console.error("Lỗi fetch dữ liệu Team:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (isOpen && newTask.teamId) fetchTeamData();
  }, [newTask.teamId, isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...newTask, duration: newTask.duration ? Number(newTask.duration) : null };
    onSubmit(payload);
  };

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100000] animate-fade-in" onClick={onClose} />

      <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
        {/* 🚀 ĐÃ SỬA: max-w-3xl, p-6, rounded-[24px] để Modal thon gọn hơn */}
        <div className="bg-white rounded-[24px] p-5 md:p-6 w-full max-w-3xl shadow-2xl relative pointer-events-auto animate-scale-in max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>


          <div className="flex justify-between">
            

            <div className="shrink-0 mb-5">
              <h2 className="text-lg md:text-xl font-black text-slate-900 mb-0.5 flex items-center gap-2">
                {initialData ? "Chỉnh sửa Thông tin Task" : "Giao Task / Video mới"}
              </h2>
              <p className="text-slate-500 font-medium text-[13px]">
                {initialData ? "Cập nhật lại dự án, nhân sự hoặc thời lượng." : "Điền thông tin và chỉ định nhân sự chuyên biệt."}
              </p>
            </div>
            <button onClick={onClose} className="top-5 right-5 p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors z-10" style={{height:'fit-content'}}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-1">
              {/* 🚀 ĐÃ SỬA: gap-5 thay vì gap-8 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

                {/* ======== CỘT TRÁI: THÔNG TIN TASK ======== */}
                <div className="space-y-4">
                  <h3 className="font-bold text-[13px] text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <FileText className="text-blue-500" size={14} /> Thông tin Video
                  </h3>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề / Ý tưởng <span className="text-red-500">*</span></label>
                    {/* 🚀 ĐÃ SỬA: rows=2, p-2.5, rounded-xl */}
                    <textarea
                      required autoFocus rows={2}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none transition-all text-slate-900 font-bold focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 resize-none"
                      placeholder="VD: Cách dùng AI..."
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><LinkIcon size={12} /> Link nguồn <span className="text-red-500">*</span></label>
                    <input
                      required type="url"
                      className={`w-full mt-1 border rounded-xl p-2.5 text-sm outline-none transition-all font-medium ${errors.linkContent ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white'}`}
                      placeholder="https://v.douyin.com/..."
                      value={newTask.linkContent}
                      onChange={(e) => setNewTask({ ...newTask, linkContent: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Clock size={12} /> Thời lượng yêu cầu (Phút) <span className="text-red-500">*</span></label>
                    <input
                      required type="number" min="1"
                      className="w-full mt-1 bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 text-sm outline-none transition-all text-indigo-900 font-black placeholder:text-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="VD: 15"
                      value={newTask.duration}
                      onChange={(e) => setNewTask({ ...newTask, duration: e.target.value })}
                    />
                  </div>
                </div>

                {/* ======== CỘT PHẢI: PHÂN BỔ TÀI NGUYÊN ======== */}
                <div className="space-y-4">
                  <h3 className="font-bold text-[13px] text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <UsersIcon className="text-emerald-500" size={14} /> Phân bổ tài nguyên
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Chọn Team */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <UsersIcon size={12} /> Chọn Team <span className="text-red-500">*</span>
                      </label>
                      <select required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:border-emerald-500 focus:bg-white outline-none transition-all text-sm font-bold text-slate-800 cursor-pointer" value={newTask.teamId}
                        onChange={(e) => setNewTask({ ...newTask, teamId: e.target.value, projectId: "", contentId: "", editorId: "", channelId: "" })}>
                        <option value="">-- Chọn Team --</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    {/* Chọn Kênh */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <Tv size={12} /> Kênh <span className="text-red-500">*</span>
                        {isLoadingData && <Loader2 size={10} className="animate-spin text-red-500 ml-1" />}
                      </label>
                      <select required disabled={!newTask.teamId || isLoadingData} className={`w-full border rounded-xl p-2.5 outline-none transition-all text-sm font-bold cursor-pointer ${!newTask.teamId ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`} value={newTask.channelId} onChange={(e) => setNewTask({ ...newTask, channelId: e.target.value })}>
                        <option value="">-- Chọn --</option>
                        {teamChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    {/* Chọn Dự án */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <FolderKanban size={12} /> Dự án <span className="text-red-500">*</span>
                      </label>
                      <select required disabled={!newTask.teamId || isLoadingData} className={`w-full border rounded-xl p-2.5 outline-none transition-all text-sm font-bold cursor-pointer ${!newTask.teamId ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`} value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
                        <option value="">-- Chọn --</option>
                        {teamProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <FileEdit size={12} /> Content
                      </label>
                      <select disabled={!newTask.teamId || isLoadingData} className={`w-full border rounded-xl p-2.5 outline-none transition-all text-sm font-bold cursor-pointer ${!newTask.teamId ? 'bg-white/50 border-emerald-100/50 text-slate-400 cursor-not-allowed' : 'bg-white border-emerald-200 text-slate-800 focus:border-emerald-500 shadow-sm'}`} value={newTask.contentId} onChange={(e) => setNewTask({ ...newTask, contentId: e.target.value })}>
                        <option value="">-- Chưa gán --</option>
                        {teamContents.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <Film size={12} /> Editor
                      </label>
                      <select disabled={!newTask.teamId || isLoadingData} className={`w-full border rounded-xl p-2.5 outline-none transition-all text-sm font-bold cursor-pointer ${!newTask.teamId ? 'bg-white/50 border-emerald-100/50 text-slate-400 cursor-not-allowed' : 'bg-white border-emerald-200 text-slate-800 focus:border-emerald-500 shadow-sm'}`} value={newTask.editorId} onChange={(e) => setNewTask({ ...newTask, editorId: e.target.value })}>
                        <option value="">-- Chưa gán --</option>
                        {teamEditors.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* ======== FOOTER: NÚT BẤM ======== */}
            {/* 🚀 ĐÃ SỬA: Giảm padding py-3, text-sm */}
            <div className="shrink-0 pt-4 flex gap-3 border-t border-slate-100 mt-2">
              <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-3 rounded-xl transition-all active:scale-95 text-sm">Hủy bỏ</button>
              <button type="submit" disabled={isSubmitting || isLoadingData} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 text-sm">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (initialData ? "Lưu Thay Đổi 💾" : "Giao việc ngay 🚀")}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}