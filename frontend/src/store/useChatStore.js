import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  initialUnreadMessageId: null,
  isSelectedUserTyping: false,
  isUsersLoading: false,
  isMessagesLoading: false,
  isActiveChatAtBottom: true,

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
      if (Array.isArray(res.data)) {
        set({ messages: res.data, initialUnreadMessageId: null });
      } else {
        set({
          messages: res.data?.messages ?? [],
          initialUnreadMessageId: res.data?.firstUnreadMessageId ?? null,
        });
      }
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData, options = {}) => {
    const { selectedUser } = get();
    const tempId = options.tempId || null;

    if (options.optimisticMessage) {
      if (tempId) {
        set((state) => ({
          messages: state.messages.map((message) =>
            message._id === tempId ? options.optimisticMessage : message
          ),
        }));
      } else {
        set((state) => ({ messages: [...state.messages, options.optimisticMessage] }));
      }
    }

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData, {
        onUploadProgress: options.onProgress
          ? (event) => {
              const total = event.total || 0;
              const progress = total ? Math.round((event.loaded * 100) / total) : 0;
              options.onProgress(progress);

              if (tempId) {
                set((state) => ({
                  messages: state.messages.map((message) =>
                    message._id === tempId
                      ? { ...message, isUploading: true, uploadProgress: progress }
                      : message
                  ),
                }));
              }
            }
          : undefined,
      });

      if (tempId) {
        set((state) => ({
          messages: state.messages.map((message) =>
            message._id === tempId ? res.data : message
          ),
        }));
      } else {
        set((state) => ({ messages: [...state.messages, res.data] }));
      }
    } catch (error) {
      if (tempId) {
        set((state) => ({
          messages: state.messages.map((message) =>
            message._id === tempId
              ? { ...message, isUploading: false, uploadFailed: true }
              : message
          ),
        }));
      }
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  markConversationAsRead: (senderId) => {
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket || !authUser || !senderId) return;

    set((state) => ({
      users: state.users.map((user) =>
        user._id === senderId ? { ...user, unreadCount: 0 } : user
      ),
    }));

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

      const isAtBottom = get().isActiveChatAtBottom;

      set((state) => ({
        messages: [...state.messages, newMessage],
        isSelectedUserTyping: false,
        users: state.users.map((user) => {
          if (user._id !== newMessage.senderId) return user;

          const nextUnreadCount = isAtBottom ? 0 : (user.unreadCount || 0) + 1;
          return {
            ...user,
            lastMessage: newMessage,
            unreadCount: nextUnreadCount,
          };
        }),
      }));
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
  setInitialUnreadMessageId: (initialUnreadMessageId) => set({ initialUnreadMessageId }),
  setActiveChatAtBottom: (isActiveChatAtBottom) => set({ isActiveChatAtBottom }),
}));
