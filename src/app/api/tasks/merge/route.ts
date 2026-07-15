import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const currentUser = session.user as any;

        const body = await req.json();
        // 🚀 BỔ SUNG NHẬN channelId và duration TỪ FRONTEND GỬI LÊN
        const { sourceTaskIds, teamId, projectId, assigneeId, channelId, duration } = body; 

        if (!sourceTaskIds || sourceTaskIds.length < 2) {
            return NextResponse.json({ error: "Cần chọn ít nhất 2 video để ghép" }, { status: 400 });
        }

        const sourceTasks = await prisma.task.findMany({
            where: { id: { in: sourceTaskIds } },
            orderBy: { episodeNumber: 'asc' } 
        });

        const episodeNumbers = sourceTasks.map(t => t.episodeNumber).filter(n => n !== null);
        const baseTitle = sourceTasks[0].title.split('#')[0].trim();
        
        const suffix = episodeNumbers.length > 0 ? ` #${episodeNumbers.join('+')}` : ` (Ghép ${sourceTasks.length} video)`;
        const autoTitle = `${baseTitle}${suffix}`;

        const autoNote = "Nguyên liệu ghép:\n" + sourceTasks.map(t => 
            `- Tập ${t.episodeNumber ?? 'Cũ'}: ${t.videoLink || 'Chưa có link'}`
        ).join('\n');

        const dummyLinkContent = `compilation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const [mergedTask] = await prisma.$transaction([
            prisma.task.create({
                data: {
                    title: autoTitle,
                    linkContent: dummyLinkContent,
                    isCompilation: true,
                    mergeCount: sourceTasks.length,
                    status: "TODO", 
                    note: autoNote,
                    creatorId: currentUser.id,
                    teamId: teamId,
                    projectId: projectId,
                    editorId: assigneeId,
                    // 🚀 LƯU VÀO DATABASE
                    channelId: channelId || undefined,
                    duration: duration ? Number(duration) : undefined,
                    
                    sourceTasks: {
                        connect: sourceTaskIds.map((id: string) => ({ id }))
                    }
                }
            }),
            prisma.task.updateMany({
                where: { id: { in: sourceTaskIds } },
                data: { usedInMergeCount: { increment: 1 } }
            })
        ]); 

        await prisma.taskLog.create({
            data: {
                action: "MERGE_VIDEO" as any,
                details: `Tạo video ghép từ ${sourceTasks.length} tập (${episodeNumbers.join(', ') || 'Cũ'})`,
                taskId: mergedTask.id,
                userId: currentUser.id,
            }
        });

        return NextResponse.json({ message: "Đã khởi tạo Video Ghép thành công", task: mergedTask });

    } catch (error) {
        console.error(">>> LỖI GHÉP VIDEO:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi gộp video" }, { status: 500 });
    }
}