import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'
import { initOfflineSync } from './utils/offline'

const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
  onOfflineReady() {
    console.log('Ilova tayyor')
  },
})

// Internet uzilganda "Yangi bemor" formasi orqali telefon xotirasiga
// saqlangan bemorlarni ulanish qaytganda (yoki ilova ochilganda, agar
// internet allaqachon bor bo'lsa) avtomatik serverga yuboradi.
initOfflineSync()

// Nusxa olishda faqat oddiy matn ko'chirilsin — aks holda Excel/Word
// kabi dasturlarga tashlaganda manba elementining fon rangi ham
// (masalan jadval qatori yoki nishon fon rangi) hujayra to'ldirilishi
// sifatida ko'chib ketadi.
document.addEventListener('copy', (e) => {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return
  const text = selection.toString()
  if (!text) return
  e.clipboardData.setData('text/plain', text)
  e.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
