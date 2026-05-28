import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useNotificationStore = create(
  persist(
    (set) => ({
      lastChecked: null,
      setLastChecked: () => set({ lastChecked: new Date().toISOString() }),
    }),
    { name: 'marjona-notifs' }
  )
)
