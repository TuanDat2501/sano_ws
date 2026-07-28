"use client";

import { X, Link as LinkIcon, CheckCircle2, Loader2, MessageSquare, Send, ClipboardCheck, Clock, Tag, Tv, Video, Trash2, Key, Layers, ImageIcon } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import EvaluationPanel from "./EvaluationPanel";

interface TaskDetailDrawerProps {
  isOpen: boolean;
  isLoading?: boolean; // 🚀 BỔ SUNG PROP NÀY
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
  // Hàm xử lý chọn file ảnh
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setChatImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setChatImagePreview(previewUrl);
    }
  };

  // Hàm xử lý xóa ảnh đang chọn
  const handleRemoveImage = () => {
    setChatImageFile(null);
    setChatImagePreview(null);
  };

  // Sửa hàm xử lý việc gửi tin nhắn bao gồm quá trình tải ảnh
  const handleSendMessageWrapper = async () => {
    let imageUrl = undefined;

    if (chatImageFile && onUploadImage) {
      setIsUploadingImage(true);
      try {
        const url = await onUploadImage(chatImageFile);
        if (url) {
          imageUrl = url;
        }
      } catch (error) {
        console.error("Lỗi khi tải ảnh lên:", error);
      } finally {
        setIsUploadingImage(false);
      }
    }

    // Gọi hàm onSendMessage truyền vào imageUrl (và text sẽ do props cha quản lý)
    // Chú ý: bạn cần đảm bảo cha (hoặc hàm onSendMessage này) có khả năng gửi tin nhắn chỉ có ảnh (text rỗng)
    if (chatMessage.trim() !== '' || imageUrl) {
      onSendMessage(imageUrl);
      setChatImageFile(null);
      setChatImagePreview(null);
    }
  };
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
  const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR", "KE_TOAN"].includes(userRole);

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

  const handleDeleteClick = async () => {
    if (confirm("Bạn có chắc chắn muốn xóa Task này? Hành động này không thể hoàn tác và sẽ xóa toàn bộ nội dung liên quan.")) {
      setIsDeleting(true);
      if (onDeleteTask) {
        await onDeleteTask(selectedTask.id);
      }
      setIsDeleting(false);
    }
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
        if (parts.length >= 2) {
          parsedLinks.push({
            name: parts[0],
            url: parts.slice(1).join(': ').trim()
          });
        }
      }
    });
  }

  const channelCategory = selectedTask?.channel?.category || 'AI';

  const allLinkFields = [
    { key: 'scriptLink', label: 'Kịch Bản (VN)', role: 'CONTENT', idField: 'contentId', categories: ['AI', 'TONG_HOP'] },
    { key: 'englishScriptLink', label: 'Text ENG', role: 'CONTENT', idField: 'contentId', categories: ['AI'] },
    { key: 'audioLink', label: 'Link Audio (AI)', role: 'EDITOR', idField: 'editorId', categories: ['AI','TONG_HOP'] }, // 🚀 ĐÃ SỬA ROLE VÀ idField SANG EDITOR
    { key: 'storyboardLink', label: 'Bố Cục', role: 'EDITOR', idField: 'contentId', categories: ['AI', 'TONG_HOP'] },
    { key: 'thumbnailLink', label: 'Thumbnail', role: 'EDITOR', idField: 'editorId', categories: ['AI', 'TONG_HOP'] },
    { key: 'videoLink', label: 'Video Render', role: 'EDITOR', idField: 'editorId', categories: ['AI', 'TONG_HOP'] },
  ];

  let visibleLinkFields = allLinkFields.filter(f => f.categories.includes(channelCategory));
  if (selectedTask?.isCompilation) {
    visibleLinkFields = visibleLinkFields.filter(f => ['thumbnailLink', 'videoLink'].includes(f.key));
  }

  const drawerContent = (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99998] transition-opacity" onClick={onClose} />}

      <div className={`fixed top-0 right-0 h-full w-full md:w-[1000px] md:max-w-[95vw] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

        {/* HEADER: HIỂN THỊ LUÔN NGAY KHI VỪA MỞ */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 bg-white z-10">
          <div className="flex flex-col w-full sm:w-auto gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border shadow-sm ${selectedTask.priority === 'URGENT' ? 'bg-red-600 text-white border-red-700 animate-pulse' :
                  selectedTask.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    selectedTask.priority === 'LOW' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                      'bg-blue-50 text-blue-600 border-blue-200'
                  }`}
              >
                {selectedTask.priority === 'URGENT' ? 'GẤP' :
                  selectedTask.priority === 'HIGH' ? 'Ưu tiên Cao' :
                    selectedTask.priority === 'LOW' ? 'Thấp' :
                      'Bình thường'}
              </span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border shadow-sm ${channelCategory === 'AI' ? 'text-pink-600 bg-pink-50 border-pink-100' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                {channelCategory === 'AI' ? 'KÊNH AI' : 'KÊNH TỔNG HỢP'}
              </span>

              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                {selectedTask.project?.name || "Dự án ẩn"}
              </span>

              <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-2.5 py-1 rounded-md border border-red-100 flex items-center gap-1 shadow-sm">
                <Tv size={12} /> {selectedTask.channel?.name || "Chưa chọn Kênh"}
              </span>

              <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                {selectedTask.team?.name || "Chưa có Team"}
              </span>
              {/* <select
                disabled={!isManager}
                value={selectedTask.priority || "NORMAL"}
                onChange={(e) => {
                  // 🚀 Lập tức lưu vào state local và gọi API AutoSave
                  selectedTask.priority = e.target.value;
                  handleAutoSave("priority", e.target.value);
                }}
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border shadow-sm outline-none cursor-pointer${selectedTask.priority === 'URGENT' ? 'bg-red-600 text-white border-red-700 animate-pulse' :
                    selectedTask.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      selectedTask.priority === 'LOW' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                        'bg-blue-50 text-blue-600 border-blue-200'}`}
              >
                <option value="LOW">Thấp</option>
                <option value="NORMAL">Bình thường</option>
                <option value="HIGH">Ưu tiên Cao</option>
                <option value="URGENT">GẤP</option>
              </select> */}



              {selectedTask.duration && (
                <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 flex items-center gap-1 shadow-sm">
                  <Clock size={12} /> {selectedTask.duration} PHÚT
                </span>
              )}

              {selectedTask.usedInMergeCount > 0 && (
                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300 flex items-center gap-1 shadow-sm animate-pulse">
                  <Layers size={12} /> Đã ghép ({selectedTask.usedInMergeCount} lần)
                </span>
              )}
            </div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 truncate max-w-[350px] md:max-w-[450px]">{selectedTask.title}</h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {(isManager || selectedTask.creatorId === sessionUserId) && (
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting || isLoading}
                className="px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Xóa
              </button>
            )}

            {isManager && (
              <button onClick={() => setRightTab(rightTab === 'chat' ? 'evaluate' : 'chat')} disabled={isLoading} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${rightTab === 'evaluate' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                <ClipboardCheck size={16} /> {rightTab === 'evaluate' ? "Quay lại Chat" : "Chấm điểm Video"}
              </button>
            )}
            <div className="w-[1px] h-6 bg-slate-200 mx-1 hidden sm:block"></div>
            {(isManager || selectedTask.creatorId === sessionUserId) && (
              <button onClick={onEditTask} disabled={isLoading} className="px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50">
                Sửa Task
              </button>
            )}
            {canReject && (
              <button onClick={onReject} disabled={isLoading} className="px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors disabled:opacity-50">
                Làm lại
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* NẾU ĐANG LOADING THÌ HIỂN THỊ KHỐI SKELETON */}
        {isLoading ? (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50 relative">
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px]">
              <Loader2 size={40} className="animate-spin text-blue-600 mb-3 drop-shadow-md" />
              <p className="text-sm font-black text-blue-600 uppercase tracking-widest animate-pulse">Đang tải chi tiết bài...</p>
            </div>

            {/* Cột trái Skeleton */}
            <div className="w-full lg:w-[55%] flex flex-col h-full border-r border-slate-200 bg-white p-4 md:p-6 space-y-6">
              <div className="h-24 w-full bg-slate-100/80 rounded-[24px] animate-pulse border border-slate-200"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-16 w-full bg-slate-100/80 rounded-2xl animate-pulse border border-slate-200"></div>
                <div className="h-16 w-full bg-slate-100/80 rounded-2xl animate-pulse border border-slate-200"></div>
              </div>
              <div className="h-64 w-full bg-slate-50 rounded-[24px] animate-pulse border border-slate-200 p-5">
                <div className="h-5 w-40 bg-slate-200 rounded-lg mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-14 bg-white border border-slate-200 rounded-xl"></div>
                  <div className="h-14 bg-white border border-slate-200 rounded-xl"></div>
                  <div className="h-14 bg-white border border-slate-200 rounded-xl"></div>
                  <div className="h-14 bg-white border border-slate-200 rounded-xl"></div>
                </div>
              </div>
            </div>

            {/* Cột phải Skeleton */}
            <div className="w-full lg:w-[45%] flex flex-col h-full bg-white">
              <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0 animate-pulse">
                <div className="h-5 w-5 bg-slate-200 rounded-full"></div>
                <div className="h-5 w-32 bg-slate-200 rounded-lg"></div>
              </div>
              <div className="flex-1 p-4 flex flex-col gap-6 bg-slate-50/50">
                <div className="flex flex-col items-start w-full animate-pulse">
                  <div className="h-3 w-24 bg-slate-200 rounded mb-1.5"></div>
                  <div className="h-12 w-3/4 max-w-[250px] bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm"></div>
                </div>
                <div className="flex flex-col items-end w-full animate-pulse mt-4">
                  <div className="h-3 w-24 bg-slate-200 rounded mb-1.5"></div>
                  <div className="h-12 w-3/4 max-w-[250px] bg-blue-100 rounded-2xl rounded-tr-sm shadow-sm"></div>
                </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="h-12 w-full bg-slate-50 border border-slate-200 rounded-2xl animate-pulse"></div>
              </div>
            </div>
          </div>
        ) : (
          /* NẾU ĐÃ LOAD XONG THÌ HIỂN THỊ NỘI DUNG THẬT */
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50">

            <div className="w-full lg:w-[55%] flex flex-col h-full border-r border-slate-200 bg-white">
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">

                {selectedTask.isCompilation ? (
                  <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-[24px] shadow-sm">
                    <label className="text-xs font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <Video size={16} /> Nguyên Liệu Video Ghép ({selectedTask.mergeCount || 0} files)
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
                  <div className="space-y-4">
                    {selectedTask.linkContent && (
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                          <LinkIcon size={14} /> Link Tham Khảo / Ý Tưởng
                        </label>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-sm text-blue-600 break-all hover:bg-blue-50 transition-colors">
                          <a href={selectedTask.linkContent} target="_blank" rel="noreferrer" className="hover:underline">{selectedTask.linkContent}</a>
                        </div>
                      </div>
                    )}
                    {selectedTask.keywords && (
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                          <Key size={14} /> Từ khóa / Keywords
                        </label>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-bold text-sm text-slate-700">
                          {selectedTask.keywords}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

                <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-5 space-y-4 shadow-inner">
                  <h3 className="font-black text-base text-slate-800 flex items-center gap-2 mb-2">
                    <CheckCircle2 className="text-emerald-500 w-5 h-5" /> Kết Quả Công Việc
                    <span className="text-xs font-medium text-slate-400 ml-auto">(Tự động lưu)</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleLinkFields.map((field, idx) => {
                      const isAssigned = selectedTask[field.idField] === sessionUserId;
                      const isCreator = selectedTask.creatorId === sessionUserId && field.key === 'scriptLink';
                      const isAllowed = isManager || isAssigned || isCreator;

                      return (
                        <div key={field.key} className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            {idx + 1}. {field.label}
                            {savingField === field.key && <Loader2 size={12} className="animate-spin text-blue-500" />}
                            {savedField === field.key && <CheckCircle2 size={12} className="text-emerald-500" />}
                          </label>
                          <input
                            type="url" disabled={!isAllowed}
                            placeholder={!isAllowed ? "Chỉ người phụ trách" : "Dán link..."}
                            className={`w-full border rounded-xl p-3 text-[13px] outline-none transition-all ${!isAllowed ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'} ${errors[field.key] ? 'border-red-500' : ''}`}
                            value={taskLinks[field.key as keyof typeof taskLinks] || ""}
                            onChange={e => setTaskLinks({ ...taskLinks, [field.key]: e.target.value })}
                            onBlur={(e) => handleAutoSave(field.key, e.target.value)}
                          />
                        </div>
                      );
                    })}

                    <div className="space-y-1.5 col-span-1 md:col-span-2 pt-2 border-t border-slate-200">
                      <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                        {visibleLinkFields.length + 1}. Link Video Đã Đăng (YT)
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
                            {/* Hiển thị hình ảnh nếu có */}
                            {msg.imageUrl && (
                              <img
                                src={msg.imageUrl}
                                alt="Đính kèm"
                                // 🚀 BỔ SUNG: Giới hạn chiều rộng và chiều cao tối đa, bo góc xịn xò
                                className="max-w-[200px] sm:max-w-[250px] max-h-[250px] object-cover rounded-xl mb-2 border border-slate-200 shadow-sm hover:opacity-90 cursor-pointer"
                                // Tùy chọn: Thêm onclick để mở ảnh to nếu sếp muốn
                                onClick={() => window.open(msg.imageUrl, '_blank')}
                              />
                            )}
                            {/* Hiển thị văn bản tin nhắn */}
                            {msg.text && <div>{msg.text}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 shrink-0 flex flex-col gap-2">
                    {/* Khu vực hiển thị xem trước hình ảnh (Preview) */}
                    {chatImagePreview && (
                      <div className="relative inline-block w-fit mt-1 ml-1 mb-2">
                        <img
                          src={chatImagePreview}
                          alt="Xem trước"
                          // Ép kích thước ảnh thành hình vuông nhỏ (w-16 h-16) và cắt gọn (object-cover)
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

                    {/* Khung nhập nội dung */}
                    <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                      {/* Nút đính kèm ảnh (ẩn thẻ input) */}
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