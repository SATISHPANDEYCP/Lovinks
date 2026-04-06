import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import {
  decryptStringPayload,
  decryptTextForMessage,
  encryptStringForUsers,
  encryptTextForUsers,
} from "../lib/e2ee";

const getLastConversationMessage = (messages, authUserId, selectedUserId) => {
  if (!authUserId || !selectedUserId) return null;

  const conversationMessages = messages.filter(
    (message) =>
      (message.senderId === authUserId && message.receiverId === selectedUserId) ||
      (message.senderId === selectedUserId && message.receiverId === authUserId)
  );

  return conversationMessages.length ? conversationMessages[conversationMessages.length - 1] : null;
};

const hydrateMessageForViewer = async (message, viewerId) => {
  const hydratedMessage = { ...message };

  if (message?.encryptedText) {
    hydratedMessage.text = await decryptTextForMessage({
      message,
      viewerId,
    });
  }

  if (message?.encryptedFileData) {
    const decryptedFileData = await decryptStringPayload({
      encryptedData: message.encryptedFileData,
      encryptionIv: message.fileEncryptionIv,
      encryptedKeyForReceiver: message.encryptedFileKeyForReceiver,
      encryptedKeyForSender: message.encryptedFileKeyForSender,
      viewerId,
      senderId: message.senderId,
      fallbackText: "",
    });

    if (decryptedFileData) {
      hydratedMessage.fileUrl = decryptedFileData;
      if (!hydratedMessage.image && hydratedMessage.fileType?.startsWith("image/")) {
        hydratedMessage.image = decryptedFileData;
      }
    }
  }

  return hydratedMessage;
};

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
      const authUser = useAuthStore.getState().authUser;
      const hydratedUsers = await Promise.all(
        (res.data || []).map(async (user) => {
          const lastMessage = user?.lastMessage;
          if (!lastMessage?.encryptedText) return user;

          const decryptedText = await decryptTextForMessage({
            message: lastMessage,
            viewerId: authUser?._id,
          });

          return {
            ...user,
            lastMessage: {
              ...lastMessage,
              text: decryptedText,
            },
          };
        })
      );

      set({ users: hydratedUsers });
    } catch (error) {
      const message = error.response?.data?.message || "Failed to fetch contacts";
      if (error.response?.status === 401) {
        window.localStorage.removeItem("lovinks_auth_token");
        useAuthStore.getState().logout?.();
      }
      toast.error(message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const authUser = useAuthStore.getState().authUser;
      const rawMessages = Array.isArray(res.data) ? res.data : res.data?.messages ?? [];
      const decryptedMessages = await Promise.all(
        rawMessages.map((message) => hydrateMessageForViewer(message, authUser?._id))
      );

      if (Array.isArray(res.data)) {
        set({ messages: decryptedMessages, initialUnreadMessageId: null });
      } else {
        set({
          messages: decryptedMessages,
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
    const authUser = useAuthStore.getState().authUser;
    const outgoingPayload = { ...messageData };

    if (
      typeof messageData.text === "string" &&
      messageData.text.trim() &&
      selectedUser?.encryptionPublicKey &&
      authUser?.encryptionPublicKey
    ) {
      try {
        const encryptedPayload = await encryptTextForUsers({
          text: messageData.text,
          receiverPublicKey: JSON.parse(selectedUser.encryptionPublicKey),
          senderPublicKey: JSON.parse(authUser.encryptionPublicKey),
        });

        if (encryptedPayload) {
          outgoingPayload.text = "";
          Object.assign(outgoingPayload, encryptedPayload);
        }
      } catch (error) {
        console.log("Failed to encrypt outgoing message:", error);
        toast.error("Could not encrypt message for this chat");
        return;
      }
    }

    if (
      typeof messageData.file === "string" &&
      messageData.file &&
      selectedUser?.encryptionPublicKey &&
      authUser?.encryptionPublicKey
    ) {
      try {
        const encryptedFilePayload = await encryptStringForUsers({
          content: messageData.file,
          receiverPublicKey: JSON.parse(selectedUser.encryptionPublicKey),
          senderPublicKey: JSON.parse(authUser.encryptionPublicKey),
        });

        if (encryptedFilePayload) {
          outgoingPayload.file = "";
          outgoingPayload.image = "";
          outgoingPayload.encryptedFileData = encryptedFilePayload.encryptedData;
          outgoingPayload.fileEncryptionIv = encryptedFilePayload.encryptionIv;
          outgoingPayload.encryptedFileKeyForReceiver =
            encryptedFilePayload.encryptedKeyForReceiver;
          outgoingPayload.encryptedFileKeyForSender = encryptedFilePayload.encryptedKeyForSender;
          outgoingPayload.fileEncryptionVersion = encryptedFilePayload.encryptionVersion;
        }
      } catch (error) {
        console.log("Failed to encrypt outgoing attachment:", error);
        toast.error("Could not encrypt attachment for this chat");
        return;
      }
    }

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
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, outgoingPayload, {
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

      const persistedMessage = await hydrateMessageForViewer(res.data, authUser?._id);

      if (tempId) {
        set((state) => ({
          messages: state.messages.map((message) =>
            message._id === tempId ? persistedMessage : message
          ),
        }));
      } else {
        set((state) => ({ messages: [...state.messages, persistedMessage] }));
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

  deleteMessage: async (message, scope = "everyone") => {
    const { selectedUser, messages, users } = get();
    const authUser = useAuthStore.getState().authUser;
    const messageId = String(message?._id || "");

    if (!selectedUser || !messageId) return;

    const isTemporaryMessage = messageId.startsWith("temp-") || message.uploadFailed || message.isUploading;
    const nextMessages = messages.filter((item) => String(item._id) !== messageId);
    const nextLastMessage = getLastConversationMessage(nextMessages, authUser?._id, selectedUser._id);
    const nextUsers = users.map((user) =>
      user._id === selectedUser._id
        ? {
            ...user,
            lastMessage: nextLastMessage || null,
          }
        : user
    );

    set({ messages: nextMessages, users: nextUsers });

    if (isTemporaryMessage) return;

    try {
      await axiosInstance.post(`/messages/${messageId}/delete`, {
        scope,
      });
    } catch (error) {
      set({ messages, users });
      toast.error(error.response?.data?.message || "Failed to delete message");
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

    socket.on("newMessage", async (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      const authUser = useAuthStore.getState().authUser;
      const hydratedMessage = await hydrateMessageForViewer(newMessage, authUser?._id);

      const isAtBottom = get().isActiveChatAtBottom;

      set((state) => ({
        messages: [...state.messages, hydratedMessage],
        isSelectedUserTyping: false,
        users: state.users.map((user) => {
          if (user._id !== hydratedMessage.senderId) return user;

          const nextUnreadCount = isAtBottom ? 0 : (user.unreadCount || 0) + 1;
          return {
            ...user,
            lastMessage: hydratedMessage,
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

    socket.on("messageDeleted", ({ messageId }) => {
      if (!messageId) return;

      const authUser = useAuthStore.getState().authUser;
      const latestState = get();
      const remainingMessages = latestState.messages.filter(
        (message) => String(message._id) !== String(messageId)
      );
      const nextLastMessage = getLastConversationMessage(
        remainingMessages,
        authUser?._id,
        selectedUser._id
      );

      set({
        messages: remainingMessages,
        users: latestState.users.map((user) =>
          user._id === selectedUser._id
            ? {
                ...user,
                lastMessage: nextLastMessage || null,
              }
            : user
        ),
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
    socket.off("messageDeleted");
    set({ isSelectedUserTyping: false });
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
  setInitialUnreadMessageId: (initialUnreadMessageId) => set({ initialUnreadMessageId }),
  setActiveChatAtBottom: (isActiveChatAtBottom) => set({ isActiveChatAtBottom }),
}));
