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
      // Reset form nếu thành công (logic này có thể tùy biến)
      if (Object.keys(errors).length === 0) {
        setNewTask({ title: "", linkContent: "", contentId: "", editorId: "", teamId: "" });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
          <X size={20} />
        </button>

        <h2 className="text-2xl font-black text-slate-900 mb-2">Yêu cầu Video mới</h2>
        <p className="text-slate-500 font-medium mb-8 text-sm">Điền thông tin và giao việc cho nhân sự chuyên biệt.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tiêu đề / Ý tưởng Video <span className="text-red-500">*</span></label>
            <input
              required
              className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-slate-900 font-medium"
              placeholder="VD: Cách dùng AI trong Sano Workspace..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Link nguồn <span className="text-red-500">*</span></label>
            <input
              required
              className={`w-full mt-1.5 bg-slate-50 border rounded-2xl p-3.5 outline-none transition-all ${errors.linkContent ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200 focus:border-red-500'}`}
              placeholder="https://v.douyin.com/..."
              value={newTask.linkContent}
              onChange={(e) => setNewTask({ ...newTask, linkContent: e.target.value })}
            />
            {errors.linkContent && <p className="text-red-500 text-xs font-bold mt-1.5 ml-1">⚠️ {errors.linkContent}</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><UsersIcon size={14} /> Task của Team</label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 focus:border-red-500 outline-none transition-all text-sm"
              value={newTask.teamId}
              onChange={(e) => setNewTask({ ...newTask, teamId: e.target.value })}
            >
              <option value="">-- Chọn Team --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nhân sự Content</label>
              <select
                className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 outline-none text-sm"
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nhân sự Editor</label>
              <select
                className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 outline-none text-sm"
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

          <div className="pt-6 flex gap-3 border-t border-slate-100 mt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl transition-all">Hủy bỏ</button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Giao việc ngay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}