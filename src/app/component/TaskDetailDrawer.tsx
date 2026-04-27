"use client";

import { X, Link as LinkIcon, CheckCircle2, Loader2, MessageSquare, Send, ClipboardCheck, AlertTriangle } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import EvaluationPanel from "./EvaluationPanel";

interface TaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTask: any;
  taskLinks: any;
  setTaskLinks: (links: any) => void;
  errors: { [key: string]: string };
  isSavingLinks: boolean;
  onSaveLinks: () => void;
  onToggleClose: () => void;
  onReject: () => void;
  canReject: boolean;
  messages: any[];
  chatMessage: string;
  setChatMessage: (msg: string) => void;
  onSendMessage: () => void;
  sessionUserId: string;
  userRole: string;
  onSubmitEvaluation?: (score: number, criteriaData: any, note: string) => void; // 🚀 Nút Submit Form Chấm Điểm
}

// 🚀 BỘ TIÊU CHUẨN MẪU (Mock Data) - Sau này sếp fetch từ `project.workflowNodes`
const MOCK_CRITERIA = [
  {
    id: 'c1', name: 'TẦNG 1: RETENTION (Giữ chân)', weight: 50,
    standards: [
      { id: 's1', text: 'Hook 3s đầu có biến hoặc câu hỏi tò mò' },
      { id: 's2', text: 'Nhịp kể phù hợp, có điểm nghỉ thở' },
      { id: 's3', text: 'Hình ảnh thay đổi (Pattern Interrupt) mỗi 2-3s' }
    ]
  },
  {
    id: 'c2', name: 'TẦNG 2: SATISFACTION (Hài lòng)', weight: 30,
    standards: [
      { id: 's4', text: 'Tạo được ít nhất 1 cảm xúc rõ ràng' },
      { id: 's5', text: 'Mang lại 1 giá trị/bài học cụ thể' },
      { id: 's6', text: 'Kết thúc tạo dư âm, có tính hành động' }
    ]
  },
  {
    id: 'c3', name: 'TẦNG 3: POLISHING (Độ mượt)', weight: 20,
    standards: [
      { id: 's7', text: 'Nhạc nền không lấn Voice' },
      { id: 's8', text: 'Góc máy và Text/Subtitle hỗ trợ cảm xúc' },
      { id: 's9', text: 'Không dính lỗi bản quyền, âm thanh rác' }
    ]
  }
];

export default function TaskDetailDrawer({
  isOpen, onClose, selectedTask, taskLinks, setTaskLinks, errors, isSavingLinks, userRole,
  onSaveLinks, onToggleClose, onReject, canReject, messages, chatMessage, setChatMessage, onSendMessage, sessionUserId, onSubmitEvaluation
}: TaskDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);

  // 🚀 STATE CHO TÍNH NĂNG CHẤM ĐIỂM
  const [rightTab, setRightTab] = useState<'chat' | 'evaluate'>('chat');
  const [checkedStandards, setCheckedStandards] = useState<Record<string, boolean>>({});
  const [kaizenNote, setKaizenNote] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset tab khi mở task mới
  useEffect(() => {
    if (isOpen) {
      setRightTab('chat');
      setCheckedStandards({});
      setKaizenNote('');
    }
  }, [isOpen, selectedTask?.id]);

  // 🚀 LOGIC TÍNH ĐIỂM TỰ ĐỘNG
  const currentScore = useMemo(() => {
    let totalScore = 0;
    MOCK_CRITERIA.forEach(criteria => {
      const totalItems = criteria.standards.length;
      const checkedItems = criteria.standards.filter(s => checkedStandards[s.id]).length;
      // Công thức: (Số mục pass / Tổng mục) * (Trọng số / 10)
      if (totalItems > 0) {
        totalScore += (checkedItems / totalItems) * (criteria.weight / 10);
      }
    });
    return totalScore.toFixed(1);
  }, [checkedStandards]);

  const handleStandardToggle = (id: string) => {
    setCheckedStandards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const submitEvaluation = () => {
    setIsEvaluating(true);
    // Gọi hàm truyền từ props cha
    if (onSubmitEvaluation) {
      onSubmitEvaluation(Number(currentScore), checkedStandards, kaizenNote);
    }
    setTimeout(() => setIsEvaluating(false), 800);
  };

  if (!selectedTask) return null;
  const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR", "QLK"].includes(userRole);

  const drawerContent = (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99998] transition-opacity" onClick={onClose} />}

      <div className={`fixed top-0 right-0 h-full w-full md:w-[1000px] md:max-w-[95vw] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

        {/* ================= HEADER ================= */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 bg-white z-10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm shrink-0">
              {selectedTask.project?.name || "Dự án chưa xác định"}
            </span>
            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
              {selectedTask.team?.name || "Sano Dự án"}
            </span>
            <h2 className="text-lg md:text-xl font-black text-slate-900 truncate max-w-[300px] md:max-w-[400px]">{selectedTask.title}</h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* 🚀 NÚT CHUYỂN ĐỔI CHẤM ĐIỂM DÀNH CHO QUẢN LÝ */}
            {isManager && (
              <button
                onClick={() => setRightTab(rightTab === 'chat' ? 'evaluate' : 'chat')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${rightTab === 'evaluate' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
              >
                <ClipboardCheck size={16} />
                {rightTab === 'evaluate' ? "Quay lại Chat" : "Chấm điểm Video"}
              </button>
            )}

            <div className="w-[1px] h-6 bg-slate-200 mx-1 hidden sm:block"></div>

            {canReject && (
              <button onClick={onReject} className="px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
                Reject
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ================= BODY ================= */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50">

          {/* CỘT TRÁI: THÔNG TIN & LINK (55%) */}
          <div className="w-full lg:w-[55%] flex flex-col h-full border-r border-slate-200 bg-white">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">

              {/* Link Nguồn */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><LinkIcon size={14} /> Link Tham Khảo / Ý Tưởng</label>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-sm text-blue-600 break-all hover:bg-blue-50 transition-colors">
                  <a href={selectedTask.linkContent} target="_blank" rel="noreferrer" className="hover:underline">{selectedTask.linkContent}</a>
                </div>
              </div>

              {/* Nhân sự */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-orange-50/50 border border-orange-100 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black border-2 border-white shadow-sm text-base">
                    {selectedTask.contentUser?.fullName?.charAt(0) || "?"}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Content</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedTask.contentUser?.fullName || "Chưa giao"}</p>
                  </div>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black border-2 border-white shadow-sm text-base">
                    {selectedTask.editorUser?.fullName?.charAt(0) || "?"}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Editor</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedTask.editorUser?.fullName || "Chưa giao"}</p>
                  </div>
                </div>
              </div>

              {/* Nộp Bài (Link kết quả) */}
              <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-6 space-y-5 shadow-inner">
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2"><CheckCircle2 className="text-emerald-500 w-5 h-5" /> Kết Quả Công Việc</h3>

                {[
                  { key: 'scriptLink', label: '1. Kịch Bản (Docs)', role: 'CONTENT', idField: 'contentId' },
                  { key: 'videoLink', label: '2. Video Render (Drive)', role: 'EDITOR', idField: 'editorId' },
                  { key: 'publishLink', label: '3. Video Đã Đăng (Tiktok)', role: 'CHANNEL_MANAGER', idField: 'publisherId' }
                ].map((field) => {
                  const isAllowed = isManager || (userRole === field.role && selectedTask[field.idField] === sessionUserId) || (field.key === 'scriptLink' && selectedTask.creatorId === sessionUserId);
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{field.label}</label>
                      <input
                        type="url" disabled={!isAllowed}
                        placeholder={!isAllowed ? "Chỉ người phụ trách mới được nhập" : "Dán link vào đây..."}
                        className={`w-full border rounded-xl p-3.5 text-sm outline-none transition-all ${!isAllowed ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'} ${errors[field.key] ? 'border-red-500' : ''}`}
                        value={taskLinks[field.key as keyof typeof taskLinks]}
                        onChange={e => setTaskLinks({ ...taskLinks, [field.key]: e.target.value })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 md:p-6 bg-white border-t border-slate-100 shrink-0">
              <button onClick={onSaveLinks} disabled={isSavingLinks} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 text-base">
                {isSavingLinks ? <Loader2 className="animate-spin" size={18} /> : "Lưu Link Tiến Độ"}
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: CHAT HOẶC CHẤM ĐIỂM (45%) */}
          <div className="w-full lg:w-[45%] flex flex-col h-full bg-white relative">

            {/* ----------------- GIAO DIỆN CHAT (Mặc định) ----------------- */}
            {rightTab === 'chat' && (
              <div className="flex flex-col h-full animate-fade-in">
                <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
                  <MessageSquare className="text-blue-600 w-5 h-5" />
                  <span className="font-black text-slate-800 text-base">Thảo luận nội bộ</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50/50 custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="m-auto text-center text-slate-400 text-sm font-medium"><MessageSquare size={32} className="mx-auto mb-2 opacity-50" />Chưa có trao đổi nào.</div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderId === sessionUserId ? "items-end" : "items-start"}`}>
                        <span className="text-[10px] font-bold text-slate-400 mb-1">{msg.sender} • {msg.time}</span>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium max-w-[85%] shadow-sm ${msg.senderId === sessionUserId ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                  <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                    <textarea
                      className="flex-1 bg-transparent resize-none py-2 px-3 text-sm outline-none font-medium text-slate-700"
                      rows={2} value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(); } }}
                      placeholder="Nhập phản hồi..."
                    />
                    <button onClick={onSendMessage} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- GIAO DIỆN CHẤM ĐIỂM (Chỉ Manager thấy) ----------------- */}
            {isManager && rightTab === 'evaluate' && (
               <div className="absolute inset-0 bg-white z-10 animate-fade-in">
                  <EvaluationPanel 
                     task={selectedTask} 
                     onCancel={() => setRightTab('chat')} 
                     onSubmit={async (score, criteria, note) => {
                        if (onSubmitEvaluation) {
                            await onSubmitEvaluation(score, criteria, note);
                        }
                     }}
                  />
               </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  return createPortal(drawerContent, document.body);
}