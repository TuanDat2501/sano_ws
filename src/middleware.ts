import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// =======================================================
// 🚀 TỪ ĐIỂN MAPPING: ĐƯỜNG DẪN -> MÃ MODULE
// Dùng ID giống hệt file src/app/permissions/page.tsx
// =======================================================
const routePermissions: Record<string, string> = {
    "/": "MENU_DASHBOARD",            // Trang Tổng quan
    "/tasks": "MENU_TASKS",           // Bảng công việc
    "/kpi": "MENU_KPI",               // Xem Đánh giá KPI
    "/requests": "MENU_REQUESTS",     // Xem Đơn từ & Đề xuất
    "/teams": "MENU_TEAMS",           // Quản lý Đội ngũ
    "/users": "MENU_USERS",           // Quản lý Nhân sự
    "/org-chart": "MENU_ORG_CHART",   // Sơ đồ tổ chức
    "/daily-report": "MENU_DAILY_REPORT", // Báo cáo Hằng ngày
    "/analytics": "MENU_ANALYTICS",   // Báo cáo Chiến lược
    "/projects": "MENU_PROJECTS",
    // Các tính năng thao tác lẻ (ACTION_) thì kiểm tra ở tầng API hoặc Nút bấm trên giao diện, không kiểm tra ở Middleware chặn Route.
};

export default withAuth(
    function middleware(req) {
        const { pathname } = req.nextUrl;
        const token = req.nextauth.token;
        const userPermissions = (token?.permissions as string[]) || [];

        // =======================================================
        // 🛡️ BẢO VỆ TUYỆT ĐỐI TRANG QUẢN LÝ PHÂN QUYỀN & CÀI ĐẶT
        // Các trang này không nằm trong từ điển động, nó ĐỘC QUYỀN cho ADMIN
        // =======================================================
        if (pathname.startsWith("/permissions") || pathname.startsWith("/settings")) {
            if (token?.role !== "ADMIN") {
                return NextResponse.redirect(new URL("/", req.url));
            }
        }

        // =======================================================
        // 🛡️ THUẬT TOÁN QUÉT QUYỀN ĐỘNG THEO TỪ ĐIỂN
        // =======================================================
        
        const matchedRoute = Object.keys(routePermissions).find(route => {
            if (route === "/") return pathname === "/";
            return pathname.startsWith(route);
        });

        if (matchedRoute) {
            const requiredModuleId = routePermissions[matchedRoute];
            
            if (!userPermissions.includes(requiredModuleId)) {
                if (pathname === "/") {
                     return NextResponse.redirect(new URL("/login", req.url));
                }
                
                return NextResponse.redirect(new URL("/unauthorized", req.url));
            }
        }

        // Hợp lệ -> Đi tiếp
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/login",
        },
    }
);

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|login).*)"],
};