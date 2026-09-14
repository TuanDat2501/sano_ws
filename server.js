const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

app.get("/", (req, res) => {
  res.send("🚀 Trạm vũ trụ Real-time BeastLore đang hoạt động mượt mà!");
});

const onlineUsers = new Map();

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://ws.sanogroup.tv", 
      "https://beastlore.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Có người vừa kết nối. Socket ID:", socket.id);

  socket.on('user_online', (username) => {
      if (!username) return;
      onlineUsers.set(socket.id, username);
      const uniqueUsernames = Array.from(new Set(onlineUsers.values()));
      io.emit('update_online_users', uniqueUsernames);
  });

  socket.on('disconnect', () => {
      onlineUsers.delete(socket.id);
      const uniqueUsernames = Array.from(new Set(onlineUsers.values()));
      io.emit('update_online_users', uniqueUsernames);
  });

  socket.on('join_my_rooms', (roomIds) => {
      if (Array.isArray(roomIds)) {
          roomIds.forEach(id => socket.join(id));
      }
  });

  socket.on("join_chat_room", (roomId) => {
      socket.join(roomId);
  });

  socket.on("send_chat_message", (data) => {
    const { roomId, message } = data;
    const richMessage = {
      ...message, 
      fullName: message.fullName || "Người dùng Sano", 
    };

    // 1. Phát nội dung tin nhắn TỚI CÁC THÀNH VIÊN TRONG PHÒNG
    socket.broadcast.to(roomId).emit("receive_chat_message", { roomId, message: richMessage });
    socket.broadcast.to(roomId).emit("reload_chat_list");

    // 2. Bắn tín hiệu "Búng Popup"
    // Nếu là chat 1-1 (Có targetId), bắn TIK-TOK thẳng vào ID người nhận để đảm bảo họ nhận được dù chưa kịp join phòng
    if (message.targetId) {
      socket.to(String(message.targetId)).emit("new_message_notification", { roomId, message: richMessage });
    }
    // Gắn lệnh búng popup vào toàn bộ những ai đang theo dõi phòng
    socket.broadcast.to(roomId).emit("new_message_notification", { roomId, message: richMessage });
  });

  socket.on("register_user", (userId) => {
    const uid = String(userId); 
    socket.join(uid); 
  });

  socket.on("send_notification", (data) => {
    if (data.userIds && Array.isArray(data.userIds)) {
      data.userIds.forEach((userId) => {
        io.to(String(userId)).emit("receive_notification", data.notification);
      });
    }
  });

  socket.on("send_system_noti", (data) => {
    socket.broadcast.emit("receive_system_noti", data);
  });

  socket.on("board_updated", () => {
    socket.broadcast.emit("reload_board");
  });

  socket.on("join_task", (taskId) => {
    socket.join(taskId);
  });

  socket.on("send_message", (data) => {
    io.to(data.taskId).emit("receive_message", data);
  });

  socket.on("reject_task", (data) => {
    if (data.workerId) {
      const uid = String(data.workerId); 
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

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`> 🚀 Trạm vũ trụ Real-time đang chạy độc lập tại port ${PORT}`);
});