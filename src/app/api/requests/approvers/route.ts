import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// TỪ ĐIỂN CẤU HÌNH LUỒNG DUYỆT (Được chuyển từ FE xuống BE)
const APPROVAL_CONFIG = {
    BGD_ADMIN: ["BAN_GIAM_DOC", "ADMIN"],
    HR_KETOAN: ["HR", "KE_TOAN"],
    ONE_STEP_HR: [] as string[],
    TWO_STEP_HR: ["NGHI_PHEP", "LAM_REMOTE", "DI_MUON_VE_SOM"],
    SPECIAL_TEAMS: ["nhân sự", "hr"]
};

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        const currentUserId = currentUser.id;

        const { searchParams } = new URL(req.url);
        const teamId = searchParams.get("teamId");
        const requestType = searchParams.get("type") || "";

        // Lấy thông tin user hiện tại từ DB để check quyền cho chính xác
        const dbUser = await prisma.user.findUnique({
            where: { id: currentUserId },
            include: { team: true }
        });
        if (!dbUser) return NextResponse.json({ error: "Không tìm thấy User" }, { status: 404 });

        // 1. TẢI TOÀN BỘ CÁC NHÓM NGƯỜI DUYỆT CẦN THIẾT
        // Lấy danh sách Level 2 (BGD & HR)
        const rawLevel2 = await prisma.level2Approver.findMany({
            include: { user: true }
        });
        const level2Users = rawLevel2.map(a => a.user).filter(u => u.isActive && u.id !== currentUserId);
        
        const bgdApprovers = level2Users.filter(u => APPROVAL_CONFIG.BGD_ADMIN.includes(u.role));
        const hrApprovers = level2Users.filter(u => !APPROVAL_CONFIG.BGD_ADMIN.includes(u.role));

        // Lấy danh sách Level 1 (Trưởng nhóm của team đang chọn)
        let teamLeaders: any[] = [];
        let selectedTeamName = "";
        if (teamId) {
            const team = await prisma.team.findUnique({ where: { id: teamId } });
            selectedTeamName = team?.name?.toLowerCase() || "";
            teamLeaders = await prisma.user.findMany({
                where: {
                    teamId: teamId,
                    isActive: true,
                    id: { not: currentUserId },
                    OR: [{ role: "LEADER" }, { isTeamLeader: true }]
                },
                select: { id: true, fullName: true, role: true, isTeamLeader: true, team: { select: { name: true } } }
            });
        }

        // 2. PHÂN TÍCH ĐIỀU KIỆN
        const isBGDOrAdmin = APPROVAL_CONFIG.BGD_ADMIN.includes(dbUser.role);
        const isHRorKeToan = APPROVAL_CONFIG.HR_KETOAN.includes(dbUser.role);
        const isLeader = dbUser.isTeamLeader || dbUser.role === "LEADER";
        
        const isTeamNhanSu = APPROVAL_CONFIG.SPECIAL_TEAMS.some(kw => selectedTeamName.includes(kw));
        const isOneStepHR = APPROVAL_CONFIG.ONE_STEP_HR.includes(requestType);
        const isTwoStepHR = APPROVAL_CONFIG.TWO_STEP_HR.includes(requestType);

        // Biến lưu kết quả cấu hình trả về FE
        let showC1 = true, showC2 = true;
        let c1Options: any[] = [], c2Options: any[] = [];
        let c1Label = "", c2Label = "";

        // 3. LOGIC PHÂN LUỒNG DUYỆT (Chạy trên Backend)
        if (dbUser.role === "LEADER" && dbUser.teamId === "ee9ce62d-8c1a-4ad8-897a-f723864bda91") {
            // Trưởng phòng nhân sự
            showC1 = false;
            c2Options = bgdApprovers;
            c2Label = "Người phê duyệt (Ban giám đốc)";
        }
        else if (isBGDOrAdmin) {
            // Giám đốc / Admin
            showC1 = false;
            c2Options = bgdApprovers;
            c2Label = "Người phê duyệt";
        }
        else if (isHRorKeToan) {
            // Nhân viên HR / Kế toán
            showC1 = false;
            c2Options = isOneStepHR ? hrApprovers : level2Users;
            c2Label = isOneStepHR ? "Người phê duyệt (Hành chính / HR)" : "Người phê duyệt";
        }
        else if (isOneStepHR || isTeamNhanSu) {
            // Đơn 1 bước HR hoặc Nhân sự phòng khác nộp vào team HR
            showC1 = false;
            c2Options = hrApprovers;
            c2Label = "Người phê duyệt (Hành chính / HR)";
        }
        else if (isLeader) {
            // Trưởng nhóm các team khác
            if (requestType === "DI_MUON_VE_SOM") {
                showC1 = false;
                c2Options = hrApprovers;
                c2Label = "Người phê duyệt (Hành chính / HR)";
            } else {
                c1Options = hrApprovers;
                c1Label = "Cấp 1 (Hành chính / HR)";
                c2Options = bgdApprovers;
                c2Label = "Cấp 2 (Ban giám đốc)";
            }
        }
        else {
            // Nhân viên bình thường
            c1Options = teamLeaders;
            c1Label = "Cấp 1 (Quản lý trực tiếp)";
            c2Options = isTwoStepHR ? hrApprovers : bgdApprovers;
            c2Label = isTwoStepHR ? "Cấp 2 (Hành chính / HR)" : "Cấp 2 (Ban giám đốc)";
        }

        // 4. ĐÓNG GÓI VÀ TRẢ VỀ FRONTEND
        return NextResponse.json({
            config: { showC1, showC2, c1Label, c2Label },
            data: { c1Options, c2Options }
        });

    } catch (error) {
        console.error("❌ Lỗi API lấy người duyệt:", error);
        return NextResponse.json({ error: "Lỗi tải danh sách người phê duyệt" }, { status: 500 });
    }
}