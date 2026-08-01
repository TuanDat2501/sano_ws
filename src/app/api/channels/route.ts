import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        
        if (searchParams.get('action') === 'get_options') {
            const teams = await prisma.team.findMany({ select: { id: true, name: true } });
            const users = await prisma.user.findMany({
                where: { isActive: true },
                select: { id: true, fullName: true, username: true, avatarUrl: true, teamId: true }
            });
            return NextResponse.json({ teams, users });
        }

        const currentUser = session.user as any;
        const userTeamId = currentUser.teamId;
        const queryTeamId = searchParams.get("teamId");

        let whereClause: any = {};

        // 🚀 ĐÃ SỬA: Đọc quyền động để xem toàn bộ Kênh xuyên Team
        // Nếu có quyền MENU_TEAMS (HR, DEPARTMENT_LEADER) HOẶC là Kế toán/Admin/BGD thì được xem xuyên Team
        const canViewAll = currentUser.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(currentUser.role);

        if (queryTeamId) {
            whereClause.teamId = queryTeamId;
        } 
        else {
            if (!canViewAll) {
                whereClause.teamId = userTeamId;
            }
        }

        const channels = await prisma.channel.findMany({
            where: whereClause,
            include: {
                team: { select: { name: true } },
                members: true,
                // Kéo mảng dự án (projects) thuộc về kênh này
                projects: true 
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(channels);
    } catch (error) {
        console.error("LỖI FETCH CHANNELS:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        
        // 🚀 ĐÃ SỬA: Đọc quyền động từ biến permissions thay vì fix cứng Role
        const hasPermission = currentUser.permissions?.includes("MENU_CHANNELS") || currentUser.role === "ADMIN";

        if (!hasPermission) {
            return NextResponse.json({ error: "Không có quyền thực hiện hành động này!" }, { status: 403 });
        }

        const body = await req.json();
        
        // Giải nén trường category ra từ JSON body
        const { name, link, topic, teamId, avatarUrl, status, monetization, category, members } = body;

        const newChannel = await prisma.channel.create({
            data: {
                name, link, topic, teamId, avatarUrl, status, monetization,
                category: category || "TONG_HOP", // Thêm category vào bản ghi khi tạo (Fallback là TONG_HOP)
                members: {
                    create: members?.map((m: any) => ({
                        userId: m.userId,
                        roleOnChannel: m.roleOnChannel
                    })) || []
                }
            }
        });

        return NextResponse.json({ success: true, channel: newChannel });
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: "Tên kênh đã tồn tại!" }, { status: 400 });
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}