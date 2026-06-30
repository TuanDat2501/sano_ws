"use client";

import { use, useState, useEffect, useRef } from "react";
import WorkflowDesigner from "./WorkflowDesigner";
import { ArrowLeft, Settings, Activity, Save, Loader2, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/component/ToastProvider";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { showToast } = useToast();
    const resolvedParams = use(params);
    const projectId = resolvedParams.id;

    // 🚀 STATE LƯU THÔNG TIN DỰ ÁN
    const [project, setProject] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const designerRef = useRef<any>(null);
    const initialNodes = project?.workflowNodes ? (typeof project.workflowNodes === 'string' ? JSON.parse(project.workflowNodes) : project.workflowNodes) : [];
    const initialEdges = project?.workflowEdges ? (typeof project.workflowEdges === 'string' ? JSON.parse(project.workflowEdges) : project.workflowEdges) : [];
    // 🚀 HÀM FETCH DỮ LIỆU DỰ ÁN (Lấy tên dự án cho Header)
    useEffect(() => {
        const fetchProjectInfo = async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}`);
                if (!res.ok) throw new Error("Không thể tải thông tin dự án");
                const data = await res.json();
                setProject(data);
            } catch (error) {
                showToast("error", "Lỗi: " + (error as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProjectInfo();
    }, [projectId, showToast]);

    // 🚀 HÀM LƯU QUY TRÌNH (Gọi từ Header)
    const handleSave = async () => {
        if (!designerRef.current) return;

        setIsSaving(true);
        try {
            const { nodes, edges } = designerRef.current.getFlowData();

            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowNodes: JSON.stringify(nodes),
                    workflowEdges: JSON.stringify(edges)
                })
            });

            if (!res.ok) throw new Error("Lỗi Server khi lưu");
            showToast("success", "Đã cập nhật quy trình dự án!");
        } catch (error) {
            showToast("error", "Lưu thất bại: " + (error as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    // Màn hình loading khi chưa có data project
    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-red-600" size={40} />
                    <p className="text-slate-500 font-bold animate-pulse">Đang tải cấu hình dự án...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-80px)] bg-slate-50 p-4 md:p-6 animate-fade-in flex flex-col overflow-hidden">

            {/* HEADER ĐỘNG */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm active:scale-90">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            {/* 🚀 HIỂN THỊ TÊN DỰ ÁN THẬT TỪ DB */}
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                {project?.name || "Dự án không tên"}
                            </h1>
                            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                {project?.team?.name || "Sano Team"}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                            <p className="text-xs text-slate-400 font-bold flex items-center gap-1">
                                <Calendar size={12} /> Cập nhật: {project?.updatedAt ? new Date(project.updatedAt).toLocaleDateString('vi-VN') : '---'}
                            </p>
                            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">ID: {projectId.split('-')[0]}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 shadow-sm transition-colors text-sm">
                        <Activity size={18} /> Báo cáo
                    </button>
                    <button className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 shadow-sm transition-colors text-sm">
                        <Settings size={18} /> Cấu hình
                    </button>

                    {/* NÚT LƯU QUY TRÌNH */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-red-600/30 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        LƯU QUY TRÌNH
                    </button>
                </div>
            </div>

            {/* WORKFLOW DESIGNER */}
            <div className="flex-1 flex flex-col min-h-0 pb-4">
                {/* <div className="mb-4 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
                    <div className="flex items-center justify-center w-6 h-6 bg-indigo-600 rounded-full font-black text-white shrink-0 text-xs shadow-md">i</div>
                    <span>Sếp có thể thiết lập các bước quy trình chuyên biệt cho <strong>{project?.name}</strong> tại đây.</span>
                </div> */}

                <WorkflowDesigner ref={designerRef}
                    projectId={projectId}
                    initialNodes={initialNodes}
                    initialEdges={initialEdges} />
            </div>

        </div>
    );
}