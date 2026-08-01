import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; 
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; 

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        }

        const user = session.user as any;
        const { searchParams } = new URL(req.url);
        const teamIdParam = searchParams.get("teamId");
        const channelIdParam = searchParams.get("channelId");
        
        let whereCondition: any = {};
        
        // 🚀 ĐÃ SỬA: Đọc quyền động từ permissions. Nếu có MENU_TEAMS thì được xem toàn bộ dự án xuyên Team
        const canViewAll = user.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC"].includes(user.role);

        if (canViewAll) {
            if (teamIdParam) whereCondition.teamId = teamIdParam;
            if (channelIdParam) whereCondition.channelId = channelIdParam;
        } else {
            whereCondition = {
                OR: [
                    { teamId: user.teamId },
                    { supervisorId: user.id }
                ]
            };
            if (channelIdParam) {
                whereCondition.channelId = channelIdParam;
            }
        }

        // FETCH DỰ ÁN VÀ KÉO THEO CẢ ĐIỂM SỐ CỦA TỪNG TASK BÊN TRONG
        const projects = await prisma.project.findMany({
            where: whereCondition,
            select: {
                id: true,
                name: true,
                status: true,
                updatedAt: true,
                channelId: true,
                team: { select: { name: true } },
                supervisor: {
                    select: {
                        fullName: true,
                        avatarUrl: true
                    }
                },
                tasks: {
                    select: {
                        evaluations: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: { score: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // TÍNH TOÁN ĐIỂM TRUNG BÌNH BẰNG JAVASCRIPT
        const formattedProjects = projects.map(proj => {
            const validScores = proj.tasks
                .map(t => t.evaluations[0]?.score) 
                .filter(score => score !== undefined && score !== null);

            const averageScore = validScores.length > 0 
                ? (validScores.reduce((sum, score) => sum + score, 0) / validScores.length).toFixed(1)
                : null; 

            const { tasks, ...projectData } = proj;

            return {
                ...projectData,
                score: averageScore 
            };
        });

        return NextResponse.json(formattedProjects);

    } catch (error) {
        console.error("LỖI FETCH PROJECTS:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        }

        const currentUser = session.user as any;

        // 🚀 BỔ SUNG: Kiểm tra quyền tạo Dự án
        const hasPermission = currentUser.permissions?.includes("MENU_PROJECTS") || currentUser.role === "ADMIN";
        if (!hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền tạo Dự án!" }, { status: 403 });
        }

        const body = await req.json();
        
        const newProject = await prisma.project.create({
            data: {
                name: body.name,
                description: body.description,
                teamId: body.teamId,
                channelId: body.channelId, 
                supervisorId: currentUser.id 
            }
        });
        return NextResponse.json(newProject);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
        }

        const currentUser = session.user as any;

        // 🚀 BỔ SUNG: Kiểm tra quyền xóa Dự án
        const hasPermission = currentUser.permissions?.includes("MENU_PROJECTS") || currentUser.role === "ADMIN";
        if (!hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền xóa Dự án!" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get("id");

        if (!projectId) {
            return NextResponse.json({ error: "Thiếu ID dự án cần xóa" }, { status: 400 });
        }

        await prisma.project.delete({
            where: { id: projectId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(">>> LỖI XÓA PROJECT:", error);
        return NextResponse.json({ error: "Lỗi Server khi xóa" }, { status: 500 });
    }
}