import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 1. LẤY TOÀN BỘ LỊCH SỬ CHAT KHI MỞ TASK
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const taskId = resolvedParams.id;

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: { user: { select: { fullName: true } } }, // Lấy tên người gửi
      orderBy: { createdAt: "asc" }, // Cũ xếp trên, mới xếp dưới
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

    // 1. Lưu tin nhắn vào DB
    const newComment = await prisma.taskComment.create({
      data: { text: body.text, taskId: taskId, userId: senderId },
      include: { user: { select: { fullName: true } } }
    });

    // 2. Tìm thông tin Task và danh sách Admin
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });

    // 3. Gom ID những người cần nhận thông báo (Loại bỏ trùng lặp bằng Set)
    const notifyUserIds = new Set<string>();
    if (task?.creatorId) notifyUserIds.add(task.creatorId);
    if (task?.contentId) notifyUserIds.add(task.contentId);
    if (task?.editorId) notifyUserIds.add(task.editorId);
    admins.forEach(admin => notifyUserIds.add(admin.id));

    // XÓA MÌNH RA KHỎI DANH SÁCH NHẬN NOTI CỦA CHÍNH MÌNH
    notifyUserIds.delete(senderId);

    // 4. Tạo thông báo trong Database cho từng người
    const notifications = [];
    for (const targetUserId of Array.from(notifyUserIds)) {
      const notif = await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: "Bình luận mới",
          message: `${senderName} vừa nhắn trong task: "${task?.title} ${body.text.substring(0, 30)}${body.text.length > 30 ? '...' : ''}"`,
          taskId: taskId,
        }
      });
      notifications.push(notif);
    }

    // Trả về cả tin nhắn MỚI và danh sách NOTI để Frontend đem đi bắn Socket
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