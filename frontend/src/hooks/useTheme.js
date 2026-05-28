import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

export function useTheme() {
  const theme = useAuthStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme === 'light' ? 'light' : 'dark')
  }, [theme])

  const isLight = theme === 'light'

  return {
    theme,
    isLight,
    chartAxis:   'var(--chart-axis)',
    chartGrid:   'var(--chart-grid)',
    chartGold:   isLight ? '#a87520' : '#d4af37',
    chartColors: isLight
      ? ['#a87520', '#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706']
      : ['#d4af37', '#3b82f6', '#10b981', '#ef4444', '#a855f7', '#f97316'],
    tooltipStyle: {
      backgroundColor: isLight ? '#ffffff' : '#1a2540',
      border: `1px solid ${isLight ? '#e8e2d4' : 'rgba(212,175,55,0.3)'}`,
      borderRadius: '10px',
      color: isLight ? '#1a1d29' : '#e8eaf2',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      fontSize: '13px',
    },
  }
}
