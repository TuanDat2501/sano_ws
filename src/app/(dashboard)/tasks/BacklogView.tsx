"use client";

import { Plus, Link as LinkIcon, Send, Trash2, FileText, PlayCircle, Lightbulb, Tv, Loader2, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useToast } from "@/app/component/ToastProvider";

// ========================================================
// COMPONENT Ô NHẬP LIỆU TỰ ĐỘNG LƯU (INLINE EDIT)
// ========================================================
const EditableCell = ({ task, fieldKey, type = "text", width = "min-w-[150px]", customClass = "" }: any) => {
    const [value, setValue] = useState(task[fieldKey] || "");
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        setValue(task[fieldKey] || "");
    }, [task[fieldKey]]);

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
                    className={`w-full h-full min-h-[46px] bg-transparent outline-none px-3 py-2.5 text-xs font-medium resize-none leading-relaxed transition-colors focus:bg-blue-50/50 hover:bg-slate-50/50 ${customClass}`}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={handleBlur}
                />
            ) : (
                <div className="flex items-center w-full h-full min-h-[46px] relative">
                    <input 
                        type={type}
                        className={`w-full h-full min-h-[46px] bg-transparent outline-none px-3 py-2 text-xs font-medium transition-colors focus:bg-blue-50/50 hover:bg-slate-50/50 ${isUrl ? 'pr-8' : ''} ${linkStyle} ${customClass}`}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onBlur={handleBlur}
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
// COMPONENT CHỌN KÊNH TỰ ĐỘNG LƯU
// ========================================================
const EditableChannelCell = ({ task, channels }: any) => {
    const [channelId, setChannelId] = useState(task.channelId || "");
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => { setChannelId(task.channelId || ""); }, [task.channelId]);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newChannelId = e.target.value;
        setChannelId(newChannelId);
        setIsSaving(true);
        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId: newChannelId || null })
            });
            if (!res.ok) throw new Error();
            showToast("success", "Đã cập nhật Kênh!");
        } catch (error) {
            showToast("error", "Lỗi cập nhật!");
            setChannelId(task.channelId || "");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <td className="border border-slate-200 p-1.5 relative min-w-[140px] bg-inherit align-middle">
            <select 
                className="w-full h-full min-h-[34px] rounded-lg outline-none px-2 text-[10px] font-bold text-slate-700 cursor-pointer appearance-none text-center shadow-sm border border-slate-200 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500/30 bg-transparent"
                value={channelId}
                onChange={handleChange}
            >
                <option value="">-- Chưa gán kênh --</option>
                {channels?.map((c: any) => (
                    <option key={c.id} value={c.id} className="text-left font-semibold text-slate-800">{c.name}</option>
                ))}
            </select>
            {isSaving && <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-white rounded-full p-0.5 shadow-sm border border-slate-100 z-10"><Loader2 size={12} className="text-blue-500 animate-spin" /></div>}
        </td>
    );
};


export default function BacklogView({ backlogTasks, channels, onQuickAdd, onPushToBoard, onDelete }: any) {
    const [quickTitle, setQuickTitle] = useState("");
    const [quickLink, setQuickLink] = useState("");
    const [quickChannelId, setQuickChannelId] = useState("");
    const { data: session } = useSession();
    
    const handleQuickAdd = (e: React.FormEvent | React.KeyboardEvent) => {
        if ('preventDefault' in e) e.preventDefault();
        if (!quickTitle.trim()) return;
        
        onQuickAdd({ 
            teamId: session?.user.teamId, 
            title: quickTitle, 
            linkContent: quickLink, 
            status: "BACKLOG",
            channelId: quickChannelId || undefined 
        });
        
        setQuickTitle("");
        setQuickLink("");
        setQuickChannelId("");
    };

    return (
        <div className="bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-fade-in">
            <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar">
                <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-max">
                    <thead className="bg-slate-100 text-[10px] uppercase font-black text-slate-500 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                        <tr>
                            <th className="border border-slate-200 p-2 text-center sticky left-0 bg-slate-200 z-40 w-[40px] shadow-[1px_0_0_0_#e2e8f0]">STT</th>
                            <th className="border border-slate-200 p-2 sticky left-[40px] bg-slate-200 z-40 w-[280px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">Từ khóa / Tên Video (Key)</th>
                            
                            <th className="border border-slate-200 p-2 min-w-[160px] text-center">Kênh</th>
                            <th className="border border-slate-200 p-2 min-w-[250px]">Link Tham Khảo</th>
                            <th className="border border-slate-200 p-2 min-w-[140px] text-center">Tiến độ (Tự động)</th>
                            
                            <th className="border border-slate-200 p-2 text-center sticky right-0 bg-slate-200 z-40 w-[120px] shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        
                        {/* =======================================================
                            DANH SÁCH Ý TƯỞNG ĐÃ LƯU
                        ======================================================== */}
                        {backlogTasks.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic font-medium border-b border-slate-200">Kho ý tưởng đang trống. Bắt đầu nhập ở dòng dưới!</td></tr>
                        ) : (
                            backlogTasks.map((task: any, index: number) => {
                                let statusBadge = (
                                    <span className="inline-flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-black border border-slate-200 shadow-sm w-[110px]">
                                        <Lightbulb size={12}/> Ý TƯỞNG THÔ
                                    </span>
                                );

                                if (task.videoLink) {
                                    statusBadge = (
                                        <span className="inline-flex items-center justify-center gap-1.5 bg-purple-100 text-purple-700 px-2 py-1 rounded text-[9px] font-black border border-purple-200 shadow-sm w-[110px]">
                                            <PlayCircle size={12}/> ĐÃ DỰNG XONG
                                        </span>
                                    );
                                } else if (task.scriptLink) {
                                    statusBadge = (
                                        <span className="inline-flex items-center justify-center gap-1.5 bg-amber-100 text-amber-700 px-2 py-1 rounded text-[9px] font-black border border-amber-200 shadow-sm w-[110px]">
                                            <FileText size={12}/> ĐÃ CÓ KỊCH BẢN
                                        </span>
                                    );
                                }

                                return (
                                    <tr key={task.id} className="transition-colors group odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/30">
                                        
                                        <td className="border border-slate-200 p-2 text-center font-bold text-slate-400 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] transition-colors bg-inherit align-middle">
                                            {index + 1}
                                        </td>
                                        
                                        <td className="border border-slate-200 p-0 sticky left-[40px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors bg-inherit align-top">
                                            <EditableCell task={task} fieldKey="title" type="textarea" width="w-full min-w-[280px]" customClass="font-bold text-slate-900 text-[13px]" />
                                        </td>
                                        
                                        <EditableChannelCell task={task} channels={channels} />
                                        
                                        <EditableCell task={task} fieldKey="linkContent" type="url" width="min-w-[250px]" />
                                        
                                        <td className="border border-slate-200 p-2 text-center align-middle bg-inherit">
                                            {statusBadge}
                                        </td>

                                        <td className="border border-slate-200 p-2 text-center sticky right-0 z-20 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)] transition-colors bg-inherit align-middle">
                                            <div className="flex flex-col xl:flex-row items-center justify-center gap-1.5 opacity-40 xl:opacity-100 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => onPushToBoard(task)} 
                                                    className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-greeb-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                                                    // className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all shadow-sm flex-1"
                                                >
                                                    <Send size={16}/>
                                                </button>

                                                <button 
                                                    onClick={() => onDelete(task.id)} 
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" 
                                                    title="Xóa bỏ"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}

                        {/* =======================================================
                            HÀNG NHẬP LIỆU NHANH (QUICK ADD) - NẰM DƯỚI CÙNG GIỐNG EXCEL
                        ======================================================== */}
                        <tr className="transition-colors group odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/30">
                            <td className="border border-slate-200 p-2 text-center font-bold text-slate-300 sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] bg-inherit align-middle">
                                {backlogTasks.length + 1}
                            </td>
                            
                            <td className="border border-slate-200 p-0 sticky left-[40px] z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] bg-inherit align-top">
                                <textarea 
                                    className="w-full h-full min-h-[46px] bg-transparent outline-none px-3 py-2.5 text-[13px] font-medium text-slate-900 resize-none focus:bg-blue-50/50 hover:bg-slate-50/50 transition-colors" 
                                    value={quickTitle} 
                                    onChange={e => setQuickTitle(e.target.value)} 
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleQuickAdd(e);
                                        }
                                    }}
                                />
                            </td>
                            
                            <td className="border border-slate-200 p-1.5 align-middle bg-inherit">
                                <select 
                                    className="w-full h-full min-h-[34px] rounded-lg outline-none px-2 text-[10px] font-bold text-slate-600 bg-transparent cursor-pointer hover:bg-slate-50/50 focus:bg-blue-50/50 transition-all text-center"
                                    value={quickChannelId} 
                                    onChange={e => setQuickChannelId(e.target.value)}
                                >
                                    <option value="">-- Kênh --</option>
                                    {channels?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </td>

                            <td className="border border-slate-200 p-0 align-top relative bg-inherit">
                                <input 
                                    type="url" 
                                    className="w-full h-full min-h-[46px] bg-transparent outline-none px-3 py-2 text-xs font-medium text-slate-700 focus:bg-blue-50/50 hover:bg-slate-50/50 transition-colors" 
                                    value={quickLink} 
                                    onChange={e => setQuickLink(e.target.value)} 
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleQuickAdd(e);
                                    }}
                                />
                            </td>

                            <td className="border border-slate-200 p-2 text-center align-middle bg-inherit">
                                {quickTitle.trim() && (
                                    <span className="inline-flex items-center justify-center gap-1.5 bg-slate-50 text-slate-400 px-2 py-1 rounded text-[9px] font-black border border-slate-200 shadow-sm w-[110px]">
                                        <Lightbulb size={12}/> CHỜ LƯU...
                                    </span>
                                )}
                            </td>

                            <td className="border border-slate-200 p-2 text-center sticky right-0 z-20 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.05)] bg-inherit align-middle">
                                {quickTitle.trim() && (
                                    <button 
                                        onClick={handleQuickAdd} 
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs w-full shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Send size={12}/> Lưu
                                    </button>
                                )}
                            </td>
                        </tr>

                    </tbody>
                </table>
            </div>
        </div>
    );
}