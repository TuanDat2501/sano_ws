"use client";

import { X, Link as LinkIcon, CheckCircle2, Loader2, MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
}

export default function TaskDetailDrawer({
  isOpen, onClose, selectedTask, taskLinks, setTaskLinks, errors, isSavingLinks, userRole,
  onSaveLinks, onToggleClose, onReject, canReject, messages, chatMessage, setChatMessage, onSendMessage, sessionUserId
}: TaskDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!selectedTask) return null;
  const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR"].includes(userRole);
  const drawerContent = (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[99998] transition-opacity" onClick={onClose} />}
      
      <div className={`fixed top-0 right-0 h-full w-full md:w-[900px] md:max-w-[95vw] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        {/* ================= HEADER ================= */}
        {/* Bóp padding, nút xếp linh hoạt trên Mobile */}
        <div className="px-4 md:px-6 py-3 md:py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-0 shrink-0 bg-white z-10">
          <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
            <span className="text-[9px] md:text-[10px] font-black uppercase text-red-600 bg-red-50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-red-100 shrink-0">
              {selectedTask.team?.name || "Sano Workspace"}
            </span>
            <h2 className="text-base md:text-xl font-black text-slate-900 truncate">{selectedTask.title}</h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-end">
            {canReject && (
              <>
                <button onClick={onReject} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-bold bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 transition-colors whitespace-nowrap">
                  Reject
                </button>
                <button onClick={onToggleClose} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-colors whitespace-nowrap ${selectedTask.isClosed ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  {selectedTask.isClosed ? "Mở lại Task" : "Đóng Task"}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 md:p-2 bg-slate-50 rounded-lg md:rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
              <X size={18} className="md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* ================= BODY (TÁCH CỘT PC / CHỒNG NHAU MOBILE) ================= */}
        {/* Trên Mobile: cuộn nguyên khối. Trên PC: Giữ nguyên flex-row và ẩn cuộn tổng */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          
          {/* CỘT TRÁI: THÔNG TIN & NỘP BÀI */}
          <div className="w-full lg:w-[55%] flex flex-col lg:h-full border-b lg:border-b-0 lg:border-r border-slate-100 bg-white shrink-0 lg:shrink">
            
            <div className="lg:flex-1 overflow-visible lg:overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 custom-scrollbar">
              
              {/* Link Nguồn */}
              <div>
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5 md:mb-2"><LinkIcon size={12} className="md:w-3.5 md:h-3.5" /> Link Tham Khảo</label>
                <div className="bg-slate-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 font-medium text-xs md:text-sm text-blue-600 break-all">
                  <a href={selectedTask.linkContent} target="_blank" rel="noreferrer" className="hover:underline">{selectedTask.linkContent}</a>
                </div>
              </div>

              {/* Nhân sự */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                 <div className="bg-orange-50/50 border border-orange-100 p-2.5 md:p-3.5 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black border-2 border-white shadow-sm shrink-0 text-sm md:text-base">
                      {selectedTask.contentUser?.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[9px] md:text-[10px] font-bold text-orange-500 uppercase tracking-widest">Content</p>
                      <p className="text-xs md:text-sm font-bold text-slate-800 truncate">{selectedTask.contentUser?.fullName || "Chưa giao"}</p>
                    </div>
                 </div>
                 <div className="bg-blue-50/50 border border-blue-100 p-2.5 md:p-3.5 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black border-2 border-white shadow-sm shrink-0 text-sm md:text-base">
                      {selectedTask.editorUser?.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[9px] md:text-[10px] font-bold text-blue-500 uppercase tracking-widest">Editor</p>
                      <p className="text-xs md:text-sm font-bold text-slate-800 truncate">{selectedTask.editorUser?.fullName || "Chưa giao"}</p>
                    </div>
                 </div>
              </div>

              {/* Nộp Bài */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl md:rounded-[24px] p-4 md:p-6 space-y-4 md:space-y-5">
                <h3 className="font-black text-sm md:text-base text-slate-800 flex items-center gap-1.5 md:gap-2"><CheckCircle2 className="text-green-500 w-4 h-4 md:w-5 md:h-5" /> Nộp Bài & Báo Cáo</h3>
                
                {[
                  { key: 'scriptLink', label: '1. Link Kịch Bản (Docs/Word)', targetRole: 'CONTENT', targetIdField: 'contentId' },
                  { key: 'videoLink', label: '2. Link Video (Drive/CapCut)', targetRole: 'EDITOR', targetIdField: 'editorId' },
                  { key: 'publishLink', label: '3. Link Đã Lên Kênh (TikTok/Youtube)', targetRole: 'CHANNEL_MANAGER', targetIdField: 'publisherId' }
                ].map((field) => {
                  const isAllowedToEdit = isManager || (userRole === field.targetRole && selectedTask[field.targetIdField] === sessionUserId);
                  const isCreatorAllowedScript = field.key === 'scriptLink' && selectedTask.creatorId === sessionUserId;
                  const isDisabled = !(isAllowedToEdit || isCreatorAllowedScript);

                  return (
                    <div key={field.key} className="space-y-1 md:space-y-1.5">
                      <label className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest">{field.label}</label>
                      <input
                        type="url"
                        disabled={isDisabled}
                        placeholder={isDisabled ? "Chỉ phụ trách mới được nhập ô này" : "Dán link vào đây..."}
                        className={`w-full border rounded-lg md:rounded-xl p-2.5 md:p-3.5 text-xs md:text-sm outline-none transition-all focus:ring-2 focus:ring-slate-200 
                          ${isDisabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'bg-white text-slate-800'}
                          ${errors[field.key] ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'}
                        `}
                        value={taskLinks[field.key as keyof typeof taskLinks]}
                        onChange={e => setTaskLinks({ ...taskLinks, [field.key]: e.target.value })}
                      />
                      {errors[field.key] && <p className="text-red-500 text-[9px] md:text-[10px] font-bold mt-1 ml-1">{errors[field.key]}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Nút Save: Luôn bám đáy cột trái */}
            <div className="p-4 md:p-6 bg-white border-t border-slate-100 shrink-0 sticky bottom-0 z-10 lg:static">
               <button onClick={onSaveLinks} disabled={isSavingLinks} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95 text-sm md:text-base disabled:opacity-70">
                 {isSavingLinks ? <Loader2 className="animate-spin" size={18} /> : "Lưu Tiến Độ & Cập Nhật"}
               </button>
            </div>
          </div>

          {/* CỘT PHẢI: CHAT THẢO LUẬN (45%) */}
          {/* Trên Mobile: Giới hạn chiều cao 500px để làm khung chat ảo diệu */}
          <div className="w-full lg:w-[45%] flex flex-col h-[500px] lg:h-full bg-slate-50 shrink-0 lg:shrink">
             
             <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-100/50 flex items-center gap-1.5 md:gap-2 shrink-0">
                <MessageSquare className="text-blue-600 w-4 h-4 md:w-4 md:h-4" /> 
                <span className="font-black text-slate-800 text-sm md:text-base">Thảo luận nội bộ</span>
             </div>
             
             <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-3 md:gap-4 custom-scrollbar bg-slate-50/50">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs md:text-sm font-medium my-auto flex flex-col items-center gap-2">
                    <MessageSquare size={28} className="text-slate-300 md:w-8 md:h-8" />
                    Chưa có thảo luận nào.<br/>Bắt đầu trao đổi ngay!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.senderId === sessionUserId ? "items-end" : "items-start"}`}>
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-400 mb-1">{msg.sender} • {msg.time}</span>
                      <div className={`px-3 py-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium max-w-[90%] leading-relaxed shadow-sm ${msg.senderId === sessionUserId ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
             </div>
             
             <div className="p-3 md:p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="flex items-end gap-1.5 md:gap-2 relative bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <textarea
                    className="w-full bg-transparent resize-none py-1.5 md:py-2 px-2 md:px-3 text-xs md:text-sm outline-none font-medium text-slate-700"
                    rows={2}
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSendMessage();
                      }
                    }}
                    placeholder="Nhập phản hồi (Enter để gửi)..."
                  />
                  <button onClick={onSendMessage} className="absolute right-1.5 bottom-1.5 md:right-2 md:bottom-2 p-1.5 md:p-2 bg-blue-600 text-white rounded-lg md:rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-sm">
                    <Send size={14} className="md:w-4 md:h-4" />
                  </button>
                </div>
             </div>
             
          </div>
        </div>
        
        
      </div>
    </>
  );
 if (!mounted) return null;
  return createPortal(drawerContent, document.body);
}