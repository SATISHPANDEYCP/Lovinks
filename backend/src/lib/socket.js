import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  if (userId) {
    io.emit("userPresenceUpdated", {
      userId,
      status: "online",
      lastSeen: null,
    });
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  const syncDeliveredMessages = async () => {
    if (!userId) return;

    const pendingMessages = await Message.find({
      receiverId: userId,
      status: "sent",
    }).select("_id senderId");

    if (!pendingMessages.length) return;

    const deliveredAt = new Date();
    const pendingMessageIds = pendingMessages.map((message) => message._id);

    await Message.updateMany(
      { _id: { $in: pendingMessageIds } },
      {
        $set: {
          status: "delivered",
          deliveredAt,
        },
      }
    );

    const senderMessageMap = new Map();
    pendingMessages.forEach((message) => {
      const senderId = message.senderId.toString();
      if (!senderMessageMap.has(senderId)) {
        senderMessageMap.set(senderId, []);
      }
      senderMessageMap.get(senderId).push(message._id);
    });

    senderMessageMap.forEach((messageIds, senderId) => {
      const senderSocketId = userSocketMap[senderId];
      if (senderSocketId) {
        const serializedMessageIds = messageIds.map((id) => id.toString());
        io.to(senderSocketId).emit("messageStatusUpdated", {
          messageIds: serializedMessageIds,
          status: "delivered",
          deliveredAt,
        });
      }
    });
  };

  syncDeliveredMessages().catch((error) => {
    console.log("Failed to sync delivered messages:", error.message);
  });

  socket.on("typing", ({ to, from }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { from });
    }
  });

  socket.on("stopTyping", ({ to, from }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { from });
    }
  });

  socket.on("markMessagesRead", async ({ from, to }) => {
    try {
      if (!from || !to) return;

      const readAt = new Date();
      const unreadMessages = await Message.find({
        senderId: from,
        receiverId: to,
        status: { $ne: "read" },
      }).select("_id");

      if (!unreadMessages.length) return;

      const unreadMessageIds = unreadMessages.map((message) => message._id);

      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        {
          $set: {
            status: "read",
            readAt,
            deliveredAt: readAt,
          },
        }
      );

      const senderSocketId = userSocketMap[from];
      if (senderSocketId) {
        const serializedUnreadMessageIds = unreadMessageIds.map((id) => id.toString());
        io.to(senderSocketId).emit("messageStatusUpdated", {
          messageIds: serializedUnreadMessageIds,
          status: "read",
          readAt,
        });
      }
    } catch (error) {
      console.log("Failed to mark messages as read:", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    const handleDisconnect = async () => {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));

      if (!userId) return;

      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { lastSeen });

      io.emit("userPresenceUpdated", {
        userId,
        status: "offline",
        lastSeen,
      });
    };

    handleDisconnect().catch((error) => {
      console.log("Failed to persist disconnect lastSeen:", error.message);
    });
  });
});

export { io, app, server };
