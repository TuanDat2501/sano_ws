"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Video, CheckSquare, Square, Search } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

interface MergeVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: any[];
    teams: any[];
    channels: any[];
    onSubmit: (data: { sourceTaskIds: string[], teamId: string, projectId: string, assigneeId: string, channelId?: string, duration?: number }) => void;
    isSubmitting: boolean;
}

export default function MergeVideoModal({ isOpen, onClose, projects, teams, channels, onSubmit, isSubmitting }: MergeVideoModalProps) {
    const { showToast } = useToast();
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [selectedEditorId, setSelectedEditorId] = useState("");
    
    const [selectedChannelId, setSelectedChannelId] = useState("");
    const [duration, setDuration] = useState("");
    
    const [availableTasks, setAvailableTasks] = useState<any[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    
    const [teamEditors, setTeamEditors] = useState<any[]>([]);
    // 🚀 State quản lý Kênh theo Team
    const [teamChannels, setTeamChannels] = useState<any[]>(channels); 
    const [isLoadingEditors, setIsLoadingEditors] = useState(false);

    const [projectTeamId, setProjectTeamId] = useState(""); 
    const [isFetchingProject, setIsFetchingProject] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");

    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Reset dữ liệu khi đóng/mở Modal
    useEffect(() => {
        if (isOpen) {
            setSelectedProjectId("");
            setSelectedTeamId("");
            setSelectedEditorId("");
            setSelectedChannelId(""); 
            setDuration(""); 
            setAvailableTasks([]);
            setSelectedTaskIds([]);
            setSearchQuery("");
            setTeamEditors([]);
            setTeamChannels(channels); // Khôi phục lại toàn bộ kênh ban đầu
            setProjectTeamId("");
        }
    }, [isOpen, channels]);

    useEffect(() => {
        if (!selectedProjectId) {
            setSelectedTeamId("");
            setProjectTeamId("");
            return;
        }

        const fetchProjectDetails = async () => {
            setIsFetchingProject(true);
            try {
                const res = await fetch(`/api/projects/${selectedProjectId}`);
                const data = await res.json();
                
                if (res.ok && data.teamId) {
                    setSelectedTeamId(data.teamId); 
                    setProjectTeamId(data.teamId); 
                } else {
                    setSelectedTeamId("");
                    setProjectTeamId("");
                }
            } catch (error) {
                console.error("Lỗi tải thông tin dự án:", error);
                setSelectedTeamId("");
                setProjectTeamId("");
            } finally {
                setIsFetchingProject(false);
            }
        };

        fetchProjectDetails();
    }, [selectedProjectId]);

    // 🚀 LOGIC MỚI: Lấy cả Nhân sự VÀ Kênh khi chốt Team
    useEffect(() => {
        if (!selectedTeamId) {
            setTeamEditors([]);
            setSelectedEditorId(""); 
            setTeamChannels(channels); // Nếu không có Team thì hiện Full Kênh
            return;
        }

        const fetchTeamData = async () => {
            setIsLoadingEditors(true);
            try {
                const res = await fetch(`/api/teams/${selectedTeamId}`);
                const data = await res.json();
                
                // Lọc Nhân sự
                const usersList = data.users || [];
                const validEditors = usersList.filter((u: any) => 
                    ["EDITOR", "LEADER", "CONTENT"].includes(u.role?.toUpperCase())
                );
                setTeamEditors(validEditors);

                // Lọc Kênh (Nếu API trả về mảng channels thì lấy, không thì dùng fallback local filter)
                if (data.channels && Array.isArray(data.channels)) {
                    setTeamChannels(data.channels);
                } else {
                    // Fallback phòng trường hợp API chưa update: tự lọc bằng mảng channels truyền vào
                    setTeamChannels(channels.filter(c => c.teamId === selectedTeamId));
                }

                // Xóa chọn kênh cũ nếu kênh đó không thuộc team này
                setSelectedChannelId(""); 

            } catch (error) {
                showToast("error", "Không thể tải dữ liệu của Team");
                setTeamEditors([]);
            } finally {
                setIsLoadingEditors(false);
            }
        };

        fetchTeamData();
    }, [selectedTeamId, channels]);

    useEffect(() => {
        if (!selectedProjectId) {
            setAvailableTasks([]);
            return;
        }

        const fetchProjectTasks = async () => {
            setIsLoadingTasks(true);
            try {
                const res = await fetch(`/api/tasks?viewMode=list&limit=100`);
                const data = await res.json();
                
                if (data.tasks) {
                    const tasksForMerge = data.tasks.filter((t: any) => 
                        t.projectId === selectedProjectId && 
                        !t.isCompilation &&
                        t.status === "DONE" && 
                        t.videoLink && t.videoLink.trim() !== "" 
                    );
                    
                    tasksForMerge.sort((a: any, b: any) => {
                        if (a.episodeNumber !== null && b.episodeNumber !== null) return a.episodeNumber - b.episodeNumber;
                        if (a.episodeNumber !== null) return -1;
                        if (b.episodeNumber !== null) return 1;
                        return 0;
                    });
                    
                    setAvailableTasks(tasksForMerge);
                }
            } catch (error) {
                showToast("error", "Không thể tải danh sách tập");
            } finally {
                setIsLoadingTasks(false);
            }
        };

        fetchProjectTasks();
    }, [selectedProjectId]);

    const handleToggleTask = (taskId: string) => {
        setSelectedTaskIds(prev => 
            prev.includes(taskId) 
                ? prev.filter(id => id !== taskId) 
                : [...prev, taskId]
        );
    };

    const handleSubmit = () => {
        if (!selectedProjectId) return showToast("error", "Vui lòng chọn Series/Project");
        if (!selectedTeamId) return showToast("error", "Vui lòng chọn Team chịu trách nhiệm");
        if (!selectedEditorId) return showToast("error", "Vui lòng chọn Editor để gán việc");
        if (selectedTaskIds.length < 2) return showToast("error", "Cần chọn ít nhất 2 tập để ghép");

        onSubmit({
            sourceTaskIds: selectedTaskIds,
            teamId: selectedTeamId,
            projectId: selectedProjectId,
            assigneeId: selectedEditorId,
            channelId: selectedChannelId || undefined,
            duration: duration ? Number(duration) : undefined
        });
    };

    if (!isOpen) return null;

    const displayedTasks = availableTasks.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayedTeams = projectTeamId ? teams.filter(t => t.id === projectTeamId) : teams;

    const content = (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xl rounded-2xl md:rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Video className="text-indigo-600" size={20} /> Tạo Video Ghép (Compilation)
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                    <div className="space-y-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">1. Chọn Dự án / Series <span className="text-red-500">*</span></label>
                                <select className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-sm font-medium focus:border-indigo-500" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                                    <option value="">-- Chọn Series --</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">2. Chọn Kênh đăng tải</label>
                                {/* 🚀 Xổ ra danh sách Kênh đã được lọc theo Team */}
                                <select 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-sm font-medium focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed" 
                                    disabled={isLoadingEditors}
                                    value={selectedChannelId} 
                                    onChange={(e) => setSelectedChannelId(e.target.value)}
                                >
                                    <option value="">{isLoadingEditors ? "Đang tải Kênh..." : "-- Không bắt buộc --"}</option>
                                    {teamChannels?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">3. Chọn Team <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-500 disabled:opacity-80 disabled:cursor-not-allowed" 
                                    value={selectedTeamId} 
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                    disabled={!!projectTeamId || isFetchingProject} 
                                >
                                    <option value="">{isFetchingProject ? "Đang tải..." : "-- Chọn Team --"}</option>
                                    {displayedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">4. Giao Editor <span className="text-red-500">*</span></label>
                                <select 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-sm focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed" 
                                    disabled={!selectedTeamId || isLoadingEditors || isFetchingProject} 
                                    value={selectedEditorId} 
                                    onChange={(e) => setSelectedEditorId(e.target.value)}
                                >
                                    <option value="">{isLoadingEditors ? "Đang tải..." : "-- Chọn --"}</option>
                                    {teamEditors.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">5. Độ dài (Phút)</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    placeholder="VD: 15"
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-sm focus:border-indigo-500" 
                                    value={duration} 
                                    onChange={(e) => setDuration(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={`transition-opacity ${selectedProjectId ? 'opacity-100' : 'opacity-50 pointer-events-none'} flex flex-col min-h-0`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                            <label className="block text-sm font-bold text-slate-700">
                                6. Tick chọn các tập cần ghép <span className="text-red-500">*</span>
                            </label>
                            
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="Tìm tên tập..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 w-full sm:w-48"
                                />
                            </div>
                        </div>
                        
                        <div className="bg-white border border-slate-200 rounded-xl h-[250px] overflow-y-auto custom-scrollbar p-2">
                            {isLoadingTasks ? (
                                <div className="flex justify-center items-center h-full text-slate-400">
                                    <Loader2 size={24} className="animate-spin" />
                                </div>
                            ) : displayedTasks.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-center text-sm text-slate-500 font-medium italic">Không tìm thấy tập nào đã Hoàn thành (DONE) và có Link Video.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {displayedTasks.map(task => {
                                        const isSelected = selectedTaskIds.includes(task.id);
                                        const usedCount = task.usedInMergeCount || 0;
                                        
                                        return (
                                            <div 
                                                key={task.id} 
                                                onClick={() => handleToggleTask(task.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent'}`}
                                            >
                                                {isSelected ? <CheckSquare className="text-indigo-600 shrink-0" size={18} /> : <Square className="text-slate-400 shrink-0" size={18} />}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{task.title}</p>
                                                    
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-500">
                                                            {task.episodeNumber ? `#${task.episodeNumber} • ` : ''}{task.status}
                                                        </span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${usedCount > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            Đã ghép: {usedCount}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-2 text-right">
                            <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-md">Đã chọn: {selectedTaskIds.length} tập</span>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 shrink-0">
                    <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm">Hủy</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md flex justify-center items-center gap-2 transition-all text-sm disabled:opacity-50">
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        {isSubmitting ? "Đang gộp..." : "Bắt đầu gộp Video"}
                    </button>
                </div>
            </div>
        </div>
    );

    if (!mounted) return null;
    return createPortal(content, document.body);
}