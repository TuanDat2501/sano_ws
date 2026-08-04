import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// 1. LẤY TOÀN BỘ LỊCH SỬ CHAT KHI MỞ TASK
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const taskId = resolvedParams.id;

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: { user: { select: { fullName: true } } }, 
      orderBy: { createdAt: "asc" }, 
    });

    return NextResponse.json(comments);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi tải lịch sử chat" }, { status: 500 });
  }
}

// 2. LƯU TIN NHẮN MỚI VÀO DATABASE
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const taskId = resolvedParams.id;
    const body = await req.json();
    const senderId = (session.user as any).id;
    const senderName = (session.user as any).fullName || session.user.name || "Ai đó";

    const newComment = await prisma.taskComment.create({
      data: { 
        text: body.text || "", 
        imageUrl: body.imageUrl || null, 
        taskId: taskId, 
        userId: senderId 
      },
      include: { user: { select: { fullName: true } } }
    });

    // 🚀 ĐÃ SỬA: Lấy thêm cả danh sách những người làm phụ (Co-workers)
    const [task, previousComments] = await Promise.all([
        prisma.task.findUnique({ 
            where: { id: taskId },
            include: {
                coContentUsers: { select: { id: true } },
                coEditorUsers: { select: { id: true } },
                coAnimatorUsers: { select: { id: true } }
            }
        }),
        prisma.taskComment.findMany({ 
            where: { taskId }, 
            select: { userId: true }, 
            distinct: ['userId'] 
        })
    ]);

    const notifyUserIds = new Set<string>();
    
    if (task?.creatorId) notifyUserIds.add(task.creatorId);
    if (task?.contentId) notifyUserIds.add(task.contentId);
    if (task?.editorId) notifyUserIds.add(task.editorId);
    if (task?.animatorId) notifyUserIds.add(task.animatorId); 
    
    // 🚀 BỔ SUNG: Ném cả những người làm phụ vào danh sách nhận Noti
    task?.coContentUsers?.forEach(u => notifyUserIds.add(u.id));
    task?.coEditorUsers?.forEach(u => notifyUserIds.add(u.id));
    task?.coAnimatorUsers?.forEach(u => notifyUserIds.add(u.id));

    previousComments.forEach(comment => notifyUserIds.add(comment.userId));

    notifyUserIds.delete(senderId);

    const messagePreview = body.text && body.text.trim() !== "" 
      ? `${body.text.substring(0, 30)}${body.text.length > 30 ? '...' : ''}`
      : "[Hình ảnh đính kèm 🖼️]";

    const notifications = [];
    for (const targetUserId of Array.from(notifyUserIds)) {
      const notif = await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: "Bình luận mới",
          message: `${senderName} vừa nhắn trong task "${task?.title}": ${messagePreview}`,
          taskId: taskId,
        }
      });
      notifications.push(notif);
    }

    return NextResponse.json({ 
      comment: newComment, 
      notifications: notifications,
      userIdsToNotify: Array.from(notifyUserIds) 
    });

  } catch (error: any) {
    console.error(">>> ❌ LỖI LƯU CHAT (POST 500):", error);
    return NextResponse.json({ error: "Lỗi lưu tin nhắn" }, { status: 500 });
  }
}