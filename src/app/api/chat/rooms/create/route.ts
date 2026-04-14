import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const myId = (session.user as any).id;
    if (!myId) {
      return NextResponse.json({ error: "Không lấy được ID của bạn từ Session. Vui lòng đăng nhập lại!" }, { status: 400 });
    }

    const body = await req.json();
    const { targetUsername, type } = body;

    if (!targetUsername || !type) {
       return NextResponse.json({ error: "Thiếu targetUsername hoặc type khi gửi lên Server!" }, { status: 400 });
    }

    console.log("=== ĐANG TẠO PHÒNG CHAT ===");
    console.log("Người tạo (myId):", myId);
    console.log("Mục tiêu (targetUsername):", targetUsername);
    console.log("Loại phòng:", type);
    const targetUser = await prisma.user.findUnique({
            where: { username: targetUsername },
            select: { id: true } // Backend lấy ID một cách an toàn và bí mật
        });

        if (!targetUser) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });

        const targetId = targetUser.id;
    // ==========================================
    // TRƯỜNG HỢP 1: TẠO CHAT 1-1 (DIRECT)
    // ==========================================
    if (type === 'DIRECT') {
      const existingRooms = await prisma.chatRoom.findMany({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: myId } } },
            { members: { some: { userId: targetId } } }
          ]
        }
      });

      if (existingRooms.length > 0) {
        return NextResponse.json(existingRooms[0]);
      }

      const newRoom = await prisma.chatRoom.create({
        data: {
          type: 'DIRECT',
          members: {
            create: [
              { userId: myId },
              { userId: targetId }
            ]
          }
        }
      });
      return NextResponse.json(newRoom);
    }

    // ==========================================
    // TRƯỜNG HỢP 2: VÀO CHAT NHÓM (TEAM)
    // ==========================================
    if (type === 'TEAM') {
      const existingRoom = await prisma.chatRoom.findFirst({
        where: { type: 'TEAM', teamId: targetId }
      });

      if (existingRoom) {
         const isMember = await prisma.roomMember.findUnique({
           where: { roomId_userId: { roomId: existingRoom.id, userId: myId } }
         });
         if (!isMember) {
            await prisma.roomMember.create({ data: { roomId: existingRoom.id, userId: myId }});
         }
         return NextResponse.json(existingRoom);
      }

      const teamUsers = await prisma.user.findMany({ where: { teamId: targetId } });
      
      const newRoom = await prisma.chatRoom.create({
        data: {
          type: 'TEAM',
          teamId: targetId,
          name: "Chat Nhóm", 
          members: {
            create: teamUsers.map(u => ({ userId: u.id }))
          }
        }
      });
      
      const meInTeam = teamUsers.find(u => u.id === myId);
      if(!meInTeam) {
        await prisma.roomMember.create({ data: { roomId: newRoom.id, userId: myId }});
      }

      return NextResponse.json(newRoom);
    }

    return NextResponse.json({ error: "Loại phòng không hợp lệ" }, { status: 400 });

  } catch (error: any) {
    // IN LỖI RA TERMINAL MÀU ĐỎ ĐỂ DỄ NHÌN
    console.error("❌ LỖI KHI TẠO PHÒNG CHAT:", error);
    
    // GỬI CHI TIẾT LỖI VỀ CHO FRONTEND
    return NextResponse.json({ 
      error: error.message || "Lỗi Database (Xem chi tiết trong Terminal VSCode)",
      details: error
    }, { status: 500 });
  }
}