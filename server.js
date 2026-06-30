const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

// Thêm 1 route HTTP cơ bản để sếp test xem server có sống không (Truy cập vào IP_VPS:3001)
app.get("/", (req, res) => {
  res.send("🚀 Trạm vũ trụ Real-time BeastLore đang hoạt động mượt mà!");
});

// ==========================================
// KHAI BÁO BIẾN TOÀN CỤC
// ==========================================
const onlineUsers = new Map();

// Khởi tạo Socket.io với cấu hình CORS cho phép Vercel gọi tới
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://ws.sanogroup.tv", // Domain thực tế của sếp
      "https://beastlore.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Có người vừa kết nối. Socket ID:", socket.id);

  // ==========================================
  // 1. QUẢN LÝ TRẠNG THÁI ONLINE / OFFLINE
  // ==========================================
  socket.on('user_online', (username) => {
      if (!username) return;

      // Lưu thông tin
      onlineUsers.set(socket.id, username);

      // Lọc ra mảng Username ĐỘC NHẤT
      const uniqueUsernames = Array.from(new Set(onlineUsers.values()));
      
      console.log("👥 Đang Online:", uniqueUsernames);

      // Bắn mảng này về cho TẤT CẢ mọi người
      io.emit('update_online_users', uniqueUsernames);
  });

  socket.on('disconnect', () => {
      // Xóa thẻ socket.id
      onlineUsers.delete(socket.id);

      // Tính toán lại danh sách
      const uniqueUsernames = Array.from(new Set(onlineUsers.values()));

      // Bắn lại danh sách mới
      io.emit('update_online_users', uniqueUsernames);
      
      console.log('❌ Vừa ngắt kết nối:', socket.id);
  });

  // ==========================================
  // 2. CHAT NỘI BỘ (SANO CHAT CHÍNH)
  // ==========================================
  socket.on('join_chat_room', (roomId) => {
      socket.join(roomId);
  });

  socket.on("send_chat_message", (data) => {
    const { roomId, message } = data;
    console.log("📨 Nhận tin nhắn từ Client gửi lên:", message);

    // 🚀 ĐÃ BỎ PRISMA: Tận dụng trực tiếp `message.fullName` do Client Vercel truyền lên.
    // Client (Next.js) lúc gửi emit hãy nhớ kèm `fullName` vào object message nhé!
    const senderFullName = message.fullName || "Người dùng Sano"; 

    const richMessage = {
      ...message, 
      fullName: senderFullName, 
    };

    console.log("📡 Chuẩn bị broadcast tin nhắn xịn:", richMessage);

    // 1. Gửi tin nhắn real-time cho người đang mở phòng chat
    socket.to(roomId).emit("receive_chat_message", { roomId, message: richMessage });

    // 2. Gửi thông báo cho popup của những người KHÔNG mở phòng (broadcast loa phường)
    socket.broadcast.emit("new_message_notification", { roomId, message: richMessage });

    // 3. Báo load lại danh sách bên trái
    socket.broadcast.emit("reload_chat_list");
  });

  // ==========================================
  // 3. THÔNG BÁO HỆ THỐNG (NOTI CHUNG)
  // ==========================================
  socket.on("register_user", (userId) => {
    const uid = String(userId); 
    socket.join(uid);
    console.log(`🔔 User [${uid}] đã đăng ký nhận thông báo (Socket ID: ${socket.id}).`);
  });

  socket.on("send_notification", (data) => {
    if (data.userIds && Array.isArray(data.userIds)) {
      data.userIds.forEach((userId) => {
        io.to(String(userId)).emit("receive_notification", data.notification);
      });
    }
  });

  socket.on("send_system_noti", (data) => {
    console.log("🔔 Bắn Noti Hệ Thống:", data.title, "-> Tới User:", data.targetId);
    socket.broadcast.emit("receive_system_noti", data);
  });

  // ==========================================
  // 4. KANBAN BOARD & TASK CHAT
  // ==========================================
  socket.on("board_updated", () => {
    socket.broadcast.emit("reload_board");
  });

  socket.on("join_task", (taskId) => {
    socket.join(taskId);
    console.log(`📌 Client [${socket.id}] vào xem Task: ${taskId}`);
  });

  socket.on("send_message", (data) => {
    io.to(data.taskId).emit("receive_message", data);
  });

  socket.on("reject_task", (data) => {
    console.log(`❌ [Task Rejected] ${data.taskName} - Bị trả lại bởi ${data.rejecterName}`);
    if (data.workerId) {
      const uid = String(data.workerId); 
      console.log(`📣 Bắn Noti Reject thẳng vào mặt User ID: ${uid}`); 
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
      io.to(String(data.assigneeId)).emit("receive_notification", { 
        title: "Bạn có Task mới 📌",
        message: `${data.assignerName} vừa giao cho bạn Task: "${data.taskName}"`,
        type: "info",
        taskId: data.taskId,
        time: new Date().toISOString()
      });
    }
    socket.broadcast.emit("reload_board");
  });

  socket.on("approve_task", (data) => {
    if (data.workerId) {
      io.to(String(data.workerId)).emit("receive_notification", { 
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

// Chạy port 3002 cho Socket trên VPS
const PORT = 8000;
server.listen(PORT, () => {
  console.log(`> 🚀 Trạm vũ trụ Real-time đang chạy độc lập tại port ${PORT}`);
});