"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
// 🚀 Đã import thêm ArrowLeft
import { Search, Send, Paperclip, Image as ImageIcon, MoreVertical, Hash, Info, MessageSquare, Edit, MoreHorizontal, Users as UsersIcon, UserCircle2, FileText, X, ArrowLeft } from "lucide-react";
import { io, Socket } from "socket.io-client";

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
    const filteredUsers = dbUsers.filter(u => u.id !== currentUserId && (u.fullName || '').toLowerCase().includes(searchNewChat.toLowerCase()));
    const filteredTeams = dbTeams.filter(t => (t.name || '').toLowerCase().includes(searchNewChat.toLowerCase()));
    const [socket, setSocket] = useState<Socket | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const activeRoomRef = useRef(activeRoom);

    // ------------------ Các hàm xử lý ------------------------
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const loadRooms = () => {
        fetch("/api/chat/rooms", { cache: "no-store" }) 
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setRooms(data);
            });
    };

    const handleStartChat = async (targetId: string, type: 'DIRECT' | 'TEAM', targetName: string) => {
        try {
            const res = await fetch('/api/chat/rooms/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetId, type })
            });

            const data = await res.json();

            if (res.ok && data.id) {
                setIsCreatingChat(false); 
                setSearchNewChat("");
                setActiveRoom({ id: data.id, name: targetName, type: type });
                loadRooms();
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
                sender: "Tôi",
                senderId: currentUserId,
                text: textToSend,
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

                const realMessage = {
                    ...savedMsg, 
                    id: savedMsg.id || tempId,
                    sender: (session?.user as any)?.fullName || "Tôi",
                    senderId: currentUserId,
                    targetId: activeRoom.targetId,
                    text: savedMsg.content || savedMsg.message || savedMsg.text || savedMsg.body || textToSend,
                    content: savedMsg.content || savedMsg.message || savedMsg.body || textToSend,
                    time: new Date(savedMsg.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    isMe: true,
                    fullName: (session?.user as any)?.fullName,
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

    // ------------------ useEffect ------------------------
    useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
    useEffect(() => { scrollToBottom(); }, [messages]);

    useEffect(() => {
        loadRooms(); loadUsers(); loadTeams();

        const newSocket = io();
        setSocket(newSocket);

        if (currentUserId) newSocket.emit("user_online", currentUserId);

        newSocket.on("update_online_users", (activeUserIds: string[]) => {
            const stringifiedIds = activeUserIds.map(id => String(id));
            setOnlineUsers(stringifiedIds);
        });

        newSocket.on("reload_chat_list", () => loadRooms());

        newSocket.on("new_message_notification", (data: { roomId: string, message: any }) => {
            if (data.message.senderId === currentUserId) return;
            if (data.message.targetId && data.message.targetId !== currentUserId) return;
            if (activeRoomRef.current?.id !== data.roomId) {
                if (Notification.permission === "granted") {
                    new Notification(`Tin nhắn mới từ ${data.message?.sender || "Đồng nghiệp"}`, {
                        body: data.message?.text || data.message?.content || "Đã gửi một tệp đính kèm",
                        icon: "/logo.png"
                    });
                }
                playNotificationSound();
                setUnreadCounts(prev => ({
                    ...prev,
                    [data.roomId]: (prev[data.roomId] || 0) + 1
                }));
            }
        });
        return () => { newSocket.disconnect(); };
    }, [currentUserId]);

    useEffect(() => {
        if (!activeRoom) return;
        setIsCreatingChat(false);
        loadMessages(activeRoom.id);
        setUnreadCounts(prev => ({ ...prev, [activeRoom.id]: 0 }));
    }, [activeRoom]);

    useEffect(() => {
        if (!socket || !activeRoom) return;
        socket.emit("join_chat_room", activeRoom.id);

        const handleReceiveMsg = (data: any) => {
            const incomingRoomId = data.roomId;
            const incomingMsg = data.message;

            if (incomingRoomId === activeRoom.id) {
                setMessages((prev) => {
                    if (prev.find(m => m.id === incomingMsg.id)) return prev;
                    return [...prev, {
                        ...incomingMsg,
                        isMe: incomingMsg.senderId === currentUserId 
                    }];
                });
            } else {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification(`Tin nhắn mới từ ${incomingMsg.sender || "Đồng nghiệp"}`, {
                        body: incomingMsg.text || incomingMsg.content || "Đã gửi một tệp đính kèm",
                        icon: "/logo.png"
                    });
                }
            }
            loadRooms();
        };

        socket.on("receive_chat_message", handleReceiveMsg);
        return () => { socket.off("receive_chat_message", handleReceiveMsg); };
    }, [socket, activeRoom, currentUserId]);

    useEffect(() => {
        if ("Notification" in window) Notification.requestPermission();
    }, []);

    return (
        // Responsive: Bóp padding màn hình bé (p-2 sm:p-4 md:p-6)
        <div className="h-full animate-fade-in flex flex-col p-2 sm:p-4 md:p-6">
            
            <div className="flex-1 bg-white md:rounded-[24px] rounded-xl border border-slate-200 shadow-sm overflow-hidden flex min-h-0 relative">

                {/* ================= CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN ================= */}
                {/* 🚀 RESPONSIVE: Trên mobile, nếu đang mở Chat/Tạo Chat thì ẨN cột này đi. Lên MD thì luôn hiện */}
                <div className={`w-full md:w-[320px] lg:w-[340px] shrink-0 border-r border-slate-200 flex-col bg-white transition-all
                    ${(activeRoom || isCreatingChat) ? 'hidden md:flex' : 'flex'}
                `}>
                    <div className="p-3 md:p-4 pb-2 shrink-0">
                        <div className="flex justify-between items-center mb-3 md:mb-4">
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Đoạn chat</h2>
                            <div className="flex items-center gap-1 md:gap-2">
                                <button className="p-1.5 md:p-2 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors">
                                    <MoreHorizontal size={18} className="md:w-5 md:h-5" />
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreatingChat(true);
                                        setActiveRoom(null);
                                    }}
                                    className="p-2 md:p-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-md shadow-red-600/20"
                                >
                                    <Edit size={18} className="md:w-5 md:h-5 ml-0.5 mb-0.5" />
                                </button>
                            </div>
                        </div>

                        <div className="relative bg-slate-100 rounded-full flex items-center p-1.5 md:p-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all border border-transparent">
                            <Search size={16} className="text-slate-500 ml-2 md:w-[18px] md:h-[18px]" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm..."
                                className="w-full bg-transparent px-2 md:px-3 py-0.5 text-xs md:text-sm outline-none font-medium text-slate-700 placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex items-center gap-2 md:gap-4 mt-3 md:mt-4 px-1 md:px-2 overflow-x-auto custom-scrollbar-thin pb-1">
                            <button className="text-xs md:text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shrink-0">Tất cả</button>
                            <button className="text-xs md:text-sm font-bold text-slate-500 hover:bg-slate-50 px-3 py-1.5 rounded-full transition-colors shrink-0">Chưa đọc</button>
                            <button className="text-xs md:text-sm font-bold text-slate-500 hover:bg-slate-50 px-3 py-1.5 rounded-full transition-colors shrink-0">Nhóm</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 mt-1 md:mt-2 space-y-1 custom-scrollbar">
                        {rooms.length === 0 ? (
                            <div className="text-center text-slate-400 text-xs md:text-sm mt-10 font-medium px-4 md:px-6 py-4 bg-slate-50 rounded-2xl mx-2 border border-slate-100">Chưa có tin nhắn nào.<br /> Bấm nút đỏ để tạo mới!</div>
                        ) : (
                            rooms.map((room, index) => {
                                const currentUnread = unreadCounts[room.id] || 0;
                                return (
                                    <div
                                        key={`room_${room.id}_${index}`}
                                        onClick={() => setActiveRoom(room)}
                                        className={`flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl cursor-pointer transition-all ${activeRoom?.id === room.id ? 'bg-red-50 border border-red-100' : 'hover:bg-slate-50 border border-transparent'}`}
                                    >
                                        <div className={`h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center shrink-0 text-white font-black text-base md:text-lg relative ${room.type === 'TEAM' ? 'bg-red-600' : 'bg-slate-200 text-slate-500'}`}>
                                            {room.type === 'TEAM' ? <Hash size={20} className="md:w-6 md:h-6" /> : <UserCircle2 size={26} className="md:w-8 md:h-8" />}
                                            {room.type === 'DIRECT' && onlineUsers.includes(String(room.targetId)) && (
                                                <div className="absolute bottom-0 right-0 h-3 w-3 md:h-3.5 md:w-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <h4 className={`font-bold text-[13px] md:text-[15px] truncate pr-2 ${room.unread > 0 ? 'text-slate-900' : 'text-slate-800'} ${activeRoom?.id === room.id ? 'text-red-800' : ''}`}>
                                                    {room.name}
                                                </h4>
                                                <span className={`text-[10px] md:text-[11px] font-medium whitespace-nowrap ${room.unread > 0 ? 'text-red-600 font-bold' : 'text-slate-500'} ${activeRoom?.id === room.id ? 'text-red-600' : ''}`}>{room.time}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <p className={`text-[11px] md:text-[13px] truncate pr-4 ${room.unread > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'} ${activeRoom?.id === room.id ? 'text-red-700/80' : ''}`}>
                                                    {room.lastMessage}
                                                </p>
                                                {currentUnread > 0 && (
                                                    <span className="bg-red-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] md:min-w-[18px] text-center shadow-sm animate-bounce">
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

                {/* ================= CỘT PHẢI: KHUNG CHAT HOẶC TẠO CHAT MỚI ================= */}
                {/* 🚀 RESPONSIVE: Trên mobile, nếu Không mở Chat/Tạo Chat thì ẨN cột này đi */}
                <div className={`flex-1 flex-col bg-white min-w-0 relative transition-all
                    ${(!activeRoom && !isCreatingChat) ? 'hidden md:flex' : 'flex'}
                `}>

                    {/* TRƯỜNG HỢP 1: MÀN HÌNH TẠO CHAT MỚI */}
                    {isCreatingChat ? (
                        <div className="absolute inset-0 bg-white z-20 flex flex-col animate-fade-in">
                            <div className="p-3 md:p-4 border-b border-slate-200 flex items-center gap-2 md:gap-3">
                                {/* 🚀 NÚT BACK CHO MOBILE */}
                                <button 
                                    className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                                    onClick={() => setIsCreatingChat(false)}
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <span className="font-bold text-slate-700 whitespace-nowrap text-sm md:text-base">Đến:</span>
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm người và nhóm..."
                                    className="flex-1 border border-red-500 rounded-xl px-3 md:px-4 py-2 outline-none text-xs md:text-sm font-medium focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm shadow-red-500/5 min-w-0"
                                    value={searchNewChat}
                                    onChange={(e) => setSearchNewChat(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                                <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
                                    {/* Khối NGƯỜI */}
                                    <div>
                                        <h3 className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4">Người</h3>
                                        {/* Mobile: 1 cột, Tablet/PC: 2 cột */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                            {filteredUsers.map((u, index) => (
                                                <div key={`user_${u.id}_${index}`} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl hover:border-red-300 hover:shadow-sm cursor-pointer transition-all group"
                                                    onClick={(e) => { e.stopPropagation(); handleStartChat(u.id, 'DIRECT', u.fullName); }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0" >
                                                        <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 relative border border-slate-200 shrink-0">
                                                            {u.fullName?.charAt(0)}
                                                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 md:h-3 md:w-3 bg-green-500 border-2 border-white rounded-full"></div>
                                                        </div>
                                                        <div className="truncate">
                                                            <p className="font-bold text-slate-800 text-xs md:text-sm group-hover:text-red-700 truncate">{u.fullName}</p>
                                                            <p className="text-[10px] md:text-xs text-slate-500 font-medium truncate">{u.role}</p>
                                                        </div>
                                                    </div>
                                                    <button className="px-3 py-1.5 md:px-4 md:py-1.5 bg-red-50 text-red-600 font-bold text-[10px] md:text-xs rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-opacity border border-red-100 shrink-0 ml-2"
                                                        onClick={(e) => { e.stopPropagation(); handleStartChat(u.id, 'DIRECT', u.fullName); }}
                                                    >Chat</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Khối NHÓM */}
                                    <div>
                                        <h3 className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4 mt-6 md:mt-8">Nhóm (Teams)</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                            {filteredTeams.map((t, index) => (
                                                <div key={`team_${t.id}_${index}`} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl hover:border-red-300 hover:shadow-sm cursor-pointer transition-all group"
                                                     onClick={(e) => { e.stopPropagation(); handleStartChat(t.id, 'TEAM', t.name); }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black relative shadow-md shadow-red-600/10 shrink-0">
                                                            <Hash size={16} className="md:w-[18px] md:h-[18px]" />
                                                            <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 md:h-4 md:w-4 bg-white rounded-full flex items-center justify-center border border-red-100">
                                                                <UsersIcon size={8} className="md:w-[10px] md:h-[10px] text-red-600" />
                                                            </div>
                                                        </div>
                                                        <div className="truncate">
                                                            <p className="font-bold text-slate-800 text-xs md:text-sm group-hover:text-red-700 truncate">{t.name}</p>
                                                            <p className="text-[10px] md:text-xs text-slate-500 font-medium truncate">{t.count} thành viên</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleStartChat(t.id, 'TEAM', t.name); }}
                                                        className="px-3 py-1.5 md:px-4 md:py-1.5 bg-red-600 text-white font-bold text-[10px] md:text-xs rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md shadow-red-600/10 shrink-0 ml-2"
                                                    >Vào nhóm</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeRoom ? (
                        /* TRƯỜNG HỢP 2: ĐANG CHAT */
                        <>
                            {/* Header Chat */}
                            <div className="h-[60px] md:h-[70px] px-3 md:px-6 border-b border-slate-200 flex justify-between items-center shrink-0 bg-white/90 backdrop-blur-sm z-10">
                                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                    {/* 🚀 NÚT BACK CHO MOBILE */}
                                    <button 
                                        className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                                        onClick={() => setActiveRoom(null)}
                                    >
                                        <ArrowLeft size={20} />
                                    </button>

                                    <div className={`h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center shrink-0 text-white font-black ${activeRoom.type === 'TEAM' ? 'bg-red-600' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                                        {activeRoom.type === 'TEAM' ? <Hash size={18} className="md:w-5 md:h-5" /> : <UserCircle2 size={22} className="md:w-6 md:h-6" />}
                                    </div>
                                    <div className="truncate">
                                        <h2 className="font-bold text-[15px] md:text-[17px] text-slate-900 flex items-center gap-2 truncate">
                                            {activeRoom.name}
                                        </h2>
                                        <p className="text-[10px] md:text-[12px] font-medium text-green-600 flex items-center gap-1"><span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span> Đang hoạt động</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-0.5 md:gap-1 text-slate-500 shrink-0">
                                    <button className="p-1.5 md:p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"><Search size={20} className="md:w-[22px] md:h-[22px]" /></button>
                                    <button className="p-1.5 md:p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"><Info size={20} className="md:w-[22px] md:h-[22px]" /></button>
                                </div>
                            </div>

                            {/* Lịch sử Chat */}
                            <div className="flex-1 overflow-y-auto p-3 md:p-6 flex flex-col gap-2 bg-slate-50/50 custom-scrollbar">
                                {messages.map((msg, index) => {
                                    const isFirstInGroup = index === 0 || messages[index - 1].senderId !== msg.senderId;
                                    const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId !== msg.senderId;
                                    const files = msg.attachments || [];

                                    return (
                                        // 🚀 Responsive độ rộng bong bóng chat: Mobile max 85%, PC max 70%
                                        <div
                                            key={`msg_${msg.id}_${index}`}
                                            className={`flex max-w-[85%] md:max-w-[70%] ${msg.isMe ? 'self-end justify-end' : 'self-start'} ${isFirstInGroup ? 'mt-2 md:mt-3' : ''}`}
                                        >
                                            {!msg.isMe && (
                                                <div className="w-6 md:w-8 shrink-0 mr-2 flex flex-col justify-end">
                                                    {isLastInGroup && (
                                                        <div className="h-6 w-6 md:h-8 md:w-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] md:text-xs font-black text-slate-600 border border-slate-300 shadow-sm" title={msg.sender}>
                                                            {msg.sender ? msg.sender.charAt(0).toUpperCase() : "U"}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className={`flex flex-col min-w-0 ${msg.isMe ? 'items-end' : 'items-start'}`}>
                                                {!msg.isMe && isFirstInGroup && (
                                                    <span className="text-[10px] md:text-[11px] font-bold text-slate-400 mb-1 ml-1">{msg.sender}</span>
                                                )}

                                                <div className={`shadow-sm leading-relaxed overflow-hidden min-w-0 ${msg.isMe
                                                    ? `bg-red-600 text-white rounded-br-sm ${isFirstInGroup ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl' : 'rounded-l-2xl'} ${isLastInGroup && !isFirstInGroup ? 'rounded-br-2xl' : ''}`
                                                    : `bg-white text-black border border-slate-200 rounded-bl-sm ${isFirstInGroup ? 'rounded-tr-2xl rounded-tl-2xl rounded-br-2xl' : 'rounded-r-2xl'} ${isLastInGroup && !isFirstInGroup ? 'rounded-bl-2xl' : ''}`
                                                    }`}>

                                                    {files.length > 0 && (
                                                        <div className={`p-1 space-y-1 ${files.length > 1 ? 'grid grid-cols-2 gap-1 space-y-0' : ''}`}>
                                                            {files.map((file: any, fileIndex: number) => {
                                                                if (file.fileType === 'image') {
                                                                    return (
                                                                        <a key={`img_${file.id}_${fileIndex}`} href={file.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg md:rounded-xl border border-white/10 shadow-inner group" >
                                                                            <img
                                                                                src={file.url}
                                                                                alt={file.fileName}
                                                                                className={`max-h-48 md:max-h-64 rounded-lg md:rounded-xl object-cover hover:scale-105 transition-transform ${files.length > 1 ? 'h-24 md:h-32 w-full' : ''}`}
                                                                            />
                                                                        </a>
                                                                    );
                                                                }
                                                                return (
                                                                    <a key={`doc_${file.id}_${fileIndex}`} href={file.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 md:gap-2 p-2 md:p-3 bg-white hover:bg-slate-100 rounded-lg md:rounded-xl m-1 border border-slate-100 shadow-sm min-w-0 ${msg.isMe ? 'text-slate-800' : 'text-slate-900'}`}>
                                                                        <FileText size={16} className="md:w-[20px] md:h-[20px] text-red-600 shrink-0" />
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[10px] md:text-xs font-bold truncate max-w-[120px] md:max-w-[150px]">{file.fileName}</span>
                                                                            <span className="text-[8px] md:text-[10px] font-medium text-slate-500 uppercase">{file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : "0"} MB</span>
                                                                        </div>
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {(msg.text || msg.content) && (
                                                        <div className={`px-3 md:px-4 py-2 md:py-2.5 text-[13px] md:text-[15px] break-words ${files.length > 0 ? 'border-t border-red-500/20 pt-1.5 md:pt-2 pb-2 md:pb-3 mt-1' : ''} ${!msg.isMe && files.length > 0 ? 'border-t-slate-100' : ''}`}>
                                                            {msg.text || msg.content}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Footer: Vùng Nhập Tin Nhắn & File */}
                            <div className="p-2 md:p-4 bg-white shrink-0 border-t border-slate-100">

                                {selectedFiles.length > 0 && (
                                    <div className="flex gap-2 p-2 md:p-3 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl mb-2 md:mb-3 overflow-x-auto custom-scrollbar-thin">
                                        {selectedFiles.map((f, index) => (
                                            <div key={`preview_${index}`} className="h-16 w-16 md:h-20 md:w-20 rounded-lg md:rounded-xl border border-slate-300 relative group shrink-0">
                                                {f.type === 'image' ? (
                                                    <img src={f.previewUrl} className="h-full w-full object-cover rounded-lg md:rounded-xl" />
                                                ) : (
                                                    <div className="h-full w-full rounded-lg md:rounded-xl bg-slate-200 flex flex-col items-center justify-center p-1 md:p-2 text-center text-slate-500">
                                                        <FileText size={16} className="md:w-5 md:h-5" />
                                                        <span className="text-[8px] md:text-[10px] font-bold mt-1 truncate w-full">{f.name}</span>
                                                    </div>
                                                )}
                                                <button onClick={() => removeSelectedFile(index)} className="absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 p-1 bg-red-600 text-white rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <X size={10} className="md:w-3 md:h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-end gap-1.5 md:gap-2 relative bg-slate-100 border border-slate-200 rounded-2xl md:rounded-3xl p-1 focus-within:bg-white focus-within:ring-2 focus-within:ring-red-500/10 focus-within:border-red-500 transition-all">

                                    <input type="file" ref={imageInputRef} hidden accept="image/*" multiple onChange={handleFileSelect} />
                                    <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.zip" />

                                    <button onClick={() => imageInputRef.current?.click()} className="p-2 md:p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all shrink-0">
                                        <ImageIcon size={20} className="md:w-[22px] md:h-[22px]" />
                                    </button>
                                    <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all shrink-0">
                                        <Paperclip size={20} className="md:w-[22px] md:h-[22px]" />
                                    </button>

                                    <textarea
                                        rows={1}
                                        className="flex-1 bg-transparent py-2.5 md:py-2.5 px-1 md:px-2 text-sm md:text-[15px] outline-none text-slate-900 resize-none max-h-24 md:max-h-32 placeholder:text-slate-400"
                                        placeholder="Nhập Aa..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />

                                    <button onClick={handleSendMessage} className="p-2 md:p-3 bg-red-600 text-white hover:bg-red-700 rounded-full transition-all shrink-0 shadow-md shadow-red-600/20 active:scale-95 mb-0.5 md:mb-0 ml-0.5 md:ml-1 disabled:bg-slate-300" disabled={!message.trim() && selectedFiles.length === 0}>
                                        <Send size={16} className="md:w-[18px] md:h-[18px] ml-0.5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* TRƯỜNG HỢP 3: MÀN HÌNH TRỐNG BAN ĐẦU (Chỉ hiện trên Tablet/PC) */
                        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <div className="h-24 w-24 bg-red-50 rounded-full flex items-center justify-center border border-red-100 mb-6 shadow-sm shadow-red-500/5">
                                <MessageSquare size={48} className="text-red-500/80" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Sano Workspace Chat</h3>
                            <p className="text-sm font-medium">Hãy chọn một đoạn chat hoặc bắt đầu cuộc trò chuyện mới bằng nút đỏ!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}