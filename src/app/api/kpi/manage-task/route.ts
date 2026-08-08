import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search");
        const taskId = searchParams.get("taskId");
        const getChannels = searchParams.get("getChannels");
        const getList = searchParams.get("list");
        
        // Nhận thêm tham số lọc
        const channelId = searchParams.get("channelId");
        const status = searchParams.get("status"); // 'ALL', 'DONE', 'TODO', 'REJECTED'
        const isClosed = searchParams.get("isClosed"); // 'true', 'false', 'ALL'

        if (getChannels) {
            const channels = await prisma.channel.findMany({ select: { id: true, name: true } });
            return NextResponse.json(channels); 
        }

        if (taskId) {
            const task = await prisma.task.findUnique({
                where: { id: taskId },
                select: { id: true, title: true, duration: true, isRework: true, channelId: true }
            });
            return NextResponse.json(task || {});
        }

        if (getList === "true" || search !== null) {
            // Xây dựng bộ lọc động
            let whereClause: any = {};
            
            if (search) {
                whereClause.title = { contains: search };
            }
            if (channelId && channelId !== 'ALL') {
                whereClause.channelId = channelId;
            }
            if (status && status !== 'ALL') {
                whereClause.status = status;
            }
            if (isClosed && isClosed !== 'ALL') {
                whereClause.isClosed = isClosed === 'true';
            }

            const tasks = await prisma.task.findMany({
                where: whereClause,
                take: 100, 
                select: { 
                    id: true, title: true, duration: true, isRework: true, status: true, createdAt: true, isClosed: true,
                    channel: { select: { id: true, name: true } } 
                },
                orderBy: { createdAt: 'desc' }
            });
            return NextResponse.json(tasks);
        }

        return NextResponse.json([]);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { id, title, duration, isRework, channelId } = body;

        if (!id) return NextResponse.json({ error: "Thiếu ID Task" }, { status: 400 });

        const updatedTask = await prisma.task.update({
            where: { id },
            data: {
                title,
                duration: duration ? Number(duration) : null,
                isRework: Boolean(isRework),
                channelId: channelId || null
            }
        });

        return NextResponse.json({ success: true, task: updatedTask });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { taskId, userId, actionType } = body;

        if (!taskId || !userId || !actionType) {
            return NextResponse.json({ error: "Thiếu tham số" }, { status: 400 });
        }

        let details = "Được gán tính KPI (Thủ công)";
        if (actionType === "SUBMIT_SCRIPT") details = "Lên kịch bản (Gán thủ công)";
        if (actionType === "SUBMIT_VIDEO") details = "Dựng Video (Gán thủ công)";
        if (actionType === "PUBLISH_VIDEO") details = "Đăng Kênh (Gán thủ công)";
        if (actionType === "DAILY_REPORT") details = "Báo cáo ngày (Gán thủ công)";
        if (actionType === "COMPLETE_TASK") details = "Nghiệm thu Task (Gán thủ công)";

        const newLog = await prisma.taskLog.create({
            data: {
                taskId,
                userId,
                action: actionType,
                details
            }
        });

        return NextResponse.json({ success: true, log: newLog });
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}