import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

// SỬA LẠI TYPE CỦA PARAMS THÀNH PROMISE
type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roomId = (await params).id;
    const myId = (session.user as any).id;
    const formData = await req.formData();
    const files = formData.getAll("files"); // Lấy danh sách file gửi lên
    const content = formData.get("content"); // Nội dung text (nếu có)

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });
    }

    // 1. Tạo tin nhắn (content có thể null)
    const newMessage = await prisma.message.create({
      data: {
        content: content ? content.toString() : null,
        roomId,
        senderId: myId,
      },
      include: { 
        sender: { select: { id: true, fullName: true } } 
      }
    });

    const attachments = [];

    // 2. Loop qua danh sách file, lưu vào đĩa cứng và DB
    for (const file of files) {
      const { fileUrl, fileType, fileName, fileSize } = await processUploadFile(file as File);
      
      const newAttachment = await prisma.attachment.create({
        data: {
          url: fileUrl,
          fileType: fileType,
          fileName: fileName,
          fileSize: fileSize,
          messageId: newMessage.id
        }
      });
      
      attachments.push(newAttachment);
    }

    // 3. Cập nhật updatedAt của phòng
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() }
    });

    // Trả về tin nhắn hoàn chỉnh kèm attachments
    return NextResponse.json({ ...newMessage, attachments });

  } catch (error) {
    console.error("Lỗi upload file:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// Hàm phụ để xử lý lưu file vào đĩa cứng
async function processUploadFile(file: File) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Tạo tên file duy nhất để không bị trùng (Timestamp + Tên gốc)
  const uniqueFileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
  const relativePath = path.join("/uploads", uniqueFileName); // Link dùng trên web
  const absolutePath = path.join(process.cwd(), "public/uploads", uniqueFileName); // Link dùng trên đĩa cứng

  // Ghi file vào public/uploads
  await writeFile(absolutePath, buffer);

  // Phân loại loại file để hiển thị UI
  let fileType = 'file';
  if (file.type.startsWith("image/")) fileType = 'image';
  if (file.type.startsWith("video/")) fileType = 'video';
  if (file.type === "application/pdf") fileType = 'pdf';
  if (file.type.includes("word")) fileType = 'word';

  return {
    fileUrl: relativePath,
    fileType: fileType,
    fileName: file.name,
    fileSize: file.size,
  };
}