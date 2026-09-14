import { create } from "zustand";

export type AdminUser = { id: string; email: string; role: string };
interface UserState {
  user: AdminUser | null;
  setUser: (user: AdminUser | null) => void;
  clearUser: () => void;
}
export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
