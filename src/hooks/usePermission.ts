import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export function usePermission() {
    const { data: session } = useSession();
    const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMyPerms = async () => {
            const role = (session?.user as any)?.role;
            if (!role) return;

            // Gọi API lấy ma trận quyền
            const res = await fetch("/api/permissions");
            const matrix = await res.json();

            // Trích xuất riêng danh sách quyền của Role hiện tại
            const myPerms: Record<string, boolean> = {};
            for (const moduleId in matrix) {
                myPerms[moduleId] = matrix[moduleId][role] || false;
            }
            setUserPermissions(myPerms);
            setLoading(false);
        };

        if (session) fetchMyPerms();
    }, [session]);

    const hasPermission = (moduleId: string) => {
        // Admin luôn có quyền tối cao
        if ((session?.user as any)?.role === "ADMIN") return true;
        return userPermissions[moduleId] || false;
    };

    return { hasPermission, loading };
}