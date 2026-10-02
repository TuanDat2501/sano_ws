"use client";

import { X, Link as LinkIcon, CheckCircle2, Loader2, MessageSquare, Send, ClipboardCheck, Clock, Tag, Tv, Video, Trash2, Key, Layers, ImageIcon, Pencil, RefreshCw, SquarePen, RotateCcw, Lock, Unlock, CalendarCheck } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import EvaluationPanel from "./EvaluationPanel";
import { useToast } from "./ToastProvider";

interface TaskDetailDrawerProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  selectedTask: any;
  taskLinks: any;
  setTaskLinks: (links: any) => void;
  errors: { [key: string]: string };
  isSavingLinks: boolean;
  onSaveLinks: () => void;
  onToggleClose: () => void;
  onReject: (reason: string, priority: string) => void;
  canReject: boolean;
  messages: any[];
  chatMessage: string;
  setChatMessage: (msg: string) => void;
  onSendMessage: (imageUrl?: string) => void;
  sessionUserId: string;
  userRole: string;
  onSubmitEvaluation?: (score: number, criteriaData: any, note: string) => void;
  onEditTask?: () => void;
  onRefreshBoard?: () => void;
  onDeleteTask?: (taskId: string) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
}

const MOCK_CRITERIA = [
  { id: 'c1', name: 'TẦNG 1: RETENTION (Giữ chân)', weight: 50, standards: [{ id: 's1', text: 'Hook 3s đầu có biến hoặc câu hỏi tò mò' }, { id: 's2', text: 'Nhịp kể phù hợp, có điểm nghỉ thở' }, { id: 's3', text: 'Hình ảnh thay đổi (Pattern Interrupt) mỗi 2-3s' }] },
  { id: 'c2', name: 'TẦNG 2: SATISFACTION (Hài lòng)', weight: 30, standards: [{ id: 's4', text: 'Tạo được ít nhất 1 cảm xúc rõ ràng' }, { id: 's5', text: 'Mang lại 1 giá trị/bài học cụ thể' }, { id: 's6', text: 'Kết thúc tạo dư âm, có tính hành động' }] },
  { id: 'c3', name: 'TẦNG 3: POLISHING (Độ mượt)', weight: 20, standards: [{ id: 's7', text: 'Nhạc nền không lấn Voice' }, { id: 's8', text: 'Góc máy và Text/Subtitle hỗ trợ cảm xúc' }, { id: 's9', text: 'Không dính lỗi bản quyền, âm thanh rác' }] }
];

const formatDateCustom = (dateString: string) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

export default function TaskDetailDrawer({
  isOpen, isLoading, onClose, selectedTask, taskLinks, setTaskLinks, errors, isSavingLinks, userRole,
  onSaveLinks, onToggleClose, onReject, canReject, messages, chatMessage, setChatMessage, onSendMessage, sessionUserId, onSubmitEvaluation, onEditTask, onRefreshBoard, onDeleteTask, onUploadImage
}: TaskDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [rightTab, setRightTab] = useState<'chat' | 'evaluate'>('chat');
  const [checkedStandards, setCheckedStandards] = useState<Record<string, boolean>>({});
  const [kaizenNote, setKaizenNote] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [chatImageFile, setChatImageFile] = useState<File | null>(null);
  const [chatImagePreview, setChatImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
  const { showToast } = useToast();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectPriority, setRejectPriority] = useState("HIGH");

  const [localPublishDate, setLocalPublishDate] = useState("");
  const [isDateFocused, setIsDateFocused] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) {
      setRightTab('chat');
      setCheckedStandards({});
      setKaizenNote('');
      setEditingFields({});
      setShowRejectModal(false);
      setRejectReason("");
      setRejectPriority(selectedTask?.priority || "HIGH");

      if (selectedTask?.publishDate) {
        setLocalPublishDate(new Date(selectedTask.publishDate).toISOString().split('T')[0]);
      } else {
        setLocalPublishDate("");
      }
    }
  }, [isOpen, selectedTask?.id]);

  const currentUserName = useMemo(() => {
    if (!selectedTask) return "Tôi";
    const allUsers = [
      ...(selectedTask.contentUser ? [selectedTask.contentUser] : []),
      ...(selectedTask.coContentUsers || []),
      ...(selectedTask.editorUser ? [selectedTask.editorUser] : []),
      ...(selectedTask.coEditorUsers || []),
      ...(selectedTask.animatorUser ? [selectedTask.animatorUser] : []),
      ...(selectedTask.coAnimatorUsers || []),
      ...(selectedTask.publisherUser ? [selectedTask.publisherUser] : [])
    ];
    const foundUser = allUsers.find((u: any) => u.id === sessionUserId);
    return foundUser ? foundUser.fullName : "Tôi";
  }, [selectedTask, sessionUserId]);

  const currentScore = useMemo(() => {
    let totalScore = 0;
    MOCK_CRITERIA.forEach(criteria => {
      const totalItems = criteria.standards.length;
      const checkedItems = criteria.standards.filter(s => checkedStandards[s.id]).length;
      if (totalItems > 0) totalScore += (checkedItems / totalItems) * (criteria.weight / 10);
    });
    return totalScore.toFixed(1);
  }, [checkedStandards]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setChatImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setChatImagePreview(previewUrl);
    }
  };

  const handleRemoveImage = () => {
    setChatImageFile(null);
    setChatImagePreview(null);
  };

  const handleSendMessageWrapper = async () => {
    let imageUrl = undefined;
    if (chatImageFile && onUploadImage) {
      setIsUploadingImage(true);
      try {
        const url = await onUploadImage(chatImageFile);
        if (url) imageUrl = url;
      } catch (error) { console.error("Lỗi khi tải ảnh lên:", error); }
      finally { setIsUploadingImage(false); }
    }
    if (chatMessage.trim() !== '' || imageUrl) {
      onSendMessage(imageUrl);
      setChatImageFile(null);
      setChatImagePreview(null);
    }
  };

  if (!selectedTask) return null;

  const contentUsersList = [...(selectedTask.contentUser ? [selectedTask.contentUser] : []), ...(selectedTask.coContentUsers || [])];
  const editorUsersList = [...(selectedTask.editorUser ? [selectedTask.editorUser] : []), ...(selectedTask.coEditorUsers || [])];
  const animatorUsersList = [...(selectedTask.animatorUser ? [selectedTask.animatorUser] : []), ...(selectedTask.coAnimatorUsers || [])];
  const publisherUsersList = selectedTask.publisherUser ? [selectedTask.publisherUser] : [];
  const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR", "KE_TOAN"].includes(userRole);

  const handleAutoSave = async (fieldKey: string, newValue: string) => {
    let finalValue = newValue;
    if (newValue && typeof newValue === 'string' && newValue.trim() !== '') {
      finalValue = newValue.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const url = urlMatch[0];
          const textPart = trimmed.replace(url, '').trim();
          if (!textPart || textPart === '-' || textPart === ':') {
            return `[${currentUserName}]: ${url}`;
          }
        }
        return trimmed;
      }).filter(Boolean).join('\n');
    }

    if (finalValue === (selectedTask[fieldKey] || "")) {
      setEditingFields(prev => ({ ...prev, [fieldKey]: false }));
      if (finalValue !== newValue) {
         setTaskLinks({ ...taskLinks, [fieldKey]: finalValue });
      }
      return;
    }

    setSavingField(fieldKey);
    setTaskLinks({ ...taskLinks, [fieldKey]: finalValue });

    try {
      const payloadValue = finalValue === "" ? null : finalValue;

      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            [fieldKey]: payloadValue,
            // 🚀 BỔ SUNG: Gửi thêm giá trị gốc để Backend đối chiếu 3-Way Merge
            [`base_${fieldKey}`]: selectedTask[fieldKey] || "" 
        })
      });

      const data = await res.json();

      if (res.ok) {
        // 🚀 CẬP NHẬT THEO GIÁ TRỊ BACKEND TRẢ VỀ (Đã được trộn nếu có người khác sửa cùng lúc)
        const mergedValue = data.task[fieldKey] || "";
        selectedTask[fieldKey] = mergedValue;
        
        // Buộc UI render lại nếu Backend có nối thêm link của người khác vào
        setTaskLinks((prev: any) => ({ ...prev, [fieldKey]: mergedValue }));

        if (data.task?.publishDate) {
          selectedTask.publishDate = data.task.publishDate;
          setLocalPublishDate(new Date(data.task.publishDate).toISOString().split('T')[0]);
        }

        setEditingFields(prev => ({ ...prev, [fieldKey]: false }));
        setSavingField(null);
        setSavedField(fieldKey);
        setTimeout(() => setSavedField(null), 2500);
        if (onRefreshBoard) onRefreshBoard();
      } else {
        setSavingField(null);
        showToast("error", data.error || "Có lỗi xảy ra khi lưu thông tin!");
        setEditingFields(prev => ({ ...prev, [fieldKey]: true }));
      }
    } catch (error) {
      setSavingField(null);
      showToast("error", "Lỗi kết nối tới Server!");
      setEditingFields(prev => ({ ...prev, [fieldKey]: true }));
    }
  };

  const handleDeleteClick = async () => {
    if (confirm("Bạn có chắc chắn muốn xóa Task này? Hành động này không thể hoàn tác và sẽ xóa toàn bộ nội dung liên quan.")) {
      setIsDeleting(true);
      if (onDeleteTask) await onDeleteTask(selectedTask.id);
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (savingField) {
      showToast("error", "Hệ thống đang lưu dữ liệu & KPI. Vui lòng chờ giây lát...");
      return;
    }
    onClose();
  };

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
        if (parts.length >= 2) parsedLinks.push({ name: parts[0], url: parts.slice(1).join(': ').trim() });
      }
    });
  }

  const channelCategory = selectedTask?.channel?.category || 'AI';
  const allLinkFields = [
    { key: 'scriptLink', label: 'Kịch Bản', role: 'CONTENT', idField: 'contentId', categories: ['AI', 'TONG_HOP'] },
    { key: 'audioLink', label: 'Link Audio', role: 'EDITOR', idField: 'editorId', categories: ['AI', 'TONG_HOP'] },
    { key: 'storyboardLink', label: 'Bố Cục', role: 'CONTENT', idField: 'contentId', categories: ['AI', 'TONG_HOP'] },
    { key: 'animationLink', label: 'Link Chuyển Động', role: 'CONTENT', idField: 'animatorId', categories: ['AI'] },
    { key: 'roughProjectLink', label: 'Link PRJ Thô', role: 'EDITOR', idField: 'editorId', categories: ['AI', 'TONG_HOP'] },
    { key: 'thumbnailLink', label: 'Thumbnail', role: 'EDITOR', idField: 'editorId', categories: ['AI', 'TONG_HOP'] },
    { key: 'videoLink', label: 'Video Render', role: 'EDITOR', idField: 'editorId', categories: ['AI', 'TONG_HOP'] },
    { key: 'linkProject', label: 'Link Project (Dựng Chính)', role: 'EDITOR', idField: 'editorId', categories: ['AI', 'TONG_HOP'] },
  ];

  let visibleLinkFields = allLinkFields.filter(f => f.categories.includes(channelCategory));

  if (selectedTask?.isCompilation) {
    visibleLinkFields = visibleLinkFields.filter(f => ['thumbnailLink', 'videoLink', 'linkProject', 'roughProjectLink'].includes(f.key));
  }

  const renderUserGroup = (title: string, users: any[], colorClass: string, bgClass: string, borderClass: string, textClass: string) => {
    if (users.length === 0) return null;
    return (
      <div className={`${bgClass} border ${borderClass} p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm`}>
        <p className={`text-[9px] font-bold ${textClass} uppercase tracking-widest`}>{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {users.map((u, idx) => (
            <div key={idx} className="relative group cursor-pointer">
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt={u.fullName} className="h-7 w-7 rounded-lg object-cover border border-white shadow hover:scale-110 transition-all duration-200" />
              ) : (
                <div className={`h-7 w-7 rounded-lg ${colorClass} flex items-center justify-center font-black border border-white shadow hover:scale-110 transition-all duration-200 text-xs`}>
                  {u.fullName?.charAt(0) || "?"}
                </div>
              )}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                {u.fullName}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const drawerContent = (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99998] transition-opacity" onClick={handleClose} />}

      {showRejectModal && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[999999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[420px] p-6 flex flex-col gap-4 animate-scale-in border border-slate-100">
            <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
              <RefreshCw className="text-orange-500 w-6 h-6" /> Yêu cầu chỉnh sửa
            </h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              Vui lòng ghi rõ lý do để nhân sự nắm được thông tin, nội dung này sẽ được ghim thẳng vào khung thảo luận nội bộ.
            </p>

            <div className="flex flex-col gap-3">
              <textarea
                autoFocus
                rows={3}
                placeholder="VD: Tiết tấu đoạn 1:00 hơi chậm, cần cắt gọt nhanh hơn..."
                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 bg-slate-50 outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 resize-none"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mức độ ưu tiên</label>
                <select
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                  value={rejectPriority}
                  onChange={(e) => setRejectPriority(e.target.value)}
                >
                  <option value="URGENT">🚨 GẤP (Xử lý ngay)</option>
                  <option value="HIGH">🔥 Ưu tiên Cao</option>
                  <option value="NORMAL">⭐ Bình thường</option>
                  <option value="LOW">🧊 Ưu tiên Thấp</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (rejectReason.trim()) {
                    onReject(rejectReason, rejectPriority);
                    setShowRejectModal(false);
                    setRejectReason('');
                  }
                }}
                disabled={!rejectReason.trim() || isLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-all active:scale-95 flex items-center gap-2 shadow-md shadow-orange-500/20 disabled:opacity-50"
              >
                <Send size={16} /> Báo Cáo & Trả Về
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`fixed top-0 right-0 h-full w-full md:w-[1000px] md:max-w-[95vw] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

        <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-2.5 shrink-0 bg-white z-10 relative">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shadow-sm ${selectedTask.priority === 'URGENT' ? 'bg-red-600 text-white border-red-700 animate-pulse' : selectedTask.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' : selectedTask.priority === 'LOW' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
              {selectedTask.priority === 'URGENT' ? 'GẤP' : selectedTask.priority === 'HIGH' ? 'ƯU TIÊN CAO' : selectedTask.priority === 'LOW' ? 'THẤP' : 'BÌNH THƯỜNG'}
            </span>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border shadow-sm ${channelCategory === 'AI' ? 'text-pink-600 bg-pink-50 border-pink-100' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
              {channelCategory === 'AI' ? 'KÊNH AI' : 'KÊNH TỔNG HỢP'}
            </span>
            <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {selectedTask.project?.name || "Dự án ẩn"}
            </span>
            <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1 shadow-sm">
              <Tv size={10} /> {selectedTask.channel?.name || "Chưa chọn Kênh"}
            </span>
            <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              {selectedTask.team?.name || "Chưa có Team"}
            </span>
            {selectedTask.isRework && (
              <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1 shadow-sm animate-pulse">
                <RefreshCw size={10} /> XÀO LẠI / CHỈNH SỬA
              </span>
            )}
            {selectedTask.duration && (
              <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1 shadow-sm">
                <Clock size={10} /> {selectedTask.duration} PHÚT
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg md:text-xl font-black text-slate-900 leading-tight pr-4 break-words">
              {selectedTask.title}
            </h2>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
              {(isManager || selectedTask.creatorId === sessionUserId) && (
                <button onClick={handleDeleteClick} disabled={isDeleting || isLoading} title="Xóa Task" className="p-1.5 md:p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50">
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              )}

              {isManager && (
                <button onClick={() => setRightTab(rightTab === 'chat' ? 'evaluate' : 'chat')} disabled={isLoading} title="Đánh giá" className={`p-1.5 md:p-2 rounded-lg transition-colors disabled:opacity-50 ${rightTab === 'evaluate' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                  <ClipboardCheck size={16} />
                </button>
              )}

              <div className="w-[1px] h-5 bg-slate-200 mx-0.5 hidden sm:block"></div>

              {(isManager || selectedTask.creatorId === sessionUserId) && (
                <button onClick={onEditTask} disabled={isLoading} title="Chỉnh sửa" className="p-1.5 md:p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50">
                  <SquarePen size={16} />
                </button>
              )}

              {canReject && (
                <button onClick={() => setShowRejectModal(true)} disabled={isLoading} title="Yêu cầu sửa lại" className="p-1.5 md:p-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors disabled:opacity-50">
                  <RotateCcw size={16} />
                </button>
              )}

              {isManager && (
                <button onClick={onToggleClose} disabled={isLoading} title={selectedTask.isClosed ? "Mở lại Task" : "Nghiệm thu (Đóng Task)"} className={`p-1.5 md:p-2 rounded-lg transition-colors disabled:opacity-50 ${selectedTask.isClosed ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                  {selectedTask.isClosed ? <Unlock size={16} /> : <Lock size={16} />}
                </button>
              )}

              <button 
                onClick={handleClose} 
                disabled={!!savingField}
                title="Đóng cửa sổ" 
                className="p-1.5 md:p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50 relative">
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px]">
              <Loader2 size={40} className="animate-spin text-blue-600 mb-3 drop-shadow-md" />
              <p className="text-sm font-black text-blue-600 uppercase tracking-widest animate-pulse">Đang tải chi tiết bài...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50">

            <div className="w-full lg:w-[55%] flex flex-col h-full border-r border-slate-200 bg-white">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {selectedTask.isCompilation ? (
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl shadow-sm">
                    <label className="text-[10px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <Video size={14} /> Nguyên Liệu Video Ghép ({selectedTask.mergeCount || 0} files)
                    </label>
                    <div className="space-y-2">
                      {parsedLinks.length > 0 ? parsedLinks.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-indigo-100/50 shadow-sm transition-all hover:shadow-md">
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-100/50 px-2 py-1 rounded-md shrink-0 min-w-[70px] text-center border border-indigo-100">
                            {item.name}
                          </span>
                          {item.url !== 'Chưa có link' && item.url.startsWith('http') ? (
                            <a href={item.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 truncate hover:text-blue-700 hover:underline flex-1">
                              {item.url}
                            </a>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 italic flex-1">
                              {item.url}
                            </span>
                          )}
                        </div>
                      )) : (
                        <p className="text-xs font-medium text-slate-500 italic px-2">Không có link nguyên liệu.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTask.linkContent && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                          <LinkIcon size={12} /> Link Tham Khảo / Ý Tưởng
                        </label>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium text-xs text-blue-600 break-all hover:bg-blue-50 transition-colors">
                          <a href={selectedTask.linkContent} target="_blank" rel="noreferrer" className="hover:underline">{selectedTask.linkContent}</a>
                        </div>
                      </div>
                    )}
                    {selectedTask.keywords && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                          <Key size={12} /> Từ khóa / Keywords
                        </label>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-bold text-xs text-slate-700">
                          {selectedTask.keywords}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {renderUserGroup("Content", contentUsersList, "bg-orange-100 text-orange-600", "bg-orange-50/50", "border-orange-100", "text-orange-500")}
                  {renderUserGroup("Editor", editorUsersList, "bg-blue-100 text-blue-600", "bg-blue-50/50", "border-blue-100", "text-blue-500")}
                  {renderUserGroup("Animator", animatorUsersList, "bg-purple-100 text-purple-600", "bg-purple-50/50", "border-purple-100", "text-purple-500")}
                  {renderUserGroup("QL Kênh", publisherUsersList, "bg-rose-100 text-rose-600", "bg-rose-50/50", "border-rose-100", "text-rose-500")}
                </div>

                {/* KHỐI KẾT QUẢ CÔNG VIỆC - VỚI INLINE ROW EDITING */}
                <div className="bg-white border border-slate-200 rounded-[20px] shadow-sm overflow-hidden flex flex-col max-h-[550px]">

                  <div className="p-4 pb-3 border-b border-slate-100 shrink-0 bg-white z-10">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[14px] text-slate-800 flex items-center gap-1.5">
                        <CheckCircle2 className="text-emerald-500 w-4 h-4" /> Kết Quả Công Việc
                      </h3>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 shadow-sm">(Tự động lưu)</span>
                    </div>
                    <p className="text-[11px] font-medium text-amber-600 mt-2 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100 flex items-start gap-1">
                      💡 <span><strong>Lưu ý:</strong> Bấm "Sửa" và dán link (hệ thống tự động gắn tên bạn). Bấm "+ Thêm Link" nếu có nhiều người nộp chung 1 mục.</span>
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
                    <div className="flex flex-col gap-4">
                      {visibleLinkFields.map((field, idx) => {
                        const currentLink = taskLinks[field.key as keyof typeof taskLinks] ?? selectedTask[field.key] ?? "";
                        const isEditing = editingFields[field.key];

                        return (
                          <div key={field.key} className={`relative rounded-lg border transition-all duration-200 group/field bg-white shadow-sm ${isEditing ? (errors[field.key] ? 'border-red-500 ring-2 ring-red-500/10' : 'border-blue-500 ring-2 ring-blue-500/10') : 'border-slate-300 hover:border-slate-400'}`}>

                            <label className={`absolute -top-2 left-3 bg-white px-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors ${isEditing ? 'text-blue-600' : 'text-slate-500'}`}>
                              {idx + 1}. {field.label}
                              {savingField === field.key && <Loader2 size={10} className="animate-spin text-blue-500" />}
                              {savedField === field.key && <CheckCircle2 size={10} className="text-emerald-500" />}
                            </label>

                            {!isEditing && (
                              <button onClick={() => setEditingFields({ ...editingFields, [field.key]: true })} className="absolute -top-2.5 right-2 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded text-[9px] flex items-center gap-1 font-bold normal-case tracking-normal transition-all shadow-sm opacity-0 group-hover/field:opacity-100 translate-y-1 group-hover/field:translate-y-0 z-10">
                                <Pencil size={10} /> Sửa
                              </button>
                            )}

                            <div className="p-2.5 pt-3">
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  {(() => {
                                    const lines = currentLink ? currentLink.split('\n') : [""];
                                    return lines.map((line: string, i: number) => (
                                      <div key={i} className="flex items-start gap-2 bg-slate-50/50 p-1.5 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                        <div className="mt-1.5 pl-1 text-slate-400"><LinkIcon size={12} /></div>
                                        <textarea
                                          rows={2}
                                          placeholder="Dán link vào đây..."
                                          className="flex-1 text-[12px] bg-transparent outline-none resize-y custom-scrollbar min-h-[32px] p-1"
                                          value={line}
                                          onChange={(e) => {
                                            const newLines = [...lines];
                                            newLines[i] = e.target.value;
                                            setTaskLinks({ ...taskLinks, [field.key]: newLines.join('\n') });
                                          }}
                                        />
                                        <button
                                          onClick={() => {
                                            const newLines = lines.filter((_: string, idx: number) => idx !== i);
                                            setTaskLinks({ ...taskLinks, [field.key]: newLines.join('\n') });
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md mt-0.5 transition-colors"
                                          title="Xóa link này"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    ));
                                  })()}

                                  <div className="flex items-center gap-2 mt-1">
                                    <button
                                      onClick={() => {
                                        const newLines = currentLink ? currentLink.split('\n') : [];
                                        newLines.push("");
                                        setTaskLinks({ ...taskLinks, [field.key]: newLines.join('\n') });
                                      }}
                                      className="flex-1 py-1.5 border border-dashed border-blue-300 bg-blue-50/50 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-100 transition-all flex items-center justify-center gap-1"
                                    >
                                      + Thêm Link
                                    </button>
                                    <button
                                      onClick={() => {
                                        const cleanLines = currentLink.split('\n').filter((l: string) => l.trim() !== '').join('\n');
                                        handleAutoSave(field.key, cleanLines);
                                      }}
                                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold shadow-sm hover:bg-blue-700 transition-all flex items-center gap-1"
                                    >
                                      <CheckCircle2 size={12} /> Lưu
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingFields(prev => ({ ...prev, [field.key]: false }));
                                        setTaskLinks({ ...taskLinks, [field.key]: selectedTask[field.key] || "" });
                                      }}
                                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold shadow-sm hover:bg-slate-200 transition-all"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {!currentLink ? (
                                     <span className="text-[11px] text-slate-400 italic px-1">Chưa có kết quả</span>
                                  ) : currentLink.split('\n').filter((l: string) => l.trim() !== '').map((line: string, i: number) => {
                                    const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                                    const url = urlMatch ? urlMatch[0] : null;
                                    const textPart = urlMatch ? line.replace(url as any, '').trim() : null;

                                    return (
                                      <div key={i} className="flex items-start gap-2 group/link">
                                        <div className="bg-slate-50 p-1 rounded text-slate-400 group-hover/link:text-blue-500 group-hover/link:bg-blue-50 transition-colors mt-0.5 border border-slate-100">
                                          <LinkIcon size={10} />
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0 justify-center leading-tight">
                                          {url ? (
                                             <>
                                                {textPart && textPart !== '-' && textPart !== ':' && (
                                                  <span className="text-[9px] font-bold text-slate-400 mb-0.5">
                                                    {textPart.replace(/^[-:\[\]]+|[-:\[\]]+$/g, '').trim()}
                                                  </span>
                                                )}
                                                <a href={url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-blue-600 hover:text-red-700 hover:underline truncate w-full break-all">
                                                  {url}
                                                </a>
                                             </>
                                          ) : (
                                              <span className="text-[12px] font-medium text-slate-600 break-all">{line}</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      <div className={`md:col-span-2 relative rounded-lg border transition-all duration-200 group/pub bg-white ${editingFields['publishLink'] ? (errors['publishLink'] ? 'border-red-500 ring-2 ring-red-500/10' : 'border-red-500 ring-2 ring-red-500/10') : 'border-red-200 hover:border-red-300'}`}>
                        <label className={`absolute -top-2 left-3 bg-white px-1 text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1`}>
                          Link Đã Đăng (YT)
                          {savingField === 'publishLink' && <Loader2 size={10} className="animate-spin text-red-500" />}
                          {savedField === 'publishLink' && <CheckCircle2 size={10} className="text-emerald-500" />}
                        </label>

                        {!editingFields['publishLink'] && (
                          <button onClick={() => setEditingFields({ ...editingFields, publishLink: true })} className="absolute -top-2.5 right-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded text-[9px] flex items-center gap-1 font-bold normal-case tracking-normal opacity-0 group-hover/pub:opacity-100 transition-all shadow-sm translate-y-1 group-hover/pub:translate-y-0 z-10">
                            <Pencil size={10} /> Sửa
                          </button>
                        )}

                        <div className="p-2.5 pt-3">
                          {editingFields['publishLink'] ? (
                             <div className="flex flex-col gap-2">
                               {(() => {
                                 const pubLinks = taskLinks.publishLink ? taskLinks.publishLink.split('\n') : [""];
                                 return pubLinks.map((line: string, i: number) => (
                                   <div key={i} className="flex items-start gap-2 bg-red-50/30 p-1.5 rounded-lg border border-red-100 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-400/20 transition-all">
                                     <div className="mt-1.5 pl-1 text-red-300"><LinkIcon size={12} /></div>
                                     <textarea
                                       rows={2}
                                       placeholder="Dán link YouTube vào đây..."
                                       className="flex-1 text-[12px] bg-transparent outline-none resize-y custom-scrollbar min-h-[32px] p-1 text-slate-800"
                                       value={line}
                                       onChange={(e) => {
                                         const newLines = [...pubLinks];
                                         newLines[i] = e.target.value;
                                         setTaskLinks({ ...taskLinks, publishLink: newLines.join('\n') });
                                       }}
                                     />
                                     <button
                                       onClick={() => {
                                         const newLines = pubLinks.filter((_: string, idx: number) => idx !== i);
                                         setTaskLinks({ ...taskLinks, publishLink: newLines.join('\n') });
                                       }}
                                       className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-100 rounded-md mt-0.5 transition-colors"
                                       title="Xóa link này"
                                     >
                                       <Trash2 size={12} />
                                     </button>
                                   </div>
                                 ));
                               })()}

                               <div className="flex items-center gap-2 mt-1">
                                 <button
                                   onClick={() => {
                                     const newLines = taskLinks.publishLink ? taskLinks.publishLink.split('\n') : [];
                                     newLines.push("");
                                     setTaskLinks({ ...taskLinks, publishLink: newLines.join('\n') });
                                   }}
                                   className="flex-1 py-1.5 border border-dashed border-red-300 bg-red-50/50 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-100 transition-all flex items-center justify-center gap-1"
                                 >
                                   + Thêm Link
                                 </button>
                                 <button
                                   onClick={() => {
                                     const cleanLines = taskLinks.publishLink ? taskLinks.publishLink.split('\n').filter((l: string) => l.trim() !== '').join('\n') : "";
                                     handleAutoSave('publishLink', cleanLines);
                                   }}
                                   className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-[11px] font-bold shadow-sm hover:bg-red-600 transition-all flex items-center gap-1"
                                 >
                                   <CheckCircle2 size={12} /> Lưu
                                 </button>
                                 <button
                                   onClick={() => {
                                     setEditingFields(prev => ({ ...prev, publishLink: false }));
                                     setTaskLinks({ ...taskLinks, publishLink: selectedTask.publishLink || "" });
                                   }}
                                   className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold shadow-sm hover:bg-slate-200 transition-all"
                                 >
                                   Hủy
                                 </button>
                               </div>
                             </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {!taskLinks.publishLink ? (
                                <span className="text-[11px] text-slate-400 italic px-1">Chưa có kết quả</span>
                              ) : taskLinks.publishLink.split('\n').filter((l: string) => l.trim() !== '').map((line: string, i: number) => {
                                const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                                const url = urlMatch ? urlMatch[0] : null;
                                const textPart = urlMatch ? line.replace(url as any, '').trim() : null;

                                return (
                                  <div key={i} className="flex items-start gap-2 group/link">
                                    <div className="bg-red-50 p-1 rounded text-red-400 group-hover/link:text-red-600 group-hover/link:bg-red-100 transition-colors mt-0.5 border border-red-100">
                                      <LinkIcon size={10} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0 justify-center leading-tight">
                                      {url ? (
                                         <>
                                            {textPart && textPart !== '-' && textPart !== ':' && (
                                              <span className="text-[9px] font-bold text-slate-400 mb-0.5">
                                                {textPart.replace(/^[-:\[\]]+|[-:\[\]]+$/g, '').trim()}
                                              </span>
                                            )}
                                            <a href={url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-red-600 hover:text-red-700 hover:underline truncate w-full break-all">
                                              {url}
                                            </a>
                                         </>
                                      ) : (
                                          <span className="text-[12px] font-medium text-slate-600 break-all">{line}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-1 relative rounded-lg border border-red-200 bg-white transition-all duration-200 hover:border-red-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/10">
                        <label className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                          Ngày HT
                          {savingField === 'publishDate' && <Loader2 size={10} className="animate-spin text-red-500" />}
                          {savedField === 'publishDate' && <CheckCircle2 size={10} className="text-emerald-500" />}
                        </label>
                        <input
                          type={isDateFocused || !localPublishDate ? "date" : "text"}
                          className="w-full h-full min-h-[42px] px-3 text-[12px] outline-none bg-transparent text-slate-800 cursor-pointer font-bold rounded-lg"
                          value={isDateFocused || !localPublishDate ? localPublishDate : formatDateCustom(localPublishDate)}
                          onFocus={() => setIsDateFocused(true)}
                          onBlur={() => setIsDateFocused(false)}
                          onChange={(e) => {
                            setLocalPublishDate(e.target.value);
                            handleAutoSave('publishDate', e.target.value ? new Date(e.target.value).toISOString() : "");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/50 border border-amber-100 rounded-[20px] p-4 space-y-2.5 shadow-sm">
                  <h3 className="font-black text-[13px] text-amber-900 flex items-center gap-1.5">
                    <Tag className="text-amber-500 w-4 h-4" /> Báo Cáo Trạng Thái
                    {savingField === 'note' && <Loader2 size={12} className="animate-spin text-blue-500 ml-auto" />}
                    {savedField === 'note' && <CheckCircle2 size={12} className="text-emerald-500 ml-auto" />}
                  </h3>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="VD: Đang cắt thô..."
                      className="w-full border border-amber-200 rounded-lg p-2.5 text-xs outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-bold text-amber-900 placeholder:text-amber-400 bg-white shadow-inner"
                      value={cleanUserNote}
                      onChange={e => setTaskLinks({ ...taskLinks, note: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && cleanUserNote.trim() !== '') {
                          setChatMessage(`[BÁO CÁO TIẾN ĐỘ]: ${cleanUserNote}`);
                          setTaskLinks({ ...taskLinks, note: '' });
                          setTimeout(() => handleSendMessageWrapper(), 50);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (cleanUserNote.trim() !== '') {
                          setChatMessage(`[BÁO CÁO TIẾN ĐỘ]: ${cleanUserNote}`);
                          setTaskLinks({ ...taskLinks, note: '' });
                          setTimeout(() => handleSendMessageWrapper(), 50);
                        }
                      }}
                      disabled={!cleanUserNote.trim()}
                      className="h-9 px-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all font-bold disabled:opacity-50 flex items-center justify-center shrink-0 shadow-sm"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

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
                            {msg.imageUrl && (
                              <img
                                src={msg.imageUrl}
                                alt="Đính kèm"
                                className="max-w-[200px] sm:max-w-[250px] max-h-[250px] object-cover rounded-xl mb-2 border border-slate-200 shadow-sm hover:opacity-90 cursor-pointer"
                                onClick={() => window.open(msg.imageUrl, '_blank')}
                              />
                            )}
                            {msg.text && <div>{msg.text}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 shrink-0 flex flex-col gap-2">
                    {chatImagePreview && (
                      <div className="relative inline-block w-fit mt-1 ml-1 mb-2">
                        <img
                          src={chatImagePreview}
                          alt="Xem trước"
                          className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm"
                        />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm active:scale-95"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                      <label className="p-2.5 cursor-pointer text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                        <ImageIcon size={18} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageSelect}
                        />
                      </label>

                      <textarea
                        className="flex-1 bg-transparent resize-none py-2 px-3 text-sm outline-none font-medium text-slate-700"
                        rows={2} value={chatMessage} onChange={e => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessageWrapper();
                          }
                        }}
                        placeholder="Nhập phản hồi..."
                      />
                      <button
                        onClick={handleSendMessageWrapper}
                        disabled={isUploadingImage || (!chatMessage.trim() && !chatImageFile)}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
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
        )}
      </div>
    </>
  );
  if (!mounted) return null;
  return createPortal(drawerContent, document.body);
}