"use client";

import { useState, useEffect } from "react";
import Pagination from "../Pagination";
import { Loader2, ExternalLink, Lock, Unlock } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

interface ListViewProps {
  filteredTasks: any[];
  columns: any;
  onOpenTaskDetail: (task: any) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// HÀM HIỂN THỊ AVATAR NHÂN SỰ
const renderStackedAvatars = (roleTitle: string, mainUser: any, coUsers: any[], colorClass: string, bgClass: string) => {
  const allUsers = [...(mainUser ? [mainUser] : []), ...(coUsers || [])];
  if (allUsers.length === 0) return null;

  const maxVisible = 2;
  const visibleUsers = allUsers.slice(0, maxVisible);
  const hiddenCount = allUsers.length - maxVisible;

  return (
      <div className="relative group cursor-pointer flex items-center shrink-0" title={`${roleTitle}: ${allUsers.map(u => u.fullName).join(', ')}`}>
          <div className="flex -space-x-1.5">
              {visibleUsers.map((u, idx) => (
                  <div key={idx} className="relative" style={{ zIndex: 10 - idx }}>
                      {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.fullName} className={`h-6 w-6 rounded-full object-cover border border-white shadow-sm ${bgClass} ${colorClass}`} />
                      ) : (
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center font-black text-[9px] border border-white shadow-sm ${bgClass} ${colorClass}`}>
                              {u.fullName?.charAt(0) || "?"}
                          </div>
                      )}
                  </div>
              ))}
              {hiddenCount > 0 && (
                  <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px] border border-white shadow-sm z-[1]">
                      +{hiddenCount}
                  </div>
              )}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-white flex items-center justify-center text-[6px] font-black text-white shadow-sm z-20 ${colorClass.replace('text-', 'bg-')}`}>
             {roleTitle.charAt(0)}
          </div>
      </div>
  );
};

// ========================================================
// COMPONENT Ô NHẬP LIỆU TỰ ĐỘNG LƯU (INLINE EDIT)
// ========================================================
const EditableCell = ({ task, fieldKey, type = "text", width = "min-w-[150px]", customClass = "" }: any) => {
    const [value, setValue] = useState(task[fieldKey] || "");
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => { setValue(task[fieldKey] || ""); }, [task[fieldKey]]);

    const handleBlur = async () => {
        const stringVal = String(value).trim();
        const oldVal = String(task[fieldKey] || "").trim();
        if (stringVal === oldVal) return;

        setIsSaving(true);
        try {
            const payloadValue = type === "number" ? (stringVal === "" ? null : Number(stringVal)) : stringVal;
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [fieldKey]: payloadValue })
            });

            if (!res.ok) throw new Error();
            showToast("success", "Đã lưu!");
        } catch (error) {
            showToast("error", "Lỗi lưu dữ liệu!");
            setValue(task[fieldKey] || ""); 
        } finally {
            setIsSaving(false);
        }
    };

    const isUrl = type === "url";
    const hasValue = String(value).trim() !== "";
    const linkStyle = (isUrl && hasValue) ? "text-blue-600 hover:text-blue-700 underline underline-offset-2" : "text-slate-700";

    return (
        <td className={`border border-slate-200 p-0 relative ${width} bg-inherit group/cell align-top`}>
            {type === "textarea" ? (
                <textarea 
                    className={`w-full h-full min-h-[46px] bg-transparent outline-none px-3 py-2.5 text-xs font-medium resize-none leading-relaxed transition-colors ${task.isClosed ? 'pointer-events-none text-slate-500' : 'focus:bg-blue-50/50 hover:bg-slate-50/50'} ${customClass}`}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={handleBlur}
                    readOnly={task.isClosed}
                />
            ) : (
                <div className="flex items-center w-full h-full min-h-[46px] relative">
                    <input 
                        type={type}
                        className={`w-full h-full min-h-[46px] bg-transparent outline-none px-3 py-2 text-xs font-medium transition-colors ${task.isClosed ? 'pointer-events-none text-slate-500' : 'focus:bg-blue-50/50 hover:bg-slate-50/50'} ${isUrl ? 'pr-8' : ''} ${linkStyle} ${customClass}`}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onBlur={handleBlur}
                        readOnly={task.isClosed}
                    />
                    {isUrl && hasValue && (
                        <a href={value} target="_blank" rel="noreferrer" className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-700 transition-colors p-1 bg-white rounded shadow-sm border border-slate-100 opacity-60 hover:opacity-100">
                            <ExternalLink size={12} />
                        </a>
                    )}
                </div>
            )}
            {isSaving && <div className="absolute right-1 top-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100 z-10"><Loader2 size={12} className="text-blue-500 animate-spin" /></div>}
        </td>
    );
};

// ========================================================
// COMPONENT Ô TRẠNG THÁI (STATUS) TỰ ĐỘNG LƯU
// ========================================================
const EditableStatusCell = ({ task, columns }: any) => {
    const [status, setStatus] = useState(task.status);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => { setStatus(task.status); }, [task.status]);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        setStatus(newStatus);
        setIsSaving(true);
        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error();
            showToast("success", "Đã cập nhật trạng thái!");
        } catch (error) {
            showToast("error", "Lỗi cập nhật!");
            setStatus(task.status);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <select 
            className={`w-full h-full min-h-[34px] rounded-lg outline-none px-2 text-[10px] font-black uppercase tracking-widest cursor-pointer appearance-none text-center shadow-sm border transition-all ${columns[status]?.iconBg} ${columns[status]?.color} ${columns[status]?.borderColor} hover:brightness-95 focus:ring-2 focus:ring-blue-500/30`}
            value={status}
            onChange={handleChange}
        >
            {Object.values(columns).map((col: any) => (
                <option key={col.id} value={col.id} className="text-slate-800 font-bold uppercase bg-white">{col.title}</option>
            ))}
        </select>
    );
};

// ========================================================
// ROW COMPONENT (Chứa Local State để Toggle Mở Khóa Mượt Mà)
// ========================================================
const TaskRow = ({ initialTask, index, currentPage, itemsPerPage, columns, onOpenTaskDetail }: any) => {
    const [task, setTask] = useState(initialTask);
    const [isClosed, setIsClosed] = useState(initialTask.isClosed);
    const [isToggling, setIsToggling] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        setTask(initialTask);
        setIsClosed(initialTask.isClosed);
    }, [initialTask]);

    const handleToggleClose = async () => {
        setIsToggling(true);
        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isClosed: !isClosed })
            });
            if (res.ok) {
                setIsClosed(!isClosed);
                setTask({ ...task, isClosed: !isClosed });
                showToast("success", !isClosed ? "Đã đóng Task!" : "Đã mở lại Task thành công!");
            } else {
                showToast("error", "Lỗi thao tác!");
            }
        } catch (error) {
            showToast("error", "Lỗi máy chủ!");
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <tr className={`transition-colors group odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/30 ${isClosed ? 'opacity-60 bg-slate-100/50' : ''}`}>
            {/* CỘT STICKY STT */}
            <td className={`border border-slate-200 p-2 text-center font-bold text-slate-400 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] transition-colors bg-inherit align-middle`}>
                {index + 1 + (currentPage - 1) * itemsPerPage}
            </td>
            
            {/* CỘT STICKY TIÊU ĐỀ */}
            <td className={`border border-slate-200 p-0 sticky left-[40px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors bg-inherit align-top`}>
                <EditableCell task={task} fieldKey="title" type="textarea" width="w-full min-w-[280px]" customClass="font-bold text-slate-900 text-[13px]" />
            </td>

            {/* 🚀 UX MA THUẬT: CỘT TRẠNG THÁI / MỞ KHÓA NHANH */}
            <td className="border border-slate-200 p-1.5 relative min-w-[140px] bg-inherit align-middle">
                {isClosed ? (
                    <button
                        onClick={handleToggleClose}
                        disabled={isToggling}
                        className="w-full h-full min-h-[34px] rounded-lg border border-slate-300 bg-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-1.5 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-300 transition-all group/unlock shadow-sm"
                        title="Bấm để mở lại Task"
                    >
                        {isToggling ? <Loader2 size={14} className="animate-spin" /> : (
                            <>
                                <Lock size={12} className="group-hover/unlock:hidden" />
                                <Unlock size={12} className="hidden group-hover/unlock:block" />
                                <span className="group-hover/unlock:hidden">Đã Đóng</span>
                                <span className="hidden group-hover/unlock:block">Mở Lại</span>
                            </>
                        )}
                    </button>
                ) : (
                    <EditableStatusCell task={task} columns={columns} />
                )}
            </td>

            {/* CÁC CỘT INLINE EDIT */}
            <EditableCell task={task} fieldKey="duration" type="number" width="min-w-[80px]" customClass="text-center font-black text-amber-600 bg-amber-50/30" />
            <EditableCell task={task} fieldKey="linkContent" type="url" width="min-w-[200px]" />
            <EditableCell task={task} fieldKey="scriptLink" type="url" width="min-w-[200px]" />
            <EditableCell task={task} fieldKey="audioLink" type="url" width="min-w-[200px]" />
            <EditableCell task={task} fieldKey="storyboardLink" type="url" width="min-w-[200px]" />
            <EditableCell task={task} fieldKey="thumbnailLink" type="url" width="min-w-[200px]" />
            <EditableCell task={task} fieldKey="videoLink" type="url" width="min-w-[200px]" />
            <EditableCell task={task} fieldKey="publishLink" type="url" width="min-w-[200px]" />
            
            {/* INFO CỘT (Read-only) */}
            <td className="border border-slate-200 p-2 bg-inherit align-middle text-center">
                <span className="inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-widest font-black text-[9px] shadow-sm">
                    {task.team?.name || '---'}
                </span>
            </td>
            <td className="border border-slate-200 p-2 bg-inherit align-middle">
                <span className="inline-block px-2.5 py-1 rounded bg-slate-50 text-slate-700 border border-slate-200 font-bold text-[10px] truncate max-w-[130px] shadow-sm" title={task.channel?.name}>
                    {task.channel?.name || '---'}
                </span>
            </td>
            <td className="border border-slate-200 p-2 bg-inherit align-middle">
              <div className="flex flex-wrap items-center gap-2">
                  {renderStackedAvatars("Content", task.contentUser, task.coContentUsers, "text-orange-600", "bg-orange-100")}
                  {renderStackedAvatars("Editor", task.editorUser, task.coEditorUsers, "text-blue-600", "bg-blue-100")}
                  {renderStackedAvatars("Animator", task.animatorUser, task.coAnimatorUsers, "text-purple-600", "bg-purple-100")}
              </div>
            </td>

            {/* NÚT CHI TIẾT STICKY BÊN PHẢI */}
            <td className={`border border-slate-200 p-2 text-center sticky right-0 z-20 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors bg-inherit align-middle`}>
              <button 
                  onClick={() => onOpenTaskDetail(task)} 
                  className="text-[10px] bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg transition-colors active:scale-95 whitespace-nowrap shadow-md border border-slate-700"
              >
                  Mở Log
              </button>
            </td>
        </tr>
    );
};

export default function ListView({ filteredTasks, columns, onOpenTaskDetail, currentPage, setCurrentPage, totalPages, totalItems, itemsPerPage }: ListViewProps) {
  return (
    <div className="bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-fade-in">
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar">
        <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-max">
          <thead className="bg-slate-100 text-[10px] uppercase font-black text-slate-500 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <tr>
              <th className="border border-slate-200 p-2 text-center sticky left-0 bg-slate-200 z-40 w-[40px] shadow-[1px_0_0_0_#e2e8f0]">STT</th>
              <th className="border border-slate-200 p-2 sticky left-[40px] bg-slate-200 z-40 w-[280px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Tên Video / Task</th>
              
              <th className="border border-slate-200 p-2 min-w-[140px] text-center">Trạng thái</th>
              <th className="border border-slate-200 p-2 min-w-[80px] text-center">Phút</th>
              <th className="border border-slate-200 p-2 min-w-[200px]">Link Tham Khảo</th>
              <th className="border border-slate-200 p-2 min-w-[200px]">Kịch Bản</th>
              <th className="border border-slate-200 p-2 min-w-[200px]">Link Audio</th>
              <th className="border border-slate-200 p-2 min-w-[200px]">Bố Cục</th>
              <th className="border border-slate-200 p-2 min-w-[200px]">Thumbnail</th>
              <th className="border border-slate-200 p-2 min-w-[200px]">Video Render</th>
              <th className="border border-slate-200 p-2 min-w-[200px]">Link Đăng (YT)</th>
              
              <th className="border border-slate-200 p-2 min-w-[120px] text-center">Team</th>
              <th className="border border-slate-200 p-2 min-w-[140px]">Kênh</th>
              <th className="border border-slate-200 p-2 min-w-[150px]">Nhân sự (C / E / A)</th>
              
              <th className="border border-slate-200 p-2 text-center sticky right-0 bg-slate-200 z-40 w-[80px] shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">Chi tiết</th>
            </tr>
          </thead>
          
          <tbody className="bg-white">
            {filteredTasks.length === 0 ? (
              <tr><td colSpan={15} className="p-8 text-center text-slate-400 font-medium italic">Không tìm thấy task nào phù hợp.</td></tr>
            ) : (
              filteredTasks.map((task, index) => (
                <TaskRow 
                    key={task.id} 
                    initialTask={task} 
                    index={index} 
                    currentPage={currentPage} 
                    itemsPerPage={itemsPerPage} 
                    columns={columns} 
                    onOpenTaskDetail={onOpenTaskDetail} 
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        itemName="task"
      />
    </div>
  );
}