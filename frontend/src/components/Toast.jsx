import { CheckCircle, XCircle, X } from 'lucide-react'
import { useToastStore } from '../store/toastStore'

export default function Toast() {
  // Selector obyekt qaytarsa har renderda yangi reference bo'lib loop berishi mumkin.
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)

  return (
    <div className="fixed right-5 top-5 z-[60] flex flex-col gap-2.5">
      {toasts.map((t) => {
        const isError = t.type === 'error'
        return (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-2xl"
            style={{
              background: isError ? 'rgba(239,68,68,0.95)' : 'var(--surface-2)',
              border: `1px solid ${isError ? 'rgba(239,68,68,0.6)' : 'var(--gold-glow)'}`,
              color: isError ? '#fff' : 'var(--text)',
              backdropFilter: 'blur(8px)',
              minWidth: '240px',
              maxWidth: '360px',
            }}
          >
            {isError
              ? <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-white/90" />
              : <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
            }
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => remove?.(t.id)}
              className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
