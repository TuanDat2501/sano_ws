"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

interface PermissionContextType {
    hasPermission: (moduleId: string) => boolean;
    loading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session, status } = useSession();
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPerms = async () => {
            const role = (session?.user as any)?.role;
            if (!role) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch("/api/permissions");
                const matrix = await res.json();

                // Lọc riêng quyền của Role hiện tại để dùng cho nhanh
                const myPerms: Record<string, boolean> = {};
                for (const moduleId in matrix) {
                    myPerms[moduleId] = matrix[moduleId][role] || false;
                }
                setPermissions(myPerms);
            } catch (error) {
                console.error("Lỗi tải phân quyền:", error);
            } finally {
                setLoading(false);
            }
        };

        if (status === "authenticated") {
            fetchPerms();
        } else if (status === "unauthenticated") {
            setLoading(false);
        }
    }, [session, status]);

    const hasPermission = (moduleId: string) => {
        const userRole = (session?.user as any)?.role;
        // 👑 ADMIN luôn có quyền tối cao, không cần check matrix
        if (userRole === "ADMIN") return true;
        return permissions[moduleId] || false;
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