import axios from "axios";

export const axiosInstance = axios.create({
  baseURL:"https://lovink.onrender.com",
  withCredentials: true,
});
