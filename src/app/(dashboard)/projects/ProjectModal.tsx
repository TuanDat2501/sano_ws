"use client";

import { useState, useEffect } from "react";
import { X, Loader2, FolderPlus, UserCheck } from "lucide-react";
import { createPortal } from "react-dom";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: any[];
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
}

export default function ProjectModal({ isOpen, onClose, teams, initialData, onSubmit }: ProjectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({ 
    name: "", 
    description: "", 
    teamId: "", 
    supervisorId: "" // 🚀 Thêm trường người phụ trách
  });
  
  const [teamMembers, setTeamMembers] = useState<any[]>([]); // Danh sách nhân sự theo team
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 1. Load dữ liệu ban đầu khi sửa
  useEffect(() => {
    if (initialData) {
      setFormData({ 
        name: initialData.name || "", 
        description: initialData.description || "", 
        teamId: initialData.teamId || "",
        supervisorId: initialData.supervisorId || ""
      });
    } else {
      setFormData({ name: "", description: "", teamId: "", supervisorId: "" });
    }
  }, [initialData, isOpen]);

  // 2. 🚀 LOGIC QUAN TRỌNG: Tự động lấy nhân sự khi chọn Team
  useEffect(() => {
    const fetchMembers = async () => {
      if (!formData.teamId) {
        setTeamMembers([]);
        setFormData(prev => ({ ...prev, supervisorId: "" }));
        return;
      }

      setIsLoadingMembers(true);
      try {
        // Giả sử sếp có API lấy user theo teamId
        const res = await fetch(`/api/users?teamId=${formData.teamId}`);
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setTeamMembers(data.users || []); // Giả sử API trả về { users: [...] }
          console.log(teamMembers);
          
        }
      } catch (error) {
        console.error("Lỗi tải nhân sự team:", error);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    if (isOpen) fetchMembers();
  }, [formData.teamId, isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100000]" onClick={onClose} />
      
      <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-[40px] p-6 md:p-10 w-full max-w-lg shadow-2xl relative pointer-events-auto animate-scale-in"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-6 right-6 p-2.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all">
            <X size={24} />
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl"><FolderPlus size={28} /></div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">{initialData ? "Chỉnh sửa Dự án" : "Khởi tạo Dự án"}</h2>
                <p className="text-slate-500 font-medium text-sm">Thiết lập quy trình và nhân sự phụ trách.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tên dự án */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tên dự án</label>
              <input
                required
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-base focus:border-red-500 focus:bg-white outline-none transition-all font-bold text-slate-800"
                placeholder="VD: Tên dự án"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Chọn Team */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Team thực thi chính</label>
              <select
                required
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:border-red-500 outline-none transition-all"
                value={formData.teamId}
                onChange={(e) => setFormData({ ...formData, teamId: e.target.value, supervisorId: "" })}
              >
                <option value="">-- Chọn Team phụ trách --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* 🚀 CHỌN NGƯỜI PHỤ TRÁCH (Dymanic Select) */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                Người phụ trách dự án {isLoadingMembers && <Loader2 size={12} className="animate-spin text-red-500" />}
              </label>
              <div className="relative">
                <select
                  required
                  disabled={!formData.teamId || isLoadingMembers}
                  className={`w-full appearance-none border-2 rounded-2xl p-4 text-sm font-bold outline-none transition-all
                    ${!formData.teamId ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-slate-100 text-slate-800 focus:border-red-500'}
                  `}
                  value={formData.supervisorId}
                  onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                >
                  <option value="">{isLoadingMembers ? "Đang tải nhân sự..." : "-- Chọn người giám sát --"}</option>
                  {teamMembers.length === 0 && !isLoadingMembers && <option value="" disabled>Không có nhân sự nào trong team này.</option>}
                  {teamMembers.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <UserCheck size={18} />
                </div>
              </div>
              {!formData.teamId && <p className="text-[10px] text-orange-500 font-bold ml-1 italic">* Vui lòng chọn Team trước để hiển thị danh sách nhân sự.</p>}
            </div>

            <div className="pt-4 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl">Hủy</button>
              <button type="submit" disabled={isSubmitting || isLoadingMembers} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Lưu Dự án 🚀"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}