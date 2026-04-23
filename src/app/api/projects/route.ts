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

        let whereCondition: any = {};

        // Phân quyền hiển thị
        if (user.role === "ADMIN" || user.role === "BAN_GIAM_DOC") {
            if (teamIdParam) whereCondition = { teamId: teamIdParam };
        } else {
            whereCondition = {
                OR: [
                    { teamId: user.teamId },
                    { supervisorId: user.id }
                ]
            };
        }

        //  FETCH DỰ ÁN VÀ KÉO THEO CẢ ĐIỂM SỐ CỦA TỪNG TASK BÊN TRONG
        const projects = await prisma.project.findMany({
            where: whereCondition,
            select: {
                id: true,
                name: true,
                status: true,
                updatedAt: true,
                team: { select: { name: true } },
                // 🚀 LẤY THÊM THÔNG TIN GIÁM SÁT TẠI ĐÂY
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
            // Lấy ra điểm số hợp lệ của các Task (Bỏ qua các Task chưa được chấm)
            const validScores = proj.tasks
                .map(t => t.evaluations[0]?.score) // Lấy phần tử [0] vì ta đã dùng take: 1 ở trên
                .filter(score => score !== undefined && score !== null);

            // Tính trung bình cộng
            const averageScore = validScores.length > 0 
                ? (validScores.reduce((sum, score) => sum + score, 0) / validScores.length).toFixed(1)
                : null; // Trả về null nếu chưa có task nào được duyệt

            // Bóc tách vứt bỏ cục "tasks" đi cho API nhẹ, chỉ gửi điểm số về Frontend
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
        const body = await req.json();
        const session = await getServerSession(authOptions);
        
        const newProject = await prisma.project.create({
            data: {
                name: body.name,
                description: body.description,
                teamId: body.teamId,
                supervisorId: (session?.user as any)?.id // Gắn người tạo làm giám sát
            }
        });
        return NextResponse.json(newProject);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}


export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        await prisma.project.delete({
            where: { id: resolvedParams.id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}