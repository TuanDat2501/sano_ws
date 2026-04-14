"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Link as LinkIcon, AlertCircle, FileText, CheckCircle2, Clock, PlayCircle, Loader2, X, UsersIcon, Send, MessageSquare, Users } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { io, Socket } from "socket.io-client";
import CreateTaskModal from "@/app/component/CreateTaskModal";
import TaskDetailDrawer from "@/app/component/TaskDetailDrawer";
import ListView from "@/app/component/ListView/ListView";
import BoardView from "@/app/component/BoardView/BoardView";
import PermissionGuard from "@/app/component/PermissionGuard";

const COLUMNS = {
  TODO: { id: "TODO", title: "Chờ Kịch Bản", icon: <FileText size={18} className="text-slate-700" />, color: "text-slate-800", iconBg: "bg-slate-300", columnBg: "bg-slate-200", borderColor: "border-slate-300" },
  DOING: { id: "DOING", title: "Chờ Dựng", icon: <PlayCircle size={18} className="text-blue-700" />, color: "text-blue-800", iconBg: "bg-blue-300", columnBg: "bg-blue-100", borderColor: "border-blue-300" },
  REVIEW: { id: "REVIEW", title: "Chờ Đăng", icon: <Clock size={18} className="text-orange-700" />, color: "text-orange-800", iconBg: "bg-orange-300", columnBg: "bg-orange-100", borderColor: "border-orange-300" },
  DONE: { id: "DONE", title: "Hoàn Thành", icon: <CheckCircle2 size={18} className="text-green-700" />, color: "text-green-800", iconBg: "bg-green-300", columnBg: "bg-green-100", borderColor: "border-green-300" },
};

const TEAM_COLORS = [
  { bg: "bg-blue-600", text: "text-white", border: "border-blue-600" },
  { bg: "bg-purple-600", text: "text-white", border: "border-purple-600" },
  { bg: "bg-orange-500", text: "text-white", border: "border-orange-500" },
  { bg: "bg-pink-600", text: "text-white", border: "border-pink-600" },
  { bg: "bg-cyan-600", text: "text-white", border: "border-cyan-600" },
  { bg: "bg-indigo-600", text: "text-white", border: "border-indigo-600" },
  { bg: "bg-rose-600", text: "text-white", border: "border-rose-600" },
];

const getTeamColor = (teamId?: string) => {
  if (!teamId) return { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-300" };
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) hash = teamId.charCodeAt(i) + ((hash << 5) - hash);
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
};

export default function KanbanBoard() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<{ [key: string]: any[] }>({ TODO: [], DOING: [], REVIEW: [], DONE: [] });
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskLinks, setTaskLinks] = useState({ scriptLink: "", videoLink: "", publishLink: "" });
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const { showToast } = useToast();
  const [linksError, setLinksError] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([{ id: 1, sender: "Admin", text: "Nhớ check kỹ bản quyền nhạc trước khi render nhé em!", time: "10:00 AM", isMine: true }]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({ title: "", linkContent: "", contentId: "", editorId: "", teamId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<'board' | 'list'>((searchParams.get("viewMode") as 'board' | 'list') || 'board');
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "ALL");
  const [fromDate, setFromDate] = useState(searchParams.get("fromDate") || "");
  const [toDate, setToDate] = useState(searchParams.get("toDate") || "");
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);

  const userRole = (session?.user as any)?.role;
  const canReject = userRole === 'ADMIN' || userRole === 'LEADER' || userRole === 'BAN_GIAM_DOC';
  const canCreateTask = ["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(userRole);

  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const ITEMS_PER_PAGE = 7;

  const [modalErrors, setModalErrors] = useState<{ [key: string]: string }>({});
  const [drawerErrors, setDrawerErrors] = useState<{ [key: string]: string }>({});
  const [boardUpdateSignal, setBoardUpdateSignal] = useState(0);

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams({
        viewMode, page: currentPage.toString(), limit: ITEMS_PER_PAGE.toString(),
        search: searchTerm, status: filterStatus, fromDate, toDate
      });

      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();

      if (!data.tasks) { setLoading(false); return; }

      if (viewMode === 'board') {
        const groupedTasks = { TODO: [], DOING: [], REVIEW: [], DONE: [] };
        data.tasks.forEach((task: any) => {
          if (groupedTasks[task.status as keyof typeof groupedTasks]) {
            (groupedTasks[task.status as keyof typeof groupedTasks] as any[]).push(task);
          }
        });
        setTasks(groupedTasks);
      } else {
        setRawTasks(data.tasks);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      }
      setLoading(false);
    } catch (err) { setLoading(false); }
  };

  const filteredTasks = rawTasks.filter((task) => {
    const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || task.status === filterStatus;
    const taskDate = new Date(task.createdAt).toISOString().split('T')[0];
    const matchFrom = fromDate === "" || taskDate >= fromDate;
    const matchTo = toDate === "" || taskDate <= toDate;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const handleSaveLinks = async () => {
    if (!selectedTask) return;
    setIsSavingLinks(true);
    setLinksError("");

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskLinks),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field) setDrawerErrors({ [data.field]: data.error });
        else showToast('error', data.error);
      } else {
        fetchTasks();
        showToast('success', 'Đã lưu kịch bản thành công.');
        setIsDrawerOpen(false);
        handleCloseDrawer();
        if (socket) socket.emit("board_updated");
      }
    } catch (error) { console.error(error); }
    finally { setIsSavingLinks(false); }
  };

  const handleToggleCloseTask = async () => {
    if (!selectedTask) return;
    const newClosedState = !selectedTask.isClosed;
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClosed: newClosedState }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast('success', newClosedState ? 'Đã đóng Task thành công.' : 'Đã mở lại Task.');
        fetchTasks(); setIsDrawerOpen(false);

        if (socket) {
          if (newClosedState) {
            if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
              socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
            } else {
              const targetUserId = selectedTask.contentId || selectedTask.editorId;
              if (targetUserId) {
                socket.emit("approve_task", { taskId: selectedTask.id, taskName: selectedTask.title, workerId: targetUserId });
              }
            }
          }
          socket.emit("board_updated");
        }
      } else showToast('error', 'Lỗi khi đóng Task!');
    } catch (error) { showToast('error', 'Lỗi Server!'); }
  };

  const handleRejectTask = async () => {
    if (!selectedTask) return;
    const reason = window.prompt("Nhập lý do yêu cầu làm lại (hoặc để trống):") || "Cần chỉnh sửa thêm theo yêu cầu Sếp.";
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClosed: false, status: "DOING" }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast('success', 'Đã Reject! Task bị trả về cột Chờ Dựng.');
        fetchTasks(); setIsDrawerOpen(false);

        if (socket) {
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          } else {
            const targetUserId = selectedTask.contentId || selectedTask.editorId;
            if (targetUserId) {
              socket.emit("reject_task", { taskId: selectedTask.id, taskName: selectedTask.title, workerId: targetUserId, reason: reason, rejecterName: (session?.user as any)?.fullName || "Quản lý" });
            }
          }
          socket.emit("board_updated");
        }
      } else showToast('error', 'Có lỗi khi Reject Task!');
    } catch (error) { showToast('error', 'Lỗi kết nối máy chủ!'); }
  };

  const handleOpenTaskDetail = (task: any) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskId", task.id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleCloseDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const loadUsers = async () => {
    try { const res = await fetch("/api/users"); const data = await res.json(); if (Array.isArray(data)) setUsers(data); } catch (error) { }
  };

  const loadTeams = async () => {
    try { const res = await fetch("/api/teams"); const data = await res.json(); if (Array.isArray(data)) setTeams(data); } catch (error) { }
  };

  const handleFilterChange = (setter: any, value: any) => { setter(value); setCurrentPage(1); };
  const isFirstRender = useRef(true);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    newSocket.on("reload_board", () => { setBoardUpdateSignal(prev => prev + 1); });
    loadUsers(); loadTeams(); fetchTasks();
    return () => { newSocket.disconnect(); };
  }, []);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const params = new URLSearchParams();
    params.set("viewMode", viewMode);
    params.set("page", currentPage.toString());
    if (searchTerm) params.set("search", searchTerm);
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (activeTaskId) params.set("taskId", activeTaskId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    const timeoutId = setTimeout(() => { fetchTasks(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentPage, searchTerm, filterStatus, fromDate, toDate, viewMode, pathname, router, boardUpdateSignal]);

  useEffect(() => {
    if (!socket || !selectedTask) return;
    socket.emit("join_task", selectedTask.id);
    const handleReceiveMessage = (data: any) => { setMessages((prev) => [...prev, data]); };
    socket.on("receive_message", handleReceiveMessage);
    return () => { socket.off("receive_message", handleReceiveMessage); setMessages([]); };
  }, [socket, selectedTask]);

  const activeTaskId = searchParams.get("taskId");
  useEffect(() => {
    if (activeTaskId) {
      setIsDrawerOpen(true); setMessages([]); setLinksError("");
      fetch(`/api/tasks/${activeTaskId}`)
        .then(res => res.json())
        .then(taskData => {
          if (taskData && !taskData.error) {
            setSelectedTask(taskData);
            setTaskLinks({ scriptLink: taskData.scriptLink || "", videoLink: taskData.videoLink || "", publishLink: taskData.publishLink || "" });
          }
        }).catch(err => console.error(err));

      fetch(`/api/tasks/${activeTaskId}/comments`)
        .then(res => res.json())
        .then(history => {
          if (Array.isArray(history)) {
            const formattedMessages: any[] = history.map((c: any) => ({
              id: c.id, taskId: c.taskId, sender: c.user?.fullName || c.user?.name || "Ai đó",
              senderId: c.userId, text: c.text, time: new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            }));
            setMessages(formattedMessages);
          }
        }).catch(err => console.error(err));
    } else {
      setIsDrawerOpen(false);
      setTimeout(() => { setSelectedTask(null); setMessages([]); setTaskLinks({ scriptLink: "", videoLink: "", publishLink: "" }); }, 300);
    }
  }, [activeTaskId]);

  const onDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColumn = source.droppableId;
    const destColumn = destination.droppableId;
    const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(userRole);

    if (!isManager) {
      let isAllowed = false;
      if (userRole === "CONTENT" && sourceColumn === "TODO" && destColumn === "DOING") isAllowed = true;
      if (userRole === "EDITOR" && sourceColumn === "DOING" && destColumn === "REVIEW") isAllowed = true;
      if (userRole === "CHANNEL_MANAGER" && sourceColumn === "REVIEW" && destColumn === "DONE") isAllowed = true;
      if (sourceColumn === destColumn) isAllowed = true;

      if (!isAllowed) { showToast("error", "⛔ Vượt quyền! Bạn không được kéo thẻ vào đây."); return; }
    }

    const sourceTasks = Array.from(tasks[sourceColumn]);
    const destTasks = sourceColumn === destColumn ? sourceTasks : Array.from(tasks[destColumn]);
    const [movedTask] = sourceTasks.splice(source.index, 1);
    movedTask.status = destColumn;
    destTasks.splice(destination.index, 0, movedTask);

    setTasks({ ...tasks, [sourceColumn]: sourceTasks, [destColumn]: destTasks });

    if (sourceColumn !== destColumn) {
      try {
        const res = await fetch(`/api/tasks/${draggableId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: destColumn }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0 && socket) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          }
          if (socket) socket.emit("board_updated");
        }
      } catch (error) { console.error("Lỗi cập nhật:", error); }
    }
    if (socket) socket.emit("board_updated")
  };

  const handleCreateTaskSubmit = async (taskData: any) => {
    setIsSubmitting(true);
    setModalErrors({});
    try {
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error.includes("Link này đã tồn tại")) setModalErrors({ linkContent: data.error });
        else showToast('error', data.error);
      } else {
        setTasks((prev: any) => ({ ...prev, TODO: [data.task, ...prev.TODO] }));
        setIsModalOpen(false);

        if (socket) {
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          } else {
            const targetUserId = taskData.contentId || taskData.editorId;
            if (targetUserId) {
              socket.emit("assign_task", { taskId: data.task?.id, taskName: data.task?.title || taskData.title, assigneeId: targetUserId, assignerName: (session?.user as any)?.fullName || "Quản lý" });
            }
          }
          socket.emit("board_updated");
        }
      }
    } catch (err) { showToast('error', "Lỗi kết nối"); }
    finally { setIsSubmitting(false); }
  };

  const handleSendMessage = async () => {
    if (chatMessage.trim() !== '' && socket && selectedTask) {
      const textToSend = chatMessage;
      setChatMessage("");

      try {
        const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSend }),
        });

        if (res.ok) {
          const data = await res.json();
          const savedComment = data.comment;
          const newMsg = {
            id: savedComment.id, taskId: selectedTask.id, sender: savedComment.user.fullName,
            senderId: savedComment.userId, text: savedComment.text,
            time: new Date(savedComment.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };
          socket.emit("send_message", newMsg);

          if (data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          }
        }
      } catch (error) { showToast('error', 'Lỗi gửi tin nhắn!'); }
    }
  };
  if (loading) return <div className="flex h-full items-center justify-center animate-pulse text-slate-400"><Loader2 size={32} className="animate-spin text-blue-500" /></div>;

  return (
    <PermissionGuard moduleId="MENU_TASKS">
    
    <div className="h-full flex flex-col p-3 md:p-6 animate-fade-in">

      <div className="shrink-0 mb-4 md:mb-6 space-y-4">
        {/* Header: Dàn thành cột trên mobile, hàng ngang trên PC */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Dây chuyền <span className="text-red-600">Sản xuất</span></h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Quản lý và theo dõi tiến độ video.</p>
          </div>

          {canCreateTask && (
            <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2.5 md:py-2.5 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-sm md:text-base">
              <Plus size={18} className="md:w-5 md:h-5" /> Tạo yêu cầu Video
            </button>
          )}
        </div>

        {/* Thanh Tabs & Filters: Bẻ cong mượt mà */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button onClick={() => setViewMode('board')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${viewMode === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Kanban
            </button>
            <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Danh sách (Excel)
            </button>
          </div>

          {viewMode === 'list' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full lg:w-auto">
              <input type="text" placeholder="Tìm tên task..." className="bg-slate-50 border border-slate-200 text-xs md:text-sm font-medium px-3 md:px-4 py-2 rounded-lg md:rounded-xl outline-none focus:border-blue-500 w-full sm:w-48 lg:w-64" value={searchTerm} onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)} />

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-2 md:px-3 py-1.5 md:py-1 shadow-sm w-full sm:w-auto overflow-x-auto custom-scrollbar-thin">
                <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Từ</span>
                <input type="date" className="bg-transparent text-xs md:text-sm font-bold text-slate-600 outline-none" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <div className="w-[1px] h-4 bg-slate-300 mx-1 shrink-0"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Đến</span>
                <input type="date" className="bg-transparent text-xs md:text-sm font-bold text-slate-600 outline-none" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>

              <select className="bg-slate-50 border border-slate-200 text-xs md:text-sm font-medium px-3 md:px-4 py-2 rounded-lg md:rounded-xl outline-none focus:border-blue-500 w-full sm:w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="ALL">Tất cả trạng thái</option>
                <option value="TODO">Chờ Kịch bản</option>
                <option value="DOING">Chờ Dựng</option>
                <option value="REVIEW">Chờ Đăng</option>
                <option value="DONE">Hoàn thành</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2">
        {viewMode === 'board' ? (
          <BoardView tasks={tasks} columns={COLUMNS} getTeamColor={getTeamColor} onDragEnd={onDragEnd} onOpenTaskDetail={handleOpenTaskDetail} userRole={userRole} />
        ) : (
          <ListView filteredTasks={filteredTasks} columns={COLUMNS} onOpenTaskDetail={handleOpenTaskDetail} currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={ITEMS_PER_PAGE} />
        )}
      </div>

      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} users={users} teams={teams} onSubmit={handleCreateTaskSubmit} isSubmitting={isSubmitting} errors={modalErrors} />

      <TaskDetailDrawer isOpen={isDrawerOpen} onClose={handleCloseDrawer} selectedTask={selectedTask} taskLinks={taskLinks} setTaskLinks={setTaskLinks} errors={drawerErrors} isSavingLinks={isSavingLinks} onSaveLinks={handleSaveLinks} onToggleClose={handleToggleCloseTask} onReject={handleRejectTask} canReject={canReject} messages={messages} chatMessage={chatMessage} setChatMessage={setChatMessage} onSendMessage={handleSendMessage} userRole={userRole} sessionUserId={(session?.user as any)?.id} />
    </div>
      </PermissionGuard>
  );
}