import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isSelectedUserTyping: false,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  markConversationAsRead: (senderId) => {
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket || !authUser || !senderId) return;

    socket.emit("markMessagesRead", {
      from: senderId,
      to: authUser._id,
    });
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
        isSelectedUserTyping: false,
      });

      get().markConversationAsRead(selectedUser._id);
    });

    socket.on("typing", ({ from }) => {
      if (from === selectedUser._id) {
        set({ isSelectedUserTyping: true });
      }
    });

    socket.on("stopTyping", ({ from }) => {
      if (from === selectedUser._id) {
        set({ isSelectedUserTyping: false });
      }
    });

    socket.on("messageStatusUpdated", ({ messageIds, status, deliveredAt, readAt }) => {
      if (!Array.isArray(messageIds) || !messageIds.length) return;

      const normalizedIds = new Set(messageIds.map((id) => String(id)));

      set({
        messages: get().messages.map((message) => {
          if (!normalizedIds.has(String(message._id))) return message;

          return {
            ...message,
            status,
            deliveredAt: deliveredAt ?? message.deliveredAt,
            readAt: readAt ?? message.readAt,
          };
        }),
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("messageStatusUpdated");
    set({ isSelectedUserTyping: false });
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
