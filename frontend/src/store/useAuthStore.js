import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { ensureLocalUserKeyPair, getLocalDeviceId } from "../lib/e2ee";

const SOCKET_BASE_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.MODE === "development" ? "http://localhost:5001" : "/");
const AUTH_TOKEN_KEY = "lovinks_auth_token";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isVerifyingLoginOtp: false,
  isResendingLoginOtp: false,
  isRequestingPasswordResetOtp: false,
  isResendingPasswordResetOtp: false,
  isResettingPasswordWithOtp: false,
  isUpdatingProfile: false,
  isDeletingAccount: false,
  isCheckingAuth: true,
  pendingLoginOtpEmail: "",
  pendingLoginOtpSessionToken: "",
  pendingPasswordResetEmail: "",
  pendingPasswordResetSessionToken: "",
  onlineUsers: [],
  userPresence: {},
  socket: null,

  ensureE2EEKeys: async () => {
    const { authUser } = get();
    if (!authUser?._id) return;

    try {
      const { publicKeyJwk } = await ensureLocalUserKeyPair(authUser._id);
      const serializedPublicKey = JSON.stringify(publicKeyJwk);
      const deviceId = getLocalDeviceId();
      const isCurrentDeviceRegistered = Array.isArray(authUser.encryptionPublicKeys)
        ? authUser.encryptionPublicKeys.some((item) => item?.deviceId === deviceId)
        : false;

      if (authUser.encryptionPublicKey === serializedPublicKey && isCurrentDeviceRegistered) {
        return;
      }

      const res = await axiosInstance.put("/auth/encryption-public-key", {
        encryptionPublicKey: serializedPublicKey,
        deviceId,
      });

      set((state) => ({
        authUser: state.authUser
          ? {
              ...state.authUser,
              encryptionPublicKey: res.data.encryptionPublicKey,
              encryptionPublicKeys: res.data.encryptionPublicKeys || [],
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
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const payload = {
        ...data,
        fullName: String(data.fullName || "").trim(),
        email: String(data.email || "").trim().toLowerCase(),
        password: String(data.password || "").trim(),
      };

      const res = await axiosInstance.post("/auth/signup", payload);

      if (res.data?.requiresOtp) {
        set({
          pendingLoginOtpEmail: res.data.email,
          pendingLoginOtpSessionToken: res.data.otpSessionToken,
        });
        toast.success("OTP sent to your email");
        return;
      }

      set({ authUser: res.data });
      await get().ensureE2EEKeys();
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const payload = {
        ...data,
        email: String(data.email || "").trim().toLowerCase(),
        password: String(data.password || "").trim(),
      };

      const res = await axiosInstance.post("/auth/login", payload);

      if (res.data?.requiresOtp) {
        set({
          pendingLoginOtpEmail: res.data.email,
          pendingLoginOtpSessionToken: res.data.otpSessionToken,
        });
        toast.success("OTP sent to your email");
        return;
      }

      set({
        authUser: res.data,
        pendingLoginOtpEmail: "",
        pendingLoginOtpSessionToken: "",
      });
      await get().ensureE2EEKeys();
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  verifyLoginOtp: async (otp) => {
    const { pendingLoginOtpEmail, pendingLoginOtpSessionToken } = get();
    if (!pendingLoginOtpEmail || !pendingLoginOtpSessionToken) {
      toast.error("OTP session expired. Please login again.");
      return;
    }

    set({ isVerifyingLoginOtp: true });
    try {
      const res = await axiosInstance.post("/auth/verify-login-otp", {
        email: pendingLoginOtpEmail,
        otp,
        otpSessionToken: pendingLoginOtpSessionToken,
      });

      const fallbackToken = res.headers?.["x-auth-token"];
      const resolvedToken = res.data?.token || fallbackToken;

      if (resolvedToken) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, resolvedToken);
      }

      const userPayload = { ...res.data };
      delete userPayload.token;

      set({
        authUser: userPayload,
        pendingLoginOtpEmail: "",
        pendingLoginOtpSessionToken: "",
      });
      await get().ensureE2EEKeys();
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "OTP verification failed");
    } finally {
      set({ isVerifyingLoginOtp: false });
    }
  },

  resendLoginOtp: async () => {
    const { pendingLoginOtpEmail, pendingLoginOtpSessionToken } = get();
    if (!pendingLoginOtpEmail || !pendingLoginOtpSessionToken) {
      toast.error("OTP session expired. Please login again.");
      return;
    }

    set({ isResendingLoginOtp: true });
    try {
      await axiosInstance.post("/auth/resend-login-otp", {
        email: pendingLoginOtpEmail,
        otpSessionToken: pendingLoginOtpSessionToken,
      });
      toast.success("OTP resent to your email");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend OTP");
    } finally {
      set({ isResendingLoginOtp: false });
    }
  },

  cancelLoginOtpFlow: () =>
    set({
      pendingLoginOtpEmail: "",
      pendingLoginOtpSessionToken: "",
      isVerifyingLoginOtp: false,
      isResendingLoginOtp: false,
    }),

  requestPasswordResetOtp: async (email) => {
    set({ isRequestingPasswordResetOtp: true });
    try {
      const res = await axiosInstance.post("/auth/forgot-password", { email });
      set({
        pendingPasswordResetEmail: res.data.email,
        pendingPasswordResetSessionToken: res.data.otpSessionToken,
      });
      toast.success(res.data.message || "OTP sent to your email");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send password reset OTP");
    } finally {
      set({ isRequestingPasswordResetOtp: false });
    }
  },

  resendPasswordResetOtp: async () => {
    const { pendingPasswordResetEmail, pendingPasswordResetSessionToken } = get();
    if (!pendingPasswordResetEmail || !pendingPasswordResetSessionToken) {
      toast.error("Reset session expired. Start again.");
      return;
    }

    set({ isResendingPasswordResetOtp: true });
    try {
      await axiosInstance.post("/auth/forgot-password/resend-otp", {
        email: pendingPasswordResetEmail,
        otpSessionToken: pendingPasswordResetSessionToken,
      });
      toast.success("OTP resent to your email");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend OTP");
    } finally {
      set({ isResendingPasswordResetOtp: false });
    }
  },

  resetPasswordWithOtp: async ({ otp, newPassword }) => {
    const { pendingPasswordResetEmail, pendingPasswordResetSessionToken } = get();
    if (!pendingPasswordResetEmail || !pendingPasswordResetSessionToken) {
      toast.error("Reset session expired. Start again.");
      return false;
    }

    set({ isResettingPasswordWithOtp: true });
    try {
      const res = await axiosInstance.post("/auth/forgot-password/reset", {
        email: pendingPasswordResetEmail,
        otp,
        otpSessionToken: pendingPasswordResetSessionToken,
        newPassword,
      });

      set({
        pendingPasswordResetEmail: "",
        pendingPasswordResetSessionToken: "",
      });

      toast.success(res.data.message || "Password reset successful");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
      return false;
    } finally {
      set({ isResettingPasswordWithOtp: false });
    }
  },

  cancelPasswordResetFlow: () =>
    set({
      pendingPasswordResetEmail: "",
      pendingPasswordResetSessionToken: "",
      isRequestingPasswordResetOtp: false,
      isResendingPasswordResetOtp: false,
      isResettingPasswordWithOtp: false,
    }),

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      set({
        authUser: null,
        pendingLoginOtpEmail: "",
        pendingLoginOtpSessionToken: "",
        pendingPasswordResetEmail: "",
        pendingPasswordResetSessionToken: "",
      });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  deleteAccount: async (password) => {
    set({ isDeletingAccount: true });
    try {
      await axiosInstance.delete("/auth/delete-account", {
        data: { password },
      });
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      set({
        authUser: null,
        onlineUsers: [],
        userPresence: {},
        pendingLoginOtpEmail: "",
        pendingLoginOtpSessionToken: "",
        pendingPasswordResetEmail: "",
        pendingPasswordResetSessionToken: "",
      });
      get().disconnectSocket();
      toast.success("Account deleted successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete account");
    } finally {
      set({ isDeletingAccount: false });
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

    const socket = io(SOCKET_BASE_URL, {
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
