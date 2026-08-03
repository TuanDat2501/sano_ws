"use client";

import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Link as LinkIcon, AlertCircle, FileText, CheckCircle2, Clock, PlayCircle, Loader2, X, UsersIcon, Send, MessageSquare, Users, Archive, Download, Video, Filter, Upload } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { io, Socket } from "socket.io-client";
import CreateTaskModal from "@/app/component/CreateTaskModal";
import TaskDetailDrawer from "@/app/component/TaskDetailDrawer";
import ListView from "@/app/component/ListView/ListView";
import BoardView from "@/app/component/BoardView/BoardView";
import PermissionGuard from "@/app/component/PermissionGuard";
import BacklogView from "./BacklogView";
import PushTaskModal from "./PushTaskModal";
import MergeVideoModal from './MergeVideoModal';
import SurplusView from "./SurplusView"; 

// FULL 7 CỘT MẶC ĐỊNH
const COLUMNS = {
  TODO: { id: "TODO", title: "Chờ Kịch Bản", icon: <FileText size={18} className="text-slate-700" />, color: "text-slate-800", iconBg: "bg-slate-300", columnBg: "bg-slate-200", borderColor: "border-slate-300" },
  CONTENT_REVIEW: { id: "CONTENT_REVIEW", title: "Duyệt Kịch Bản", icon: <CheckCircle2 size={18} className="text-orange-700"/>, color: "text-orange-800", iconBg: "bg-orange-300", columnBg: "bg-orange-50", borderColor: "border-orange-200" },
  
  ANIMATION_DOING: { id: "ANIMATION_DOING", title: "Đang làm CĐ", icon: <PlayCircle size={18} className="text-purple-700" />, color: "text-purple-800", iconBg: "bg-purple-300", columnBg: "bg-purple-50", borderColor: "border-purple-200" },
  ANIMATION_REVIEW: { id: "ANIMATION_REVIEW", title: "Duyệt CĐ", icon: <Clock size={18} className="text-pink-700" />, color: "text-pink-800", iconBg: "bg-pink-300", columnBg: "bg-pink-50", borderColor: "border-pink-200" },
  
  EDIT_DOING: { id: "EDIT_DOING", title: "Đang Dựng", icon: <Video size={18} className="text-cyan-700" />, color: "text-cyan-800", iconBg: "bg-cyan-300", columnBg: "bg-cyan-50", borderColor: "border-cyan-200" },
  EDIT_REVIEW: { id: "EDIT_REVIEW", title: "Chờ Đăng", icon: <Clock size={18} className="text-indigo-700" />, color: "text-indigo-800", iconBg: "bg-indigo-300", columnBg: "bg-indigo-50", borderColor: "border-indigo-200" },
  
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
  const [channels, setChannels] = useState<any[]>([]);
  const [tasks, setTasks] = useState<{ [key: string]: any[] }>({ 
      TODO: [], CONTENT_REVIEW: [], 
      ANIMATION_DOING: [], ANIMATION_REVIEW: [], 
      EDIT_DOING: [], EDIT_REVIEW: [], DONE: [] 
  });
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskLinks, setTaskLinks] = useState({
    scriptLink: "", englishScriptLink: "", storyboardLink: "",
    audioLink: "", thumbnailLink: "", videoLink: "", publishLink: "", note: "",animationLink:""
  });
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const { showToast } = useToast();
  const [linksError, setLinksError] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([{ id: 1, sender: "Hệ thống", text: "Chào mừng đến với không gian thảo luận Task!", time: new Date().toLocaleTimeString(), isMine: false }]);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({ title: "", linkContent: "", contentId: "", editorId: "", teamId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<'board' | 'list' | 'backlog' | 'surplus'>((searchParams.get("viewMode") as 'board' | 'list' | 'backlog' | 'surplus') || 'board');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "ALL");
  const [filterChannel, setFilterChannel] = useState(searchParams.get("channelId") || "ALL");
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
  const [isClearing, setIsClearing] = useState(false);

  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [taskToPush, setTaskToPush] = useState<any>(null);
  const [isPushing, setIsPushing] = useState(false);

  const backlogTasks = rawTasks.filter(t => t.status === 'BACKLOG');
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const filteredTasks = rawTasks.filter((task) => {
    if (task.status === 'BACKLOG') return false;
    const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || task.status === filterStatus;
    const matchChannel = filterChannel === "ALL" || task.channelId === filterChannel;
    const taskDate = new Date(task.createdAt).toISOString().split('T')[0];
    const matchFrom = fromDate === "" || taskDate >= fromDate;
    const matchTo = toDate === "" || taskDate <= toDate;
    return matchSearch && matchStatus && matchChannel && matchFrom && matchTo;
  });

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const activeChannelObj = channels.find(c => c.id === filterChannel);
  const isTongHopChannel = activeChannelObj?.category === 'TONG_HOP';
  
  const BOARD_COLUMNS = { ...COLUMNS };
  if (isTongHopChannel) {
    delete (BOARD_COLUMNS as any).ANIMATION_DOING;
    delete (BOARD_COLUMNS as any).ANIMATION_REVIEW;
  }

  const handleMergeSubmit = async (mergeData: any) => {
    setIsMerging(true);
    try {
        const res = await fetch("/api/tasks/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mergeData)
        });
        const data = await res.json();

        if (res.ok) {
            showToast("success", "Đã tạo Video Ghép thành công!");
            setIsMergeModalOpen(false);
            fetchTasks(); 
            if (socket) {
                socket.emit("board_updated");
                socket.emit("assign_task", {
                    taskId: data.task?.id,
                    taskName: data.task?.title,
                    assigneeId: mergeData.assigneeId,
                    assignerName: (session?.user as any)?.fullName || "Quản lý"
                });
            }
        } else {
            showToast("error", data.error || "Có lỗi xảy ra khi gộp");
        }
    } catch (error) {
        showToast("error", "Lỗi kết nối Server");
    } finally {
        setIsMerging(false);
    }
  };

  const fetchTasks = async () => {
    try {
      if (viewMode === 'surplus') {
        setLoading(false);
        return;
      }

      const currentStatus = viewMode === 'backlog' ? 'BACKLOG' : filterStatus;
      const currentLimit = viewMode === 'backlog' ? "50" : ITEMS_PER_PAGE.toString();

      const params = new URLSearchParams({
        viewMode, page: currentPage.toString(), limit: currentLimit,
        search: searchTerm, status: currentStatus, fromDate, toDate,
        ...(filterChannel !== "ALL" && { channelId: filterChannel })
      });

      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();

      if (!data.tasks) { setLoading(false); return; }

      if (viewMode === 'board') {
        const groupedTasks = { TODO: [], CONTENT_REVIEW: [], ANIMATION_DOING: [], ANIMATION_REVIEW: [], EDIT_DOING: [], EDIT_REVIEW: [], DONE: [] };
        
        data.tasks.forEach((task: any) => {
          if (filterChannel !== "ALL" && task.channelId !== filterChannel) return;
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

  const loadProjects = async () => {
    try { const res = await fetch("/api/projects"); const data = await res.json(); if (Array.isArray(data)) setProjects(data); } catch (error) { }
  };

  const loadUsers = async () => {
    try { const res = await fetch("/api/users"); const data = await res.json(); if (Array.isArray(data)) setUsers(data); } catch (error) { }
  };

  const loadTeams = async () => {
    try { const res = await fetch("/api/teams"); const data = await res.json(); if (Array.isArray(data)) setTeams(data); } catch (error) { }
  };

  const loadChannels = async () => {
    try {
      const res = await fetch("/api/channels");
      const data = await res.json();
      if (Array.isArray(data)) setChannels(data);
    } catch (error) { }
  };

  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl && !selectedTask && !isDrawerOpen) {
      const fetchAndOpenTask = async () => {
        try {
          const res = await fetch(`/api/tasks/${taskIdFromUrl}`);
          if (res.ok) {
            const taskData = await res.json();
            handleOpenTaskDetail(taskData);
          }
        } catch (err) { console.error("Lỗi khi tự động mở task:", err); }
      };
      fetchAndOpenTask();
    }
  }, [searchParams]);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://socket.sanogroup.tv";
    const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });
    setSocket(newSocket);
    newSocket.on("receive_message", (data: any) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, {
          id: data.id, 
          sender: data.sender, 
          text: data.text,
          imageUrl: data.imageUrl, 
          time: data.time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          isMine: data.senderId === (session?.user as any)?.id
        }];
      });
    });
    newSocket.on("reload_board", () => { setBoardUpdateSignal(prev => prev + 1); });
    
    loadUsers(); loadTeams(); loadProjects(); loadChannels(); fetchTasks();
    return () => { newSocket.disconnect(); };
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }

    const params = new URLSearchParams(searchParams.toString());
    params.set("viewMode", viewMode);
    params.set("page", currentPage.toString());

    if (searchTerm) params.set("search", searchTerm); else params.delete("search");
    if (filterStatus !== "ALL") params.set("status", filterStatus); else params.delete("status");
    if (filterChannel !== "ALL") params.set("channelId", filterChannel); else params.delete("channelId"); 
    if (fromDate) params.set("fromDate", fromDate); else params.delete("fromDate");
    if (toDate) params.set("toDate", toDate); else params.delete("toDate");

    const newQueryString = params.toString();
    if (searchParams.toString() !== newQueryString) {
      router.replace(`${pathname}?${newQueryString}`, { scroll: false });
    }

    const timeoutId = setTimeout(() => { fetchTasks(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentPage, searchTerm, filterStatus, filterChannel, fromDate, toDate, viewMode, boardUpdateSignal]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Tạm giữ nguyên logic Import...
  };

  const handleExportExcel = async () => {
      setIsExporting(true);
      try {
        const res = await fetch('/api/tasks/export');
        const data = await res.json();
        if (!res.ok) throw new Error("Lỗi tải dữ liệu");
  
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách Task');
  
        worksheet.columns = [
          { header: 'STT', key: 'stt', width: 5 },
          { header: 'Từ khóa (Key)', key: 'key', width: 25 },
          { header: 'Tiêu đề Video', key: 'title', width: 35 },
          { header: 'Video tham khảo', key: 'refLink', width: 20 },
          { header: 'Text ENG', key: 'eng', width: 20 },
          { header: 'Bố cục', key: 'story', width: 20 },
          { header: 'Thumbnail', key: 'thumb', width: 20 },
          { header: 'Nhân sự Content', key: 'content', width: 20 },
          { header: 'Audio', key: 'audio', width: 20 },
          { header: 'Chuyển động (CĐ)', key: 'animator', width: 20 },
          { header: 'Nhân sự Editor', key: 'editor', width: 20 },
          { header: 'Video hoàn thành', key: 'video', width: 20 },
          { header: 'Kênh / Project', key: 'channel', width: 25 },
          { header: 'LINK YT (Pub)', key: 'pub', width: 20 },
          { header: 'Ngày đăng', key: 'date', width: 15 },
          { header: 'Trạng thái', key: 'status', width: 15 },
        ];
  
        data.forEach((item: any, idx: number) => {
          worksheet.addRow({
            stt: idx + 1,
            key: item["Key (Từ khóa)"],
            title: item["Tiêu đề Video"],
            refLink: item["Video tham khảo"],
            eng: item["Text ENG"],
            story: item["Bố cục"],
            thumb: item["Thumbnail"],
            content: item["Nhân sự Content"],
            audio: item["Link Audio (AI)"],
            animator: item["Nhân sự Chuyển động"],
            editor: item["Nhân sự Editor"],
            video: item["Video hoàn thành"],
            channel: `${item["Thuộc Kênh"]} - ${item["Dự án"]}`,
            pub: item["Link Youtube (Pub)"],
            date: item["Ngày đăng"],
            status: item["Trạng thái"]
          });
        });
  
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
          cell.font = { name: 'Arial', bold: true, size: 11, color: { argb: '000000' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
  
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            row.eachCell((cell) => {
              cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } }
              };
              cell.alignment = { vertical: 'middle' };
              if (String(cell.value).startsWith('http')) {
                cell.font = { color: { argb: '2563EB' }, underline: true };
              }
            });
          }
        });
  
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        worksheet.autoFilter = 'A1:P1'; 
        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `SanoWS_Export_${new Date().getTime()}.xlsx`;
        saveAs(new Blob([buffer]), fileName);
  
        showToast("success", "Đã xuất file Excel 'siêu đẹp' thành công!");
      } catch (error) {
        showToast("error", "Lỗi xuất file rồi sếp ơi!");
      } finally {
        setIsExporting(false);
      }
  };

  const handleFilterChange = (setter: any, value: any) => { setter(value); setCurrentPage(1); };

  const handleSwitchTab = (mode: 'board' | 'list' | 'backlog' | 'surplus') => {
    setViewMode(mode);
    setCurrentPage(1);
    setSearchTerm("");
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (res.ok) {
        const data = await res.json();
        const formattedMessages = data.map((c: any) => ({
          id: c.id, 
          sender: c.user?.fullName || "Ẩn danh", 
          text: c.text,
          imageUrl: c.imageUrl, 
          time: new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          isMine: c.userId === (session?.user as any)?.id
        }));
        setMessages([
          { id: "system", sender: "Hệ thống", text: "Chào mừng đến với không gian thảo luận Task!", time: "", isMine: false },
          ...formattedMessages
        ]);
      }
    } catch (error) {}
  };

  const handleOpenTaskDetail = async (task: any) => {
    setIsLoadingDetail(true);
    setIsDrawerOpen(true);
    
    setSelectedTask(task);
    setTaskLinks({
      scriptLink: task.scriptLink || "", englishScriptLink: task.englishScriptLink || "", storyboardLink: task.storyboardLink || "",
      audioLink: task.audioLink || "", thumbnailLink: task.thumbnailLink || "", videoLink: task.videoLink || "",
      publishLink: task.publishLink || "", note: task.note || "",animationLink:task.animationLink
    });

    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const fullTask = await res.json();
        setSelectedTask(fullTask); 
        setTaskLinks({
          scriptLink: fullTask.scriptLink || "", englishScriptLink: fullTask.englishScriptLink || "", storyboardLink: fullTask.storyboardLink || "",
          audioLink: fullTask.audioLink || "", thumbnailLink: fullTask.thumbnailLink || "", videoLink: fullTask.videoLink || "",
          publishLink: fullTask.publishLink || "", note: fullTask.note || "",animationLink:fullTask.animationLink||""
        });
      }
    } catch (err) {
       console.error(err);
    } finally {
       setIsLoadingDetail(false);
    }

    loadTaskComments(task.id);
    if (socket) socket.emit("join_task", task.id);

    const params = new URLSearchParams(searchParams.toString());
    if (params.get("taskId") !== task.id) {
      params.set("taskId", task.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedTask(null), 300);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("taskId")) {
      params.delete("taskId");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const sourceCol = [...tasks[source.droppableId]];
    const destCol = [...tasks[destination.droppableId]];
    const [movedTask] = sourceCol.splice(source.index, 1);
    movedTask.status = destination.droppableId;
    destCol.splice(destination.index, 0, movedTask);

    setTasks({ ...tasks, [source.droppableId]: sourceCol, [destination.droppableId]: destCol });

    try {
      const res = await fetch(`/api/tasks/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destination.droppableId })
      });

      const data = await res.json();

      if (res.ok) {
        if (socket) {
          socket.emit("board_updated");
          
          // Ưu tiên dùng list Notification trả về từ Backend (Chứa đẩy đủ list User gộp)
          if (data && data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          } 
          else {
            // 🚀 BỔ SUNG: Xử lý gom toàn bộ mảng ID của Co-workers để thông báo nếu server không trả Noti
            const currentUserId = (session?.user as any)?.id;
            const currentUserName = (session?.user as any)?.name || (session?.user as any)?.fullName || "Ai đó";
            
            const targetIds = new Set<string>();

            // Gom sạch cả người làm chính và người làm phụ
            const contentIds = [movedTask.contentId, ...(movedTask.coContentUsers?.map((u:any)=>u.id) || [])].filter(Boolean);
            const editorIds = [movedTask.editorId, ...(movedTask.coEditorUsers?.map((u:any)=>u.id) || [])].filter(Boolean);
            const animatorIds = [movedTask.animatorId, ...(movedTask.coAnimatorUsers?.map((u:any)=>u.id) || [])].filter(Boolean);

            switch (destination.droppableId) {
                case "CONTENT_REVIEW":
                case "ANIMATION_REVIEW":
                case "EDIT_REVIEW":
                    if (movedTask.creatorId && movedTask.creatorId !== currentUserId) {
                        targetIds.add(movedTask.creatorId);
                    }
                    break;
                case "CONTENT_DOING":
                    contentIds.forEach(id => { if (id !== currentUserId) targetIds.add(id); });
                    break;
                case "ANIMATION_DOING":
                    animatorIds.forEach(id => { if (id !== currentUserId) targetIds.add(id); });
                    break;
                case "EDIT_DOING":
                    editorIds.forEach(id => { if (id !== currentUserId) targetIds.add(id); });
                    break;
                case "DONE":
                    if (movedTask.creatorId && movedTask.creatorId !== currentUserId) targetIds.add(movedTask.creatorId);
                    contentIds.forEach(id => { if (id !== currentUserId) targetIds.add(id); });
                    editorIds.forEach(id => { if (id !== currentUserId) targetIds.add(id); });
                    animatorIds.forEach(id => { if (id !== currentUserId) targetIds.add(id); });
                    break;
                default:
                    if (movedTask.creatorId && movedTask.creatorId !== currentUserId) targetIds.add(movedTask.creatorId);
                    break;
            }

            const targets = Array.from(targetIds);

            if (targets.length > 0) {
              let actionText = "đã cập nhật trạng thái";
              if (destination.droppableId === "CONTENT_REVIEW") actionText = "đã nộp kịch bản, chờ duyệt ⏳";
              if (destination.droppableId === "ANIMATION_DOING") actionText = "đã giao việc làm chuyển động cho bạn 🎬";
              if (destination.droppableId === "ANIMATION_REVIEW") actionText = "đã nộp bản chuyển động ⏳";
              if (destination.droppableId === "EDIT_DOING") actionText = "đã giao việc dựng video cho bạn 🎞️";
              if (destination.droppableId === "EDIT_REVIEW") actionText = "đã nộp video, chờ duyệt đăng 🚀";
              if (destination.droppableId === "DONE") actionText = "đã nghiệm thu Hoàn Thành 🎉";

              socket.emit("send_notification", {
                userIds: targets,
                notification: {
                  title: destination.droppableId === "DONE" ? "Task Hoàn Thành!" : "Cập nhật tiến độ",
                  message: `${currentUserName} ${actionText} task: "${movedTask.title || 'Không tên'}"`,
                  type: destination.droppableId === "DONE" ? "success" : "info",
                  taskId: movedTask.id,
                  time: new Date().toISOString()
                }
              });
            }
          }
        }
      } else {
        showToast('error', data.error || 'Lỗi chuyển trạng thái');
        fetchTasks();
      }
    } catch (e) {
      showToast('error', 'Lỗi kết nối tới Server');
      fetchTasks();
    }
  };

  const handleCreateTaskSubmit = async (taskData: any) => {
    setIsSubmitting(true);
    setModalErrors({});
    try {
      const isEditMode = !!taskData.id; 
      const url = isEditMode ? `/api/tasks/${taskData.id}` : "/api/tasks";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
      });

      const data = await res.json();

      if (res.ok) {
        showToast("success", isEditMode ? "Đã cập nhật Task thành công!" : (taskData.status === 'BACKLOG' ? "Đã thêm ý tưởng vào kho!" : "Đã tạo Yêu cầu Video!"));
        setIsModalOpen(false);
        setEditingTask(null); 
        setCurrentPage(1);
        fetchTasks();

        if (socket) {
          socket.emit("board_updated");
          // 🚀 BỔ SUNG: Đẩy thông báo cho mảng userIdsToNotify từ API trả về
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          }
        }
      } else {
        setModalErrors({ submit: data.error || "Có lỗi xảy ra" });
        showToast("error", data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      showToast("error", "Lỗi kết nối Server");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLinks = async () => {
    setIsSavingLinks(true);
    setDrawerErrors({});
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskLinks)
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Đã lưu cập nhật Link!");
        fetchTasks();
        if (socket) socket.emit("board_updated");
        handleCloseDrawer();
        setTaskLinks({
          scriptLink: "", englishScriptLink: "", storyboardLink: "",
          audioLink: "", thumbnailLink: "", videoLink: "", publishLink: "", note: "",animationLink:""
        });
        setLinksError("");
      } else {
        if (data.field) setDrawerErrors({ [data.field]: data.error });
        showToast("error", data.error || "Lỗi lưu link");
      }
    } catch (error) {
      showToast("error", "Lỗi kết nối Server");
    } finally {
      setIsSavingLinks(false);
    }
  };

  const handleToggleCloseTask = async () => {
    if (!confirm(`Bạn chắc chắn muốn ${selectedTask.isClosed ? 'MỞ LẠI' : 'ĐÓNG (Nghiệm thu)'} task này?`)) return;
    const newClosedState = !selectedTask.isClosed;
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClosed: newClosedState })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", newClosedState ? "Đã đóng Task!" : "Đã mở lại Task!");
        setIsDrawerOpen(false);
        fetchTasks();

        if (socket) {
          socket.emit("board_updated");
          if (newClosedState) {
            // 🚀 BỔ SUNG: Dùng mảng userIdsToNotify từ API
            if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
              socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
            } 
          }
        }
      }
    } catch (error) { showToast("error", "Lỗi thao tác"); }
  };

  const handleRejectTask = async () => {
    const reason = window.prompt("Nhập lý do yêu cầu làm lại (hoặc để trống):") || "Cần chỉnh sửa thêm theo yêu cầu Sếp.";
    if (!reason) return; 

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClosed: false, status: "TODO" }) 
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Đã trả Task về làm lại!");
        setIsDrawerOpen(false);
        fetchTasks();

        if (socket) {
          socket.emit("board_updated");
          // 🚀 BỔ SUNG: Thông báo cho toàn bộ những người được giao
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          }
        }
      }
    } catch (error) { showToast("error", "Lỗi thao tác"); }
  };

  const handleClearDoneTasks = async () => {
    if (!confirm("Sếp có chắc chắn muốn dọn dẹp Bảng? Các Task 'Hoàn thành' sẽ được cất vào kho lưu trữ!")) return;
    setIsClearing(true);
    try {
      const res = await fetch('/api/tasks/clear-done', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('success', `Đã cất ${data.count} task vào kho lưu trữ!`);
        fetchTasks();
        if (socket) socket.emit("board_updated");
      } else { showToast('error', data.error || 'Có lỗi xảy ra!'); }
    } catch (error) { showToast('error', 'Lỗi kết nối!'); } 
    finally { setIsClearing(false); }
  };

  const handlePushTaskSubmit = async (pushData: { teamId: string, projectId: string, contentId: string, editorId: string }) => {
    if (!taskToPush) return;
    setIsPushing(true);
    try {
      const res = await fetch(`/api/tasks/${taskToPush.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "TODO",
          teamId: pushData.teamId || undefined,
          projectId: pushData.projectId || undefined,
          contentId: pushData.contentId || undefined,
          editorId: pushData.editorId || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Đã giao việc! Task đã bay sang Kanban.');
        setIsPushModalOpen(false);
        fetchTasks();

        if (socket) {
          socket.emit("board_updated");
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          }
        }
      } else { showToast('error', data.error || 'Lỗi giao việc'); }
    } catch (error) { showToast('error', 'Lỗi kết nối Server'); } 
    finally { setIsPushing(false); }
  };

  const handleUploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      return data.url; 
    } catch (error) {
      showToast("error", "Lỗi tải ảnh lên!");
      return null;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("success", "Đã xóa Task thành công!");
            setSelectedTask(null); 
            fetchTasks(); 
        } else {
            const data = await res.json();
            showToast("error", data.error || "Lỗi khi xóa Task.");
        }
    } catch (error) {
        showToast("error", "Mất kết nối đến máy chủ, vui lòng thử lại!");
    }
  };

  const handleSendMessage = async (imageUrl?: string) => {
    if ((chatMessage.trim() !== '' || imageUrl) && socket && selectedTask) {
      const textToSend = chatMessage;
      setChatMessage(""); 
      
      try {
        const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSend, imageUrl: imageUrl }),
        });
        
        if (res.ok) {
          const data = await res.json();
          const savedComment = data.comment;
          
          await loadTaskComments(selectedTask.id);
          
          const newMsg = {
            id: savedComment.id, 
            taskId: selectedTask.id, 
            sender: savedComment.user.fullName,
            senderId: savedComment.userId, 
            text: savedComment.text,
            imageUrl: savedComment.imageUrl, 
            time: new Date(savedComment.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };
          
          socket.emit("send_message", newMsg);
          if (data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          }
        }
      } catch (error) { 
        showToast('error', 'Lỗi gửi tin nhắn!'); 
      }
    }
  };

  const handleEvaluationSubmit = async (score: number, criteriaData: any, note: string) => {
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/evaluate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, criteria: criteriaData, note })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Đã lưu đánh giá KPI thành công!");
        fetchTasks();
        if (socket) {
          socket.emit("board_updated");
          
          // 🚀 BỔ SUNG: Quét toàn bộ để báo kết quả chấm điểm
          const targetIds = new Set<string>();
          [
             selectedTask.editorId, selectedTask.contentId, selectedTask.animatorId,
             ...(selectedTask.coContentUsers?.map((u:any)=>u.id) || []),
             ...(selectedTask.coEditorUsers?.map((u:any)=>u.id) || []),
             ...(selectedTask.coAnimatorUsers?.map((u:any)=>u.id) || [])
          ].forEach(id => { if(id) targetIds.add(id); });

          if (targetIds.size > 0) {
            socket.emit("send_notification", {
              userIds: Array.from(targetIds),
              notification: {
                title: "Đánh giá Task 🌟",
                message: `Task "${selectedTask.title}" của bạn vừa được đánh giá ${score} điểm!`,
                type: "success", taskId: selectedTask.id, time: new Date().toISOString()
              }
            });
          }
        }
        handleCloseDrawer();
      } else { showToast("error", data.error || "Lỗi khi lưu đánh giá"); }
    } catch (error) { showToast("error", "Lỗi kết nối tới Server"); }
  };

  if (loading) return <div className="flex h-full items-center justify-center animate-pulse text-slate-400"><Loader2 size={32} className="animate-spin text-blue-500" /></div>;

  return (
    <PermissionGuard moduleId="MENU_TASKS">
      <div className="h-full flex flex-col p-3 md:p-6 animate-fade-in">
        <div className="shrink-0 mb-4 md:mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Dây chuyền <span className="text-red-600">Sản xuất</span></h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">Quản lý và theo dõi tiến độ video.</p>
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2 md:gap-3">
              {canCreateTask && (
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="flex-1 sm:flex-none bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm md:text-base"
                >
                  {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  <span>Xuất Excel</span>
                </button>
              )}

              {canCreateTask && (
                <button
                  onClick={handleClearDoneTasks}
                  disabled={isClearing}
                  className="flex-1 sm:flex-none bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm md:text-base"
                >
                  {isClearing ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} className="text-slate-500 md:w-5 md:h-5" />}
                  <span className="hidden md:inline">Lưu trữ Task</span>
                </button>
              )}
              {canCreateTask && (
                <div className="flex gap-2">
                    <button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-sm md:text-base">
                      <Plus size={18} /> Tạo Video
                    </button>

                    <button onClick={() => setIsMergeModalOpen(true)} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-sm md:text-base">
                      <Video size={18} /> Video Ghép
                    </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
              <button onClick={() => handleSwitchTab('board')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all whitespace-nowrap ${viewMode === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Kanban</button>
              <button onClick={() => handleSwitchTab('list')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all whitespace-nowrap ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Danh sách (Excel)</button>
              {canCreateTask && (
                <button onClick={() => handleSwitchTab('backlog')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${viewMode === 'backlog' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-600 hover:bg-indigo-50'}`}>Kho Ý Tưởng</button>
              )}
              {canCreateTask && (
                <button onClick={() => handleSwitchTab('surplus')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${viewMode === 'surplus' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-50'}`}>Kiểm Soát Bài Dư</button>
              )}
            </div>

            {viewMode !== 'backlog' && viewMode !== 'surplus' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-auto flex items-center bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl">
                    <div className="pl-3 py-2 shrink-0">
                        <Filter size={16} className="text-slate-400"/>
                    </div>
                    <select 
                        className="bg-transparent text-xs md:text-sm font-bold text-slate-700 px-2 py-2 w-full outline-none" 
                        value={filterChannel} 
                        onChange={(e) => handleFilterChange(setFilterChannel, e.target.value)}
                    >
                        <option value="ALL">Tất cả Kênh / Dự án</option>
                        {channels.map((ch: any) => (
                            <option key={ch.id} value={ch.id}>
                                {ch.name} {ch.category === 'AI' ? '(AI)' : '(Tổng hợp)'}
                            </option>
                        ))}
                    </select>
                </div>

                <input type="text" placeholder="Tìm tên task..." className="bg-slate-50 border border-slate-200 text-xs md:text-sm font-medium px-3 md:px-4 py-2 rounded-lg md:rounded-xl outline-none focus:border-blue-500 w-full sm:w-48 lg:w-48" value={searchTerm} onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)} />
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-2 md:px-3 py-1.5 md:py-1 shadow-sm w-full sm:w-auto overflow-x-auto custom-scrollbar-thin hidden lg:flex">
                  <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Từ</span>
                  <input type="date" className="bg-transparent text-xs md:text-sm font-bold text-slate-600 outline-none" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  <div className="w-[1px] h-4 bg-slate-300 mx-1 shrink-0"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Đến</span>
                  <input type="date" className="bg-transparent text-xs md:text-sm font-bold text-slate-600 outline-none" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                
                {viewMode === 'list' && (
                    <select className="bg-slate-50 border border-slate-200 text-xs md:text-sm font-bold text-slate-600 px-3 md:px-4 py-2 rounded-lg md:rounded-xl outline-none focus:border-blue-500 w-full sm:w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                      <option value="ALL">Mọi trạng thái</option>
                      <option value="TODO">Chờ Kịch bản</option>
                      <option value="CONTENT_REVIEW">Chờ duyệt Content</option>
                      <option value="ANIMATION_DOING">Đang làm CĐ</option>
                      <option value="ANIMATION_REVIEW">Chờ duyệt CĐ</option>
                      <option value="EDIT_DOING">Đang Dựng Video</option>
                      <option value="EDIT_REVIEW">Chờ Đăng (QC)</option>
                      <option value="DONE">Hoàn thành</option>
                    </select>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2">
          {viewMode === 'board' && (
            <BoardView 
                tasks={tasks} 
                columns={BOARD_COLUMNS} 
                getTeamColor={getTeamColor} 
                onDragEnd={onDragEnd} 
                onOpenTaskDetail={handleOpenTaskDetail} 
                userRole={userRole} 
                currentUserId={(session?.user as any)?.id} 
            />
          )}

          {viewMode === 'list' && (
            <ListView filteredTasks={filteredTasks} columns={COLUMNS} onOpenTaskDetail={handleOpenTaskDetail} currentPage={currentPage} setCurrentPage={setCurrentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={ITEMS_PER_PAGE} />
          )}

          {viewMode === 'backlog' && (
            <BacklogView
              backlogTasks={backlogTasks}
              onQuickAdd={handleCreateTaskSubmit}
              onPushToBoard={(task: any) => {
                setTaskToPush(task);
                setIsPushModalOpen(true);
              }}
              channels={channels}
              onDelete={handleDeleteTask}
            />
          )}

          {viewMode === 'surplus' && (
            <SurplusView />
          )}
        </div>

        <CreateTaskModal isOpen={isModalOpen} initialData={editingTask} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} users={users} teams={teams} onSubmit={handleCreateTaskSubmit} isSubmitting={isSubmitting} errors={modalErrors} projects={projects} />

        <TaskDetailDrawer isOpen={isDrawerOpen} onClose={handleCloseDrawer} selectedTask={selectedTask} taskLinks={taskLinks} setTaskLinks={setTaskLinks} errors={drawerErrors} isSavingLinks={isSavingLinks} onSaveLinks={handleSaveLinks} onToggleClose={handleToggleCloseTask} onReject={handleRejectTask} canReject={canReject} messages={messages} chatMessage={chatMessage} setChatMessage={setChatMessage} onSendMessage={handleSendMessage} userRole={userRole} sessionUserId={(session?.user as any)?.id} onSubmitEvaluation={handleEvaluationSubmit}
          onEditTask={() => {
            setIsDrawerOpen(false); 
            setEditingTask(selectedTask); 
            setIsModalOpen(true); 
            
          }}
          onRefreshBoard={() => {
            fetchTasks(); 
            if (socket) socket.emit("board_updated"); 
          }}
          onDeleteTask={handleDeleteTask}
          isLoading={isLoadingDetail}
          onUploadImage={handleUploadImage}
        />

        <PushTaskModal
          isOpen={isPushModalOpen}
          onClose={() => setIsPushModalOpen(false)}
          task={taskToPush}
          teams={teams}
          session={session}
          onSubmit={handlePushTaskSubmit}
          isSubmitting={isPushing}
        />

        <MergeVideoModal 
            isOpen={isMergeModalOpen}
            onClose={() => setIsMergeModalOpen(false)}
            projects={projects}
            teams={teams}
            channels={channels}
            onSubmit={handleMergeSubmit}
            isSubmitting={isMerging}
        />
      </div>
    </PermissionGuard>
  );
}