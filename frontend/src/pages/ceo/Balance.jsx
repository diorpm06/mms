import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney, formatDate } from '../../utils/format'
import { Skeleton, TableSkeleton } from '../../components/Skeleton'
import { Wallet } from 'lucide-react'

const TYPE_LABELS = {
  income:         { label: 'Kirim',          color: 'var(--success)' },
  expense:        { label: 'Harajat',         color: 'var(--danger)'  },
  salary:         { label: 'Maosh',           color: 'var(--danger)'  },
  advance:        { label: 'Avans',           color: 'var(--danger)'  },
  cancel:         { label: 'Bekor (qaytim)',  color: 'var(--info)'    },
  expense_cancel: { label: 'Harajat qaytim',  color: 'var(--info)'    },
  advance_cancel: { label: 'Avans qaytim',    color: 'var(--info)'    },
}

export default function CeoBalance() {
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [from, setFrom] = useState('')
  const [to,   setTo]   = useState('')

  const loadHistory = () => {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to)   p.set('to', to)
    const q = p.toString() ? `?${p}` : ''
    api(`/balance/history${q}`).then(setHistory)
  }

  useEffect(() => {
    api('/balance').then(setBalance)
    loadHistory()
  }, [])

  const typeInfo = (t) => TYPE_LABELS[t] || { label: t, color: 'var(--text-muted)' }

  return (
    <div>
      <h1 className="page-title mb-6">Balans</h1>

      {!balance ? (
        <Skeleton className="mb-6 h-36 rounded-2xl" />
      ) : (
        <div className="stat-card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted text-sm mb-1">Joriy balans</p>
              <p className="text-4xl font-bold" style={{ color: 'var(--gold)' }}>
                {formatMoney(balance.current_balance)}
              </p>
              <p className="text-muted mt-2 text-xs">
                Yangilangan: {formatDate(balance.updated_at)}
              </p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--gold-dim)' }}>
              <Wallet className="h-8 w-8" style={{ color: 'var(--gold)' }} />
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input type="date" className="input-field max-w-[180px]" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input-field max-w-[180px]" value={to}   onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn-gold" onClick={loadHistory}>Filtrlash</button>
        {(from || to) && (
          <button type="button" className="btn-outline" onClick={() => { setFrom(''); setTo(''); loadHistory() }}>
            Tozalash
          </button>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
              {['Sana', 'Turi', 'Summa', 'Tavsif'].map((h) => (
                <th key={h} className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => {
              const { label, color } = typeInfo(h.entry_type)
              return (
                <tr
                  key={h.id}
                  className="border-b table-row"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="p-3 text-muted">{formatDate(h.created_at)}</td>
                  <td className="p-3">
                    <span className="badge text-xs" style={{ background: `${color}18`, color }}>
                      {label}
                    </span>
                  </td>
                  <td className="p-3 font-semibold" style={{ color: h.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {h.amount >= 0 ? '+' : ''}{formatMoney(Math.abs(h.amount))}
                  </td>
                  <td className="p-3 text-muted">{h.description}</td>
                </tr>
              )
            })}
            {history.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted">Ma'lumot yo'q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
