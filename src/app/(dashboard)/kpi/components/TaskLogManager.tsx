"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Trash2, Search, Database, Users, Edit, Target, Tv, Clock, RefreshCw, ChevronRight, CheckCircle } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import TaskManageDrawer from "./TaskManageDrawer";
import TaskDetailDrawer from "@/app/component/TaskDetailDrawer";


export default function TaskLogManager({ teams }: { teams: any[] }) {
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'TASKS' | 'LOGS'>('TASKS');

    // States cho Tab Tasks & Bộ lọc
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [taskSearchTerm, setTaskSearchTerm] = useState("");
    const [channels, setChannels] = useState<any[]>([]);
    const [filterChannel, setFilterChannel] = useState("ALL");
    const [filterStatus, setFilterStatus] = useState("ALL");

    // States cho Tab Logs
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [teamUsers, setTeamUsers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // 🚀 ĐIỀU KHIỂN DRAWER QUẢN LÝ (SỬA THÔNG SỐ / GÁN KPI)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState<'EDIT_TASK' | 'ASSIGN_KPI'>('EDIT_TASK');
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);

    // 🚀 ĐIỀU KHIỂN DRAWER XEM CHI TIẾT & CHAT
    const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [selectedTaskDetail, setSelectedTaskDetail] = useState<any>(null);
    const [taskLinks, setTaskLinks] = useState<any>({});
    const [messages, setMessages] = useState<any[]>([]);
    const [chatMessage, setChatMessage] = useState("");

    useEffect(() => {
        // Lấy danh sách kênh cho bộ lọc
        fetch(`/api/kpi/manage-task?getChannels=true`)
            .then(res => res.json())
            .then(data => setChannels(Array.isArray(data) ? data : []));
    }, []);

    const fetchTasks = async () => {
        setIsLoadingTasks(true);
        try {
            const url = `/api/kpi/manage-task?list=true&search=${encodeURIComponent(taskSearchTerm)}&channelId=${filterChannel}&status=${filterStatus}`;
            const res = await fetch(url);
            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch (e) {
            showToast("error", "Lỗi tải danh sách Task");
        } finally {
            setIsLoadingTasks(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'TASKS') {
            const timer = setTimeout(() => { fetchTasks(); }, 500);
            return () => clearTimeout(timer);
        }
    }, [activeTab, taskSearchTerm, filterChannel, filterStatus]);

    useEffect(() => {
        if (!selectedTeamId) { setTeamUsers([]); setSelectedUserId(""); return; }
        setIsLoadingUsers(true);
        fetch(`/api/users?teamId=${selectedTeamId}`)
            .then(res => res.json())
            .then(data => setTeamUsers(Array.isArray(data.users) ? data.users : []))
            .catch(() => showToast("error", "Lỗi tải nhân sự"))
            .finally(() => setIsLoadingUsers(false));
    }, [selectedTeamId]);

    const fetchLogs = async () => {
        if (!selectedUserId) { setLogs([]); return; }
        setIsLoadingLogs(true);
        try {
            const res = await fetch(`/api/task-logs?userId=${selectedUserId}`);
            if (res.ok) setLogs(await res.json());
        } catch (e) { showToast("error", "Lỗi tải log"); } 
        finally { setIsLoadingLogs(false); }
    };

    useEffect(() => {
        if (activeTab === 'LOGS') fetchLogs();
    }, [selectedUserId, activeTab]);

    const handleDeleteLog = async (logId: string) => {
        if (!confirm("XÓA VĨNH VIỄN log này? Có thể làm giảm điểm KPI của nhân sự.")) return;
        try {
            const res = await fetch(`/api/task-logs`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: logId, type: "DELETE" })
            });
            if (res.ok) {
                showToast("success", "Đã xóa log thành công.");
                fetchLogs();
            } else { showToast("error", "Lỗi khi xóa log"); }
        } catch (e) { showToast("error", "Lỗi Server"); }
    };

    // Mở Task Detail Drawer
    const handleOpenTaskDetail = async (taskId: string) => {
        if (!taskId) return;
        setIsDetailDrawerOpen(true);
        setIsLoadingDetail(true);
        
        try {
            const [taskRes, commentsRes] = await Promise.all([
                fetch(`/api/tasks/${taskId}`),
                fetch(`/api/tasks/${taskId}/comments`)
            ]);
            
            const taskData = await taskRes.json();
            const commentsData = commentsRes.ok ? await commentsRes.json() : [];

            const taskDetail = taskData.task || taskData;
            setSelectedTaskDetail(taskDetail);
            
            setTaskLinks({
                scriptLink: taskDetail?.scriptLink || "",
                audioLink: taskDetail?.audioLink || "",
                storyboardLink: taskDetail?.storyboardLink || "",
                animationLink: taskDetail?.animationLink || "",
                thumbnailLink: taskDetail?.thumbnailLink || "",
                videoLink: taskDetail?.videoLink || "",
                publishLink: taskDetail?.publishLink || "",
                linkProject: taskDetail?.linkProject || "",
                roughProjectLink: taskDetail?.roughProjectLink || "",
                note: taskDetail?.note || ""
            });

            setMessages(commentsData.map((c: any) => ({
                id: c.id,
                sender: c.user?.fullName || "Người ẩn danh",
                senderId: c.user?.id || "",
                text: c.text,
                imageUrl: c.imageUrl,
                time: new Date(c.createdAt).toLocaleString('vi-VN')
            })));
        } catch (e) {
            showToast("error", "Không thể tải chi tiết Task.");
        } finally {
            setIsLoadingDetail(false);
        }
    };

    const handleSendMessage = async (imageUrl?: string) => {
        if (!selectedTaskDetail) return;
        try {
            const res = await fetch(`/api/tasks/${selectedTaskDetail.id}/comments`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: chatMessage, imageUrl })
            });
            if (res.ok) {
                const newComment = await res.json();
                setMessages(prev => [...prev, {
                    id: newComment.id,
                    sender: currentUser?.fullName || "Tôi",
                    senderId: currentUser?.id,
                    text: newComment.text,
                    imageUrl: newComment.imageUrl,
                    time: new Date(newComment.createdAt).toLocaleString('vi-VN')
                }]);
                setChatMessage("");
            }
        } catch (e) { showToast("error", "Lỗi gửi tin nhắn"); }
    };

    const handleToggleCloseTask = async () => {
        if (!selectedTaskDetail) return;
        try {
            const newStatus = !selectedTaskDetail.isClosed;
            const res = await fetch(`/api/tasks/${selectedTaskDetail.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isClosed: newStatus })
            });
            if (res.ok) {
                setSelectedTaskDetail({ ...selectedTaskDetail, isClosed: newStatus });
                showToast("success", newStatus ? "Đã nghiệm thu Task!" : "Đã mở lại Task!");
                fetchTasks(); // Reload list ngoài
            }
        } catch (e) { showToast("error", "Lỗi Server"); }
    };

    const handleRejectTask = async (reason: string, priority: string) => {
        if (!selectedTaskDetail) return;
        try {
            await fetch(`/api/tasks/${selectedTaskDetail.id}/comments`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: `[YÊU CẦU SỬA LẠI]: ${reason}` })
            });
            await fetch(`/api/tasks/${selectedTaskDetail.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priority, isRework: true, status: "TODO" })
            });
            showToast("success", "Đã gửi yêu cầu sửa lại!");
            setIsDetailDrawerOpen(false);
            fetchTasks();
        } catch (e) { showToast("error", "Lỗi Server"); }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-fade-in relative">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4 shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2">
                            <Database className="text-rose-500 w-5 h-5" /> Quản lý Dữ liệu Thô (Log) & Task
                        </h2>
                        <p className="text-[10px] md:text-xs font-medium text-slate-500 mt-1">
                            Xem chi tiết Task, Gán KPI thủ công cho nhân sự, hoặc Dọn dẹp Log rác.
                        </p>
                    </div>
                    <button onClick={() => { setSelectedTaskId(undefined); setDrawerMode('ASSIGN_KPI'); setIsDrawerOpen(true); }} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm">
                        <Target size={14} /> Gán Tự Do
                    </button>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveTab('TASKS')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'TASKS' ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        Danh sách Video/Task
                    </button>
                    <button 
                        onClick={() => setActiveTab('LOGS')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'LOGS' ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        Xóa Log rác (Cá nhân)
                    </button>
                </div>

                {activeTab === 'TASKS' ? (
                    <div className="flex flex-wrap items-center gap-2 w-full">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Tìm kiếm Video/Task..."
                                className="w-full border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs md:text-sm font-semibold outline-none focus:border-rose-500 bg-white"
                                value={taskSearchTerm}
                                onChange={(e) => setTaskSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="bg-white border border-slate-200 text-xs md:text-sm font-bold text-slate-800 rounded-lg px-3 py-2 outline-none focus:border-rose-500 w-[140px] cursor-pointer"
                            value={filterChannel}
                            onChange={(e) => setFilterChannel(e.target.value)}
                        >
                            <option value="ALL">Tất cả Kênh</option>
                            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select 
                            className="bg-white border border-slate-200 text-xs md:text-sm font-bold text-slate-800 rounded-lg px-3 py-2 outline-none focus:border-rose-500 w-[140px] cursor-pointer"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">Mọi trạng thái</option>
                            <option value="TODO">Đang làm</option>
                            <option value="DONE">Hoàn thành</option>
                        </select>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto">
                        <select 
                            className="bg-white border border-slate-200 text-xs md:text-sm font-bold text-slate-800 rounded-xl px-3 py-2 outline-none focus:border-rose-500 w-full sm:w-40 cursor-pointer"
                            value={selectedTeamId}
                            onChange={e => setSelectedTeamId(e.target.value)}
                        >
                            <option value="">-- Chọn Team --</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        <select 
                            className="bg-white border border-slate-200 text-xs md:text-sm font-bold text-slate-800 rounded-xl px-3 py-2 outline-none focus:border-rose-500 w-full sm:w-48 disabled:opacity-50 cursor-pointer"
                            value={selectedUserId}
                            onChange={e => setSelectedUserId(e.target.value)}
                            disabled={!selectedTeamId || isLoadingUsers}
                        >
                            <option value="">{isLoadingUsers ? "Đang tải..." : "-- Chọn Nhân sự --"}</option>
                            {teamUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {activeTab === 'TASKS' && (
                <div className="flex-1 overflow-auto custom-scrollbar p-3 md:p-5 relative">
                    {isLoadingTasks ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-rose-500" /></div>
                    ) : (
                        <table className="w-full text-left text-xs md:text-sm text-slate-600 min-w-[800px]">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] md:text-[11px] sticky top-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-xl border-b border-slate-200 w-52 md:w-64">Tên Video / Task (Bấm để xem)</th>
                                    <th className="px-4 py-3 border-b border-slate-200 w-40">Kênh Đăng</th>
                                    <th className="px-4 py-3 border-b border-slate-200 text-center w-28">Thông số</th>
                                    <th className="px-4 py-3 border-b border-slate-200 w-32 text-center">Trạng thái</th>
                                    <th className="px-4 py-3 text-center rounded-tr-xl border-b border-slate-200 w-40">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tasks.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-slate-400 font-medium">Không tìm thấy Video/Task nào.</td></tr>
                                ) : (
                                    tasks.map((task) => (
                                        <tr key={task.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-4 py-3 cursor-pointer" onClick={() => handleOpenTaskDetail(task.id)}>
                                                <p className="font-bold text-slate-800 text-xs md:text-sm line-clamp-2 group-hover:text-blue-600 transition-colors" title={task.title}>{task.title}</p>
                                                <span className="text-[9px] font-bold text-slate-400 mt-1 inline-block">Mở chi tiết <ChevronRight size={10} className="inline" /></span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {task.channel?.name ? (
                                                    <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200 text-[10px] md:text-[11px] font-bold">
                                                        <Tv size={12} className="text-slate-400" /> {task.channel.name}
                                                    </span>
                                                ) : <span className="text-slate-300 italic text-[11px]">Chưa gắn kênh</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    {task.duration ? (
                                                        <span className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                                                            <Clock size={10} className="text-amber-500" /> {task.duration} Phút
                                                        </span>
                                                    ) : <span className="text-slate-300 italic text-[10px]">- Thiếu phút -</span>}
                                                    
                                                    {task.isRework && (
                                                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase flex items-center gap-1 w-fit">
                                                            <RefreshCw size={10} /> Xào lại
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {task.isClosed ? (
                                                    <span className="bg-slate-200 text-slate-500 px-2 py-1 rounded text-[10px] font-black">ĐÃ ĐÓNG</span>
                                                ) : task.status === 'DONE' ? (
                                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-black">HOÀN THÀNH</span>
                                                ) : (
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-black">ĐANG LÀM</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => { setSelectedTaskId(task.id); setDrawerMode('ASSIGN_KPI'); setIsDrawerOpen(true); }}
                                                        className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-colors font-bold text-[10px] md:text-xs flex items-center gap-1.5 border border-emerald-100"
                                                    >
                                                        <Target size={14} /> Gán KPI
                                                    </button>
                                                    <button 
                                                        onClick={() => { setSelectedTaskId(task.id); setDrawerMode('EDIT_TASK'); setIsDrawerOpen(true); }}
                                                        className="p-1.5 bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors border border-blue-100"
                                                        title="Sửa thông số Task"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'LOGS' && (
                <div className="flex-1 overflow-auto custom-scrollbar p-3 md:p-5 relative">
                    {!selectedUserId ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                            <Users size={40} className="text-slate-200 mb-3 md:mb-4" />
                            <p className="text-xs md:text-sm font-medium">Vui lòng chọn Team và Nhân sự ở trên để xem Log.</p>
                        </div>
                    ) : isLoadingLogs ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-rose-500" /></div>
                    ) : (
                        <table className="w-full text-left text-xs md:text-sm text-slate-600 min-w-[700px]">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] md:text-[11px] sticky top-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                                <tr>
                                    <th className="px-4 py-3 w-32 md:w-40 rounded-tl-xl border-b border-slate-200">Thời gian tạo</th>
                                    <th className="px-4 py-3 border-b border-slate-200">Chi tiết Ghi nhận</th>
                                    <th className="px-4 py-3 w-48 md:w-56 border-b border-slate-200">Thuộc Video (Task)</th>
                                    <th className="px-4 py-3 w-28 md:w-32 text-center border-b border-slate-200">Trạng thái KPI</th>
                                    <th className="px-4 py-3 w-20 text-center rounded-tr-xl border-b border-slate-200">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-slate-400 font-medium">Không tìm thấy dữ liệu.</td></tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-rose-50/30 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-700 text-[11px] md:text-xs">
                                                {new Date(log.createdAt).toLocaleString("vi-VN", {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800 text-[11px] md:text-xs">
                                                {log.details}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] md:text-xs">
                                                <p className="font-bold text-blue-600 truncate max-w-[150px] md:max-w-[200px] cursor-pointer hover:underline" onClick={() => handleOpenTaskDetail(log.taskId)} title={log.task?.title}>{log.task?.title || "Video đã bị xóa"}</p>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {['DAILY_REPORT', 'SUBMIT_SCRIPT', 'SUBMIT_VIDEO', 'PUBLISH_VIDEO', 'COMPLETE_TASK'].includes(log.action) ? (
                                                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[9px] md:text-[10px] font-black tracking-wide">CÓ TÍNH KPI</span>
                                                ) : (
                                                    <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[9px] md:text-[10px] font-black tracking-wide">KHÔNG TÍNH</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button 
                                                    onClick={() => handleDeleteLog(log.id)} 
                                                    className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                                                    title="Xóa log này"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* NHÚNG DRAWER QUẢN LÝ TASK (SỬA/GÁN) */}
            <TaskManageDrawer 
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                mode={drawerMode}
                taskId={selectedTaskId}
                teams={teams}
                onSuccess={() => {
                    if (activeTab === 'TASKS') fetchTasks();
                    if (activeTab === 'LOGS') fetchLogs();
                }}
            />

            {/* NHÚNG DRAWER XEM CHI TIẾT TASK & CHAT */}
            <TaskDetailDrawer
                isOpen={isDetailDrawerOpen}
                isLoading={isLoadingDetail}
                onClose={() => setIsDetailDrawerOpen(false)}
                selectedTask={selectedTaskDetail}
                taskLinks={taskLinks}
                setTaskLinks={setTaskLinks}
                errors={{}}
                isSavingLinks={false}
                onSaveLinks={() => {}} 
                onToggleClose={handleToggleCloseTask}
                onReject={handleRejectTask}
                canReject={currentUser?.role !== "CONTENT"}
                messages={messages}
                chatMessage={chatMessage}
                setChatMessage={setChatMessage}
                onSendMessage={handleSendMessage}
                sessionUserId={currentUser?.id}
                userRole={currentUser?.role}
                onUploadImage={async (file) => {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/upload", { method: "POST", body: formData });
                    const data = await res.json();
                    return data.url;
                }}
            />
        </div>
    );
}