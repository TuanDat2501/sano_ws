import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        const { searchParams } = new URL(req.url);
        
        const mode = searchParams.get("mode") || "monthly"; 
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const teamId = searchParams.get("teamId");

        const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser.role) || currentUser.permissions?.includes("MENU_TEAMS");
        const isLeader = currentUser.role === "LEADER" || currentUser.isTeamLeader;

        if (!isManager && !isLeader) {
             return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
        }

        const targetTeamId = (!isManager && isLeader) ? currentUser.teamId : teamId;

        // ==========================================
        // 🚀 CHẾ ĐỘ XEM TỔNG HỢP CẢ NĂM
        // ==========================================
        if (mode === "yearly") {
            // 🚀 ĐÃ THÊM: Loại bỏ ADMIN và BAN_GIAM_DOC
            let userWhere: any = { 
                isActive: true,
                role: { notIn: ["ADMIN", "BAN_GIAM_DOC"] }
            };
            if (targetTeamId && targetTeamId !== "ALL") userWhere.teamId = targetTeamId;

            const users = await prisma.user.findMany({
                where: userWhere,
                select: { id: true, fullName: true, role: true, avatarUrl: true, team: { select: { name: true } } }
            });

            const evals = await prisma.monthlyEvaluation.findMany({
                where: {
                    year,
                    userId: { in: users.map(u => u.id) }
                }
            });

            const data = users.map(user => {
                const userEvals = evals.filter(e => e.userId === user.id);
                const monthlyScores: Record<number, number> = {};
                userEvals.forEach(e => {
                    monthlyScores[e.month] = e.totalScore;
                });
                return {
                    userId: user.id,
                    fullName: user.fullName,
                    role: user.role,
                    avatarUrl: user.avatarUrl,
                    teamName: user.team?.name || "Chưa phân team",
                    monthlyScores
                };
            });

            data.sort((a, b) => a.teamName.localeCompare(b.teamName) || a.fullName.localeCompare(b.fullName));

            return NextResponse.json(data);
        }

        // ==========================================
        // 🚀 CHẾ ĐỘ XEM VÀ CHẤM ĐIỂM TỪNG THÁNG
        // ==========================================
        if (!targetTeamId || targetTeamId === "ALL") {
            return NextResponse.json({ error: "Vui lòng chọn Phòng ban để chấm điểm" }, { status: 400 });
        }

        const users = await prisma.user.findMany({
            where: { 
                teamId: targetTeamId, 
                isActive: true,
                // 🚀 ĐÃ THÊM: Loại bỏ ADMIN và BAN_GIAM_DOC
                role: { notIn: ["ADMIN", "BAN_GIAM_DOC"] }
            },
            select: { id: true, fullName: true, role: true, avatarUrl: true }
        });

        const evaluations = await prisma.monthlyEvaluation.findMany({
            where: { teamId: targetTeamId, year, month }
        });

        const data = users.map(user => {
            const ev = evaluations.find(e => e.userId === user.id);
            return {
                userId: user.id,
                fullName: user.fullName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                evaluationId: ev?.id || null,
                totalScore: ev?.totalScore || 0,
                grade: ev?.grade || "CHƯA ĐÁNH GIÁ",
                details: ev?.details || {},
                note: ev?.note || ""
            };
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error("LỖI API EVALUATION GET:", error);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        
        const currentUser = session.user as any;
        const body = await req.json();
        
        const { year, month, teamId, evaluations } = body;

        if (!year || !month || !teamId || !Array.isArray(evaluations)) {
            return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
        }

        const transactions = evaluations.map((ev: any) => {
            return prisma.monthlyEvaluation.upsert({
                where: {
                    user_time_unique: { userId: ev.userId, year, month }
                },
                update: {
                    totalScore: ev.totalScore,
                    grade: ev.grade,
                    details: ev.details,
                    note: ev.note,
                    evaluatorId: currentUser.id
                },
                create: {
                    userId: ev.userId,
                    teamId,
                    year,
                    month,
                    totalScore: ev.totalScore,
                    grade: ev.grade,
                    details: ev.details,
                    note: ev.note,
                    evaluatorId: currentUser.id
                }
            });
        });

        await prisma.$transaction(transactions);

        return NextResponse.json({ success: true, message: "Lưu bảng đánh giá thành công!" });

    } catch (error) {
        console.error("LỖI API EVALUATION POST:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi lưu đánh giá" }, { status: 500 });
    }
}