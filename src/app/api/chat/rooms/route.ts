import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = (session.user as any).id;

    // 1. Quét Database
    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: { some: { userId: userId } }
      },
      include: {
        team: true,
        members: {
          include: { user: { select: { id: true, fullName: true } } }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Lấy 1 tin mới nhất làm preview
          include: { sender: { select: { fullName: true } } }
        }
      }
    });

    // ==========================================
    // LỚP PHÒNG THỦ: Kiểm tra xem rooms có phải là Array không
    // ==========================================
    if (!rooms || !Array.isArray(rooms)) {
      console.error("❌ Prisma không trả về Array! Giá trị thực tế là:", rooms);
      // Trả về mảng rỗng để giao diện không bị sập (trắng trang)
      return NextResponse.json([]); 
    }

    // 2. Chế biến Data
    const formattedRooms = rooms.map(room => {
       let roomName = room.name || "Phòng Chat";
       let targetId = null;
       if (room.type === "DIRECT") {
          const otherMember = room.members.find(m => m.userId !== userId);
          roomName = otherMember?.user?.fullName || "Người dùng ẩn";
          targetId = otherMember?.userId || null;
       } else if (room.type === "TEAM" && room.team) {
          roomName = room.team.name;
       }

       // Đảm bảo messages là mảng trước khi lấy phần tử [0]
       const validMessages = Array.isArray(room.messages) ? room.messages : [];
       const lastMsg = validMessages[0];

       return {
         id: room.id,
         name: roomName,
         targetId: targetId,
         type: room.type,
         lastMessage: lastMsg ? `${lastMsg.senderId === userId ? "Bạn: " : ""}${lastMsg.content || 'Đã gửi file đính kèm'}` : "Chưa có tin nhắn...",
         time: lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : "",
         rawTime: lastMsg ? lastMsg.createdAt : room.createdAt,
         unread: 0
       };
    });

    // 3. Sort từ mới tới cũ
    formattedRooms.sort((a, b) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime());

    return NextResponse.json(formattedRooms);

  } catch (error) {
    console.error("❌ Lỗi bắt được tại catch (fetch rooms):", error);
    // Vẫn trả về mảng rỗng để UI không chết `map`
    return NextResponse.json([]); 
  }
}