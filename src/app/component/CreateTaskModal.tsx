"use client";

import { useState } from "react";
import { X, AlertCircle, UsersIcon, Loader2 } from "lucide-react";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: any[];
  teams: any[];
  onSubmit: (taskData: any) => Promise<void>;
  isSubmitting: boolean;
  errors: { [key: string]: string };
}

export default function CreateTaskModal({ isOpen, onClose, users, teams, onSubmit, isSubmitting, errors }: CreateTaskModalProps) {
  const [newTask, setNewTask] = useState({ title: "", linkContent: "", contentId: "", editorId: "", teamId: "" });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(newTask).then(() => {
      if (Object.keys(errors).length === 0) {
        setNewTask({ title: "", linkContent: "", contentId: "", editorId: "", teamId: "" });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-3 sm:p-4 animate-fade-in" onClick={onClose}>
      {/* Width full trên mobile, padding bóp lại */}
      <div className="bg-white rounded-2xl md:rounded-[32px] p-5 md:p-8 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 md:top-6 md:right-6 p-1.5 md:p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
          <X size={18} className="md:w-5 md:h-5" />
        </button>

        <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1.5 md:mb-2">Yêu cầu Video mới</h2>
        <p className="text-slate-500 font-medium mb-5 md:mb-8 text-xs md:text-sm">Điền thông tin và giao việc cho nhân sự chuyên biệt.</p>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          <div>
            <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tiêu đề / Ý tưởng Video <span className="text-red-500">*</span></label>
            <input
              required
              className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 text-sm md:text-base focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-900 font-medium"
              placeholder="VD: Cách dùng AI trong Sano Workspace..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Link nguồn <span className="text-red-500">*</span></label>
            <input
              required
              className={`w-full mt-1.5 bg-slate-50 border rounded-xl md:rounded-2xl p-2.5 md:p-3.5 text-sm md:text-base outline-none transition-all ${errors.linkContent ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-red-500'}`}
              placeholder="https://v.douyin.com/..."
              value={newTask.linkContent}
              onChange={(e) => setNewTask({ ...newTask, linkContent: e.target.value })}
            />
            {errors.linkContent && <p className="text-red-500 text-[10px] md:text-xs font-bold mt-1.5 ml-1">⚠️ {errors.linkContent}</p>}
          </div>

          <div>
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5 md:mb-2"><UsersIcon size={12} className="md:w-3.5 md:h-3.5" /> Task của Team</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 focus:border-red-500 outline-none transition-all text-xs md:text-sm font-medium"
              value={newTask.teamId}
              onChange={(e) => setNewTask({ ...newTask, teamId: e.target.value })}
            >
              <option value="">-- Chọn Team --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Dàn thành 1 cột trên Mobile, 2 cột ngang trên PC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nhân sự Content</label>
              <select
                className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 outline-none text-xs md:text-sm font-medium"
                value={newTask.contentId}
                onChange={(e) => setNewTask({ ...newTask, contentId: e.target.value })}
              >
                <option value="">-- Chọn Content --</option>
                {users.filter(u => ['CONTENT', 'LEADER', 'ADMIN'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nhân sự Editor</label>
              <select
                className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2.5 md:p-3.5 outline-none text-xs md:text-sm font-medium"
                value={newTask.editorId}
                onChange={(e) => setNewTask({ ...newTask, editorId: e.target.value })}
              >
                <option value="">-- Chọn Editor --</option>
                {users.filter(u => ['EDITOR', 'LEADER', 'ADMIN'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nút: Bẻ dọc trên Mobile */}
          <div className="pt-4 md:pt-6 flex flex-col sm:flex-row gap-2.5 md:gap-3 border-t border-slate-100 mt-2 md:mt-4">
            <button type="button" onClick={onClose} className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all text-sm md:text-base">Hủy bỏ</button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all shadow-md shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-70 text-sm md:text-base"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Giao việc ngay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}