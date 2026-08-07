"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Pencil, Save, X, Calendar, Video } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function TaskLogCrud({ userId, userName }: { userId: string, userName: string }) {
    const { showToast } = useToast();
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/task-logs?userId=${userId}`);
            if (res.ok) setLogs(await res.json());
        } catch (e) {
            showToast("error", "Lỗi tải dữ liệu log");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (userId) fetchLogs();
    }, [userId]);

    const handleDelete = async (logId: string) => {
        if (!confirm("Xóa log này sẽ làm thay đổi điểm KPI của nhân sự. Bạn chắc chắn chứ?")) return;
        try {
            const res = await fetch(`/api/task-logs`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: logId, type: "DELETE" })
            });
            if (res.ok) {
                showToast("success", "Đã xóa log thành công");
                fetchLogs();
            } else {
                showToast("error", "Lỗi khi xóa log");
            }
        } catch (e) {
            showToast("error", "Lỗi Server");
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-[24px] p-5 md:p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-black text-slate-800">Lịch sử ghi nhận KPI</h3>
                    <p className="text-sm font-medium text-slate-500">Quản lý và điều chỉnh điểm số cho: <span className="text-blue-600 font-bold">{userName}</span></p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                                <th className="p-3 rounded-tl-xl font-black">Thời gian</th>
                                <th className="p-3 font-black">Video / Dự án</th>
                                <th className="p-3 font-black">Nội dung ghi nhận</th>
                                <th className="p-3 font-black text-center">Trạng thái (KPI)</th>
                                <th className="p-3 rounded-tr-xl font-black text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-3 font-bold text-slate-700 whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                                    </td>
                                    <td className="p-3 font-bold text-blue-600 max-w-[250px] truncate">
                                        {log.task?.title || "Task đã bị xóa"}
                                    </td>
                                    <td className="p-3 font-medium text-slate-600">
                                        {log.details}
                                    </td>
                                    <td className="p-3 text-center">
                                        {log.action === "DAILY_REPORT" ? (
                                            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[11px] font-black">ĐƯỢC TÍNH ĐIỂM</span>
                                        ) : (
                                            <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md text-[11px] font-black">KHÔNG TÍNH ĐIỂM</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                        <button onClick={() => handleDelete(log.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium italic">Không có dữ liệu ghi nhận KPI nào.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}