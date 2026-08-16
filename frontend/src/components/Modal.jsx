import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Oyna ochiq turganda orqa fon aylanmasin — telefonda barmoq bilan
    // surganda fon siljib, oyna qotib qolgandek tuyulardi.
    const eski = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = eski
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`card w-full ${widths[size]} max-h-[90vh] overflow-y-auto overscroll-contain`}
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px var(--gold-glow)' }}
      >
        <div className="mb-5 flex items-center justify-between sticky -top-6 -mx-6 px-6 pt-6 pb-3 z-10" style={{ background: 'var(--surface)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--gold)' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost rounded-lg p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
