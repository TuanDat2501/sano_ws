"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle, Info, XOctagon } from "lucide-react";
import PusherClient from "pusher-js";
import { useSession } from "next-auth/react";

export default function NotificationBell() {
    const { data: session } = useSession();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const userId = (session?.user as any)?.id;
        if (!userId) return;

        // 1. KẾT NỐI PUSHER
        const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
            cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        });

        // 2. ĐĂNG KÝ KÊNH RIÊNG CỦA USER ĐÓ (user-12345)
        const channel = pusher.subscribe(`user-${userId}`);

        // 3. LẮNG NGHE SỰ KIỆN "new-notification"
        channel.bind("new-notification", (data: any) => {
            // Thêm thông báo mới lên đầu mảng
            setNotifications((prev) => [data, ...prev]);
            setUnreadCount((prev) => prev + 1);
            
            // Có thể play 1 file âm thanh ting ting ở đây nếu sếp thích
        });

        // Cleanup khi user đăng xuất hoặc tắt trình duyệt
        return () => {
            pusher.unsubscribe(`user-${userId}`);
        };
    }, [session]);

    // Icon theo loại thông báo
    const getIcon = (type: string) => {
        if (type === 'success') return <CheckCircle className="text-green-500 w-5 h-5" />;
        if (type === 'error') return <XOctagon className="text-red-500 w-5 h-5" />;
        return <Info className="text-blue-500 w-5 h-5" />;
    };

    return (
        <div className="relative">
            {/* NÚT CHUÔNG */}
            <button 
                onClick={() => {
                    setIsOpen(!isOpen);
                    setUnreadCount(0); // Bấm vào là xem như đã đọc
                }} 
                className="relative p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
                <Bell className="text-slate-700 w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* DANH SÁCH THÔNG BÁO DROPDOWN */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-fade-in">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-800">Thông báo</h3>
                            <button onClick={() => setNotifications([])} className="text-[11px] font-bold text-blue-600 hover:underline">Xóa tất cả</button>
                        </div>
                        
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 font-medium text-sm">
                                    Không có thông báo nào.
                                </div>
                            ) : (
                                notifications.map((noti, idx) => (
                                    <div key={idx} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer">
                                        <div className="shrink-0 mt-0.5">{getIcon(noti.type)}</div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{noti.title}</p>
                                            <p className="text-xs text-slate-500 mt-1 leading-snug">{noti.message}</p>
                                            <p className="text-[10px] text-slate-400 font-bold mt-2">
                                                {new Date(noti.time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}