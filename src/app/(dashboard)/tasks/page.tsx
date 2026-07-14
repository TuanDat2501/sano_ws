"use client";

import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Link as LinkIcon, AlertCircle, FileText, CheckCircle2, Clock, PlayCircle, Loader2, X, UsersIcon, Send, MessageSquare, Users, Archive, Download } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import { io, Socket } from "socket.io-client";
import CreateTaskModal from "@/app/component/CreateTaskModal";
import TaskDetailDrawer from "@/app/component/TaskDetailDrawer";
import ListView from "@/app/component/ListView/ListView";
import BoardView from "@/app/component/BoardView/BoardView";
import PermissionGuard from "@/app/component/PermissionGuard";
import BacklogView from "./BacklogView";
import PushTaskModal from "./PushTaskModal";

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
  const [channels, setChannels] = useState<any[]>([]);
  const [tasks, setTasks] = useState<{ [key: string]: any[] }>({ TODO: [], DOING: [], REVIEW: [], DONE: [] });
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskLinks, setTaskLinks] = useState({
    scriptLink: "", englishScriptLink: "", storyboardLink: "",
    audioLink: "", thumbnailLink: "", videoLink: "", publishLink: "", note: ""
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

  const [viewMode, setViewMode] = useState<'board' | 'list' | 'backlog'>((searchParams.get("viewMode") as 'board' | 'list' | 'backlog') || 'board');
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
  const [isClearing, setIsClearing] = useState(false);

  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [taskToPush, setTaskToPush] = useState<any>(null);
  const [isPushing, setIsPushing] = useState(false);

  const backlogTasks = rawTasks.filter(t => t.status === 'BACKLOG');
  const [editingTask, setEditingTask] = useState<any>(null);
  const filteredTasks = rawTasks.filter((task) => {
    if (task.status === 'BACKLOG') return false;
    const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || task.status === filterStatus;
    const taskDate = new Date(task.createdAt).toISOString().split('T')[0];
    const matchFrom = fromDate === "" || taskDate >= fromDate;
    const matchTo = toDate === "" || taskDate <= toDate;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const fetchTasks = async () => {
    try {
      const currentStatus = viewMode === 'backlog' ? 'BACKLOG' : filterStatus;
      const currentLimit = viewMode === 'backlog' ? "50" : ITEMS_PER_PAGE.toString();

      const params = new URLSearchParams({
        viewMode, page: currentPage.toString(), limit: currentLimit,
        search: searchTerm, status: currentStatus, fromDate, toDate
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

      // ❌ ĐÃ XÓA BỎ ĐOẠN AUTO-OPEN Ở ĐÂY ĐỂ TRÁNH XUNG ĐỘT GÂY NHÁY

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

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/tasks/export');
      const data = await res.json();
      if (!res.ok) throw new Error("Lỗi tải dữ liệu");

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách Task');

      // 1. ĐỊNH NGHĨA CỘT (Đúng thứ tự sếp yêu cầu trong ảnh)
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

      // 2. ĐỔ DỮ LIỆU VÀO
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

      // 3. THIẾT KẾ STYLE (Đây là phần sếp cần nhất)

      // Style cho Header (Dòng 1)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 30; // Cho hàng tiêu đề cao tí nhìn cho sang

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF00' } // Màu vàng rực rỡ như ảnh sếp gửi
        };
        cell.font = {
          name: 'Arial',
          bold: true,
          size: 11,
          color: { argb: '000000' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Style cho toàn bộ Data (Kẻ bảng)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'E2E8F0' } },
              left: { style: 'thin', color: { argb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
              right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
            cell.alignment = { vertical: 'middle' };
            // Nếu là link thì cho màu xanh dương
            if (String(cell.value).startsWith('http')) {
              cell.font = { color: { argb: '2563EB' }, underline: true };
            }
          });
        }
      });

      // 4. TIỆN ÍCH NÂNG CAO
      worksheet.views = [{ state: 'frozen', ySplit: 1 }]; // Cố định hàng tiêu đề
      worksheet.autoFilter = 'A1:P1'; // Thêm bộ lọc cho sếp dễ lọc theo Kênh/User

      // 5. XUẤT FILE
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
  // 🚀 LOGIC TỰ ĐỘNG MỞ DRAWER KHI URL CÓ TASKID
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");

    // Chỉ chạy nếu URL có ID, chưa có task được chọn, VÀ Drawer đang đóng
    if (taskIdFromUrl && !selectedTask && !isDrawerOpen) {
      const fetchAndOpenTask = async () => {
        try {
          const res = await fetch(`/api/tasks/${taskIdFromUrl}`);
          if (res.ok) {
            const taskData = await res.json();
            handleOpenTaskDetail(taskData);
          }
        } catch (err) {
          console.error("Lỗi khi tự động mở task từ URL:", err);
        }
      };

      fetchAndOpenTask();
    }
  }, [searchParams]); // ❌ Xóa bớt socket và selectedTask khỏi dependency
  const loadChannels = async () => {
    try {
      const res = await fetch("/api/channels");
      const data = await res.json();
      if (Array.isArray(data)) setChannels(data);
    } catch (error) { }
  };
  useEffect(() => {
    // 🚀 Kết nối thẳng đến VPS của sếp
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://socket.sanogroup.tv";

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);
    newSocket.on("receive_message", (data: any) => {
      setMessages((prev) => {
        // Tránh bị lặp tin nhắn nếu mình chính là người vừa bấm gửi
        if (prev.some(m => m.id === data.id)) return prev;

        return [...prev, {
          id: data.id,
          sender: data.sender,
          text: data.text,
          time: data.time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          isMine: data.senderId === (session?.user as any)?.id
        }];
      });
    });
    newSocket.on("reload_board", () => {
      setBoardUpdateSignal(prev => prev + 1);
    });
    loadUsers(); loadTeams(); loadProjects(); loadChannels(); fetchTasks();
    return () => { newSocket.disconnect(); };
  }, []);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }

    // 🚀 LẤY GỐC TỪ searchParams CỦA NEXT.JS (An toàn tuyệt đối)
    const params = new URLSearchParams(searchParams.toString());

    params.set("viewMode", viewMode);
    params.set("page", currentPage.toString());

    if (searchTerm) params.set("search", searchTerm); else params.delete("search");
    if (filterStatus !== "ALL") params.set("status", filterStatus); else params.delete("status");
    if (fromDate) params.set("fromDate", fromDate); else params.delete("fromDate");
    if (toDate) params.set("toDate", toDate); else params.delete("toDate");

    // 🚀 CHỈ THAY ĐỔI URL NẾU CÓ SỰ KHÁC BIỆT THỰC SỰ
    const newQueryString = params.toString();
    if (searchParams.toString() !== newQueryString) {
      router.replace(`${pathname}?${newQueryString}`, { scroll: false });
    }

    const timeoutId = setTimeout(() => { fetchTasks(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentPage, searchTerm, filterStatus, fromDate, toDate, viewMode, boardUpdateSignal]);
  // ❌ ĐÃ XÓA router và pathname khỏi dependency để chống loop vô tận


  // =========================================================================
  // 🚀 CÁC HÀM XỬ LÝ (ĐÃ ĐƯỢC PHỤC HỒI TOÀN BỘ)
  // =========================================================================

  const handleFilterChange = (setter: any, value: any) => { setter(value); setCurrentPage(1); };

  const handleSwitchTab = (mode: 'board' | 'list' | 'backlog') => {
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
          time: new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          isMine: c.userId === (session?.user as any)?.id
        }));

        // Đặt lại danh sách tin nhắn (Giữ lại câu chào hệ thống trên cùng)
        setMessages([
          { id: "system", sender: "Hệ thống", text: "Chào mừng đến với không gian thảo luận Task!", time: "", isMine: false },
          ...formattedMessages
        ]);
      }
    } catch (error) {
      console.error("Lỗi tải lịch sử comment:", error);
    }
  };
  const handleOpenTaskDetail = async (task: any) => {
    // 1. Tạm gán data từ thẻ Kanban để Drawer bật lên lập tức (Optimistic UI)
    setSelectedTask(task);
    setTaskLinks({
      scriptLink: task.scriptLink || "",
      englishScriptLink: task.englishScriptLink || "",
      storyboardLink: task.storyboardLink || "",
      audioLink: task.audioLink || "",
      thumbnailLink: task.thumbnailLink || "",
      videoLink: task.videoLink || "",
      publishLink: task.publishLink || "",
      note: task.note || ""
    });
    setIsDrawerOpen(true);

    // 2. 🚀 LUÔN LUÔN GỌI LẠI API ĐỂ KÉO DATA MỚI NHẤT KHI MỞ DRAWER
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const fullTask = await res.json();
        setSelectedTask(fullTask); // Cập nhật data cho các tab khác

        // 🚀 BỔ SUNG QUAN TRỌNG NHẤT: Đổ data mới nhất từ Backend vào lại State của Input Links
        setTaskLinks({
          scriptLink: fullTask.scriptLink || "",
          englishScriptLink: fullTask.englishScriptLink || "",
          storyboardLink: fullTask.storyboardLink || "",
          audioLink: fullTask.audioLink || "",
          thumbnailLink: fullTask.thumbnailLink || "",
          videoLink: fullTask.videoLink || "",
          publishLink: fullTask.publishLink || "",
          note: fullTask.note || ""
        });
      }
    } catch (err) {
      console.error("Lỗi fetch chi tiết task:", err);
    }

    // 3. Tải tin nhắn và join Socket
    loadTaskComments(task.id);
    if (socket) socket.emit("join_task", task.id);

    // 4. Đồng bộ URL
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("taskId") !== task.id) {
      params.set("taskId", task.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedTask(null), 300);

    // 🚀 DÙNG searchParams CHUẨN CỦA NEXT.JS
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

    // Cập nhật UI ngay lập tức (Optimistic UI)
    const sourceCol = [...tasks[source.droppableId]];
    const destCol = [...tasks[destination.droppableId]];
    const [movedTask] = sourceCol.splice(source.index, 1);
    movedTask.status = destination.droppableId;
    destCol.splice(destination.index, 0, movedTask);

    setTasks({ ...tasks, [source.droppableId]: sourceCol, [destination.droppableId]: destCol });

    // Bắn API lưu Database
    try {
      const res = await fetch(`/api/tasks/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destination.droppableId })
      });

      const data = await res.json(); // 🚀 Đọc response từ API để lấy Data chuẩn

      if (res.ok) {
        if (socket) {
          // 1. Báo mọi người tải lại bảng Kanban
          socket.emit("board_updated");

          // 🚀 2. XỬ LÝ NOTIFICATION REAL-TIME
          // Ưu tiên 1: Nếu Backend của Sếp có sinh ra Noti (lưu DB) thì bắn Socket luôn
          if (data && data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", {
              userIds: data.userIdsToNotify,
              notification: data.notifications[0]
            });
          }
          // Ưu tiên 2: Nếu Backend chưa kịp làm Noti, Frontend sẽ tự suy luận để bắn (Fallback)
          else {
            const currentUserId = (session?.user as any)?.id;
            const currentUserName = (session?.user as any)?.name || (session?.user as any)?.fullName || "Ai đó";

            // Dùng Set để lọc trùng lặp ID
            const targetIds = new Set<string>();

            // 🔥 Quan trọng: Báo cho Người tạo Task (Sếp/Leader) biết để vào nghiệm thu
            if (movedTask.creatorId && movedTask.creatorId !== currentUserId) targetIds.add(movedTask.creatorId);
            // Báo cho Content (Nếu Editor kéo)
            if (movedTask.contentId && movedTask.contentId !== currentUserId) targetIds.add(movedTask.contentId);
            // Báo cho Editor (Nếu Content/Sếp kéo)
            if (movedTask.editorId && movedTask.editorId !== currentUserId) targetIds.add(movedTask.editorId);

            const targets = Array.from(targetIds);

            if (targets.length > 0) {
              // Tuỳ biến câu chữ mượt mà theo từng cột thả vào
              let actionText = "đã cập nhật trạng thái";
              if (destination.droppableId === "DOING") actionText = "đã chuyển sang Chờ Dựng 🎬";
              if (destination.droppableId === "REVIEW") actionText = "đã chuyển sang Chờ Đăng ⏳";
              if (destination.droppableId === "DONE") actionText = "đã Hoàn Thành 🎉";

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
        fetchTasks(); // Giật lại data cũ nếu lỗi
      }
    } catch (e) {
      showToast('error', 'Lỗi kết nối tới Server');
      fetchTasks();
    }
  };

  // Tạo hoặc Sửa Task
  const handleCreateTaskSubmit = async (taskData: any) => {
    setIsSubmitting(true);
    setModalErrors({});
    try {
      const isEditMode = !!taskData.id; // 🚀 Xác định xem là đang tạo hay sửa
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
        setEditingTask(null); // 🚀 Xóa state sau khi xong
        setCurrentPage(1);
        fetchTasks();

        // 🚀 PHỤC HỒI SOCKET
        if (socket) {
          socket.emit("board_updated");
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          } else if (!isEditMode) {
            // Chỉ báo assign task nếu là tạo mới
            const targetUserId = taskData.contentId || taskData.editorId;
            if (targetUserId) {
              socket.emit("assign_task", {
                taskId: data.task?.id,
                taskName: data.task?.title || taskData.title,
                assigneeId: targetUserId,
                assignerName: (session?.user as any)?.fullName || "Quản lý"
              });
            }
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

  // Lưu link báo cáo trong Task Detail
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
          audioLink: "", thumbnailLink: "", videoLink: "", publishLink: "", note: ""
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

  // Đóng / Mở lại Task (Nghiệm thu)
  // Đóng / Mở lại Task (Nghiệm thu)
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

        // 🚀 PHỤC HỒI SOCKET NGHIỆM THU
        if (socket) {
          socket.emit("board_updated");
          if (newClosedState) {
            if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
              socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
            } else {
              const targetUserId = selectedTask.contentId || selectedTask.editorId;
              if (targetUserId) {
                socket.emit("approve_task", {
                  taskId: selectedTask.id,
                  taskName: selectedTask.title,
                  workerId: targetUserId
                });
              }
            }
          }
        }
      }
    } catch (error) {
      showToast("error", "Lỗi thao tác");
    }
  };

  // Đánh Reject (Trả về làm lại)
  const handleRejectTask = async () => {
    const reason = window.prompt("Nhập lý do yêu cầu làm lại (hoặc để trống):") || "Cần chỉnh sửa thêm theo yêu cầu Sếp.";
    if (!reason) return; // Nếu user bấm Cancel ở prompt thì hủy

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClosed: false, status: "DOING" })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Đã trả Task về làm lại!");
        setIsDrawerOpen(false);
        fetchTasks();

        // 🚀 PHỤC HỒI SOCKET REJECT
        if (socket) {
          socket.emit("board_updated");
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          } else {
            const targetUserId = selectedTask.contentId || selectedTask.editorId;
            if (targetUserId) {
              socket.emit("reject_task", {
                taskId: selectedTask.id,
                taskName: selectedTask.title,
                workerId: targetUserId,
                reason: reason,
                rejecterName: (session?.user as any)?.fullName || "Quản lý"
              });
            }
          }
        }
      }
    } catch (error) {
      showToast("error", "Lỗi thao tác");
    }
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
      } else {
        showToast('error', data.error || 'Có lỗi xảy ra!');
      }
    } catch (error) {
      showToast('error', 'Lỗi kết nối!');
    } finally {
      setIsClearing(false);
    }
  };

  // Giao việc từ kho
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

        // 🚀 PHỤC HỒI SOCKET REAL-TIME GIAO VIỆC
        if (socket) {
          socket.emit("board_updated");
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", { userIds: data.userIdsToNotify, notification: data.notifications[0] });
          } else {
            const targetUserId = pushData.contentId || pushData.editorId;
            if (targetUserId) {
              socket.emit("assign_task", {
                taskId: taskToPush.id,
                taskName: taskToPush.title,
                assigneeId: targetUserId,
                assignerName: (session?.user as any)?.fullName || "Quản lý"
              });
            }
          }
        }
      } else {
        showToast('error', data.error || 'Lỗi giao việc');
      }
    } catch (error) {
      showToast('error', 'Lỗi kết nối Server');
    } finally {
      setIsPushing(false);
    }
  };

  // Xóa Task Kho
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Sếp có chắc muốn xóa ý tưởng này khỏi kho không?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast("success", "Đã xóa thành công!");
        fetchTasks();
        if (socket) socket.emit("board_updated");
      } else {
        showToast("error", "Lỗi khi xóa ý tưởng");
      }
    } catch (error) {
      showToast("error", "Lỗi kết nối Server");
    }
  };

  // ==========================================
  // XỬ LÝ CHAT TRONG TASK CHUẨN API & SOCKET
  // ==========================================
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

  // ==========================================
  // XỬ LÝ NỘP ĐÁNH GIÁ KPI CHUẨN API & SOCKET
  // ==========================================
  const handleEvaluationSubmit = async (score: number, criteriaData: any, note: string) => {
    try {
      // 🚀 1. Đổi URL gọi vào đúng file API sếp đã tạo
      const res = await fetch(`/api/tasks/${selectedTask.id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: score,
          criteria: criteriaData, // Gửi lên với key là 'criteria'
          note: note
        })
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        showToast("error", "Lỗi 404: Không tìm thấy API Endpoint!");
        return;
      }

      const data = await res.json();

      if (res.ok) {
        showToast("success", "Đã lưu đánh giá KPI thành công!");
        fetchTasks();

        if (socket) {
          socket.emit("board_updated");
          const targetUserId = selectedTask.editorId || selectedTask.contentId;
          if (targetUserId) {
            socket.emit("send_notification", {
              userIds: [targetUserId],
              notification: {
                title: "Đánh giá Task 🌟",
                message: `Task "${selectedTask.title}" của bạn vừa được đánh giá ${score} điểm!`,
                type: "success",
                taskId: selectedTask.id,
                time: new Date().toISOString()
              }
            });
          }
        }

        handleCloseDrawer();
      } else {
        showToast("error", data.error || "Lỗi khi lưu đánh giá");
      }
    } catch (error) {
      showToast("error", "Lỗi kết nối tới Server");
    }
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
                <button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white px-4 md:px-5 py-2.5 md:py-2.5 rounded-xl md:rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 text-sm md:text-base">
                  <Plus size={18} className="md:w-5 md:h-5" /> Tạo yêu cầu Video
                </button>
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
          {viewMode === 'board' && (
            <BoardView tasks={tasks} columns={COLUMNS} getTeamColor={getTeamColor} onDragEnd={onDragEnd} onOpenTaskDetail={handleOpenTaskDetail} userRole={userRole} />
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
        </div>

        <CreateTaskModal isOpen={isModalOpen} initialData={editingTask} onClose={() => { setIsModalOpen(false); setEditingTask(null); }} users={users} teams={teams} onSubmit={handleCreateTaskSubmit} isSubmitting={isSubmitting} errors={modalErrors} projects={projects} />

        <TaskDetailDrawer isOpen={isDrawerOpen} onClose={handleCloseDrawer} selectedTask={selectedTask} taskLinks={taskLinks} setTaskLinks={setTaskLinks} errors={drawerErrors} isSavingLinks={isSavingLinks} onSaveLinks={handleSaveLinks} onToggleClose={handleToggleCloseTask} onReject={handleRejectTask} canReject={canReject} messages={messages} chatMessage={chatMessage} setChatMessage={setChatMessage} onSendMessage={handleSendMessage} userRole={userRole} sessionUserId={(session?.user as any)?.id} onSubmitEvaluation={handleEvaluationSubmit}
          onEditTask={() => {
            setIsDrawerOpen(false); // Tạm đóng Drawer chi tiết
            setEditingTask(selectedTask); // Lưu data task hiện tại vào state
            setIsModalOpen(true); // Mở modal Create lên (Nó sẽ tự thành Form Sửa vì đã có editingTask)
            
          }}
          onRefreshBoard={() => {
            fetchTasks(); // Kéo dữ liệu mới từ Database về
            if (socket) socket.emit("board_updated"); // Báo mọi người khác cùng reload
          }}
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
      </div>
    </PermissionGuard>
  );
}