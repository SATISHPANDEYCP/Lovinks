import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AUTH_TOKEN_KEY = "lovinks_auth_token";

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL || (import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api"),
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);

  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});
