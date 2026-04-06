import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { ensureLocalUserKeyPair } from "../lib/e2ee";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  userPresence: {},
  socket: null,

  ensureE2EEKeys: async () => {
    const { authUser } = get();
    if (!authUser?._id) return;

    try {
      const { publicKeyJwk } = await ensureLocalUserKeyPair(authUser._id);
      const serializedPublicKey = JSON.stringify(publicKeyJwk);

      if (authUser.encryptionPublicKey === serializedPublicKey) {
        return;
      }

      const res = await axiosInstance.put("/auth/encryption-public-key", {
        encryptionPublicKey: serializedPublicKey,
      });

      set((state) => ({
        authUser: state.authUser
          ? {
              ...state.authUser,
              encryptionPublicKey: res.data.encryptionPublicKey,
            }
          : state.authUser,
      }));
    } catch (error) {
      console.log("Failed to initialize E2EE keys:", error);
    }
  },

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      await get().ensureE2EEKeys();
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      await get().ensureE2EEKeys();
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      await get().ensureE2EEKeys();
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();

    set({ socket: socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("userPresenceUpdated", ({ userId, status, lastSeen }) => {
      set((state) => {
        const nextOnlineUsers = new Set(state.onlineUsers);

        if (status === "online") {
          nextOnlineUsers.add(userId);
        } else if (status === "offline") {
          nextOnlineUsers.delete(userId);
        }

        return {
          onlineUsers: Array.from(nextOnlineUsers),
          userPresence: {
            ...state.userPresence,
            [userId]: {
              status,
              lastSeen: status === "offline" ? lastSeen : null,
            },
          },
        };
      });
    });
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
    set({ socket: null, onlineUsers: [], userPresence: {} });
  },
}));
