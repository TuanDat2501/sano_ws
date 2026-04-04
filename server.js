const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

// Khởi tạo Next.js App
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// ==========================================
// KHAI BÁO BIẾN TOÀN CỤC (QUAN TRỌNG)
// ==========================================
// Dùng Map để lưu danh sách [userId => socket.id]
const onlineSockets = new Map();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log("🟢 Có người vừa kết nối. Socket ID:", socket.id);

    // ==========================================
    // 1. QUẢN LÝ TRẠNG THÁI ONLINE / OFFLINE
    // ==========================================
    socket.on("user_online", (userId) => {
      const uid = String(userId);
      onlineSockets.set(socket.id, uid); // Gắn ID người dùng vào đúng cái Tab/Socket này

      // Gom tất cả những người đang online lại (Dùng Set để lọc trùng lặp lỡ 1 người mở 5 Tab)
      const uniqueOnlineUsers = Array.from(new Set(onlineSockets.values()));
      io.emit("update_online_users", uniqueOnlineUsers);
    });

    socket.on("disconnect", () => {
      // Chỉ xóa đúng cái Tab/Socket vừa bị tắt
      onlineSockets.delete(socket.id);

      // Cập nhật lại danh sách và báo cho anh em
      const uniqueOnlineUsers = Array.from(new Set(onlineSockets.values()));
      io.emit("update_online_users", uniqueOnlineUsers);
    });

    // ==========================================
    // 2. CHAT NỘI BỘ (SANO CHAT CHÍNH)
    // ==========================================
    socket.on("join_chat_room", (roomId) => {
      socket.join(roomId);
      console.log(`💬 User joined Chat Room: ${roomId}`);
    });

    socket.on("send_chat_message", async (data) => {
      const { roomId, message } = data;

      console.log("📨 Nhận tin nhắn thô:", message);

      // 🚀 BƯỚC QUAN TRỌNG: Tìm tên đầy đủ của người gửi trong DB
      let senderFullName = "Người dùng Sano"; // Tên mặc định nếu ko tìm thấy
      try {
        if (message.senderId) {
          // Ví dụ dùng Prisma (Sếp thay bằng câu lệnh DB tương ứng của mình)
          const user = await prisma.user.findUnique({
            where: { id: message.senderId },
            select: { fullName: true } // Chỉ lấy mỗi trường tên
          });
          console.log("Người nhận : ",user);
          
          if (user && user.fullName) {
            senderFullName = user.fullName;
          }
        }
      } catch (error) {
        console.error("❌ Lỗi khi tìm tên người gửi trong DB:", error);
      }

      // 🚀 TẠO CỤC DỮ LIỆU MỚI: Đính kèm fullName vào tin nhắn
      const richMessage = {
        ...message, // Giữ các trường cũ (text, senderId, createdAt)
        fullName: senderFullName, // 🔥 Thêm trường này vào để popup có tên
      };

      console.log("📡 Chuẩn bị broadcast tin nhắn xịn:", richMessage);

      // 1. Gửi tin nhắn real-time cho người đang mở phòng chat
      socket.to(roomId).emit("receive_chat_message", { roomId, message: richMessage });

      // 2. Gửi thông báo cho popup của những người KHÔNG mở phòng (broadcast loa phường)
      // 🚀 CHỖ NÀY ĐÃ FIX: Gửi cục richMessage có tên đầy đủ
      socket.broadcast.emit("new_message_notification", { roomId, message: richMessage });

      // 3. Báo load lại danh sách bên trái
      socket.broadcast.emit("reload_chat_list");
    });

    // ==========================================
    // 3. THÔNG BÁO HỆ THỐNG (NOTI CHUNG)
    // ==========================================
    socket.on("register_user", (userId) => {
      const uid = String(userId); // 🛠️ ÉP KIỂU CHUỖI
      socket.join(uid);
      console.log(`🔔 User [${uid}] đã đăng ký nhận thông báo (Socket ID: ${socket.id}).`);
    });

    socket.on("send_notification", (data) => {
      // data.userIds là mảng những người cần nhận (VD: người được giao Task)
      if (data.userIds && Array.isArray(data.userIds)) {
        data.userIds.forEach((userId) => {
          io.to(userId).emit("receive_notification", data.notification);
        });
      }
    });

    socket.on("send_system_noti", (data) => {
      console.log("🔔 Bắn Noti Hệ Thống:", data.title, "-> Tới User:", data.targetId);
      
      // Phát thông báo này tới toàn bộ các máy khác (Frontend sẽ tự lọc ai đúng ID thì mới nhận)
      socket.broadcast.emit("receive_system_noti", data);
    });

    // ==========================================
    // 4. KANBAN BOARD & TASK CHAT
    // ==========================================
    socket.on("board_updated", () => {
      // Ai đó kéo thả Task -> Báo người khác tải lại bảng
      socket.broadcast.emit("reload_board");
    });

    socket.on("join_task", (taskId) => {
      socket.join(taskId);
      console.log(`📌 Client [${socket.id}] vào xem Task: ${taskId}`);
    });

    socket.on("send_message", (data) => {
      // Chat bên trong Modal của 1 Task cụ thể
      io.to(data.taskId).emit("receive_message", data);
    });
    socket.on("reject_task", (data) => {
      console.log(`❌ [Task Rejected] ${data.taskName} - Bị trả lại bởi ${data.rejecterName}`);
      if (data.workerId) {
        const uid = String(data.workerId); // 🛠️ ÉP KIỂU CHUỖI
        console.log(`📣 Bắn Noti Reject thẳng vào mặt User ID: ${uid}`); // Log ra để Sếp dễ debug
        io.to(uid).emit("receive_notification", {
          title: "Task bị từ chối ⚠️",
          message: `${data.rejecterName} đã yêu cầu làm lại Task "${data.taskName}". Lý do: ${data.reason}`,
          type: "error",
          taskId: data.taskId,
          time: new Date().toISOString()
        });
      }
      socket.broadcast.emit("reload_board");
    });
    socket.on("assign_task", (data) => {
      if (data.assigneeId) {
        io.to(String(data.assigneeId)).emit("receive_notification", { // 🛠️ ÉP KIỂU CHUỖI
          title: "Bạn có Task mới 📌",
          message: `${data.assignerName} vừa giao cho bạn Task: "${data.taskName}"`,
          type: "info",
          taskId: data.taskId,
          time: new Date().toISOString()
        });
      }
      socket.broadcast.emit("reload_board");
    });

    // 5.3. Khi Task được Duyệt thành công (Approve / Done)
    socket.on("approve_task", (data) => {
      if (data.workerId) {
        io.to(String(data.workerId)).emit("receive_notification", { // 🛠️ ÉP KIỂU CHUỖI
          title: "Task đã hoàn thành 🎉",
          message: `Task "${data.taskName}" của bạn đã được duyệt thành công!`,
          type: "success",
          taskId: data.taskId,
          time: new Date().toISOString()
        });
      }
      socket.broadcast.emit("reload_board");
    });
  });

  httpServer.once("error", (err) => {
    console.error(err);
    process.exit(1);
  }).listen(port, () => {
    console.log(`> 🚀 Trạm vũ trụ Real-time đang chạy tại http://${hostname}:${port}`);
  });
});