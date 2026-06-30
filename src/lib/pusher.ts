// src/lib/pusher.ts
import PusherServer from "pusher";

// Khởi tạo Lõi Pusher cho Backend (Chỉ chạy trên Server)
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});