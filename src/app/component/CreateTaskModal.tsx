"use client";

import { useState, useEffect } from "react";
import { X, UsersIcon, Loader2, FileEdit, Film, Clock, Link as LinkIcon, FileText, Key, CalendarDays, MonitorPlay, UserCheck, RefreshCw, Search, Check } from "lucide-react";
import { createPortal } from "react-dom";

interface CreateTaskModalProps {
  isOpen: boolean; onClose: () => void; teams: any[]; users?: any[]; projects?: any[]; initialData?: any;
  onSubmit: (taskData: any) => Promise<void>; isSubmitting: boolean; errors: { [key: string]: string };
}

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
    <div>
      <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
        <Icon size={12} /> {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px] p-1 bg-white border border-emerald-100 rounded-lg">
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

export default function CreateTaskModal({ isOpen, onClose, teams, initialData, onSubmit, isSubmitting, errors }: CreateTaskModalProps) {
  const [mounted, setMounted] = useState(false);

  const [newTask, setNewTask] = useState({
    id: "", title: "", keywords: "", linkContent: "", 
    contentIds: [] as string[], 
    editorIds: [] as string[], 
    animatorIds: [] as string[], 
    teamId: "", projectId: "", duration: "", publishDate: "", channelId: "", publisherId: "", priority: "NORMAL"
  });

  const [teamProjects, setTeamProjects] = useState<any[]>([]);
  const [teamContents, setTeamContents] = useState<any[]>([]);
  const [teamEditors, setTeamEditors] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [teamChannels, setTeamChannels] = useState<any[]>([]);
  const [usersTeam, setUsersTeam] = useState<any[]>([]);
  const [teamPublishers, setTeamPublishers] = useState<any[]>([]);

  const [isRework, setIsRework] = useState(false);
  const [doneTasks, setDoneTasks] = useState<any[]>([]);
  const [searchReworkTask, setSearchReworkTask] = useState("");
  const [selectedSourceTaskId, setSelectedSourceTaskId] = useState("");
  const [isLoadingDoneTasks, setIsLoadingDoneTasks] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setNewTask({
          id: initialData.id,
          title: initialData.title || "",
          keywords: initialData.keywords || "",
          linkContent: initialData.linkContent || "",
          contentIds: [
            ...(initialData.contentId ? [initialData.contentId] : []),
            ...(initialData.coContentUsers?.map((u: any) => u.id) || [])
          ],
          editorIds: [
            ...(initialData.editorId ? [initialData.editorId] : []),
            ...(initialData.coEditorUsers?.map((u: any) => u.id) || [])
          ],
          animatorIds: [
            ...(initialData.animatorId ? [initialData.animatorId] : []),
            ...(initialData.coAnimatorUsers?.map((u: any) => u.id) || [])
          ],
          teamId: initialData.teamId || "",
          projectId: initialData.projectId || "",
          duration: initialData.duration || "",
          publishDate: initialData.publishDate ? new Date(initialData.publishDate).toISOString().split('T')[0] : "",
          channelId: initialData.channelId || "",
          publisherId: initialData.publisherId || "",
          priority: initialData.priority || "NORMAL"
        });
        setIsRework(initialData.isRework || false);
      } else {
        setNewTask({ id: "", title: "", keywords: "", linkContent: "", contentIds: [], editorIds: [], animatorIds: [], teamId: "", projectId: "", duration: "", publishDate: "", channelId: "", publisherId: "", priority: "NORMAL" });
        setIsRework(false);
        setSelectedSourceTaskId("");
        setSearchReworkTask("");
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!newTask.teamId) {
        setTeamProjects([]); setTeamContents([]); setTeamEditors([]); setTeamChannels([]); setTeamPublishers([]); return;
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
          setUsersTeam(listUsers.filter((u: any) => ['EDITOR', 'LEADER','CONTENT','PUBLISHER'].includes(u.role)));
          setTeamPublishers(listUsers.filter((u: any) => ['PUBLISHER', 'CHANNEL_MANAGER', 'LEADER'].includes(u.role)));
        }
      } catch (error) { } finally { setIsLoadingData(false); }
    };
    if (isOpen && newTask.teamId) fetchTeamData();
  }, [newTask.teamId, isOpen]);

  useEffect(() => {
    if (isOpen && isRework && newTask.teamId) {
      setIsLoadingDoneTasks(true);
      fetch(`/api/tasks/done?teamId=${newTask.teamId}`)
        .then(res => res.json())
        .then(data => {
          setDoneTasks(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => setIsLoadingDoneTasks(false));
    }
  }, [isOpen, isRework, newTask.teamId]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
        ...newTask, 
        duration: newTask.duration ? Number(newTask.duration) : null,
        isRework: isRework 
    };
    onSubmit(payload);
  };

  const selectedChannel = teamChannels.find(c => c.id === newTask.channelId);
  const isTongHopChannel = selectedChannel?.category === 'TONG_HOP';
  const filteredProjects = newTask.channelId ? teamProjects.filter(p => p.channelId === newTask.channelId) : teamProjects;
  
  const filteredDoneTasks = doneTasks.filter(t => t.title.toLowerCase().includes(searchReworkTask.toLowerCase()));

  const handleSelectSourceTask = (task: any) => {
      setSelectedSourceTaskId(task.id);
      setNewTask(prev => ({
          ...prev,
          title: prev.title === "" ? `[XÀO LẠI] ${task.title}` : prev.title,
          linkContent: prev.linkContent === "" ? (task.publishLink || task.videoLink || task.scriptLink || "") : prev.linkContent
      }));
  };

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100000] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-[24px] p-5 md:p-6 max-w-4xl shadow-2xl relative pointer-events-auto animate-scale-in max-h-[95vh] flex flex-col w-full" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between">
            <div className="shrink-0 mb-5">
              <h2 className="text-lg md:text-xl font-black text-slate-900 mb-0.5 flex items-center gap-2">
                {initialData ? "Chỉnh sửa Thông tin Task" : "Giao Task / Video mới"}
              </h2>
              <p className="text-slate-500 font-medium text-[13px]">Cấu trúc động: Có thể phân công nhiều nhân sự cùng lúc.</p>
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

                  {/* 🚀 BOX: XÀO LẠI VIDEO CŨ */}
                  <div className="col-span-1 md:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer mb-2 w-fit group">
                          <input 
                              type="checkbox" 
                              checked={isRework} 
                              onChange={e => setIsRework(e.target.checked)} 
                              className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500" 
                          />
                          <span className="text-[12px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5 group-hover:text-rose-700 transition-colors">
                              <RefreshCw size={14}/> Sửa lại Video (Xào lại)
                          </span>
                      </label>

                      {isRework && (
                          <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-4 animate-fade-in mt-2 mb-4 shadow-sm">
                              {!newTask.teamId ? (
                                  <p className="text-[11px] text-rose-500 italic font-medium">Vui lòng chọn Team ở cột bên phải để hiển thị danh sách video.</p>
                              ) : (
                                  <>
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                          <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
                                              Tìm & Chọn video cũ
                                          </label>
                                          <div className="relative flex-1 sm:max-w-xs">
                                              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                              <input 
                                                  type="text" 
                                                  placeholder="Tìm tên tập..." 
                                                  className="border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-rose-500 w-full bg-white shadow-sm" 
                                                  value={searchReworkTask} 
                                                  onChange={e => setSearchReworkTask(e.target.value)} 
                                              />
                                          </div>
                                      </div>
                                      
                                      {/* 🚀 ĐÃ TỐI ƯU UI: Thêm giới hạn hiển thị, tăng chiều cao khung */}
                                      <div className="max-h-[220px] overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg bg-white p-1.5">
                                          {isLoadingDoneTasks ? (
                                              <div className="flex flex-col items-center justify-center p-6 gap-2 text-slate-400">
                                                  <Loader2 size={18} className="animate-spin" />
                                                  <span className="text-[11px] font-medium">Đang tải danh sách...</span>
                                              </div>
                                          ) : filteredDoneTasks.length > 0 ? (
                                              <div className="space-y-1">
                                                  {/* 🚀 Chỉ hiển thị 50 kết quả đầu tiên */}
                                                  {filteredDoneTasks.slice(0, 50).map(t => (
                                                      <div 
                                                          key={t.id} 
                                                          onClick={() => handleSelectSourceTask(t)} 
                                                          className={`p-2.5 text-xs font-bold cursor-pointer rounded-lg border transition-all flex items-center gap-2.5 ${selectedSourceTaskId === t.id ? 'bg-rose-50 border-rose-200 text-rose-700' : 'hover:bg-slate-50 border-transparent text-slate-600'}`}
                                                      >
                                                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${selectedSourceTaskId === t.id ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300'}`}>
                                                              {selectedSourceTaskId === t.id && <Check size={10} strokeWidth={4} />}
                                                          </div>
                                                          <span className="truncate flex-1">{t.title}</span>
                                                      </div>
                                                  ))}
                                                  {/* Cảnh báo khi có quá nhiều kết quả */}
                                                  {filteredDoneTasks.length > 50 && (
                                                      <div className="p-2.5 mt-1 text-center text-[10px] font-bold text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                                          Hiển thị 50 / {filteredDoneTasks.length} kết quả. Nhập từ khóa để tìm thêm...
                                                      </div>
                                                  )}
                                              </div>
                                          ) : (
                                              <div className="flex items-center justify-center p-8">
                                                  <p className="text-[11px] text-slate-400 italic font-medium">Không tìm thấy tập nào phù hợp.</p>
                                              </div>
                                          )}
                                      </div>
                                  </>
                              )}
                          </div>
                      )}
                  </div>

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
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">🔥 Mức Độ Ưu Tiên</label>
                      <select className="w-full mt-1 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-900 outline-none font-bold bg-slate-50 focus:border-blue-500" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
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
                      <select required className="w-full border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-slate-50" value={newTask.teamId} onChange={(e) => setNewTask({ ...newTask, teamId: e.target.value, projectId: "", contentIds: [], editorIds: [], animatorIds: [], channelId: "", publisherId: "" })}>
                        <option value="">-- Chọn Team --</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Kênh <span className="text-red-500">*</span></label>
                      <select required disabled={!newTask.teamId || isLoadingData} className="w-full border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-slate-50 disabled:opacity-50 disabled:text-slate-400" value={newTask.channelId} onChange={(e) => {
                        const newChannelId = e.target.value;
                        const newChan = teamChannels.find(c => c.id === newChannelId);
                        setNewTask({ ...newTask, channelId: newChannelId, projectId: "", animatorIds: newChan?.category === 'TONG_HOP' ? [] : newTask.animatorIds });
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
                    
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block flex items-center gap-1.5"><UserCheck size={12} /> Quản lý kênh</label>
                      <select disabled={!newTask.teamId || isLoadingData} className="w-full border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-sm text-slate-900 bg-slate-50 disabled:opacity-50 disabled:text-slate-400" value={newTask.publisherId} onChange={(e) => setNewTask({ ...newTask, publisherId: e.target.value })}>
                        <option value="">-- Bỏ trống nếu chưa có --</option>
                        {usersTeam.map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-4 shadow-inner">
                    <MultiSelectUser 
                        label="Nhóm Content" 
                        icon={FileEdit} 
                        options={teamContents} 
                        selectedIds={newTask.contentIds} 
                        onChange={(val: any) => setNewTask({ ...newTask, contentIds: val })} 
                        disabled={!newTask.teamId || isLoadingData} 
                    />
                    
                    <MultiSelectUser 
                        label="Nhóm Editor" 
                        icon={Film} 
                        options={teamEditors} 
                        selectedIds={newTask.editorIds} 
                        onChange={(val: any) => setNewTask({ ...newTask, editorIds: val })} 
                        disabled={!newTask.teamId || isLoadingData} 
                    />

                    {!isTongHopChannel && (
                      <MultiSelectUser 
                          label="Nhóm Chuyển Động" 
                          icon={MonitorPlay} 
                          options={usersTeam} 
                          selectedIds={newTask.animatorIds} 
                          onChange={(val: any) => setNewTask({ ...newTask, animatorIds: val })} 
                          disabled={!newTask.teamId || isLoadingData} 
                      />
                    )}
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