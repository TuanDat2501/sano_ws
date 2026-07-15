"use client";

import { X, Link as LinkIcon, CheckCircle2, Loader2, MessageSquare, Send, ClipboardCheck, Clock, Tag, Tv, Video, Trash2 } from "lucide-react";
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
  onSubmitEvaluation?: (score: number, criteriaData: any, note: string) => void;
  onEditTask?: () => void;
  onRefreshBoard?: () => void;
  onDeleteTask?: (taskId: string) => void; // 🚀 THÊM PROP XÓA TASK
}

// 🚀 BỘ TIÊU CHUẨN MẪU (Mock Data)
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
  onSaveLinks, onToggleClose, onReject, canReject, messages, chatMessage, setChatMessage, onSendMessage, sessionUserId, onSubmitEvaluation, onEditTask, onRefreshBoard, onDeleteTask
}: TaskDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);

  const [rightTab, setRightTab] = useState<'chat' | 'evaluate'>('chat');
  const [checkedStandards, setCheckedStandards] = useState<Record<string, boolean>>({});
  const [kaizenNote, setKaizenNote] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // 🚀 State để quay tròn lúc đang call API xóa
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) {
      setRightTab('chat');
      setCheckedStandards({});
      setKaizenNote('');
    }
  }, [isOpen, selectedTask?.id]);

  const currentScore = useMemo(() => {
    let totalScore = 0;
    MOCK_CRITERIA.forEach(criteria => {
      const totalItems = criteria.standards.length;
      const checkedItems = criteria.standards.filter(s => checkedStandards[s.id]).length;
      if (totalItems > 0) {
        totalScore += (checkedItems / totalItems) * (criteria.weight / 10);
      }
    });
    return totalScore.toFixed(1);
  }, [checkedStandards]);

  const submitEvaluation = () => {
    setIsEvaluating(true);
    if (onSubmitEvaluation) {
      onSubmitEvaluation(Number(currentScore), checkedStandards, kaizenNote);
    }
    setTimeout(() => setIsEvaluating(false), 800);
  };

  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  
  if (!selectedTask) return null;
  const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR", "QLK"].includes(userRole);

  const isParticipant = isManager || selectedTask.contentId === sessionUserId || selectedTask.editorId === sessionUserId || selectedTask.creatorId === sessionUserId;

  const handleAutoSave = async (fieldKey: string, newValue: string) => {
    if (newValue === (selectedTask[fieldKey] || "")) return;

    setSavingField(fieldKey);
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: newValue })
      });

      if (res.ok) {
        selectedTask[fieldKey] = newValue;
        setSavingField(null);
        setSavedField(fieldKey);
        setTimeout(() => setSavedField(null), 2500);
        if (onRefreshBoard) {
          onRefreshBoard();
        }
      }
    } catch (error) {
      setSavingField(null);
      console.error("Lỗi auto-save:", error);
    }
  };

  // 🚀 HÀM XỬ LÝ KHI BẤM XÓA TASK
  const handleDeleteClick = async () => {
    if (confirm("Bạn có chắc chắn muốn xóa Task này? Hành động này không thể hoàn tác và sẽ xóa toàn bộ nội dung liên quan.")) {
        setIsDeleting(true);
        if (onDeleteTask) {
             await onDeleteTask(selectedTask.id);
        }
        setIsDeleting(false);
    }
  };

  // =========================================================================
  // LOGIC TÁCH DỮ LIỆU "NGUYÊN LIỆU GHÉP" VÀ "BÁO CÁO CỦA USER"
  // =========================================================================
  const fullNote = taskLinks.note !== undefined ? taskLinks.note : (selectedTask?.note || "");
  const splitToken = "Nguyên liệu ghép:";
  const splitIndex = fullNote.indexOf(splitToken);

  const cleanUserNote = splitIndex !== -1 ? fullNote.substring(0, splitIndex).trim() : fullNote;
  const compilationPart = splitIndex !== -1 ? fullNote.substring(splitIndex) : "";

  const parsedLinks: { name: string, url: string }[] = [];
  if (compilationPart) {
    compilationPart.split('\n').forEach((line: string) => {
      if (line.startsWith('- ')) {
        const parts = line.substring(2).split(': ');
        if (parts.length >= 2) {
          parsedLinks.push({
            name: parts[0],
            url: parts.slice(1).join(': ').trim()
          });
        }
      }
    });
  }

  const drawerContent = (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99998] transition-opacity" onClick={onClose} />}

      <div className={`fixed top-0 right-0 h-full w-full md:w-[1000px] md:max-w-[95vw] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

        {/* ================= HEADER ================= */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 bg-white z-10">
          <div className="flex flex-col w-full sm:w-auto gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                {selectedTask.project?.name || "Dự án ẩn"}
              </span>
              <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-100 flex items-center gap-1 shadow-sm">
                <Tv size={12} /> {selectedTask.channel?.name || "Chưa chọn Kênh"}
              </span>
              <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                {selectedTask.team?.name || "Chưa có Team"}
              </span>
              {selectedTask.duration && (
                <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 flex items-center gap-1 shadow-sm">
                  <Clock size={12} /> {selectedTask.duration} PHÚT
                </span>
              )}
            </div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 truncate max-w-[350px] md:max-w-[450px]">{selectedTask.title}</h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
             {/* 🚀 NÚT XÓA TASK */}
             {(isManager || selectedTask.creatorId === sessionUserId) && (
              <button 
                  onClick={handleDeleteClick} 
                  disabled={isDeleting}
                  className="px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                 {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} 
                 Xóa
              </button>
            )}

            {isManager && (
              <button onClick={() => setRightTab(rightTab === 'chat' ? 'evaluate' : 'chat')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${rightTab === 'evaluate' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                <ClipboardCheck size={16} /> {rightTab === 'evaluate' ? "Quay lại Chat" : "Chấm điểm Video"}
              </button>
            )}
            <div className="w-[1px] h-6 bg-slate-200 mx-1 hidden sm:block"></div>
            {(isManager || selectedTask.creatorId === sessionUserId) && (
              <button onClick={onEditTask} className="px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                Sửa Task
              </button>
            )}
            {canReject && (
              <button onClick={onReject} className="px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
                Làm lại
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

              {/* GIAO DIỆN HIỂN THỊ LINK ĐÃ ĐƯỢC CHIA TRƯỜNG HỢP */}
              {selectedTask.isCompilation ? (
                <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-[24px] shadow-sm">
                  <label className="text-xs font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2 mb-3">
                    <Video size={16} /> Nguyên Liệu Video Ghép
                  </label>
                  <div className="space-y-2.5">
                    {parsedLinks.length > 0 ? parsedLinks.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white p-3 rounded-xl border border-indigo-100/50 shadow-sm transition-all hover:shadow-md">
                        <span className="text-xs font-black text-indigo-700 bg-indigo-100/50 px-2.5 py-1.5 rounded-lg shrink-0 min-w-[70px] text-center border border-indigo-100">
                          {item.name}
                        </span>
                        {item.url !== 'Chưa có link' && item.url.startsWith('http') ? (
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-blue-600 truncate hover:text-blue-700 hover:underline flex-1">
                            {item.url}
                          </a>
                        ) : (
                          <span className="text-[13px] font-bold text-slate-400 italic flex-1">
                            {item.url}
                          </span>
                        )}
                      </div>
                    )) : (
                      <p className="text-sm font-medium text-slate-500 italic px-2">Không tìm thấy link nguyên liệu.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <LinkIcon size={14} /> Link Tham Khảo / Ý Tưởng
                  </label>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-sm text-blue-600 break-all hover:bg-blue-50 transition-colors">
                    <a href={selectedTask.linkContent} target="_blank" rel="noreferrer" className="hover:underline">{selectedTask.linkContent}</a>
                  </div>
                </div>
              )}

              {/* NHÂN SỰ */}
              <div className="grid grid-cols-2 gap-4">
                {selectedTask.contentUser && 
                  <div className="bg-orange-50/50 border border-orange-100 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black border-2 border-white shadow-sm text-base">
                    {selectedTask.contentUser?.fullName?.charAt(0) || "?"}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Content</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedTask.contentUser?.fullName || "Chưa giao"}</p>
                  </div>
                </div>
                }
                
                {
                  selectedTask.editorUser && 
                  <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-2xl flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black border-2 border-white shadow-sm text-base">
                    {selectedTask.editorUser?.fullName?.charAt(0) || "?"}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Editor</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedTask.editorUser?.fullName || "Chưa giao"}</p>
                  </div>
                </div>
                }
                

                {selectedTask.animatorUser &&
                  <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black border-2 border-white shadow-sm text-base">
                      {selectedTask.animatorUser?.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Animator</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{selectedTask.animatorUser?.fullName || "Chưa giao"}</p>
                    </div>
                  </div>
                }

              </div>

              {/* KHỐI INPUT LINK */}
              <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-5 space-y-4 shadow-inner">
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2 mb-2"><CheckCircle2 className="text-emerald-500 w-5 h-5" /> Kết Quả Công Việc</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'scriptLink', label: '1. Kịch Bản (VN)', role: 'CONTENT', idField: 'contentId' },
                    { key: 'englishScriptLink', label: '2. Text ENG', role: 'CONTENT', idField: 'contentId' },
                    { key: 'audioLink', label: '3. Link Audio (AI)', role: 'CONTENT', idField: 'contentId' },
                    { key: 'storyboardLink', label: '4. Bố Cục', role: 'EDITOR', idField: 'editorId' },
                    { key: 'thumbnailLink', label: '5. Thumbnail', role: 'EDITOR', idField: 'editorId' },
                    { key: 'videoLink', label: '6. Video Render', role: 'EDITOR', idField: 'editorId' },
                  ].map((field) => {
                    const isAllowed = isManager || (userRole === field.role && selectedTask[field.idField] === sessionUserId) || (field.key === 'scriptLink' && selectedTask.creatorId === sessionUserId);
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          {field.label}
                          {savingField === field.key && <Loader2 size={12} className="animate-spin text-blue-500" />}
                          {savedField === field.key && <CheckCircle2 size={12} className="text-emerald-500" />}
                        </label>
                        <input
                          type="url" disabled={!isAllowed}
                          placeholder={!isAllowed ? "Chỉ người phụ trách" : "Dán link..."}
                          className={`w-full border rounded-xl p-3 text-[13px] outline-none transition-all ${!isAllowed ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'} ${errors[field.key] ? 'border-red-500' : ''}`}
                          value={taskLinks[field.key as keyof typeof taskLinks] || ""}
                          onChange={e => setTaskLinks({ ...taskLinks, [field.key]: e.target.value })}
                          onBlur={(e) => handleAutoSave(field.key, e.target.value)}
                        />
                      </div>
                    );
                  })}

                  <div className="space-y-1.5 col-span-1 md:col-span-2 pt-2 border-t border-slate-200">
                    <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                      7. Link Video Đã Đăng (YT)
                      {savingField === 'publishLink' && <Loader2 size={12} className="animate-spin text-blue-500" />}
                      {savedField === 'publishLink' && <CheckCircle2 size={12} className="text-emerald-500" />}
                    </label>
                    <input
                      type="url" disabled={!isManager}
                      placeholder={!isManager ? "Chỉ Quản lý Kênh" : "Dán link YouTube..."}
                      className="w-full border rounded-xl p-3 text-[13px] outline-none transition-all bg-white text-slate-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      value={taskLinks.publishLink || ""}
                      onChange={e => setTaskLinks({ ...taskLinks, publishLink: e.target.value })}
                      onBlur={(e) => handleAutoSave('publishLink', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* KHỐI GHI CHÚ TRẠNG THÁI */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-[24px] p-5 space-y-3 shadow-sm">
                <h3 className="font-black text-sm text-amber-900 flex items-center gap-2">
                  <Tag className="text-amber-500 w-4 h-4" /> Báo Cáo Trạng Thái
                  {savingField === 'note' && <Loader2 size={14} className="animate-spin text-blue-500 ml-auto" />}
                  {savedField === 'note' && <CheckCircle2 size={14} className="text-emerald-500 ml-auto" />}
                </h3>
                <p className="text-[11px] text-amber-700/70 font-bold leading-tight">Dùng để cập nhật nhanh tình trạng bài cho QLK nắm bắt (VD: Đang cắt thô, Đang tìm Voice, Lỗi file...)</p>
                <input
                  type="text"
                  disabled={!isParticipant}
                  placeholder={!isParticipant ? "Không có quyền" : "Nhập tiến độ hiện tại..."}
                  className="w-full border border-amber-200 rounded-xl p-3 text-sm outline-none transition-all focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 disabled:bg-slate-100 disabled:text-slate-400 font-bold text-amber-900 placeholder:text-amber-300"
                  value={cleanUserNote} 
                  onChange={e => {
                    const val = e.target.value;
                    const newFullNote = compilationPart ? (val ? `${val}\n\n${compilationPart}` : compilationPart) : val;
                    setTaskLinks({ ...taskLinks, note: newFullNote });
                  }}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const newFullNote = compilationPart ? (val ? `${val}\n\n${compilationPart}` : compilationPart) : val;
                    handleAutoSave('note', newFullNote);
                  }}
                />
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: CHAT HOẶC CHẤM ĐIỂM (Giữ nguyên) */}
          <div className="w-full lg:w-[45%] flex flex-col h-full bg-white relative">
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
            {isManager && rightTab === 'evaluate' && (
              <div className="absolute inset-0 bg-white z-10 animate-fade-in">
                <EvaluationPanel
                  task={selectedTask}
                  onCancel={() => setRightTab('chat')}
                  onSubmit={async (score, criteria, note) => {
                    if (onSubmitEvaluation) await onSubmitEvaluation(score, criteria, note);
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