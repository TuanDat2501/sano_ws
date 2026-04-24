"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, UserCircle2, Minus } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from 'next/navigation'; // 🚀 Nhúng thêm useRouter
import { useToast } from "../ToastProvider";

export default function FloatingChat() {
    const pathname = usePathname();
    const router = useRouter(); // 🚀 Khai báo Router
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const { showToast } = useToast();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [dbUsers, setDbUsers] = useState<any[]>([]);
    const [onlineUserNames, setOnlineUserNames] = useState<string[]>([]);
    const [activeChats, setActiveChats] = useState<any[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const chatEndRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const audioRef = useRef<HTMLAudioElement>(null);
    
    // 🚀 TÚI NHỚ ẨN: Giúp Socket đọc được danh sách chat hiện tại mà không làm web bị giật (re-render)
    const activeChatsRef = useRef(activeChats);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/sounds/sound-noti.mp3');
            audio.play().catch(e => console.log("Trình duyệt chặn phát nhạc:", e));
        } catch (err) {
            console.error("Lỗi audio:", err);
        }
    };

    useEffect(() => {
        activeChatsRef.current = activeChats;
    }, [activeChats]);

    // ==========================================
    // 1. KHỞI TẠO DATA & SOCKET
    // ==========================================
    useEffect(() => {
        const userId = currentUser?.id;
        if (!userId) return;

        fetch("/api/users/chat-list")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setDbUsers(data.filter(u => String(u.id) !== String(userId)));
            })
            .catch(err => console.error("Lỗi tải users:", err));

        const newSocket = io();
        setSocket(newSocket);

        const handleConnect = () => {
            console.log("🟢 Floating Chat: Báo danh Username:", currentUser?.username);
            newSocket.emit("user_online", currentUser?.username);
        };

        if (newSocket.connected) {
            handleConnect();
        } else {
            newSocket.on("connect", handleConnect);
        }

        newSocket.on("update_online_users", (usernames: string[]) => {
            setOnlineUserNames(usernames);
        });

        // HỨNG TIN NHẮN (Khi Box Chat ĐÃ MỞ)
        newSocket.on("receive_chat_message", (data: any) => {
            const { roomId, message } = data;

            if (!roomId || !message) return;

            setActiveChats((prevChats) => prevChats.map(chat => {
                if (chat.roomId === roomId) {
                    const isExist = chat.messages.some((m: any) => m.id === message.id);
                    if (isExist) return chat;

                    return {
                        ...chat,
                        messages: [...chat.messages, { ...message, isMe: false }]
                    };
                }
                return chat;
            }));
        });

        // 🚀 TÍNH NĂNG MỚI: TỰ BẬT POPUP KHI CÓ THÔNG BÁO TIN NHẮN 
        newSocket.on("new_message_notification", async (data: any) => {
            const { roomId, message } = data;

            if (!roomId || !message) return;
            if (message.senderId === currentUser?.id) return; 
            if (message.targetId && message.targetId !== currentUser?.id) return; 
            if (pathname === '/chat') return;

            const isChatAlreadyOpen = activeChatsRef.current.some(c => c.roomId === roomId);

            // 🚀 BƯỚC NẢY MOBILE: Nếu đang xài điện thoại, KHÔNG bật popup lơ lửng, chỉ báo Notification (hoặc có thể chuyển thẳng sang /chat)
            if (!isChatAlreadyOpen) {
                playNotificationSound();
                
                // Nếu là màn hình rộng (Desktop) thì mới búng Popup Chat lên
                if (window.innerWidth >= 768) {
                    try {
                        const msgRes = await fetch(`/api/chat/rooms/${roomId}/messages`);
                        const msgData = await msgRes.json();
                        const newChatBox = {
                            roomId: roomId,
                            targetUser: {
                                id: message.senderId,
                                fullName: msgData[msgData.length - 1]?.sender || "Người dùng"
                            },
                            messages: Array.isArray(msgData) ? msgData : [],
                            inputValue: ""
                        };

                        setActiveChats(prev => {
                            if (prev.some(c => c.roomId === roomId)) return prev;
                            return [...prev, newChatBox];
                        });

                        newSocket.emit("join_chat_room", roomId);
                    } catch (err) {
                        console.error("Lỗi khi tự động búng popup chat:", err);
                    }
                } else {
                    // Nếu là Mobile, hiện Toast mượt mà báo có tin nhắn tới để người dùng tự click vào /chat
                    showToast("info", `💬 Tin nhắn mới từ ${message.sender || "ai đó"}`);
                }
            }
        });

        newSocket.on("receive_system_noti", (data: any) => {
            if (data.targetId === currentUser?.id) {
                playNotificationSound();
                showToast("success", `${data.title}: ${data.message}`);
            }
        });

        return () => {
            newSocket.off("connect", handleConnect);
            newSocket.off("update_online_users");
            newSocket.off("receive_chat_message");
            newSocket.off("new_message_notification");
            newSocket.off("receive_system_noti");
            newSocket.disconnect();
        };
    }, [currentUser?.id, pathname]);


    useEffect(() => {
        activeChats.forEach(chat => {
            chatEndRefs.current[chat.roomId]?.scrollIntoView({ behavior: "smooth" });
        });
    }, [activeChats]);

    // ==========================================
    // 2. MỞ BOX CHAT KHI BẤM VÀO USER
    // ==========================================
    const openChatBox = async (targetUser: any) => {
        // 🚀 MOBILE REDIRECT: Nếu là màn hình nhỏ, lập tức chuyển qua trang Full Chat
        if (window.innerWidth < 768) {
            router.push(`/chat`);
            setIsMenuOpen(false);
            return;
        }

        // DESKTOP LOGIC (Giữ nguyên)
        if (activeChats.find(c => c.targetUser.username === targetUser.username)) return;

        try {
            const res = await fetch('/api/chat/rooms/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUsername: targetUser.username, type: 'DIRECT' })
            });
            const roomData = await res.json();

            if (roomData && roomData.id) {
                const msgRes = await fetch(`/api/chat/rooms/${roomData.id}/messages`);
                const msgData = await msgRes.json();

                const newChatBox = {
                    roomId: roomData.id,
                    targetUser: targetUser,
                    messages: Array.isArray(msgData) ? msgData : [],
                    inputValue: ""
                };

                setActiveChats(prev => [...prev, newChatBox]);

                if (socket) socket.emit("join_chat_room", roomData.id);
            }
        } catch (error) {
            console.error("Lỗi mở box chat:", error);
        }
    };

    const closeChatBox = (roomId: string) => {
        setActiveChats(prev => prev.filter(c => c.roomId !== roomId));
    };

    const handleSendMessage = async (roomId: string) => {
        const chatIndex = activeChats.findIndex(c => c.roomId === roomId);
        if (chatIndex === -1) return;

        const textToSend = activeChats[chatIndex].inputValue;
        if (!textToSend.trim()) return;

        const updatedChats = [...activeChats];
        updatedChats[chatIndex].inputValue = "";
        setActiveChats(updatedChats);

        try {
            const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: textToSend })
            });

            if (res.ok) {
                const savedMsg = await res.json();

                const msgObj = {
                    id: savedMsg.id,
                    sender: currentUser.fullName,
                    targetId: activeChats[chatIndex].targetUser.id,
                    senderId: currentUser.id,
                    text: savedMsg.content,
                    isMe: true,
                    fullName: (session?.user as any)?.fullName,
                };

                setActiveChats(prevChats => prevChats.map(chat => {
                    if (chat.roomId === roomId) {
                        if (chat.messages.some((m: any) => m.id === msgObj.id)) return chat;
                        return {
                            ...chat,
                            messages: [...chat.messages, msgObj]
                        };
                    }
                    return chat;
                }));

                if (socket) {
                    socket.emit("send_chat_message", { roomId, message: msgObj });
                }
            } else {
                console.error("Lỗi khi gửi tin nhắn:", await res.text());
            }
        } catch (error) {
            console.error("Lỗi kết nối:", error);
        }
    };

    // 🚀 TÀNG HÌNH: Ẩn hoàn toàn cục FloatingChat khi đang đứng ở trang "/chat"
    if (pathname === '/chat') {
        return null;
    }

    return (
        <div className="fixed bottom-0 right-4 md:right-6 z-[9999] flex items-end gap-3 pointer-events-none pb-4 md:pb-0">

            {/* ========================================== */}
            {/* A. CÁC HỘP THOẠI CHAT ĐANG MỞ (CHỈ HIỂN THỊ TRÊN DESKTOP) */}
            {/* ========================================== */}
            {/* Thêm hidden md:flex để triệt tiêu việc hiện box lơ lửng trên màn nhỏ */}
            <div className="hidden md:flex items-end gap-3 pointer-events-none">
                {activeChats.map((chat) => (
                    <div key={chat.roomId} className="w-[320px] h-[400px] bg-white rounded-t-xl shadow-[0_0_20px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                        <div className="h-12 bg-red-600 text-white px-3 flex justify-between items-center shrink-0 cursor-pointer">
                            <div className="flex items-center gap-2 font-bold text-[15px] truncate">
                                <div className="relative shrink-0">
                                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center font-black text-sm">
                                        {chat.targetUser.avatarUrl ? (
                                            <img src={chat.targetUser.avatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                                        ) : (
                                            <span>{chat.targetUser.fullName?.charAt(0)}</span>
                                        )}
                                    </div>
                                    {onlineUserNames.includes(chat.targetUser.username) && (
                                        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-red-600"></div>
                                    )}
                                </div>
                                <span className="truncate max-w-[150px]">{chat.targetUser.fullName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => closeChatBox(chat.roomId)} className="p-1 hover:bg-white/20 rounded-md transition-colors"><X size={18} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 bg-slate-50 flex flex-col gap-2 custom-scrollbar">
                            {chat.messages.map((msg: any) => (
                                <div key={msg.id} className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] md:text-[14px] ${msg.isMe ? 'bg-red-600 text-white self-end rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 self-start rounded-bl-sm shadow-sm'}`}>
                                    {msg.text || msg.content}
                                </div>
                            ))}
                            <div ref={(el) => { chatEndRefs.current[chat.roomId] = el; }} />
                        </div>

                        <div className="p-2 bg-white border-t border-slate-200 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Nhập tin nhắn..."
                                className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-[13px] md:text-[14px] outline-none"
                                value={chat.inputValue}
                                onChange={(e) => {
                                    const newChats = [...activeChats];
                                    const idx = newChats.findIndex(c => c.roomId === chat.roomId);
                                    newChats[idx].inputValue = e.target.value;
                                    setActiveChats(newChats);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(chat.roomId)}
                            />
                            <button onClick={() => handleSendMessage(chat.roomId)} className="p-2 text-red-600 hover:bg-red-50 rounded-full shrink-0 transition-colors">
                                <Send size={18} className="md:w-5 md:h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ========================================== */}
            {/* B. CỤC MENU LIÊN HỆ GỐC */}
            {/* ========================================== */}
            <div className="flex flex-col items-end pointer-events-auto pb-2 md:pb-6 relative z-50">
                {isMenuOpen && (
                    // 🚀 Responsive: Giới hạn chiều cao và co chiều rộng trên mobile
                    <div className="mb-3 md:mb-4 w-[280px] sm:w-[320px] h-[350px] md:h-[450px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                        <div className="p-3 md:p-4 bg-slate-950 text-white flex justify-between items-center shrink-0">
                            <span className="font-bold text-[14px] md:text-[15px]">Sano Chat</span>
                            <button onClick={() => setIsMenuOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors"><X size={18} className="md:w-5 md:h-5" /></button>
                        </div>

                        <div className="p-2 md:p-3 bg-slate-50/50">
                            <input type="text" placeholder="Tìm kiếm liên hệ..." className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs md:text-sm outline-none focus:ring-1 focus:ring-red-500" />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {dbUsers.map(user => {
                                const isOnline = onlineUserNames.includes(user.username);
                                return (
                                    <div key={user.id} onClick={() => openChatBox(user)} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 group">
                                        <div className="shrink-0 relative">
                                            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-sm shadow-inner group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                                                {user.avatarUrl ? (
                                                    <img src={user.avatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                                                ) : (
                                                    <span>{user.fullName?.charAt(0)}</span>
                                                )}
                                            </div>
                                            {isOnline && <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white rounded-full"></div>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-800 text-xs md:text-[15px] leading-snug truncate">{user.fullName}</p>
                                            <p className="text-[9px] md:text-[10px] font-black text-slate-400 mt-1 uppercase tracking-tight truncate">{user.role}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    // 🚀 Responsive: Co nút nhỏ lại chút trên mobile (p-3 vs p-4)
                    className={`relative p-3 md:p-4 rounded-full shadow-xl transition-all active:scale-95 ${isMenuOpen ? 'bg-slate-800' : 'bg-red-600 hover:bg-red-700'}`}
                >
                    {isMenuOpen ? <X className="text-white w-6 h-6 md:w-7 md:h-7" /> : <MessageCircle className="text-white w-6 h-6 md:w-7 md:h-7" />}
                    {!isMenuOpen && onlineUserNames.length > 0 && (
                        <div className="absolute -top-1 -left-1 bg-green-500 text-[9px] md:text-[10px] text-white font-black px-1.5 py-0.5 rounded-full border border-white md:border-2 shadow-sm animate-pulse">
                            {onlineUserNames.length}
                        </div>
                    )}
                </button>
            </div>

        </div>
    );
}