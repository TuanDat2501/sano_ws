import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        
        // ==========================================================
        // 🚀 RẼ NHÁNH 1: API TIỆN ÍCH LẤY DATA CHO DROPDOWN (Giữ nguyên)
        // ==========================================================
        if (searchParams.get('action') === 'get_options') {
            const teams = await prisma.team.findMany({ select: { id: true, name: true } });
            // Lấy danh sách user (có mang theo teamId để UI lọc)
            const users = await prisma.user.findMany({
                where: { isActive: true },
                select: { id: true, fullName: true, username: true, avatarUrl: true, teamId: true }
            });
            return NextResponse.json({ teams, users });
        }

        // ==========================================================
        // 🚀 RẼ NHÁNH 2: LẤY DANH SÁCH KÊNH (CÓ TÍCH HỢP PHÂN QUYỀN)
        // ==========================================================
        const userData = session.user as any;
        const role = userData.role?.toUpperCase();
        const userTeamId = userData.teamId;
        const queryTeamId = searchParams.get("teamId");

        let whereClause: any = {};

        // TH1: Frontend yêu cầu lấy Kênh của một Team cụ thể (VD: form CreateTaskModal)
        if (queryTeamId) {
            whereClause.teamId = queryTeamId;
        } 
        // TH2: Trả về danh sách mặc định (Cần phân quyền tránh nhìn trộm Kênh team khác)
        else {
            if (role !== "ADMIN" && role !== "BAN_GIAM_DOC") {
                // Nếu KHÔNG phải Admin/Giám đốc -> Ép cứng chỉ được lấy Kênh của team mình
                whereClause.teamId = userTeamId;
            }
            // Nếu là Admin/Giám đốc thì whereClause giữ nguyên {} -> Lấy ra tất cả Kênh
        }

        const channels = await prisma.channel.findMany({
            where: whereClause,
            include: {
                team: { select: { name: true } },
                members: true // 🚀 Vẫn giữ members để UI trang Quản lý Kênh không bị lỗi
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
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { name, link, topic, teamId, avatarUrl, status, monetization, members } = body;

        // 🚀 TẠO KÊNH VÀ GÁN NHÂN SỰ CÙNG LÚC (Nested Create)
        const newChannel = await prisma.channel.create({
            data: {
                name, link, topic, teamId, avatarUrl, status, monetization,
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