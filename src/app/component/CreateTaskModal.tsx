"use client";

import { useState, useEffect } from "react";
import { X, UsersIcon, Loader2, FolderKanban, FileEdit, Film, Clock, Tv, Link as LinkIcon, FileText, Key, CalendarDays, MonitorPlay } from "lucide-react";
import { createPortal } from "react-dom";

interface CreateTaskModalProps {
  isOpen: boolean; onClose: () => void; teams: any[]; users?: any[]; projects?: any[]; initialData?: any;
  onSubmit: (taskData: any) => Promise<void>; isSubmitting: boolean; errors: { [key: string]: string };
}

export default function CreateTaskModal({ isOpen, onClose, teams, initialData, onSubmit, isSubmitting, errors }: CreateTaskModalProps) {
  const [mounted, setMounted] = useState(false);

  const [newTask, setNewTask] = useState({
    id: "", title: "", keywords: "", linkContent: "", contentId: "", editorId: "", animatorId: "", teamId: "", projectId: "", duration: "", publishDate: "", channelId: "", priority: "NORMAL"
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
          keywords: initialData.keywords || "",
          linkContent: initialData.linkContent || "",
          contentId: initialData.contentId || "",
          editorId: initialData.editorId || "",
          animatorId: initialData.animatorId || "",
          teamId: initialData.teamId || "",
          projectId: initialData.projectId || "",
          duration: initialData.duration || "",
          publishDate: initialData.publishDate ? new Date(initialData.publishDate).toISOString().split('T')[0] : "",
          channelId: initialData.channelId || "",
          priority: initialData.priority || "NORMAL"
        });
      } else {
        setNewTask({ id: "", title: "", keywords: "", linkContent: "", contentId: "", editorId: "", animatorId: "", teamId: "", projectId: "", duration: "", publishDate: "", channelId: "", priority: "" });
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!newTask.teamId) {
        setTeamProjects([]); setTeamContents([]); setTeamEditors([]); setTeamChannels([]); return;
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
          setTeamContents(listUsers.filter((u: any) => ['CONTENT', 'LEADER'].includes(u.role)));
          setTeamEditors(listUsers.filter((u: any) => ['EDITOR', 'LEADER'].includes(u.role)));
        }
      } catch (error) { } finally { setIsLoadingData(false); }
    };
    if (isOpen && newTask.teamId) fetchTeamData();
  }, [newTask.teamId, isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...newTask, duration: newTask.duration ? Number(newTask.duration) : null };
    onSubmit(payload);
  };

  // 🚀 TÌM KÊNH ĐANG ĐƯỢC CHỌN ĐỂ XÁC ĐỊNH LÀ AI HAY TỔNG HỢP
  const selectedChannel = teamChannels.find(c => c.id === newTask.channelId);
  const isTongHopChannel = selectedChannel?.category === 'TONG_HOP';

  // 🚀 LỌC DANH SÁCH DỰ ÁN THEO KÊNH ĐANG CHỌN
  const filteredProjects = newTask.channelId
    ? teamProjects.filter(p => p.channelId === newTask.channelId)
    : teamProjects;

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100000] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-[24px] p-5 md:p-6 max-w-4xl shadow-2xl relative pointer-events-auto animate-scale-in max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between">
            <div className="shrink-0 mb-5">
              <h2 className="text-lg md:text-xl font-black text-slate-900 mb-0.5 flex items-center gap-2">
                {initialData ? "Chỉnh sửa Thông tin Task" : "Giao Task / Video mới"}
              </h2>
              <p className="text-slate-500 font-medium text-[13px]">Điền thông tin và chỉ định nhân sự chuyên biệt.</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors h-fit">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

                {/* ======== CỘT TRÁI: THÔNG TIN TASK ======== */}
                <div className="space-y-4">
                  <h3 className="font-bold text-[13px] text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <FileText className="text-blue-500" size={14} /> Thông tin Video
                  </h3>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề / Ý tưởng <span className="text-red-500">*</span></label>
                    <textarea required autoFocus rows={2} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all font-bold focus:border-blue-500 focus:bg-white resize-none" placeholder="Nhập tiêu đề video..." value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Key size={12} /> Từ khóa (Key)</label>
                    <input type="text" className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all font-medium focus:border-blue-500 focus:bg-white" placeholder="VD: prehistoric creatures..." value={newTask.keywords} onChange={(e) => setNewTask({ ...newTask, keywords: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><LinkIcon size={12} /> Link Tham Khảo</label>
                    <input type="text" className="w-full mt-1 border rounded-xl p-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none font-medium bg-slate-50 border-slate-200 focus:border-blue-500" placeholder="Dán link youtube..." value={newTask.linkContent} onChange={(e) => setNewTask({ ...newTask, linkContent: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Clock size={12} /> Phút <span className="text-red-500">*</span></label>
                      <input required type="number" min="1" className="w-full mt-1 bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 text-sm text-indigo-900 placeholder:text-indigo-400 outline-none font-black focus:border-indigo-500 focus:bg-white" placeholder="Thời lượng..." value={newTask.duration} onChange={(e) => setNewTask({ ...newTask, duration: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><CalendarDays size={12} /> Ngày Hoành Thành</label>
                      <input type="date" className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 outline-none font-bold focus:border-blue-500 focus:bg-white" value={newTask.publishDate} onChange={(e) => setNewTask({ ...newTask, publishDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        🔥 Mức Độ Ưu Tiên
                      </label>
                      <select
                        className="w-full mt-1 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 outline-none font-bold bg-slate-50 focus:border-blue-500"
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                      >
                        <option value="LOW" className="text-slate-500">Thấp</option>
                        <option value="NORMAL" className="text-blue-600">Bình thường</option>
                        <option value="HIGH" className="text-orange-600">Cao</option>
                        <option value="URGENT" className="text-red-600">Gấp</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ======== CỘT PHẢI: PHÂN BỔ ======== */}
                <div className="space-y-4">
                  <h3 className="font-bold text-[13px] text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <UsersIcon className="text-emerald-500" size={14} /> Phân bổ tài nguyên
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Team <span className="text-red-500">*</span></label>
                      <select required className="w-full border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-slate-50" value={newTask.teamId} onChange={(e) => setNewTask({ ...newTask, teamId: e.target.value, projectId: "", contentId: "", editorId: "", animatorId: "", channelId: "" })}>
                        <option value="">-- Chọn Team --</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Kênh <span className="text-red-500">*</span></label>
                      <select required disabled={!newTask.teamId || isLoadingData} className="w-full border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-slate-50 disabled:opacity-50 disabled:text-slate-400" value={newTask.channelId} onChange={(e) => {
                        const newChannelId = e.target.value;
                        const newChan = teamChannels.find(c => c.id === newChannelId);
                        setNewTask({
                          ...newTask,
                          channelId: newChannelId,
                          projectId: "", 
                          animatorId: newChan?.category === 'TONG_HOP' ? "" : newTask.animatorId
                        });
                      }}>
                        <option value="">-- Chọn --</option>
                        {teamChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Dự án <span className="text-red-500">*</span></label>
                      <select required disabled={!newTask.teamId || isLoadingData} className="w-full border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-slate-50 disabled:opacity-50 disabled:text-slate-400" value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
                        <option value="">{newTask.channelId && filteredProjects.length === 0 ? "-- Kênh trống --" : "-- Chọn --"}</option>
                        {filteredProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><FileEdit size={12} /> Content</label>
                      <select disabled={!newTask.teamId || isLoadingData} className="w-full border rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-white border-emerald-200 disabled:opacity-50 disabled:text-slate-400" value={newTask.contentId} onChange={(e) => setNewTask({ ...newTask, contentId: e.target.value })}>
                        <option value="">-- Chưa gán --</option>
                        {teamContents.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </div>
                    <div className={`grid ${isTongHopChannel ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                      <div>
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Film size={12} /> Editor</label>
                        <select disabled={!newTask.teamId || isLoadingData} className="w-full border rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-white border-emerald-200 disabled:opacity-50 disabled:text-slate-400" value={newTask.editorId} onChange={(e) => setNewTask({ ...newTask, editorId: e.target.value })}>
                          <option value="">-- Ai Dựng? --</option>
                          {teamEditors.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                        </select>
                      </div>

                      {!isTongHopChannel && (
                        <div>
                          <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><MonitorPlay size={12} /> Chuyển Động</label>
                          <select disabled={!newTask.teamId || isLoadingData} className="w-full border rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-white border-emerald-200 disabled:opacity-50 disabled:text-slate-400" value={newTask.animatorId} onChange={(e) => setNewTask({ ...newTask, animatorId: e.target.value })}>
                            <option value="">-- Ai làm CĐ? --</option>
                            {teamContents.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 pt-4 flex gap-3 border-t border-slate-100 mt-2">
              <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-3 rounded-xl transition-all active:scale-95 text-sm">Hủy bỏ</button>
              <button type="submit" disabled={isSubmitting || isLoadingData} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex justify-center gap-2 active:scale-95 text-sm">
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