import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      fullName: null,
      userId: null,
      theme: 'dark',
      setAuth: (data) =>
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          role: data.role,
          fullName: data.full_name,
          userId: data.user_id ?? null,
        }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, role: null, fullName: null, userId: null }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'marjona-auth' }
  )
)
