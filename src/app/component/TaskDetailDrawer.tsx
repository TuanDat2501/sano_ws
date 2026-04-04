"use client";

import { X, Link as LinkIcon, Users, CheckCircle2, Loader2, MessageSquare, Send } from "lucide-react";

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
}

export default function TaskDetailDrawer({
  isOpen, onClose, selectedTask, taskLinks, setTaskLinks, errors, isSavingLinks,
  onSaveLinks, onToggleClose, onReject, canReject, messages, chatMessage, setChatMessage, onSendMessage, sessionUserId
}: TaskDetailDrawerProps) {
  if (!selectedTask) return null;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-[900px] max-w-[95vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        
        {/* ================= HEADER ================= */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
              {selectedTask.team?.name || "Sano Workspace"}
            </span>
            <h2 className="text-xl font-black text-slate-900">{selectedTask.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            {canReject && (
              <>
                <button onClick={onReject} className="px-4 py-2 rounded-xl text-sm font-bold bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 transition-colors">
                  Reject
                </button>
                <button onClick={onToggleClose} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${selectedTask.isClosed ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  {selectedTask.isClosed ? "Mở lại Task" : "Đóng Task"}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ================= BODY (CHIA 2 CỘT) ================= */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* CỘT TRÁI: THÔNG TIN & NỘP BÀI (55%) */}
          <div className="w-[55%] flex flex-col h-full border-r border-slate-100 bg-white">
            
            {/* Vùng cuộn nội dung cột trái */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Link Nguồn */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><LinkIcon size={14} /> Link Tham Khảo</label>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-sm text-blue-600 break-all">
                  <a href={selectedTask.linkContent} target="_blank" rel="noreferrer" className="hover:underline">{selectedTask.linkContent}</a>
                </div>
              </div>

              {/* Nhân sự */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-orange-50/50 border border-orange-100 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black border-2 border-white shadow-sm shrink-0">
                      {selectedTask.contentUser?.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Content</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{selectedTask.contentUser?.fullName || "Chưa giao"}</p>
                    </div>
                 </div>
                 <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black border-2 border-white shadow-sm shrink-0">
                      {selectedTask.editorUser?.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Editor</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{selectedTask.editorUser?.fullName || "Chưa giao"}</p>
                    </div>
                 </div>
              </div>

              {/* Nộp Bài */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-[24px] p-6 space-y-5">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><CheckCircle2 className="text-green-500" size={20} /> Nộp Bài & Báo Cáo</h3>
                
                {/* Lặp qua 3 input link */}
                {[
                  { key: 'scriptLink', label: '1. Link Kịch Bản (Docs/Word)' },
                  { key: 'videoLink', label: '2. Link Video (Drive/CapCut)' },
                  { key: 'publishLink', label: '3. Link Đã Lên Kênh (TikTok/Youtube)' }
                ].map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{field.label}</label>
                    <input
                      type="url"
                      className={`w-full bg-white border rounded-xl p-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-slate-200 ${errors[field.key] ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'}`}
                      value={taskLinks[field.key as keyof typeof taskLinks]}
                      onChange={e => {
                        setTaskLinks({ ...taskLinks, [field.key]: e.target.value });
                      }}
                    />
                    {errors[field.key] && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors[field.key]}</p>}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Nút Save (Cố định ở đáy cột trái, không bị lấn sang phải) */}
            <div className="p-6 bg-white border-t border-slate-100 shrink-0">
               <button onClick={onSaveLinks} disabled={isSavingLinks} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95">
                 {isSavingLinks ? <Loader2 className="animate-spin" size={20} /> : "Lưu Tiến Độ & Cập Nhật"}
               </button>
            </div>
          </div>

          {/* CỘT PHẢI: CHAT THẢO LUẬN (45%) */}
          <div className="w-[45%] flex flex-col h-full bg-slate-50">
             
             {/* Header Chat */}
             <div className="p-4 border-b border-slate-200 bg-slate-100/50 flex items-center gap-2 shrink-0">
                <MessageSquare className="text-blue-600" size={18} /> 
                <span className="font-black text-slate-800">Thảo luận nội bộ</span>
             </div>
             
             {/* Vùng cuộn tin nhắn */}
             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm font-medium my-auto flex flex-col items-center gap-2">
                    <MessageSquare size={32} className="text-slate-300" />
                    Chưa có thảo luận nào.<br/>Bắt đầu trao đổi ngay!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.senderId === sessionUserId ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] font-bold text-slate-400 mb-1">{msg.sender} • {msg.time}</span>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium max-w-[90%] leading-relaxed shadow-sm ${msg.senderId === sessionUserId ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
             </div>
             
             {/* Khung nhập tin nhắn (Cố định ở đáy cột phải) */}
             <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="flex items-end gap-2 relative bg-slate-50 border border-slate-200 rounded-2xl p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <textarea
                    className="w-full bg-transparent resize-none py-2 px-3 text-sm outline-none font-medium text-slate-700"
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
                  <button onClick={onSendMessage} className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-sm">
                    <Send size={16} />
                  </button>
                </div>
             </div>
             
          </div>
        </div>
      </div>
    </>
  );
}