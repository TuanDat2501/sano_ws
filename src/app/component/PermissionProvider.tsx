"use client";

import React, { createContext, useContext } from "react";
import { useSession } from "next-auth/react";

interface PermissionContextType {
    hasPermission: (moduleId: string) => boolean;
    loading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider = ({ children }: { children: React.ReactNode }) => {
    // Chỉ cần lấy session ra dùng, không cần fetch API nữa
    const { data: session, status } = useSession();

    // Hệ thống chỉ loading khi NextAuth đang xác thực
    const loading = status === "loading";

    const hasPermission = (moduleId: string) => {
        if (!session?.user) return false;
        
        const currentUser = session.user as any;

        // 👑 ADMIN và BGD luôn có quyền tối cao
        if (currentUser.role === "ADMIN" || currentUser.role === "BAN_GIAM_DOC") {
            return true;
        }

        // 🚀 Đọc trực tiếp từ mảng permissions đã được auth.ts tính toán sẵn (Bao gồm cả quyền ảo)
        const userPermissions = currentUser.permissions || [];
        return userPermissions.includes(moduleId);
    };

    return (
        <PermissionContext.Provider value={{ hasPermission, loading }}>
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermission = () => {
    const context = useContext(PermissionContext);
    if (!context) throw new Error("usePermission must be used within PermissionProvider");
    return context;
};