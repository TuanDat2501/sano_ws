import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function POST(request: Request) {
  try {
    // 1. Nhận file từ giao diện gửi lên
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file ảnh!" }, { status: 400 });
    }

    // 2. Chuyển đổi dữ liệu sang dạng Cục nhị phân (Buffer) để Node.js hiểu
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 3. Đặt tên file chống trùng lặp (dùng thời gian hiện tại + số ngẫu nhiên)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Lấy đuôi file gốc (vd: .png, .jpg)
    const ext = path.extname(file.name).toLowerCase() || '.png'; 
    const fileName = `avatar-${uniqueSuffix}${ext}`;

    // 4. Chỉ định thư mục lưu trữ: public/uploads/avatars
    const uploadDir = path.join(process.cwd(), "public/uploads/avatars");
    
    // Nếu thư mục chưa tồn tại thì tự động tạo mới
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Đường dẫn đầy đủ để lưu file xuống ổ cứng máy sếp
    const filePath = path.join(uploadDir, fileName);

    // 5. Ghi file xuống ổ cứng
    await writeFile(filePath, buffer);

    // 6. Trả về Link Public cho Frontend
    // ĐẶC BIỆT LƯU Ý: Tuyệt đối KHÔNG có chữ "public" trong URL
    const fileUrl = `/uploads/avatars/${fileName}`;

    return NextResponse.json({ url: fileUrl });

  } catch (error) {
    console.error(">>> [API UPLOAD LOCAL ERROR]:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi lưu file" }, { status: 500 });
  }
}