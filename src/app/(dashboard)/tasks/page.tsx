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

// Định nghĩa các cột với nền đậm hơn, dễ phân biệt ranh giới giữa các bước
const COLUMNS = {
  TODO: {
    id: "TODO", title: "Chờ Kịch Bản", icon: <FileText size={18} className="text-slate-700" />,
    color: "text-slate-800", iconBg: "bg-slate-300",
    columnBg: "bg-slate-200", borderColor: "border-slate-300"
  },
  DOING: {
    id: "DOING", title: "Chờ Dựng", icon: <PlayCircle size={18} className="text-blue-700" />,
    color: "text-blue-800", iconBg: "bg-blue-300",
    columnBg: "bg-blue-100", borderColor: "border-blue-300"
  },
  REVIEW: {
    id: "REVIEW", title: "Chờ Đăng", icon: <Clock size={18} className="text-orange-700" />,
    color: "text-orange-800", iconBg: "bg-orange-300",
    columnBg: "bg-orange-100", borderColor: "border-orange-300"
  },
  DONE: {
    id: "DONE", title: "Hoàn Thành", icon: <CheckCircle2 size={18} className="text-green-700" />,
    color: "text-green-800", iconBg: "bg-green-300",
    columnBg: "bg-green-100", borderColor: "border-green-300"
  },
};

// 1. Bảng 8 màu Đậm (Solid) để phân biệt Team cực kỳ rõ ràng
const TEAM_COLORS = [
  { bg: "bg-blue-600", text: "text-white", border: "border-blue-600" },
  { bg: "bg-purple-600", text: "text-white", border: "border-purple-600" },
  // { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-600" },
  { bg: "bg-orange-500", text: "text-white", border: "border-orange-500" },
  { bg: "bg-pink-600", text: "text-white", border: "border-pink-600" },
  { bg: "bg-cyan-600", text: "text-white", border: "border-cyan-600" },
  { bg: "bg-indigo-600", text: "text-white", border: "border-indigo-600" },
  { bg: "bg-rose-600", text: "text-white", border: "border-rose-600" },
];

// Hàm băm màu (Giữ nguyên như cũ)
const getTeamColor = (teamId?: string) => {
  if (!teamId) return { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-300" };
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = teamId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TEAM_COLORS.length;
  return TEAM_COLORS[index];
};
export default function KanbanBoard() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<any>({ TODO: [], DOING: [], REVIEW: [], DONE: [] });
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // THÊM STATE CHO DRAWER TRẢ BÀI
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskLinks, setTaskLinks] = useState({ scriptLink: "", videoLink: "", publishLink: "" });
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const { showToast } = useToast();
  const [linksError, setLinksError] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  // Tạm thời dùng state này để test UI, sau này nối API lấy từ DB lên
  const [messages, setMessages] = useState([
    { id: 1, sender: "Admin", text: "Nhớ check kỹ bản quyền nhạc trước khi render nhé em!", time: "10:00 AM", isMine: true },
  ]);
  const [socket, setSocket] = useState<Socket | null>(null);
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  // Tìm dòng này và thay thế
  const [newTask, setNewTask] = useState({ title: "", linkContent: "", contentId: "", editorId: "", teamId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [teams, setTeams] = useState<any[]>([]);

  // === STATE CHO CHẾ ĐỘ HIỂN THỊ & TÌM KIẾM ===
  const [viewMode, setViewMode] = useState<'board' | 'list'>((searchParams.get("viewMode") as 'board' | 'list') || 'board');
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "ALL");
  const [fromDate, setFromDate] = useState(searchParams.get("fromDate") || "");
  const [toDate, setToDate] = useState(searchParams.get("toDate") || "");
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);


  const userRole = (session?.user as any)?.role;
  const canReject = userRole === 'ADMIN' || userRole === 'LEADER' || userRole === 'BAN_GIAM_DOC';


  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0); // Để đếm "Hiển thị 1 - 10 trên tổng 120 task"
  const ITEMS_PER_PAGE = 7;

  // Lỗi cho Modal Tạo Task
  const [modalErrors, setModalErrors] = useState<{ [key: string]: string }>({});

  // Lỗi cho Drawer nộp bài
  const [drawerErrors, setDrawerErrors] = useState<{ [key: string]: string }>({});
  // Logic lọc dữ liệu
  const [boardUpdateSignal, setBoardUpdateSignal] = useState(0);
  // const isFirstRender = useRef(true);
  const fetchTasks = async () => {
    try {
      // Ghép nối chuỗi Query URL
      const params = new URLSearchParams({
        viewMode,
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        search: searchTerm,
        status: filterStatus,
        fromDate,
        toDate
      });

      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();

      if (!data.tasks) {
        setLoading(false);
        return;
      }

      if (viewMode === 'board') {
        // Phân loại vào 4 cột cho Kanban
        const groupedTasks = { TODO: [], DOING: [], REVIEW: [], DONE: [] };
        data.tasks.forEach((task: any) => {
          if (groupedTasks[task.status as keyof typeof groupedTasks]) {
            (groupedTasks[task.status as keyof typeof groupedTasks] as any[]).push(task);
          }
        });
        setTasks(groupedTasks);
      } else {
        // Lưu thẳng data vào cho dạng Danh sách
        setRawTasks(data.tasks);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      }
      setLoading(false);
    } catch (err) {
      console.error("Lỗi tải Task", err);
      setLoading(false);
    }
  };
  const filteredTasks = rawTasks.filter((task) => {
    const matchSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || task.status === filterStatus;

    // LỌC THEO KHOẢNG THỜI GIAN
    const taskDate = new Date(task.createdAt).toISOString().split('T')[0];

    // Nếu có chọn 'Từ ngày' thì taskDate phải >= fromDate
    const matchFrom = fromDate === "" || taskDate >= fromDate;
    // Nếu có chọn 'Đến ngày' thì taskDate phải <= toDate
    const matchTo = toDate === "" || taskDate <= toDate;

    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  // Hàm Lưu Link báo cáo
  const handleSaveLinks = async () => {
    if (!selectedTask) return;
    setIsSavingLinks(true);
    setLinksError("");
    
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskLinks),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field) {
          setDrawerErrors({
            [data.field]: data.error // Chỉ hiện lỗi đúng ô đó
          });
        } else {
          // Các lỗi khác không phải do trùng link thì vẫn báo Toast
          showToast('error', data.error);
        }
      } else {
        fetchTasks();
        showToast('success', 'Đã lưu kịch bản thành công.');
        setIsDrawerOpen(false);
        handleCloseDrawer();
        if (socket) socket.emit("board_updated");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingLinks(false);
    }
  };

  // Hàm Đóng / Mở lại Task (Approve)
  const handleToggleCloseTask = async () => {
    if (!selectedTask) return;

    const newClosedState = !selectedTask.isClosed;

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClosed: newClosedState }),
      });

      if (res.ok) {
        const data = await res.json(); // 🛠️ Hứng data từ Server
        
        showToast('success', newClosedState ? 'Đã đóng Task thành công.' : 'Đã mở lại Task.');
        fetchTasks(); 
        setIsDrawerOpen(false); 

        // ==========================================
        // 🚀 BẮN SOCKET: THÔNG BÁO DUYỆT TASK
        // ==========================================
        if (socket) {
          // Nếu là ĐÓNG TASK (Duyệt) thì mới bắn thông báo chúc mừng
          if (newClosedState) {
            // Trường hợp 1: Backend có trả mảng Noti
            if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
              socket.emit("send_notification", {
                userIds: data.userIdsToNotify,
                notification: data.notifications[0]
              });
            } 
            // Trường hợp 2: Tự bắn ép bằng ID trên UI
            else {
              const targetUserId = selectedTask.contentId || selectedTask.editorId;
              if (targetUserId) {
                socket.emit("approve_task", {
                  taskId: selectedTask.id,
                  taskName: selectedTask.title,
                  workerId: targetUserId,
                });
              }
            }
          }
          socket.emit("board_updated"); // Cập nhật bảng
        }
      } else {
        showToast('error', 'Lỗi khi đóng Task!');
      }
    } catch (error) {
      showToast('error', 'Lỗi Server!');
    }
  };
  const handleRejectTask = async () => {
    if (!selectedTask) return;

    // Sếp có thể nhập lý do trả lại
    const reason = window.prompt("Nhập lý do yêu cầu làm lại (hoặc để trống):") || "Cần chỉnh sửa thêm theo yêu cầu Sếp.";

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isClosed: false,    // Ép mở lại task nếu đang bị đóng
          status: "DOING"     // Đẩy thẳng về cột Chờ Dựng để sửa lại
        }),
      });

      if (res.ok) {
        const data = await res.json(); // 🛠️ Hứng data từ Server
        
        showToast('success', 'Đã Reject! Task bị trả về cột Chờ Dựng.');
        fetchTasks(); 
        setIsDrawerOpen(false); 

        // ==========================================
        // 🚀 BẮN SOCKET: THÔNG BÁO TỪ CHỐI TASK
        // ==========================================
        if (socket) {
          // Trường hợp 1: Backend trả về sẵn mảng Noti
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", {
              userIds: data.userIdsToNotify,
              notification: data.notifications[0]
            });
          } 
          // Trường hợp 2: Tự lấy ID từ giao diện để bắn ép
          else {
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
          
          socket.emit("board_updated"); // Báo mọi người F5 bảng
        }
      } else {
        showToast('error', 'Có lỗi khi Reject Task!');
      }
    } catch (error) {
      showToast('error', 'Lỗi kết nối máy chủ!');
    }
  };
  // 1. Hàm MỞ DRAWER (Chỉ đẩy taskId lên URL)
  const handleOpenTaskDetail = (task: any) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskId", task.id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // 2. Hàm ĐÓNG DRAWER (Chỉ xóa taskId khỏi URL)
  const handleCloseDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };


  // =====================================================================
  // 1. CÁC HÀM GỌI API ĐỘC LẬP (Tách khỏi useEffect)
  // =====================================================================
  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (error) {
      console.error("Lỗi tải danh sách Users:", error);
    }
  };

  const loadTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();
      if (Array.isArray(data)) setTeams(data);
    } catch (error) {
      console.error("Lỗi tải danh sách Teams:", error);
    }
  };

  // (Hàm fetchTasks của bạn đã được khai báo ở trên, giữ nguyên hàm đó nhé)

  // Hàm xử lý chung khi người dùng thay đổi bộ lọc (Sẽ tự động đưa về trang 1)
  const handleFilterChange = (setter: any, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const isFirstRender = useRef(true);

  // =====================================================================
  // 2. USE-EFFECT 1: KHỞI TẠO LẦN ĐẦU (Chạy đúng 1 lần khi mở trang)
  // =====================================================================
  useEffect(() => {
    // Kết nối Socket
    const newSocket = io();
    setSocket(newSocket);
    newSocket.on("reload_board", () => {
      setBoardUpdateSignal(prev => prev + 1);
    });
    // Gọi các hàm API khởi tạo
    loadUsers();
    loadTeams();
    fetchTasks();

    // Dọn dẹp socket khi tắt tab
    return () => {
      newSocket.disconnect();
    };
  }, []); // <-- Mảng rỗng đảm bảo chỉ chạy 1 lần

  // =====================================================================
  // 3. USE-EFFECT 2: LỌC DỮ LIỆU & ĐỒNG BỘ URL (Chạy khi State thay đổi)
  // =====================================================================
  useEffect(() => {
    // Bỏ qua lần render đầu tiên (Vì đã có UseEffect 1 lo việc fetch data ban đầu rồi)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // A. Cập nhật State lên thanh địa chỉ URL
    const params = new URLSearchParams();
    params.set("viewMode", viewMode);
    params.set("page", currentPage.toString());
    if (searchTerm) params.set("search", searchTerm);
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (activeTaskId) params.set("taskId", activeTaskId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    // B. Đợi 300ms rồi mới gọi API lấy Task (Kỹ thuật Debounce chống giật lag)
    const timeoutId = setTimeout(() => {
      fetchTasks();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentPage, searchTerm, filterStatus, fromDate, toDate, viewMode, pathname, router, boardUpdateSignal]);

  // =====================================================================
  // 4. USE-EFFECT 3: QUẢN LÝ PHÒNG CHAT CỦA TASK (Chạy khi bấm mở Drawer)
  // =====================================================================
  useEffect(() => {
    if (!socket || !selectedTask) return;

    socket.emit("join_task", selectedTask.id);

    const handleReceiveMessage = (data: any) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      setMessages([]);
    };
  }, [socket, selectedTask]);

  // =====================================================================
  // 5. USE-EFFECT 4: TỰ ĐỘNG MỞ TASK KHI CLICK TỪ THÔNG BÁO (DEEP LINK)
  // =====================================================================
  const activeTaskId = searchParams.get("taskId");
  useEffect(() => {
    if (activeTaskId) {
      // 1. Mở Drawer ngay lập tức cho mượt
      setIsDrawerOpen(true);
      setMessages([]); // Clear chat cũ
      setLinksError("");

      // 2. Fetch chi tiết Task
      fetch(`/api/tasks/${activeTaskId}`)
        .then(res => res.json())
        .then(taskData => {
          if (taskData && !taskData.error) {
            setSelectedTask(taskData);
            setTaskLinks({
              scriptLink: taskData.scriptLink || "",
              videoLink: taskData.videoLink || "",
              publishLink: taskData.publishLink || ""
            });
          }
        })
        .catch(err => console.error("Lỗi tải Task:", err));

      // 3. Fetch lịch sử Chat
      fetch(`/api/tasks/${activeTaskId}/comments`)
        .then(res => res.json())
        .then(history => {
          if (Array.isArray(history)) {
            const formattedMessages = history.map((c: any) => ({
              id: c.id,
              taskId: c.taskId,
              sender: c.user?.fullName || c.user?.name || "Ai đó",
              senderId: c.userId,
              text: c.text,
              time: new Date(c.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            }));
            setMessages(formattedMessages);
          }
        })
        .catch(err => console.error("Lỗi tải Chat:", err));

    } else {
      // Nếu URL không có taskId -> Đóng Drawer và dọn dẹp dữ liệu
      setIsDrawerOpen(false);
      // Đợi 300ms cho animation trượt đóng xong rồi mới xóa data để tránh giật UI
      setTimeout(() => {
        setSelectedTask(null);
        setMessages([]);
        setTaskLinks({ scriptLink: "", videoLink: "", publishLink: "" });
      }, 300);
    }
  }, [activeTaskId]);

  // Xử lý sự kiện kéo thả
  const onDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result;

    // Kéo ra ngoài bảng hoặc thả lại vị trí cũ
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColumn = source.droppableId;
    const destColumn = destination.droppableId;

    // Xử lý Giao diện ngay lập tức (Optimistic UI) cho mượt
    const sourceTasks = Array.from(tasks[sourceColumn]);
    const destTasks = sourceColumn === destColumn ? sourceTasks : Array.from(tasks[destColumn]);
    const [movedTask] = sourceTasks.splice(source.index, 1);
    movedTask.status = destColumn; // Cập nhật trạng thái mới
    destTasks.splice(destination.index, 0, movedTask);

    setTasks({
      ...tasks,
      [sourceColumn]: sourceTasks,
      [destColumn]: destTasks,
    });

    // Gọi API lưu vào Database ngầm phía sau
    /* if (sourceColumn !== destColumn) {
      await fetch(`/api/tasks/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: destColumn }),
      });
    } */
    if (sourceColumn !== destColumn) {
      try {
        const res = await fetch(`/api/tasks/${draggableId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: destColumn }),
        });

        if (res.ok) {
          const data = await res.json();

          // 1. KÍCH HOẠT HỆ THỐNG THÔNG BÁO CHO CÁC SẾP (Nếu có)
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0 && socket) {
            socket.emit("send_notification", {
              userIds: data.userIdsToNotify,
              notification: data.notifications[0]
            });
          }

          // 2. Báo cho MỌI NGƯỜI tải lại bảng Kanban (Real-time update)
          if (socket) socket.emit("board_updated");
        }
      } catch (error) {
        console.error("Lỗi cập nhật trạng thái:", error);
      }
    }
    if (socket) socket.emit("board_updated")
  };

  const handleCreateTaskSubmit = async (taskData: any) => {
    setIsSubmitting(true);
    setModalErrors({});
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData)
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error.includes("Link này đã tồn tại")) setModalErrors({ linkContent: data.error });
        else showToast('error', data.error);
      } else {
        setTasks((prev: any) => ({ ...prev, TODO: [data.task, ...prev.TODO] }));
        setIsModalOpen(false);
        
        // ==========================================
        // 🚀 FIX LỖI KẾT NỐI: BẮN SOCKET THÔNG BÁO TẠO TASK
        // ==========================================
        if (socket) {
          // Trường hợp 1: Nếu Backend API có trả về danh sách userIdsToNotify (Giống lúc kéo thả)
          if (data.userIdsToNotify && data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", {
              userIds: data.userIdsToNotify,
              notification: data.notifications[0]
            });
          } 
          // Trường hợp 2: Nếu Backend không trả về, TỰ MÓC ID từ Form lúc bấm nút ra để bắn
          else {
            const targetUserId = taskData.contentId || taskData.editorId; // 🛠️ Lấy chắc chắn từ Form
            if (targetUserId) {
              socket.emit("assign_task", {
                 taskId: data.task?.id,
                 taskName: data.task?.title || taskData.title,
                 assigneeId: targetUserId,
                 assignerName: (session?.user as any)?.fullName || "Quản lý"
              });
            }
          }
          
          // Báo cho MỌI NGƯỜI tải lại bảng Kanban để thấy Thẻ Task mới
          socket.emit("board_updated");
        }
      }
    } catch (err) { 
      showToast('error', "Lỗi kết nối"); 
    }
    finally { setIsSubmitting(false); }
  };

  // Hàm Gửi tin nhắn Real-time
  const handleSendMessage = async () => {
    if (chatMessage.trim() !== '' && socket && selectedTask) {
      const textToSend = chatMessage;
      setChatMessage("");

      try {
        const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSend }),
        });

        if (res.ok) {
          const data = await res.json();
          const savedComment = data.comment;

          // 1. Phát tin nhắn vào phòng chat
          const newMsg = {
            id: savedComment.id,
            taskId: selectedTask.id,
            sender: savedComment.user.fullName,
            senderId: savedComment.userId,
            text: savedComment.text,
            time: new Date(savedComment.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };
          socket.emit("send_message", newMsg);

          // 2. KÍCH HOẠT HỆ THỐNG THÔNG BÁO TOÀN CỤC
          if (data.userIdsToNotify.length > 0) {
            socket.emit("send_notification", {
              userIds: data.userIdsToNotify, // Bắn cho ai?
              notification: data.notifications[0] // Data thông báo
            });
          }
        }
      } catch (error) {
        showToast('error', 'Lỗi kết nối: Không thể gửi tin nhắn!');
      }
    }
  };
  if (loading) return <div className="flex h-full items-center justify-center animate-pulse text-slate-400">Đang tải bảng công việc...</div>;

  return (
    <div className="h-full flex flex-col p-6 animate-fade-in">

      {/* ================= HEADER CỐ ĐỊNH ================= */}
      {/* Lớp shrink-0 chặn header bị thu nhỏ khi nội dung bên dưới quá dài */}
      <div className="shrink-0 mb-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dây chuyền <span className="text-red-600">Sản xuất</span></h1>
            <p className="text-slate-500 font-medium">Quản lý và theo dõi tiến độ video.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md shadow-red-600/20 active:scale-95">
            <Plus size={20} /> Tạo yêu cầu Video
          </button>
        </div>

        {/* Thanh Tabs & Filters */}
        <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('board')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Kanban
            </button>
            <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Danh sách (Excel)
            </button>
          </div>

          {viewMode === 'list' && (
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Tìm tên task..." className="bg-slate-50 border border-slate-200 text-sm font-medium px-4 py-2 rounded-xl outline-none focus:border-blue-500 w-64" value={searchTerm} onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)} />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase">Từ</span>
                <input type="date" className="bg-transparent text-sm font-bold text-slate-600 outline-none" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase">Đến</span>
                <input type="date" className="bg-transparent text-sm font-bold text-slate-600 outline-none" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <select className="bg-slate-50 border border-slate-200 text-sm font-medium px-4 py-2 rounded-xl outline-none focus:border-blue-500" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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

      {/* ================= KHU VỰC ĐỘNG (BẢNG/KANBAN) ================= */}
      {/* flex-1: Chiếm hết phần còn lại. overflow-hidden và min-h-0: Ngăn trang web xuất hiện thanh cuộn tổng */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2">
        {viewMode === 'board' ? (
          <BoardView
            tasks={tasks}
            columns={COLUMNS}
            getTeamColor={getTeamColor}
            onDragEnd={onDragEnd}
            onOpenTaskDetail={handleOpenTaskDetail}
          />
        ) : (
          <ListView
            filteredTasks={filteredTasks}
            columns={COLUMNS}
            onOpenTaskDetail={handleOpenTaskDetail}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>

      {/* ================= MODALS & DRAWERS ================= */}
      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        users={users}
        teams={teams}
        onSubmit={handleCreateTaskSubmit}
        isSubmitting={isSubmitting}
        errors={modalErrors}
      />

      <TaskDetailDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        selectedTask={selectedTask}
        taskLinks={taskLinks}
        setTaskLinks={setTaskLinks}
        errors={drawerErrors}
        isSavingLinks={isSavingLinks}
        onSaveLinks={handleSaveLinks}
        onToggleClose={handleToggleCloseTask}
        onReject={handleRejectTask}
        canReject={canReject}
        messages={messages}
        chatMessage={chatMessage}
        setChatMessage={setChatMessage}
        onSendMessage={handleSendMessage}
        sessionUserId={(session?.user as any)?.id}
      />

    </div>
  );
}