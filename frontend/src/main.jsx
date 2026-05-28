import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'

// Service worker'ni ro'yxatdan o'tkazish (dev + prod da ishlaydi)
const updateSW = registerSW({
  onNeedRefresh() {
    // Yangi versiya chiqdi — foydalanuvchi ilovani yangilashi mumkin
    if (confirm('Yangi versiya mavjud! Yangilash?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Ilova oflayn rejimda ishlashga tayyor')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
