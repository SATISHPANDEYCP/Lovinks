import { create } from "zustand";
import { THEMES } from "../constants";

const savedTheme = localStorage.getItem("chat-theme");
const initialTheme = THEMES.includes(savedTheme) ? savedTheme : "luxury";

export const useThemeStore = create((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    localStorage.setItem("chat-theme", theme);
    set({ theme });
  },
}));
