import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney, formatDate } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'

const CATEGORIES = [
  'Kommunal',
  "Ta'mirlash",
  'Jihozlar',
  "Dori-darmon",
  'Transport',
  'Reklama',
  'Boshqa',
]

const MONTHS = [
  'Yanvar','Fevral','Mart','Aprel','May','Iyun',
  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr',
]

export default function CeoExpenses() {
  const [items,  setItems]  = useState(null)
  const [month,  setMonth]  = useState(new Date().getMonth() + 1)
  const [year,   setYear]   = useState(new Date().getFullYear())
  const [total,  setTotal]  = useState(0)
  const [cancelId, setCancelId] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const toast = useToastStore((s) => s.add)

  const load = () => {
    api(`/expenses?month=${month}&year=${year}`).then(setItems)
    api(`/expenses/summary?month=${month}&year=${year}`).then((r) => setTotal(r.total))
  }

  useEffect(() => { load() }, [month, year])

  const doCancel = async () => {
    if (cancelReason.length < 3) {
      toast('Sabab kamida 3 harf', 'error')
      return
    }
    try {
      await api(`/expenses/${cancelId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      })
      toast('Harajat bekor qilindi')
      setCancelId(null)
      setCancelReason('')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const categoryColor = (cat) => {
    const map = {
      'Kommunal':   'var(--info)',
      "Ta'mirlash": 'var(--danger)',
      'Jihozlar':   'var(--gold)',
      "Dori-darmon": 'var(--success)',
      'Transport':  '#a855f7',
      'Reklama':    '#f97316',
      'Boshqa':     'var(--text-muted)',
    }
    return map[cat] || 'var(--text-muted)'
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Harajatlar</h1>
        <div className="card flex items-center gap-2 py-2 px-4">
          <span className="text-muted text-sm">Jami:</span>
          <span className="font-bold text-lg" style={{ color: 'var(--danger)' }}>{formatMoney(total)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          className="input-field max-w-[140px]"
          value={month}
          onChange={(e) => setMonth(+e.target.value)}
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          className="input-field max-w-[100px]"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
        />
      </div>

      {!items ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <div className="card flex h-40 items-center justify-center">
          <p className="text-muted">Bu oyda harajat yo'q</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                <th className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>Sana</th>
                <th className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>Kategoriya</th>
                <th className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>Manba</th>
                <th className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>Tavsif</th>
                <th className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>Summa</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr
                  key={e.id}
                  className="border-b transition-colors table-row"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="p-3 text-muted">{formatDate(e.created_at)}</td>
                  <td className="p-3">
                    {e.category ? (
                      <span
                        className="badge text-xs"
                        style={{
                          background: `${categoryColor(e.category)}18`,
                          color: categoryColor(e.category),
                        }}
                      >
                        {e.category}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">{e.source || '—'}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3 font-semibold" style={{ color: 'var(--danger)' }}>
                    {formatMoney(e.amount)}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="btn-danger py-1 px-2 text-xs"
                      onClick={() => { setCancelId(e.id); setCancelReason('') }}
                    >
                      Bekor
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="Harajatni bekor qilish" size="sm">
        <p className="text-muted mb-4 text-sm">
          Harajat bekor qilinsa, summa balansga qaytariladi.
        </p>
        <div className="space-y-3">
          <input
            className="input-field"
            placeholder="Bekor qilish sababi *"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setCancelId(null)}>
              Orqaga
            </button>
            <button type="button" className="btn-danger flex-1 py-2" onClick={doCancel}>
              Bekor qilish
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
