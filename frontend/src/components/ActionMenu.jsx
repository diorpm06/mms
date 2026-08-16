import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Jadval qatoridagi amallarni bitta "⋮" tugmasi ostiga yig'adi.
 *
 * Ilgari har bir qatorda 4-5 ta tugma yonma-yon turardi. Tor ustunda ular
 * o'ralib ketib, qator balandligini uch barobar oshirardi va jadval tartibsiz
 * ko'rinardi.
 *
 * Ro'yxat `position: fixed` bilan chiziladi — aks holda jadvalning
 * `overflow-x-auto` o'rami uni kesib qo'yadi.
 *
 * items: [{ label, icon, onClick, variant?, disabled?, hidden? }]
 *   variant: 'default' | 'danger' | 'success' | 'gold'
 */
export default function ActionMenu({ items = [], title = 'Amallar' }) {
  const [open, setOpen] = useState(false)
  const [joy, setJoy] = useState({ top: 0, left: 0 })
  const tugmaRef = useRef(null)
  const royxatRef = useRef(null)

  const korinadigan = items.filter((x) => x && !x.hidden)

  // Ro'yxat joyini tugmaga qarab hisoblaymiz
  useLayoutEffect(() => {
    if (!open || !tugmaRef.current) return
    const r = tugmaRef.current.getBoundingClientRect()
    const kenglik = 200
    const balandlik = korinadigan.length * 38 + 12
    // Ekrandan chiqib ketmasin
    const left = Math.min(Math.max(8, r.right - kenglik), window.innerWidth - kenglik - 8)
    const pastda = r.bottom + 6
    const top = pastda + balandlik > window.innerHeight - 8
      ? Math.max(8, r.top - balandlik - 6)
      : pastda
    setJoy({ top, left, width: kenglik })
  }, [open, korinadigan.length])

  // Tashqariga bosilsa, Escape bosilsa yoki sahifa aylantirilsa — yopiladi
  useEffect(() => {
    if (!open) return
    const bosildi = (e) => {
      if (tugmaRef.current?.contains(e.target)) return
      if (royxatRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const tugma = (e) => e.key === 'Escape' && setOpen(false)
    const aylandi = () => setOpen(false)
    document.addEventListener('mousedown', bosildi)
    document.addEventListener('keydown', tugma)
    window.addEventListener('scroll', aylandi, true)
    window.addEventListener('resize', aylandi)
    return () => {
      document.removeEventListener('mousedown', bosildi)
      document.removeEventListener('keydown', tugma)
      window.removeEventListener('scroll', aylandi, true)
      window.removeEventListener('resize', aylandi)
    }
  }, [open])

  if (!korinadigan.length) return null

  const rang = {
    danger: 'text-rose-400',
    success: 'text-emerald-400',
    gold: 'text-gold',
    default: 'text-body',
  }

  return (
    <>
      <button
        ref={tugmaRef}
        type="button"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
          open ? 'bg-gold/15 border-gold/50 text-gold' : 'border-border text-muted hover:text-gold hover:border-gold/40'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <div
          ref={royxatRef}
          role="menu"
          style={{
            position: 'fixed',
            top: joy.top,
            left: joy.left,
            width: joy.width,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
          }}
          className="z-[60] rounded-xl p-1.5 text-left animate-in fade-in zoom-in-95"
        >
          {korinadigan.map((x, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={x.disabled}
              onClick={(e) => { e.stopPropagation(); setOpen(false); x.onClick?.() }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-bold
                          transition-colors hover:bg-surface-hover disabled:opacity-40
                          disabled:cursor-not-allowed ${rang[x.variant] || rang.default}`}
            >
              {x.icon && <span className="flex-shrink-0">{x.icon}</span>}
              <span className="truncate">{x.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
