"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Target, Edit, Loader2, CheckCircle2, Search, Users, Tv, Calendar } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

interface TaskManageDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'EDIT_TASK' | 'ASSIGN_KPI';
    taskId?: string; // Bắt buộc nếu là EDIT_TASK
    teams: any[];
    onSuccess: () => void; // Trigger để báo cho bảng bên ngoài Reload lại data
}

export default function TaskManageDrawer({ isOpen, onClose, mode, taskId, teams, onSuccess }: TaskManageDrawerProps) {
    const { showToast } = useToast();
    const [mounted, setMounted] = useState(false);

    // ================= STATES: EDIT TASK =================
    const [currentTask, setCurrentTask] = useState<any>(null);
    const [channels, setChannels] = useState<any[]>([]);
    const [isSavingTask, setIsSavingTask] = useState(false);
    const [isLoadingTask, setIsLoadingTask] = useState(false);

    // ================= STATES: ASSIGN KPI =================
    const [assignTeamId, setAssignTeamId] = useState("");
    const [assignUsers, setAssignUsers] = useState<any[]>([]);
    const [assignUserId, setAssignUserId] = useState("");
    const [assignAction, setAssignAction] = useState("DAILY_REPORT");
    
    // 🚀 ĐÃ BỔ SUNG: State quản lý Ngày gán KPI (mặc định lấy ngày hôm nay)
    const [assignDate, setAssignDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Tìm kiếm Task (Nếu mở Drawer Gán KPI từ hư không mà chưa có Task)
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(false);
    const [selectedTaskToAssign, setSelectedTaskToAssign] = useState<any>(null);
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (isOpen) {
            // Reset States khi mở lại
            setCurrentTask(null);
            setAssignTeamId("");
            setAssignUserId("");
            setSelectedTaskToAssign(null);
            setSearchQuery("");
            setSearchResults([]);
            setAssignDate(new Date().toISOString().split('T')[0]); // Mở modal thì tự nhảy về ngày nay

            if (taskId && mode === 'EDIT_TASK') {
                fetchTaskDetail(taskId);
            }

            if (mode === 'ASSIGN_KPI') {
                fetchAllTasks();
            }

            if (channels.length === 0 && mode === 'EDIT_TASK') {
                fetch(`/api/kpi/manage-task?getChannels=true`)
                    .then(res => res.json())
                    .then(data => setChannels(Array.isArray(data) ? data : []))
                    .catch(() => setChannels([])); 
            }
        }
    }, [isOpen, taskId, mode]);

    const fetchTaskDetail = async (id: string) => {
        setIsLoadingTask(true);
        try {
            const tRes = await fetch(`/api/kpi/manage-task?taskId=${id}`);
            const data = await tRes.json();
            setCurrentTask(data);
        } catch (e) {
            showToast("error", "Lỗi lấy dữ liệu Task");
        } finally {
            setIsLoadingTask(false);
        }
    };

    const fetchAllTasks = async () => {
        setIsLoadingAllTasks(true);
        try {
            const res = await fetch(`/api/kpi/manage-task?list=true`);
            const data = await res.json();
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (e) {
            showToast("error", "Lỗi tải danh sách Task");
        } finally {
            setIsLoadingAllTasks(false);
        }
    };

    // ---------------------------------------------------------
    // XỬ LÝ SỬA TASK
    // ---------------------------------------------------------
    const handleSaveTask = async () => {
        setIsSavingTask(true);
        try {
            const res = await fetch(`/api/kpi/manage-task`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(currentTask)
            });
            if (res.ok) {
                showToast("success", "Cập nhật Task thành công!");
                onSuccess();
                onClose();
            } else { showToast("error", "Cập nhật thất bại"); }
        } catch (e) { showToast("error", "Lỗi Server"); } 
        finally { setIsSavingTask(false); }
    };

    // ---------------------------------------------------------
    // XỬ LÝ TÌM & GÁN KPI
    // ---------------------------------------------------------
    const handleSearchTask = async () => {
        setIsSearching(true);
        try {
            const res = await fetch(`/api/kpi/manage-task?list=true&search=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (e) { showToast("error", "Lỗi tìm kiếm"); } 
        finally { setIsSearching(false); }
    };

    useEffect(() => {
        if (!assignTeamId) { setAssignUsers([]); setAssignUserId(""); return; }
        fetch(`/api/users?teamId=${assignTeamId}`)
            .then(res => res.json())
            .then(data => setAssignUsers(Array.isArray(data.users) ? data.users : []));
    }, [assignTeamId]);

    const handleAssignKPI = async () => {
        if (!selectedTaskToAssign || !assignUserId) return;
        setIsAssigning(true);
        try {
            const res = await fetch(`/api/kpi/manage-task`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskId: selectedTaskToAssign.id,
                    userId: assignUserId,
                    actionType: assignAction,
                    assignedDate: assignDate // 🚀 Gửi kèm Ngày đã chọn
                })
            });
            if (res.ok) {
                showToast("success", "Đã gán KPI thành công!");
                onSuccess();
                onClose();
            } else { showToast("error", "Gán thất bại"); }
        } catch (e) { showToast("error", "Lỗi Server"); } 
        finally { setIsAssigning(false); }
    };

    if (!mounted) return null;

    const drawerContent = (
        <>
            {isOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99998] transition-opacity" onClick={onClose} />}

            <div className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-[99999] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
                
                {/* HEADER DRAWER */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        {mode === 'EDIT_TASK' ? (
                            <><Edit className="text-blue-600" size={20} /> Sửa Thông Số Task</>
                        ) : (
                            <><Target className="text-emerald-500" size={20} /> Gán KPI Thủ Công</>
                        )}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-white rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm">
                        <X size={18} />
                    </button>
                </div>

                {/* NỘI DUNG CHÍNH */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                    {isLoadingTask ? (
                        <div className="h-full flex flex-col items-center justify-center text-blue-500">
                            <Loader2 size={32} className="animate-spin mb-4" />
                            <p className="font-bold text-sm">Đang tải dữ liệu Task...</p>
                        </div>
                    ) : (
                        <>
                            {/* ==================================
                                MODE 1: SỬA TASK 
                            ================================== */}
                            {mode === 'EDIT_TASK' && currentTask && (
                                <div className="flex flex-col gap-5 animate-fade-in">
                                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Tên Video / Task</label>
                                        <textarea 
                                            rows={2}
                                            className="w-full bg-white border border-blue-200 rounded-lg p-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none"
                                            value={currentTask.title}
                                            onChange={(e) => setCurrentTask({...currentTask, title: e.target.value})}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Thuộc Kênh Đăng</label>
                                        <select 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                                            value={currentTask.channelId || ""}
                                            onChange={(e) => setCurrentTask({...currentTask, channelId: e.target.value})}
                                        >
                                            <option value="">-- Cảnh báo: Chưa chọn kênh --</option>
                                            {Array.isArray(channels) && channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="flex-1">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Thời lượng (Phút)</label>
                                            <input 
                                                type="number" 
                                                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:border-blue-500 focus:bg-white"
                                                value={currentTask.duration || ""}
                                                onChange={(e) => setCurrentTask({...currentTask, duration: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex-1 pb-1">
                                            <label className="flex items-center gap-3 cursor-pointer group bg-white border border-slate-200 px-4 py-3 rounded-xl hover:border-rose-300 transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-5 h-5 cursor-pointer accent-rose-500 rounded"
                                                    checked={currentTask.isRework}
                                                    onChange={(e) => setCurrentTask({...currentTask, isRework: e.target.checked})}
                                                />
                                                <span className="text-sm font-black text-slate-700 group-hover:text-rose-600 transition-colors">Xào Lại</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ==================================
                                MODE 2: GÁN KPI 
                            ================================== */}
                            {mode === 'ASSIGN_KPI' && (
                                <div className="flex flex-col gap-5 animate-fade-in">
                                    {/* Bước 1: Chọn Task (Nếu chưa có) */}
                                    {!selectedTaskToAssign ? (
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                            <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Bước 1: Chọn Video / Task cần gán</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Tìm theo tên video..."
                                                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-emerald-500"
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchTask()}
                                                    />
                                                </div>
                                                <button onClick={handleSearchTask} disabled={isSearching} className="bg-slate-800 text-white px-4 rounded-xl font-bold hover:bg-slate-900 transition-colors shrink-0">
                                                    {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Tìm"}
                                                </button>
                                            </div>

                                            {/* KHU VỰC HIỂN THỊ LIST TASK */}
                                            {isLoadingAllTasks ? (
                                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-500" /></div>
                                            ) : (
                                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto custom-scrollbar mt-2 shadow-sm">
                                                    {searchResults.length === 0 ? (
                                                        <div className="p-5 text-center text-slate-400 text-sm font-medium">Không có Video/Task nào.</div>
                                                    ) : searchResults.map(task => (
                                                        <div 
                                                            key={task.id} 
                                                            onClick={() => setSelectedTaskToAssign(task)}
                                                            className="p-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors hover:bg-emerald-50/50 border-l-4 border-l-transparent hover:border-l-emerald-400 group"
                                                        >
                                                            <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-1.5 group-hover:text-emerald-700 transition-colors">{task.title}</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                <span className="text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                                                    <Tv size={10} /> {task.channel?.name || "Chưa kênh"}
                                                                </span>
                                                                <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                                    {task.duration || 0} Phút
                                                                </span>
                                                                {task.isClosed && (
                                                                    <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                                                                        Đã đóng
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-2xl relative shadow-sm">
                                            <button onClick={() => setSelectedTaskToAssign(null)} className="absolute top-2 right-2 p-1.5 bg-white rounded-lg text-emerald-600 shadow-sm border border-emerald-100 hover:bg-emerald-100 transition-colors text-[10px] font-bold">
                                                Đổi Video
                                            </button>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Video/Task Đã Chọn:</p>
                                            <p className="text-sm font-bold text-slate-800 pr-16">{selectedTaskToAssign.title}</p>
                                        </div>
                                    )}

                                    {/* Bước 2: Chọn Người Nhận KPI */}
                                    <div className={`transition-all duration-300 ${!selectedTaskToAssign ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-3">Bước 2: Phân bổ Điểm KPI</label>
                                        <div className="flex flex-col gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                            
                                            {/* 🚀 ĐÃ BỔ SUNG: CỘT NGÀY THÁNG GÁN KPI */}
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <Calendar size={14} className="text-emerald-500" /> Ngày báo cáo (KPI)
                                                    </label>
                                                    <input 
                                                        type="date" 
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:border-emerald-500 focus:bg-white text-emerald-800 cursor-pointer"
                                                        value={assignDate}
                                                        onChange={(e) => setAssignDate(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">1. Chọn Team</label>
                                                <select 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer"
                                                    value={assignTeamId}
                                                    onChange={(e) => setAssignTeamId(e.target.value)}
                                                >
                                                    <option value="">-- Chọn Team --</option>
                                                    {Array.isArray(teams) && teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">2. Người hưởng KPI</label>
                                                <select 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-50 cursor-pointer"
                                                    value={assignUserId}
                                                    onChange={(e) => setAssignUserId(e.target.value)}
                                                    disabled={!assignTeamId}
                                                >
                                                    <option value="">-- Chọn Nhân Sự --</option>
                                                    {Array.isArray(assignUsers) && assignUsers.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}
                                                </select>
                                            </div>
                                            <div className="pt-2 border-t border-slate-100">
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">3. Hành động (Loại KPI)</label>
                                                <select 
                                                    className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 text-sm font-black outline-none focus:border-emerald-500 text-emerald-800 cursor-pointer shadow-inner"
                                                    value={assignAction}
                                                    onChange={(e) => setAssignAction(e.target.value)}
                                                >
                                                    <option value="DAILY_REPORT">✅ Báo Cáo Ngày (Áp dụng chung)</option>
                                                    <option value="SUBMIT_SCRIPT">📝 Hoàn thành Kịch Bản (Content)</option>
                                                    <option value="SUBMIT_VIDEO">🎬 Hoàn thành Dựng Video (Edit)</option>
                                                    <option value="PUBLISH_VIDEO">🚀 Đã Đăng Kênh (Publish)</option>
                                                    <option value="COMPLETE_TASK">⭐ Nghiệm thu thành công</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* FOOTER - NÚT HÀNH ĐỘNG */}
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                        Hủy
                    </button>

                    {mode === 'EDIT_TASK' ? (
                        <button 
                            onClick={handleSaveTask} 
                            disabled={isSavingTask || isLoadingTask} 
                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
                        >
                            {isSavingTask && <Loader2 size={16} className="animate-spin" />} Lưu Thông Số
                        </button>
                    ) : (
                        <button 
                            onClick={handleAssignKPI} 
                            disabled={!selectedTaskToAssign || !assignUserId || isAssigning || isLoadingTask} 
                            className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                        >
                            {isAssigning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Chốt Gán KPI
                        </button>
                    )}
                </div>
            </div>
        </>
    );

    return createPortal(drawerContent, document.body);
}