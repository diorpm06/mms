import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useNotificationStore = create(
  persist(
    (set) => ({
      lastChecked: null,
      setLastChecked: () => set({ lastChecked: new Date().toISOString() }),
      // `items` — Layout ikkita joyda (mobil va desktop sarlavha) bitta
      // <NotificationBell/> ni bir vaqtda render qiladi (CSS bilan
      // ko'rsatish/yashirish, ikkalasi ham DOM'da mavjud). Ro'yxat shu
      // yerda umumiy saqlanadi, shunda ikkalasi ham bir xil ma'lumotni
      // ko'rsatadi, lekin so'rovni faqat BITTASI yuboradi (pastga qarang).
      items: [],
      setItems: (items) => set({ items }),
    }),
    { name: 'marjona-notifs', partialize: (state) => ({ lastChecked: state.lastChecked }) }
  )
)
