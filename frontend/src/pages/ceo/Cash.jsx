import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney, formatDate } from '../../utils/format'
import { Skeleton } from '../../components/Skeleton'
import IncassationModal from '../../components/IncassationModal'

export default function Cash() {
  const [data, setData] = useState(null)
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10))
  const [to,   setTo]   = useState(new Date().toISOString().slice(0, 10))
  const [incassationOpen, setIncassationOpen] = useState(false)

  const load = () => {
    setData(null)
    api(`/cash?from=${from}&to=${to}`).then(setData)
  }

  useEffect(() => { load() }, [from, to])

  if (!data) return (
    <div>
      <h1 className="page-title mb-6">Kassa</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  )

  const summaryRows = [
    { label: "Boshlang'ich qoldiq", value: data.opening_balance,  bold: false, color: 'var(--text)' },
    { label: 'Kirim — Naqt',        value: data.cash_income,       bold: false, color: 'var(--success)' },
    { label: 'Kirim — Karta',       value: data.card_income,       bold: false, color: 'var(--info)' },
    { label: 'Jami kirim',          value: data.total_income,      bold: true,  color: 'var(--success)' },
    { label: 'Chiqim — Harajat',    value: data.expenses,          bold: false, color: 'var(--danger)' },
    { label: 'Chiqim — Avans',      value: data.advances,          bold: false, color: 'var(--danger)' },
    { label: 'Chiqim — Maosh',      value: data.salaries,          bold: false, color: 'var(--danger)' },
    { label: 'Jami chiqim',         value: data.total_out,         bold: true,  color: 'var(--danger)' },
    { label: 'Yakuniy qoldiq',       value: data.closing_balance,  bold: true,  color: 'var(--gold)' },
  ]

  return (
    <div>
      <IncassationModal open={incassationOpen} onClose={() => { setIncassationOpen(false); load() }} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Kassa</h1>
        <button
          type="button"
          onClick={() => setIncassationOpen(true)}
          className="btn-gold py-2 px-4 text-xs font-black shadow-lg flex items-center gap-2"
        >
          🔒 Smenani Yopish va Inkassatsiya
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <input type="date" className="input-field max-w-[180px]" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input-field max-w-[180px]" value={to}   onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn-gold" onClick={load}>Hisoblash</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Summary table */}
        <div className="card">
          <h2 className="accent-value mb-4 font-semibold">Kassa hisobi</h2>
          <div className="space-y-0">
            {summaryRows.map(({ label, value, bold, color }, i) => (
              <div
                key={label}
                className="flex items-center justify-between py-2.5"
                style={{
                  borderBottom: i < summaryRows.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span className={bold ? 'font-semibold' : 'text-muted text-sm'}>{label}</span>
                <span className="font-semibold" style={{ color: bold ? color : 'var(--text)' }}>
                  {formatMoney(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted text-sm">Naqt kassa</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--success)' }}>
                  {formatMoney(data.cash_income)}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <span className="text-2xl">💵</span>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted text-sm">Karta kassa</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--info)' }}>
                  {formatMoney(data.card_income)}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.12)' }}>
                <span className="text-2xl">💳</span>
              </div>
            </div>
          </div>
          <div className="card">
            <p className="text-muted text-sm">Tranzaksiyalar soni</p>
            <p className="mt-1 text-2xl font-bold accent-value">{data.patients_count}</p>
          </div>
        </div>
      </div>

      {/* Transactions */}
      {data.transactions?.length > 0 && (
        <div className="card mt-4 overflow-x-auto p-0">
          <div className="p-4 pb-0">
            <h3 className="accent-value font-semibold">So'nggi tranzaksiyalar</h3>
          </div>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                {['#', 'Summa', "To'lov turi", 'Vaqt'].map((h) => (
                  <th key={h} className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr
                  key={t.id}
                  className="border-b table-row"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="p-3 text-muted">#{t.id}</td>
                  <td className="p-3 font-semibold" style={{ color: 'var(--success)' }}>
                    {formatMoney(t.amount)}
                  </td>
                  <td className="p-3">
                    <span className={`badge ${t.payment_type === 'cash' ? 'badge-success' : 'badge-info'}`}>
                      {t.payment_type === 'cash' ? 'Naqt' : 'Karta'}
                    </span>
                  </td>
                  <td className="p-3 text-muted text-xs">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
