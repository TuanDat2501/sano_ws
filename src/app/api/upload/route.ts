import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Nhận file từ giao diện gửi lên
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file ảnh!" }, { status: 400 });
    }

    // 2. Lấy API Key của ImgBB
    // Tốt nhất bạn nên tạo một biến IMGBB_API_KEY trong file .env
    const apiKey = process.env.IMGBB_API_KEY || "3139895e89f5887a5599b6657e39649f";

    if (!apiKey || apiKey === "3139895e89f5887a5599b6657e39649f") {
      return NextResponse.json({ error: "Chưa cấu hình ImgBB API Key" }, { status: 500 });
    }

    // 3. Chuẩn bị dữ liệu để gửi sang ImgBB
    // Tham số bắt buộc của ImgBB cho file ảnh là "image"
    const imgbbFormData = new FormData();
    imgbbFormData.append("image", file);

    // 4. Gọi fetch API để bắn ảnh sang máy chủ ImgBB
    const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: imgbbFormData,
    });

    const result = await imgbbResponse.json();

    // 5. Kiểm tra lỗi nếu ImgBB từ chối
    if (!imgbbResponse.ok || !result.success) {
      console.error(">>> [IMGBB UPLOAD ERROR]:", result);
      return NextResponse.json({ error: "Lỗi từ server ImgBB khi tải ảnh lên" }, { status: 500 });
    }

    // 6. Trích xuất link ảnh trực tiếp (direct link) từ phản hồi của ImgBB
    const fileUrl = result.data.url;

    // Trả về cho Frontend (Cấu trúc JSON giữ nguyên như code cũ)
    return NextResponse.json({ url: fileUrl });

  } catch (error) {
    console.error(">>> [API UPLOAD ERROR]:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi lưu file" }, { status: 500 });
  }
}