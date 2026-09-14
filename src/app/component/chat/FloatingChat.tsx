"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, UserCircle2, Minus, Hash } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from "../ToastProvider";

// 🚀 BỔ SUNG: Hàm tính toán hiển thị dải phân cách ngày
const formatMessageDate = (dateString: any) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Hôm nay";
    if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";

    return date.toLocaleDateString('vi-VN', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

export default function FloatingChat() {
    const pathname = usePathname();
    const router = useRouter(); 
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const currentUserName = currentUser?.fullName || currentUser?.name || "Người dùng Sano";

    const { showToast } = useToast();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [dbUsers, setDbUsers] = useState<any[]>([]);
    const [chatRooms, setChatRooms] = useState<any[]>([]);
    
    const [onlineUserNames, setOnlineUserNames] = useState<string[]>([]);
    const [activeChats, setActiveChats] = useState<any[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const chatEndRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const [searchQuery, setSearchQuery] = useState("");
    const activeChatsRef = useRef(activeChats);
    const dbUsersRef = useRef(dbUsers);
    const chatRoomsRef = useRef(chatRooms); 

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/sounds/sound-noti.mp3');
            audio.play().catch(e => console.log("Trình duyệt chặn phát nhạc:", e));
        } catch (err) {
            console.error("Lỗi audio:", err);
        }
    };

    useEffect(() => { activeChatsRef.current = activeChats; }, [activeChats]);
    useEffect(() => { dbUsersRef.current = dbUsers; }, [dbUsers]);
    useEffect(() => { chatRoomsRef.current = chatRooms; }, [chatRooms]);

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

        const fetchRooms = async () => {
            try {
                const res = await fetch("/api/chat/rooms");
                const data = await res.json();
                if (Array.isArray(data)) {
                    setChatRooms(data);
                    return data;
                }
                return [];
            } catch (error) { 
                console.error(error); 
                return []; 
            }
        };

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://socket.sanogroup.tv";
        const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });
        setSocket(newSocket);

        const handleConnect = async () => {
            newSocket.emit("user_online", currentUser?.username);
            newSocket.emit("register_user", currentUser?.id);
            
            const roomsData = await fetchRooms();
            if (roomsData.length > 0) {
                const roomIds = roomsData.map((r: any) => r.id);
                newSocket.emit("join_my_rooms", roomIds);
            }
        };

        if (newSocket.connected) {
            handleConnect();
        } else {
            newSocket.on("connect", handleConnect);
        }

        newSocket.on("update_online_users", (usernames: string[]) => {
            setOnlineUserNames(usernames);
        });

        newSocket.on("reload_chat_list", () => {
            fetchRooms();
        });

        newSocket.on("receive_chat_message", (data: any) => {
            const { roomId, message } = data;
            if (!roomId || !message) return;

            let finalAvatarUrl = message.avatarUrl || message.sender?.avatarUrl || null;
            if (!finalAvatarUrl) {
                const senderFromDb = dbUsersRef.current.find(u => String(u.id) === String(message.senderId));
                finalAvatarUrl = senderFromDb?.avatarUrl || null;
            }

            const enrichedMessage = {
                ...message,
                avatarUrl: finalAvatarUrl,
                isMe: String(message.senderId) === String(currentUser?.id)
            };

            setActiveChats((prevChats) => prevChats.map(chat => {
                if (chat.roomId === roomId) {
                    const isExist = chat.messages.some((m: any) => m.id === message.id);
                    if (isExist) return chat;
                    return {
                        ...chat,
                        messages: [...chat.messages, enrichedMessage]
                    };
                }
                return chat;
            }));
        });

        newSocket.on("new_message_notification", async (data: any) => {
            const { roomId, message } = data;

            if (!roomId || !message) return;
            if (String(message.senderId) === String(currentUser?.id)) return;
            if (pathname === '/chat') return;

            if (message.targetId && String(message.targetId) !== String(currentUser?.id)) {
                return; 
            }

            const isChatAlreadyOpen = activeChatsRef.current.some(c => c.roomId === roomId);

            if (!isChatAlreadyOpen) {
                playNotificationSound();

                if (window.innerWidth >= 768) {
                    try {
                        const msgRes = await fetch(`/api/chat/rooms/${roomId}/messages`);
                        const msgData = await msgRes.json();
                        
                        let roomInfo = chatRoomsRef.current.find(r => r.id === roomId);
                        if (!roomInfo) {
                            const newRooms = await fetchRooms(); 
                            roomInfo = newRooms.find((r:any) => r.id === roomId);
                        }

                        const senderFromDb = dbUsersRef.current.find(u => String(u.id) === String(message.senderId));
                        
                        let chatBoxName = message.fullName || senderFromDb?.fullName || msgData[msgData.length - 1]?.sender || "Người dùng";
                        let chatBoxType = 'DIRECT';
                        let chatBoxAvatar = message.avatarUrl || message.sender?.avatarUrl || senderFromDb?.avatarUrl || null;

                        if (roomInfo) {
                            chatBoxName = roomInfo.name;
                            chatBoxType = roomInfo.type;
                            if (roomInfo.type === 'DIRECT') {
                                chatBoxAvatar = roomInfo.avatarUrl;
                            }
                        }

                        const newChatBox = {
                            roomId: roomId,
                            targetUser: {
                                id: chatBoxType === 'TEAM' ? roomId : message.senderId,
                                fullName: chatBoxName,
                                avatarUrl: chatBoxAvatar,
                                type: chatBoxType 
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
                    showToast("info", `💬 Tin nhắn mới từ ${message.fullName || message.sender || "ai đó"}`);
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
            newSocket.off("reload_chat_list");
            newSocket.disconnect();
        };
    }, [currentUser?.id, pathname]);

    useEffect(() => {
        activeChats.forEach(chat => {
            chatEndRefs.current[chat.roomId]?.scrollIntoView({ behavior: "smooth" });
        });
    }, [activeChats]);

    const openChatBox = async (targetUser: any) => {
        if (window.innerWidth < 768) {
            router.push(`/chat`);
            setIsMenuOpen(false);
            return;
        }

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
                    targetUser: { ...targetUser, type: 'DIRECT' }, 
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
                const realSenderName = savedMsg.sender?.fullName || currentUserName;
                
                const realAvatarUrl = savedMsg.sender?.avatarUrl || currentUser?.avatarUrl || null;

                const msgObj = {
                    id: savedMsg.id || Date.now().toString(),
                    sender: realSenderName, 
                    fullName: realSenderName,
                    avatarUrl: realAvatarUrl, 
                    targetId: activeChats[chatIndex].targetUser?.type === 'DIRECT' ? activeChats[chatIndex].targetUser?.id : null, 
                    senderId: currentUser.id,
                    text: savedMsg.content || textToSend,
                    time: new Date(savedMsg.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    createdAt: savedMsg.createdAt || new Date().toISOString(), // 🚀 BƠM THỜI GIAN ĐỂ PHÂN LOẠI NGÀY
                    isMe: true,
                    attachments: savedMsg.attachments || []
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

    const filteredUsers = dbUsers.filter(user => 
        (user.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.role || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (pathname === '/chat') {
        return null;
    }

    return (
        <div className="fixed bottom-0 right-4 md:right-6 z-[9999] flex items-end gap-3 pointer-events-none pb-4 md:pb-0">
            <div className="hidden md:flex items-end gap-3 pointer-events-none">
                {activeChats.map((chat) => (
                    <div key={chat.roomId} className="w-[320px] h-[400px] bg-white rounded-t-xl shadow-[0_0_20px_rgba(0,0,0,0.15)] border border-slate-200 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                        {/* HEADER Ô CHAT */}
                        <div className="h-12 bg-red-600 text-white px-3 flex justify-between items-center shrink-0 cursor-pointer">
                            <div className="flex items-center gap-2 font-bold text-[15px] truncate">
                                <div className="relative shrink-0">
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-sm overflow-hidden border ${chat.targetUser?.type === 'TEAM' ? 'bg-red-700 border-red-500' : 'bg-white/20 border-transparent'}`}>
                                        {chat.targetUser?.type === 'TEAM' ? (
                                            <Hash size={16} />
                                        ) : chat.targetUser?.avatarUrl ? (
                                            <img src={chat.targetUser.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <span>{chat.targetUser?.fullName?.charAt(0)?.toUpperCase()}</span>
                                        )}
                                    </div>
                                    {chat.targetUser?.username && onlineUserNames.includes(chat.targetUser.username) && chat.targetUser?.type !== 'TEAM' && (
                                        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-red-600"></div>
                                    )}
                                </div>
                                <span className="truncate max-w-[150px]">{chat.targetUser?.fullName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => closeChatBox(chat.roomId)} className="p-1 hover:bg-white/20 rounded-md transition-colors"><X size={18} /></button>
                            </div>
                        </div>

                        {/* 🚀 ĐÃ SỬA: TÍNH TOÁN NGÀY VÀ HIỂN THỊ CHAT */}
                        <div className="flex-1 overflow-y-auto p-3 bg-slate-50 flex flex-col gap-[2px] custom-scrollbar">
                            {chat.messages.map((msg: any, index: number) => {
                                // Tính toán dải phân cách ngày
                                const currentMsgDate = new Date(msg.createdAt || Date.now()).toDateString();
                                const prevMsgDate = index > 0 ? new Date(chat.messages[index - 1].createdAt || Date.now()).toDateString() : null;
                                const nextMsgDate = index < chat.messages.length - 1 ? new Date(chat.messages[index + 1].createdAt || Date.now()).toDateString() : null;

                                const showDateDivider = currentMsgDate !== prevMsgDate;

                                const isFirstInGroup = index === 0 || chat.messages[index - 1].senderId !== msg.senderId || showDateDivider;
                                const isLastInGroup = index === chat.messages.length - 1 || chat.messages[index + 1].senderId !== msg.senderId || currentMsgDate !== nextMsgDate;

                                const displayAvatarUrl = msg.avatarUrl || msg.sender?.avatarUrl || (chat.targetUser?.type === 'DIRECT' ? chat.targetUser?.avatarUrl : null);

                                return (
                                    <div key={msg.id} className="flex flex-col w-full">
                                        
                                        {/* Dải Phân Cách Ngày */}
                                        {showDateDivider && (
                                            <div className="flex justify-center w-full my-3">
                                                <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 bg-slate-100 rounded-full">
                                                    {formatMessageDate(msg.createdAt || Date.now())}
                                                </span>
                                            </div>
                                        )}

                                        <div className={`flex w-full ${msg.isMe ? 'justify-end' : 'justify-start'} ${isFirstInGroup && !showDateDivider ? 'mt-2.5' : 'mt-[2px]'}`}>
                                            
                                            {!msg.isMe && (
                                                <div className="w-7 shrink-0 mr-1.5 flex flex-col justify-end pb-0.5">
                                                    {isLastInGroup && (
                                                        <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 border border-slate-300 shadow-sm overflow-hidden" title={msg.sender || chat.targetUser?.fullName}>
                                                            {displayAvatarUrl ? (
                                                                <img src={displayAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span>{(msg.sender || chat.targetUser?.fullName || "U")?.charAt(0)?.toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className={`flex flex-col max-w-[75%] min-w-0 ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                                <div className={`group relative px-3 py-2 text-[13px] md:text-[14px] shadow-sm break-words ${
                                                    msg.isMe
                                                    ? `bg-red-600 text-white rounded-l-2xl ${isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-sm'} ${isLastInGroup ? 'rounded-br-2xl' : 'rounded-br-sm'}`
                                                    : `bg-white border border-slate-200 text-slate-800 rounded-r-2xl ${isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-sm'} ${isLastInGroup ? 'rounded-bl-2xl' : 'rounded-bl-sm'}`
                                                }`}>
                                                    {/* Giờ tin nhắn (Hover để hiển thị) */}
                                                    <span className={`absolute top-1/2 -translate-y-1/2 text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${msg.isMe ? '-left-10' : '-right-10'}`}>
                                                        {msg.time}
                                                    </span>
                                                    {msg.text || msg.content}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={(el) => { chatEndRefs.current[chat.roomId] = el; }} />
                        </div>

                        {/* Ô NHẬP TIN NHẮN */}
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

            <div className="flex flex-col items-end pointer-events-auto pb-2 md:pb-6 relative z-50">
                {isMenuOpen && (
                    <div className="mb-3 md:mb-4 w-[280px] sm:w-[320px] h-[350px] md:h-[450px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                        <div className="p-3 md:p-4 bg-slate-950 text-white flex justify-between items-center shrink-0">
                            <span className="font-bold text-[14px] md:text-[15px]">Sano Chat</span>
                            <button onClick={() => setIsMenuOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors"><X size={18} className="md:w-5 md:h-5" /></button>
                        </div>

                        <div className="p-2 md:p-3 bg-slate-50/50">
                            <input 
                                type="text" 
                                placeholder="Tìm kiếm liên hệ..." 
                                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs md:text-sm outline-none focus:ring-1 focus:ring-red-500" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-xs md:text-sm text-slate-400 font-medium">
                                    Không tìm thấy người dùng phù hợp.
                                </div>
                            ) : (
                                filteredUsers.map(user => {
                                    const isOnline = onlineUserNames.includes(user.username);
                                    return (
                                        <div key={user.id} onClick={() => openChatBox(user)} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 group">
                                            <div className="shrink-0 relative">
                                                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-sm shadow-inner group-hover:bg-red-50 group-hover:text-red-600 transition-colors overflow-hidden">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
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
                                })
                            )}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
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