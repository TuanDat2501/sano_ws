"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Send, Paperclip, Image as ImageIcon, MoreVertical, Hash, Info, MessageSquare, Edit, MoreHorizontal, Users as UsersIcon, UserCircle2, FileText, X, ArrowLeft } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { formatMessageDate } from "@/lib/utils";

export default function ChatPage() {
    const { data: session } = useSession();
    const [message, setMessage] = useState("");
    const [activeRoom, setActiveRoom] = useState<any>(null);

    const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [rooms, setRooms] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [searchNewChat, setSearchNewChat] = useState("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [dbUsers, setDbUsers] = useState<any[]>([]);
    const [dbTeams, setDbTeams] = useState<any[]>([]);

    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    const currentUserId = (session?.user as any)?.id;
    const currentUserName = (session?.user as any)?.fullName || (session?.user as any)?.name || "Người dùng Sano";
    const currentUserAvatar = (session?.user as any)?.avatarUrl || null;

    const filteredUsers = dbUsers.filter(u => u.id !== currentUserId && (u.fullName || '').toLowerCase().includes(searchNewChat.toLowerCase()));
    const filteredTeams = dbTeams.filter(t => (t.name || '').toLowerCase().includes(searchNewChat.toLowerCase()));

    const [socket, setSocket] = useState<Socket | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const activeRoomRef = useRef(activeRoom);

    const dbUsersRef = useRef(dbUsers);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const loadRooms = useCallback(() => {
        fetch("/api/chat/rooms", { cache: "no-store" })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setRooms(data);
            });
    }, []);

    const handleStartChat = async (targetId: string, type: 'DIRECT' | 'TEAM', targetName: string) => {
        try {
            const res = await fetch('/api/chat/rooms/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUsername: targetId, type })
            });

            const data = await res.json();

            if (res.ok && data.id) {
                setIsCreatingChat(false);
                setSearchNewChat("");
                setActiveRoom({ id: data.id, name: targetName, type: type, avatarUrl: data.avatarUrl });
                loadRooms();

                if (socket && type === 'DIRECT') {
                    socket.emit("send_notification", {
                        userIds: [targetId],
                        notification: { type: "system_ping_reload" }
                    });
                }
            } else {
                alert("Lỗi từ Server: " + (data.error || "Không thể tạo phòng chat."));
            }
        } catch (error) {
            alert("Lỗi Network: Cổng API chưa hoạt động!");
        }
    };

    const handleSendMessage = async () => {
        if ((!message.trim() && selectedFiles.length === 0) || !activeRoom) return;

        const textToSend = message;
        const filesToSend = selectedFiles;

        setMessage("");
        setSelectedFiles([]);

        const tempId = "temp_" + Date.now().toString();

        if (textToSend.trim() && filesToSend.length === 0) {
            const tempMessage = {
                id: tempId,
                sender: currentUserName,
                senderId: currentUserId,
                avatarUrl: currentUserAvatar,
                text: textToSend,
                createdAt: new Date().toISOString(),
                content: textToSend,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                isMe: true
            };
            setMessages(prev => [...prev, tempMessage]);
        }

        try {
            let res;
            if (filesToSend.length > 0) {
                const formData = new FormData();
                if (textToSend.trim()) formData.append("content", textToSend);
                filesToSend.forEach(f => {
                    formData.append("files", f.file);
                });
                res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages/upload`, {
                    method: "POST", body: formData,
                });
            } else {
                res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: textToSend })
                });
            }

            if (res.ok) {
                const savedMsg = await res.json();

                const realSenderName = savedMsg.sender?.fullName || currentUserName;
                const realAvatarUrl = savedMsg.sender?.avatarUrl || currentUserAvatar;

                const realMessage = {
                    ...savedMsg,
                    id: savedMsg.id || tempId,
                    sender: realSenderName,
                    senderId: currentUserId,
                    targetId: activeRoom.targetId,
                    text: savedMsg.content || savedMsg.message || savedMsg.text || savedMsg.body || textToSend,
                    content: savedMsg.content || savedMsg.message || savedMsg.body || textToSend,
                    time: new Date(savedMsg.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    isMe: true,
                    createdAt: savedMsg.createdAt || new Date().toISOString(),
                    fullName: realSenderName,
                    avatarUrl: realAvatarUrl,
                    attachments: savedMsg.attachments || []
                };

                setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== tempId);
                    return [...filtered, realMessage];
                });

                if (socket) {
                    socket.emit("send_chat_message", {
                        roomId: activeRoom.id,
                        message: realMessage
                    });
                }
                loadRooms();
            }
        } catch (error) { console.error(error); }
    };

    const loadUsers = async () => {
        try {
            const res = await fetch("/api/users");
            const data = await res.json();
            if (Array.isArray(data)) setDbUsers(data);
        } catch (error) { console.error(error); }
    };

    const loadTeams = async () => {
        try {
            const res = await fetch("/api/teams");
            const data = await res.json();
            if (Array.isArray(data)) setDbTeams(data);
        } catch (error) { console.error(error); }
    };

    const loadMessages = async (roomId: string) => {
        try {
            const res = await fetch(`/api/chat/rooms/${roomId}/messages`, { cache: "no-store" });
            const data = await res.json();
            if (Array.isArray(data)) {
                const formattedData = data.map(m => ({
                    ...m,
                    isMe: m.senderId === currentUserId
                }));
                setMessages(formattedData);
            }
        } catch (error) { console.error(error); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files).map(file => ({
                file: file,
                name: file.name,
                type: file.type.startsWith('image/') ? 'image' : 'file',
                previewUrl: URL.createObjectURL(file)
            }));
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
        if (e.target) e.target.value = '';
    };

    const removeSelectedFile = (indexToRemove: number) => {
        setSelectedFiles(prev => {
            const newFiles = [...prev];
            if (newFiles[indexToRemove].previewUrl) {
                URL.revokeObjectURL(newFiles[indexToRemove].previewUrl);
            }
            newFiles.splice(indexToRemove, 1);
            return newFiles;
        });
    };

    const playNotificationSound = () => {
        const audio = new Audio('/sounds/sound-noti.mp3');
        audio.play().catch(e => console.log("Trình duyệt chặn auto-play"));
    };

    useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
    useEffect(() => { dbUsersRef.current = dbUsers; }, [dbUsers]);
    useEffect(() => { scrollToBottom(); }, [messages]);

    useEffect(() => {
        loadRooms(); loadUsers(); loadTeams();

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://socket.sanogroup.tv";
        const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });
        setSocket(newSocket);

        if (currentUserId) {
            newSocket.emit("user_online", currentUserId);
            newSocket.emit("register_user", currentUserId);
        }

        newSocket.on("update_online_users", (activeUserIds: string[]) => {
            setOnlineUsers(activeUserIds.map(id => String(id)));
        });

        newSocket.on("receive_notification", (noti) => {
            if (noti.type === "system_ping_reload") loadRooms();
        });

        return () => { newSocket.disconnect(); };
    }, [currentUserId, loadRooms]);

    useEffect(() => {
        if (socket && rooms.length > 0) {
            const roomIds = rooms.map(r => r.id);
            socket.emit("join_my_rooms", roomIds);
        }
    }, [socket, rooms]);

    useEffect(() => {
        if (!activeRoom) return;
        setIsCreatingChat(false);
        loadMessages(activeRoom.id);
        setUnreadCounts(prev => ({ ...prev, [activeRoom.id]: 0 }));
    }, [activeRoom]);

    useEffect(() => {
        if (!socket) return;

        const handleReceiveMsg = (data: any) => {
            const incomingRoomId = data.roomId;
            const incomingMsg = data.message;

            let finalAvatarUrl = incomingMsg.avatarUrl || incomingMsg.sender?.avatarUrl || null;
            if (!finalAvatarUrl) {
                const senderFromDb = dbUsersRef.current.find(u => String(u.id) === String(incomingMsg.senderId));
                finalAvatarUrl = senderFromDb?.avatarUrl || null;
            }

            const enrichedMessage = {
                ...incomingMsg,
                avatarUrl: finalAvatarUrl,
                isMe: String(incomingMsg.senderId) === String(currentUserId)
            };

            if (activeRoomRef.current?.id === incomingRoomId) {
                setMessages((prev) => {
                    if (prev.find(m => m.id === incomingMsg.id)) return prev;
                    return [...prev, enrichedMessage];
                });
            } else {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification(`Tin nhắn mới từ ${enrichedMessage.fullName || enrichedMessage.sender || "Đồng nghiệp"}`, {
                        body: enrichedMessage.text || enrichedMessage.content || "Đã gửi một tệp đính kèm",
                        icon: "/logo.png"
                    });
                }
                playNotificationSound();
                setUnreadCounts(prev => ({
                    ...prev,
                    [incomingRoomId]: (prev[incomingRoomId] || 0) + 1
                }));
            }
        };

        socket.on("receive_chat_message", handleReceiveMsg);
        socket.on("reload_chat_list", () => loadRooms());

        return () => {
            socket.off("receive_chat_message", handleReceiveMsg);
            socket.off("reload_chat_list");
        };
    }, [socket, currentUserId, loadRooms]);

    useEffect(() => {
        if ("Notification" in window) Notification.requestPermission();
    }, []);

    // 🚀 BẮT ĐẦU VÙNG GIAO DIỆN MỚI
    return (
        // Xoá bỏ padding ngoài cùng, thay bằng kiến trúc nguyên khối
        <div className="h-[100dvh] md:h-full w-full bg-white flex overflow-hidden relative">

            {/* ================= CỘT TRÁI (SIDEBAR DANH SÁCH) ================= */}
            <div className={`flex-col w-full md:w-[340px] lg:w-[380px] bg-white border-r border-slate-100 shrink-0 h-full transition-all ${(activeRoom || isCreatingChat) ? 'hidden md:flex' : 'flex'}`}>

                {/* Header Sidebar */}
                <div className="p-4 pb-2 shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-[22px] md:text-2xl font-black text-slate-900 tracking-tight">Đoạn chat</h2>
                        <div className="flex items-center gap-2">
                            <button className="p-2 bg-slate-50 text-slate-700 rounded-full hover:bg-slate-100 transition-colors">
                                <MoreHorizontal size={20} />
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreatingChat(true);
                                    setActiveRoom(null);
                                }}
                                className="p-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-md shadow-red-600/20"
                            >
                                <Edit size={20} className="ml-0.5 mb-0.5" />
                            </button>
                        </div>
                    </div>

                    <div className="relative bg-slate-50 rounded-2xl flex items-center p-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all border border-slate-100">
                        <Search size={18} className="text-slate-400 ml-2" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="w-full bg-transparent px-3 py-1 text-[15px] outline-none font-medium text-slate-700 placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Danh sách Chat */}
                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 custom-scrollbar">
                    {rooms.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm mt-10 font-medium px-6 py-6 bg-slate-50 rounded-2xl mx-2 border border-slate-100">
                            Chưa có tin nhắn nào.<br /> Bấm nút đỏ để tạo mới!
                        </div>
                    ) : (
                        rooms.map((room, index) => {
                            const currentUnread = unreadCounts[room.id] || 0;
                            return (
                                <div
                                    key={`room_${room.id}_${index}`}
                                    onClick={() => setActiveRoom(room)}
                                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${activeRoom?.id === room.id ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="relative shrink-0">
                                        <div className={`h-14 w-14 rounded-full flex items-center justify-center text-white font-black text-xl overflow-hidden border-2 ${room.type === 'TEAM' ? 'bg-red-600 border-transparent' : 'bg-slate-100 text-slate-400 border-slate-100'}`}>
                                            {room.type === 'TEAM' ? <Hash size={24} /> : (
                                                room.avatarUrl ? <img src={room.avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : <UserCircle2 size={32} />
                                            )}
                                        </div>
                                        {room.type === 'DIRECT' && onlineUsers.includes(String(room.targetId)) && (
                                            <div className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 bg-green-500 border-[3px] border-white rounded-full z-10"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className={`font-bold text-[16px] truncate pr-2 ${room.unread > 0 ? 'text-slate-900' : 'text-slate-800'} ${activeRoom?.id === room.id ? 'text-red-700' : ''}`}>
                                                {room.name}
                                            </h4>
                                            <span className={`text-[12px] font-medium whitespace-nowrap ${room.unread > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>{room.time}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className={`text-[14px] truncate pr-4 ${room.unread > 0 ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                                                {room.lastMessage}
                                            </p>
                                            {currentUnread > 0 && (
                                                <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full text-center shadow-sm">
                                                    {currentUnread > 9 ? '9+' : currentUnread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ================= CỘT PHẢI (KHUNG CHAT) ================= */}
            {/* 🚀 Đổi màu nền sang Xám nhạt giống Messenger */}
            <div className={`flex-1 flex-col bg-[#F0F2F5] min-w-0 h-full relative transition-all ${(!activeRoom && !isCreatingChat) ? 'hidden md:flex' : 'flex'}`}>

                {isCreatingChat ? (
                    <div className="absolute inset-0 bg-white z-20 flex flex-col animate-fade-in">
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white shadow-sm">
                            <button className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0" onClick={() => setIsCreatingChat(false)}>
                                <ArrowLeft size={24} />
                            </button>
                            <span className="font-bold text-slate-700 whitespace-nowrap text-[15px]">Đến:</span>
                            <input
                                type="text"
                                placeholder="Tìm kiếm người và nhóm..."
                                className="flex-1 bg-transparent px-2 py-1 outline-none text-[15px] font-medium text-slate-900 placeholder:text-slate-400 min-w-0"
                                value={searchNewChat}
                                onChange={(e) => setSearchNewChat(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                            <div className="max-w-3xl mx-auto space-y-8">
                                <div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Người liên hệ</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {filteredUsers.map((u, index) => (
                                            <div key={`user_${u.id}_${index}`} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl hover:border-red-300 hover:shadow-sm cursor-pointer transition-all group"
                                                onClick={(e) => { e.stopPropagation(); handleStartChat(u.username, 'DIRECT', u.fullName); }}
                                            >
                                                <div className="flex items-center gap-3 min-w-0" >
                                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 relative overflow-hidden shrink-0">
                                                        {u.avatarUrl ? (
                                                            <img src={u.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span>{u.fullName?.charAt(0)}</span>
                                                        )}
                                                        <div className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="font-bold text-slate-800 text-[15px] group-hover:text-red-700 truncate">{u.fullName}</p>
                                                        <p className="text-[12px] text-slate-500 font-medium truncate">{u.role}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 mt-8">Nhóm (Teams)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {filteredTeams.map((t, index) => (
                                            <div key={`team_${t.id}_${index}`} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl hover:border-red-300 hover:shadow-sm cursor-pointer transition-all group"
                                                onClick={(e) => { e.stopPropagation(); handleStartChat(t.id, 'TEAM', t.name); }}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-12 w-12 rounded-xl bg-red-600 flex items-center justify-center text-white font-black relative shadow-md shadow-red-600/10 shrink-0">
                                                        <Hash size={20} />
                                                        <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-white rounded-full flex items-center justify-center border border-red-100">
                                                            <UsersIcon size={12} className="text-red-600" />
                                                        </div>
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="font-bold text-slate-800 text-[15px] group-hover:text-red-700 truncate">{t.name}</p>
                                                        <p className="text-[12px] text-slate-500 font-medium truncate">{t.count} thành viên</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeRoom ? (
                    <>
                        {/* 🚀 Header Trắng tinh, đổ bóng nhẹ */}
                        <div className="h-[70px] px-4 md:px-6 bg-white flex justify-between items-center shrink-0 shadow-sm z-10">
                            <div className="flex items-center gap-3 min-w-0">
                                <button className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0" onClick={() => setActiveRoom(null)}>
                                    <ArrowLeft size={24} />
                                </button>

                                <div className="relative shrink-0">
                                    <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white font-black overflow-hidden ${activeRoom.type === 'TEAM' ? 'bg-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {activeRoom.type === 'TEAM' ? <Hash size={20} /> : (
                                            activeRoom.avatarUrl ? <img src={activeRoom.avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : <UserCircle2 size={28} />
                                        )}
                                    </div>
                                </div>

                                <div className="truncate">
                                    <h2 className="font-bold text-[17px] text-slate-900 flex items-center gap-2 truncate">
                                        {activeRoom.name}
                                    </h2>
                                    <p className="text-[12px] font-medium text-slate-500">Đang hoạt động</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-red-600 shrink-0">
                                <button className="p-2 hover:bg-red-50 rounded-full transition-colors"><Search size={22} /></button>
                                <button className="p-2 hover:bg-red-50 rounded-full transition-colors"><Info size={22} /></button>
                            </div>
                        </div>

                        {/* 🚀 Nội dung tin nhắn tràn viền */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-[2px] custom-scrollbar">
                            {messages.map((msg, index) => {
                                // 🚀 TÍNH TOÁN MỐC THỜI GIAN
                                const currentMsgDate = new Date(msg.createdAt || Date.now()).toDateString();
                                const prevMsgDate = index > 0 ? new Date(messages[index - 1].createdAt || Date.now()).toDateString() : null;
                                const nextMsgDate = index < messages.length - 1 ? new Date(messages[index + 1].createdAt || Date.now()).toDateString() : null;

                                const showDateDivider = currentMsgDate !== prevMsgDate;

                                // Tự động cắt cụm bo góc nếu có dải phân cách ngày xen vào giữa
                                const isFirstInGroup = index === 0 || messages[index - 1].senderId !== msg.senderId || showDateDivider;
                                const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId !== msg.senderId || currentMsgDate !== nextMsgDate;

                                const files = msg.attachments || [];
                                const displayAvatarUrl = msg.avatarUrl || msg.sender?.avatarUrl || (activeRoom?.type === 'DIRECT' ? activeRoom?.avatarUrl : null);

                                return (
                                    <div key={`msg_${msg.id}_${index}`} className="flex flex-col w-full">

                                        {/* 🚀 DẢI PHÂN CÁCH NGÀY CHÍNH GIỮA */}
                                        {showDateDivider && (
                                            <div className="flex justify-center w-full my-5 md:my-6">
                                                <span className="bg-slate-200/60 text-slate-500 text-[11px] md:text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                                    {formatMessageDate(msg.createdAt || Date.now())}
                                                </span>
                                            </div>
                                        )}

                                        <div className={`flex w-full max-w-[85%] md:max-w-[65%] ${msg.isMe ? 'self-end justify-end' : 'self-start'} ${isFirstInGroup && !showDateDivider ? 'mt-3' : 'mt-[2px]'}`}>

                                            {!msg.isMe && (
                                                <div className="w-8 shrink-0 mr-2 flex flex-col justify-end pb-0.5">
                                                    {isLastInGroup && (
                                                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-black text-slate-600 overflow-hidden" title={msg.sender}>
                                                            {displayAvatarUrl ? (
                                                                <img src={displayAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span>{(msg.sender || "U").charAt(0).toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className={`flex flex-col min-w-0 ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                                {!msg.isMe && isFirstInGroup && (
                                                    <span className="text-[12px] font-medium text-slate-500 mb-1 ml-1">{msg.sender}</span>
                                                )}

                                                <div className={`shadow-sm leading-relaxed overflow-hidden min-w-0 ${msg.isMe
                                                    ? `bg-red-600 text-white rounded-l-2xl ${isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-[4px]'} ${isLastInGroup ? 'rounded-br-2xl' : 'rounded-br-[4px]'}`
                                                    : `bg-white text-black rounded-r-2xl ${isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-[4px]'} ${isLastInGroup ? 'rounded-bl-2xl' : 'rounded-bl-[4px]'}`
                                                    }`}>

                                                    {files.length > 0 && (
                                                        <div className={`p-1 space-y-1 ${files.length > 1 ? 'grid grid-cols-2 gap-1 space-y-0' : ''}`}>
                                                            {files.map((file: any, fileIndex: number) => {
                                                                if (file.fileType === 'image') {
                                                                    return (
                                                                        <a key={`img_${file.id}_${fileIndex}`} href={file.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl group" >
                                                                            <img
                                                                                src={file.url}
                                                                                alt={file.fileName}
                                                                                className={`max-h-64 object-cover hover:scale-105 transition-transform ${files.length > 1 ? 'h-32 w-full' : ''}`}
                                                                            />
                                                                        </a>
                                                                    );
                                                                }
                                                                return (
                                                                    <a key={`doc_${file.id}_${fileIndex}`} href={file.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl m-1 min-w-0 ${msg.isMe ? 'text-slate-800' : 'text-slate-900'}`}>
                                                                        <FileText size={20} className="text-red-600 shrink-0" />
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-xs font-bold truncate max-w-[150px]">{file.fileName}</span>
                                                                            <span className="text-[10px] font-medium text-slate-500 uppercase">{file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : "0"} MB</span>
                                                                        </div>
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {(msg.text || msg.content) && (
                                                        <div className="group relative px-4 py-2.5 text-[15px] break-words">
                                                            {/* 🚀 Đính kèm giờ ngay cạnh tin nhắn */}
                                                            <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${msg.isMe ? '-left-10' : '-right-10'}`}>
                                                                {msg.time}
                                                            </span>
                                                            {msg.text || msg.content}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* 🚀 Ô nhập liệu kiểu Pill trắng */}
                        <div className="p-3 md:p-4 bg-white shrink-0">
                            {selectedFiles.length > 0 && (
                                <div className="flex gap-2 p-3 bg-slate-50 rounded-2xl mb-3 overflow-x-auto custom-scrollbar-thin">
                                    {selectedFiles.map((f, index) => (
                                        <div key={`preview_${index}`} className="h-20 w-20 rounded-xl border border-slate-200 relative group shrink-0">
                                            {f.type === 'image' ? (
                                                <img src={f.previewUrl} className="h-full w-full object-cover rounded-xl" />
                                            ) : (
                                                <div className="h-full w-full rounded-xl bg-white flex flex-col items-center justify-center p-2 text-center text-slate-500">
                                                    <FileText size={20} />
                                                    <span className="text-[10px] font-bold mt-1 truncate w-full">{f.name}</span>
                                                </div>
                                            )}
                                            <button onClick={() => removeSelectedFile(index)} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full opacity-100 transition-opacity">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-end gap-2 max-w-full">
                                <button onClick={() => imageInputRef.current?.click()} className="p-2.5 text-red-600 hover:bg-red-50 rounded-full transition-all shrink-0">
                                    <ImageIcon size={24} />
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-red-600 hover:bg-red-50 rounded-full transition-all shrink-0">
                                    <Paperclip size={24} />
                                </button>

                                <input type="file" ref={imageInputRef} hidden accept="image/*" multiple onChange={handleFileSelect} />
                                <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.zip" />

                                <div className="flex-1 bg-slate-100 rounded-3xl flex items-end pr-1">
                                    <textarea
                                        rows={1}
                                        className="flex-1 bg-transparent py-3 px-4 text-[15px] outline-none text-slate-900 resize-none max-h-32 placeholder:text-slate-500"
                                        placeholder="Aa"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <button onClick={handleSendMessage} className="p-2 m-1 bg-red-600 text-white hover:bg-red-700 rounded-full transition-all shrink-0 shadow-md active:scale-95 disabled:bg-slate-300 disabled:shadow-none" disabled={!message.trim() && selectedFiles.length === 0}>
                                        <Send size={20} className="ml-0.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="hidden md:flex flex-1 flex-col items-center justify-center text-slate-400 bg-[#F0F2F5]">
                        <div className="h-28 w-28 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <MessageSquare size={54} className="text-red-500/80" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Sano Workspace Chat</h3>
                        <p className="text-[15px] font-medium">Hãy chọn một đoạn chat hoặc bắt đầu cuộc trò chuyện mới!</p>
                    </div>
                )}
            </div>
        </div>
    );
}