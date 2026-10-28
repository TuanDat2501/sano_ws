"use client";

import { useState, useEffect } from "react";
import { Loader2, Activity } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";
import SurplusView from "../tasks/SurplusView";

export default function ProductionHealthPage() {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/production-health");
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                } else {
                    showToast("error", "Không thể tải dữ liệu");
                }
            } catch (error) {
                showToast("error", "Lỗi máy chủ");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-full animate-fade-in">
            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <Activity className="text-indigo-600" /> Kiểm Soát Năng Suất (Bài Dư)
                </h1>
                <p className="text-sm text-slate-500 font-medium mt-1">Hệ thống tự động quét và đếm bài dư dựa trên tiến độ công việc thực tế.</p>
            </div>

            <SurplusView />
        </div>
    );
}