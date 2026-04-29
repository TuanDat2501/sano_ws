"use client";

import { useState, useEffect } from "react";
import { X, UsersIcon, Loader2, FolderKanban, FileEdit, Film, Clock, Tv } from "lucide-react";
import { createPortal } from "react-dom";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: any[];
  users?: any[];       
  projects?: any[];    
  initialData?: any; // 🚀 THÊM PROP NÀY ĐỂ NHẬN DATA KHI SỬA
  onSubmit: (taskData: any) => Promise<void>;
  isSubmitting: boolean;
  errors: { [key: string]: string };
}

export default function CreateTaskModal({ isOpen, onClose, teams, initialData, onSubmit, isSubmitting, errors }: CreateTaskModalProps) {
  const [mounted, setMounted] = useState(false);

  // 🚀 THÊM DURATION VÀO STATE
  const [newTask, setNewTask] = useState({
    id: "", title: "", linkContent: "", contentId: "", editorId: "", teamId: "", projectId: "", duration: "", channelId: ""
  });

  const [teamProjects, setTeamProjects] = useState<any[]>([]);
  const [teamContents, setTeamContents] = useState<any[]>([]);
  const [teamEditors, setTeamEditors] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [teamChannels, setTeamChannels] = useState<any[]>([]);
  useEffect(() => { setMounted(true); }, []);

  // 🚀 NẠP DỮ LIỆU KHI MỞ MODAL (TẠO MỚI HOẶC SỬA)
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
          duration: initialData.duration || "" // Lấy thời lượng cũ nếu có
        });
      } else {
        setNewTask({ id: "", title: "", linkContent: "", contentId: "", editorId: "", teamId: "", projectId: "", duration: "", channelId: "" });
      }
    }
  }, [isOpen, initialData]);

  // Logic fetch data khi đổi Team
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!newTask.teamId) {
        setTeamProjects([]); setTeamContents([]); setTeamEditors([]);
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
    // Chuyển duration sang số trước khi gửi
    const payload = { ...newTask, duration: newTask.duration ? Number(newTask.duration) : null };
    onSubmit(payload);
  };

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100000] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-[32px] p-6 md:p-8 w-full max-w-xl shadow-2xl relative pointer-events-auto animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>

          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
            <X size={20} />
          </button>

          {/* 🚀 ĐỔI TIÊU ĐỀ THEO CHẾ ĐỘ */}
          <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1">
            {initialData ? "Chỉnh sửa Thông tin Task" : "Giao Task / Video mới"}
          </h2>
          <p className="text-slate-500 font-medium mb-6 text-sm">
            {initialData ? "Cập nhật lại dự án, nhân sự hoặc thời lượng." : "Điền thông tin và chỉ định nhân sự chuyên biệt."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            {/* Tiêu đề & Link nguồn (Giữ nguyên) */}
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề / Ý tưởng Video <span className="text-red-500">*</span></label>
              <input required autoFocus className="w-full mt-1.5 bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 text-sm md:text-base focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-slate-900 font-bold" placeholder="VD: Cách dùng AI trong Sano Workspace..." value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Link nguồn <span className="text-red-500">*</span></label>
              <input required className={`w-full mt-1.5 border-2 rounded-2xl p-3.5 text-sm md:text-base outline-none transition-all font-medium ${errors.linkContent ? 'border-red-500 bg-red-50 focus:ring-4 focus:ring-red-500/20' : 'bg-slate-50 border-slate-100 focus:border-red-500 focus:bg-white'}`} placeholder="https://v.douyin.com/..." value={newTask.linkContent} onChange={(e) => setNewTask({ ...newTask, linkContent: e.target.value })} />
            </div>

            {/* 🚀 THÊM TRƯỜNG YÊU CẦU THỜI LƯỢNG */}
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Clock size={14} /> Thời lượng yêu cầu (Phút) <span className="text-red-500">*</span>
              </label>
              <input required type="number" min="1" className="w-full mt-1.5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-3.5 text-sm md:text-base focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-indigo-900 font-black placeholder:text-indigo-300" placeholder="VD: 15" value={newTask.duration} onChange={(e) => setNewTask({ ...newTask, duration: e.target.value })} />
            </div>

            <div className="h-[1px] w-full bg-slate-100 my-4"></div>

            {/* Chọn Team */}
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <UsersIcon size={14} /> Chọn Team thực hiện <span className="text-red-500">*</span>
              </label>
              <select required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3.5 focus:border-red-500 focus:bg-white outline-none transition-all text-sm font-bold text-slate-800" value={newTask.teamId}
                onChange={(e) => setNewTask({ ...newTask, teamId: e.target.value, projectId: "", contentId: "", editorId: "" })}>
                <option value="">-- Chọn Team --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Chọn Kênh */}
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <Tv size={14} /> Thuộc Kênh <span className="text-red-500">*</span>
                {isLoadingData && <Loader2 size={12} className="animate-spin text-red-500 ml-2" />}
              </label>
              <select required disabled={!newTask.teamId || isLoadingData} className={`w-full border-2 rounded-2xl p-3.5 outline-none transition-all text-sm font-bold ${!newTask.teamId ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-red-500'}`} value={newTask.channelId} onChange={(e) => setNewTask({ ...newTask, channelId: e.target.value })}>
                <option value="">{isLoadingData ? "Đang tải dữ liệu..." : "-- Chọn Kênh --"}</option>
                {teamChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            {/* Chọn Dự án */}
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <FolderKanban size={14} /> Thuộc Dự án <span className="text-red-500">*</span>
                {isLoadingData && <Loader2 size={12} className="animate-spin text-red-500 ml-2" />}
              </label>
              <select required disabled={!newTask.teamId || isLoadingData} className={`w-full border-2 rounded-2xl p-3.5 outline-none transition-all text-sm font-bold ${!newTask.teamId ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-red-500'}`} value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
                <option value="">{isLoadingData ? "Đang tải dữ liệu..." : "-- Chọn Dự án --"}</option>
                {teamProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Chia cột Nhân sự */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                  <FileEdit size={14} /> Content (Kịch bản)
                </label>
                <select disabled={!newTask.teamId || isLoadingData} className={`w-full border-2 rounded-2xl p-3.5 outline-none transition-all text-sm font-bold ${!newTask.teamId ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-red-500'}`} value={newTask.contentId} onChange={(e) => setNewTask({ ...newTask, contentId: e.target.value })}>
                  <option value="">{isLoadingData ? "Đang tải..." : "-- Chọn Content --"}</option>
                  {teamContents.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                  <Film size={14} /> Editor (Dựng Video)
                </label>
                <select disabled={!newTask.teamId || isLoadingData} className={`w-full border-2 rounded-2xl p-3.5 outline-none transition-all text-sm font-bold ${!newTask.teamId ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-800 focus:border-red-500'}`} value={newTask.editorId} onChange={(e) => setNewTask({ ...newTask, editorId: e.target.value })}>
                  <option value="">{isLoadingData ? "Đang tải..." : "-- Chọn Editor --"}</option>
                  {teamEditors.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-6 flex gap-3 border-t border-slate-100 mt-2">
              <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all active:scale-95">Hủy bỏ</button>
              <button type="submit" disabled={isSubmitting || isLoadingData} className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (initialData ? "Lưu Thay Đổi 💾" : "Giao việc ngay 🚀")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}