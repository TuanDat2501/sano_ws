"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Menu, X, Bell } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/component/ToastProvider";

interface NavbarProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
}

export default function Navbar({ isSidebarOpen, setSidebarOpen }: NavbarProps) {
  const processedNotifs = useRef<Set<string>>(new Set());
  // REF ĐỂ XỬ LÝ CLICK RA NGOÀI DROPDOWN
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const { data: session } = useSession();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // =======================================
  // 🚀 HÀM KÉO DATA TỪ DATABASE (ĐÃ CHỐNG CACHE TRIỆT ĐỂ)
  // =======================================
  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        // Sắp xếp thời gian mới nhất lên đầu
        const sortedData = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(sortedData);
      }
    } catch (error) {
      console.error("Lỗi fetch thông báo:", error);
    }
  };

  // =======================================
  // HOOK 1: ĐÓNG BẢNG THÔNG BÁO KHI CLICK RA NGOÀI
  // =======================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // =======================================
  // HOOK 2: QUẢN LÝ SOCKET VÀ LẮNG NGHE SỰ KIỆN
  // =======================================
  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;

    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setNotifications(data);
      });

    // 🚀 ĐIỂM SỬA CHỮA CHÍ MẠNG: ÉP DÙNG WEBSOCKET
    const socketInstance = io({
      transports: ["websocket"], // Tuyệt đối cấm Polling, chỉ dùng WebSocket
      reconnectionAttempts: 5,   // Nếu đứt mạng, chỉ thử kết nối lại 5 lần rồi dừng
      reconnectionDelay: 2000,   // Mỗi lần thử cách nhau 2 giây (chống spam server)
    });
    
    setSocket(socketInstance);

    // Hàm báo danh
    const handleConnect = () => {
      console.log("🟢 Navbar: Socket Connected (WebSocket). Báo danh ID:", userId);
      socketInstance.emit("register_user", String(userId));
    };

    if (socketInstance.connected) {
      handleConnect();
    } else {
      socketInstance.on("connect", handleConnect);
    }

    // Hàm hứng Noti (Giữ nguyên của sếp)
    const handleReceive = (notif: any) => {
      console.log("📩 TING TING! Nhận Noti Real-time:", notif);
      const notifId = notif.id || `temp_${Date.now()}_${Math.random()}`;
      
      if (processedNotifs.current.has(notifId)) return;
      processedNotifs.current.add(notifId);

      const safeNotif = { 
        ...notif, 
        id: notifId, 
        isRead: false, 
        createdAt: notif.time || notif.createdAt || new Date().toISOString() 
      };

      setNotifications((prev) => [safeNotif, ...prev]);
      showToast(safeNotif.type || 'info', `🔔 ${safeNotif.title || 'Thông báo'}: ${safeNotif.message}`); 
      
      const audio = new Audio('/sounds/sound-noti-1.mp3');
      audio.play().catch(() => {});
    };

    socketInstance.on("receive_notification", handleReceive);
    
    // DỌN DẸP
    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("receive_notification", handleReceive);
      socketInstance.disconnect();
    };
    
  }, [(session?.user as any)?.id]);

  // =======================================
  // HÀM 1: CLICK VÀO 1 THÔNG BÁO
  // =======================================
  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      fetch(`/api/notifications/${notif.id}`, { method: "PATCH" }).catch(() => fetchNotifications());
    }

    setIsDropdownOpen(false);

    // 🚀 ĐIỀU HƯỚNG THÔNG MINH
    if (notif.taskId) {
      router.push(`/tasks?taskId=${notif.taskId}`);
    }
    else if (notif.requestId) {
      // 🚀 BƯỚC MỚI: Phân tích xem thông báo này báo cho Sếp hay báo cho Nhân viên
      const titleLower = notif.title?.toLowerCase() || "";
      const isForApprover = titleLower.includes("cần duyệt") || titleLower.includes("chờ");

      // Nếu cho Sếp -> Mở Tab Cần duyệt. Nếu cho Nhân viên -> Mở Tab Đơn của tôi.
      const targetTab = isForApprover ? "NEED_APPROVAL" : "MY_REQUESTS";

      // Đẩy cả Tab và ID lên URL
      router.push(`/requests?tab=${targetTab}&id=${notif.requestId}`);
    }
    else if (notif.title?.toLowerCase().includes("đơn") || notif.message?.toLowerCase().includes("duyệt")) {
      router.push(`/requests`);
    }
  };

  // =======================================
  // HÀM 2: ĐÁNH DẤU ĐÃ ĐỌC TẤT CẢ
  // =======================================
  const handleMarkAllAsRead = async () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    const unreadNotifs = notifications.filter(n => !n.isRead);
    if (unreadNotifs.length === 0) return;

    try {
      await Promise.all(
        unreadNotifs.map(n => fetch(`/api/notifications/${n.id}`, { method: "PATCH" }))
      );
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái đã đọc:", error);
    }
  };
  const translateMessage = (msg: string) => {
    if (!msg) return "";

    const dict: Record<string, string> = {
      "NGHI_PHEP": "Nghỉ phép",
      "TAM_UNG": "Tạm ứng",
      "MUA_SAM": "Mua sắm thiết bị",
      "LAM_THEM": "Làm thêm giờ",
      "DI_TRE": "Đi trễ / Về sớm",
      "CONG_TAC": "Công tác",
      "WFH": "Làm việc từ xa"
      // Sếp có mã nào mới thì cứ phẩy rồi thêm vào đây nhé
    };

    let translated = msg;
    Object.keys(dict).forEach(key => {
      // Tìm và thay thế mã hệ thống bằng Tiếng Việt
      translated = translated.replace(key, dict[key]);
    });

    return translated;
  };
  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 relative z-30">
      <button
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className="flex items-center gap-6">

        {/* KHỐI DROPDOWN QUẢ CHUÔNG */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`relative p-2 transition-colors focus:outline-none ${isDropdownOpen ? 'text-red-600' : 'text-slate-400 hover:text-red-600'}`}
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 min-w-5 h-5 px-1 bg-red-600 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-3 w-[360px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-md">
                <h3 className="font-black text-slate-800">Thông báo</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllAsRead} className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline transition-all">
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>

              <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div className="bg-slate-50 p-4 rounded-full mb-3">
                      <Bell size={32} className="opacity-20" />
                    </div>
                    <p className="text-sm font-medium">Bạn chưa có thông báo nào.</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 border-b border-slate-50 flex gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-red-50/30' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="mt-1 shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${!notif.isRead ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Bell size={18} />
                        </div>
                      </div>
                      <div className="flex-1 pr-2">
                        <p className={`text-sm leading-snug ${!notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                          {translateMessage(notif.message)}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                          {new Date(notif.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(notif.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      {!notif.isRead && <div className="w-2.5 h-2.5 rounded-full bg-red-600 mt-2 shrink-0 shadow-sm shadow-red-500/50"></div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Thông tin User */}
        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-none">{session?.user?.name || "Người dùng"}</p>
            <p className="text-[11px] text-slate-500 mt-1 uppercase font-black tracking-wider">{(session?.user as any)?.role || "Thành viên"}</p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center font-black text-red-600 shadow-sm">
            {session?.user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
        </div>
      </div>
    </header>
  );
}