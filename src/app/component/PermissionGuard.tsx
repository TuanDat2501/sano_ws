"use client";

import React from "react";
import { usePermission } from "./PermissionProvider";
import AccessDenied from "./AccessDenied";
import { Loader2 } from "lucide-react";

interface PermissionGuardProps {
    moduleId: string;
    children: React.ReactNode;
}

export default function PermissionGuard({ moduleId, children }: PermissionGuardProps) {
    const { hasPermission, loading } = usePermission();

    // 1. Đang tải dữ liệu quyền từ Database
    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="animate-spin text-red-600" size={32} />
                <p className="text-sm font-bold">Đang kiểm tra quyền hạn...</p>
            </div>
        );
    }

    // 2. Không có quyền -> Đá ra trang AccessDenied
    if (!hasPermission(moduleId)) {
        return <AccessDenied />;
    }

    // 3. Có quyền -> Cho phép hiển thị nội dung trang
    return <>{children}</>;
}