"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Search, Database, Users } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function TaskLogManager({ teams }: { teams: any[] }) {
    const { showToast } = useToast();
    
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [teamUsers, setTeamUsers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // Fetch User khi chọn Team
    useEffect(() => {
        if (!selectedTeamId) {
            setTeamUsers([]);
            setSelectedUserId("");
            return;
        }
        setIsLoadingUsers(true);
        fetch(`/api/users?teamId=${selectedTeamId}`)
            .then(res => res.json())
            .then(data => {
                setTeamUsers(Array.isArray(data.users) ? data.users : []);
            })
            .catch(() => showToast("error", "Lỗi tải danh sách nhân sự"))
            .finally(() => setIsLoadingUsers(false));
    }, [selectedTeamId]);

    // Fetch Log khi chọn User
    const fetchLogs = async () => {
        if (!selectedUserId) {
            setLogs([]);
            return;
        }
        setIsLoadingLogs(true);
        try {
            const res = await fetch(`/api/task-logs?userId=${selectedUserId}`);
            if (res.ok) setLogs(await res.json());
        } catch (e) {
            showToast("error", "Lỗi tải dữ liệu log");
        } finally {
            setIsLoadingLogs(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [selectedUserId]);

    const handleDelete = async (logId: string) => {
        if (!confirm("Hành động này sẽ XÓA VĨNH VIỄN log và có thể làm giảm điểm KPI của nhân sự. Xác nhận xóa?")) return;
        try {
            const res = await fetch(`/api/task-logs`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: logId, type: "DELETE" })
            });
            if (res.ok) {
                showToast("success", "Đã xóa log rác thành công. Vui lòng reload trang KPI để cập nhật.");
                fetchLogs();
            } else {
                showToast("error", "Lỗi khi xóa log");
            }
        } catch (e) {
            showToast("error", "Lỗi Server");
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            {/* Thanh điều khiển */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center shrink-0">
                <div>
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Database className="text-rose-500 w-5 h-5" /> Quản lý Dữ liệu Thô (Log)
                    </h2>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                        Khu vực dọn dẹp các log bị hệ thống ghi nhận trùng hoặc sai lệch.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select 
                        className="bg-white border border-slate-200 text-sm font-bold text-slate-800 rounded-xl px-3 py-2 outline-none focus:border-rose-500 w-full sm:w-48"
                        value={selectedTeamId}
                        onChange={e => setSelectedTeamId(e.target.value)}
                    >
                        <option value="">-- Chọn Team --</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <select 
                        className="bg-white border border-slate-200 text-sm font-bold text-slate-800 rounded-xl px-3 py-2 outline-none focus:border-rose-500 w-full sm:w-48 disabled:opacity-50"
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        disabled={!selectedTeamId || isLoadingUsers}
                    >
                        <option value="">{isLoadingUsers ? "Đang tải..." : "-- Chọn Nhân sự --"}</option>
                        {teamUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                </div>
            </div>

            {/* Bảng Log */}
            <div className="flex-1 overflow-auto custom-scrollbar p-5">
                {!selectedUserId ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                        <Users size={48} className="text-slate-200 mb-4" />
                        <p className="text-sm font-medium">Vui lòng chọn Team và Nhân sự để tải danh sách Log.</p>
                    </div>
                ) : isLoadingLogs ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-rose-500" /></div>
                ) : (
                    <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] sticky top-0">
                            <tr>
                                <th className="px-4 py-3 w-40 rounded-tl-xl">Thời gian tạo</th>
                                <th className="px-4 py-3">Chi tiết Ghi nhận</th>
                                <th className="px-4 py-3 w-56">Thuộc Video</th>
                                <th className="px-4 py-3 w-32 text-center">Trạng thái KPI</th>
                                <th className="px-4 py-3 w-20 text-center rounded-tr-xl">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-slate-400 font-medium">Không tìm thấy dữ liệu.</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-rose-50/30 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-700 text-xs">
                                            {new Date(log.createdAt).toLocaleString("vi-VN", {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800 text-xs">
                                            {log.details}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <p className="font-bold text-blue-600 truncate max-w-[200px]" title={log.task?.title}>{log.task?.title || "Video đã bị xóa"}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {log.action === "DAILY_REPORT" ? (
                                                <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-black tracking-wide">CÓ TÍNH KPI</span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-black tracking-wide">KHÔNG TÍNH</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => handleDelete(log.id)} 
                                                className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                                                title="Xóa log này"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}