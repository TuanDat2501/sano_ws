import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const resolvedParams = await params;
    const roomId = resolvedParams.id;

    // Lấy toàn bộ tin nhắn của Phòng này
    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' }, // Sắp xếp cũ trên - mới dưới
      include: {
        sender: { select: { id: true, fullName: true } },
        attachments: true
      }
    });

    // Format lại để nhét vừa vào UI hiện tại
    const formattedMessages = messages.map(msg => ({
       id: msg.id,
       sender: msg.sender.fullName,
       senderId: msg.sender.id,
       text: msg.content,
       time: new Date(msg.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}),
       isMe: msg.sender.id === (session.user as any).id,
       attachments: msg.attachments || []
    }));

    return NextResponse.json(formattedMessages);
  } catch (error) {
     console.error("Lỗi fetch messages:", error);
     return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roomId = (await params).id;
    const { content } = await req.json();

    if (!content || content.trim() === "") {
      return NextResponse.json({ error: "Tin nhắn trống" }, { status: 400 });
    }

    // 1. Lưu tin nhắn vào DB
    const newMessage = await prisma.message.create({
      data: {
        content,
        roomId,
        senderId: (session.user as any).id,
      },
      include: { 
        sender: { select: { id: true, fullName: true } } 
      }
    });

    // 2. Cập nhật thời gian của phòng chat để nó nhảy lên đầu danh sách (Như Zalo)
    (await prisma).chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error("Lỗi gửi tin nhắn:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}