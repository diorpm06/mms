import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'
import { CardSkeleton } from '../../components/Skeleton'
import { Users, TrendingUp, CreditCard, Plus, Search, List } from 'lucide-react'

export default function AdminDashboard() {
  const [data,  setData]  = useState(null)
  const [today, setToday] = useState([])

  const load = useCallback(() => {
    const d = new Date().toISOString().slice(0, 10)
    api(`/reports/admin-daily?date=${d}`)
      .then(setData)
      .catch(() => setData({ patients_count: 0, total_income: 0, cash: 0, card: 0 }))
    api('/patients/today').then(setToday)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const cards = data ? [
    { label: 'Bugungi mijozlar', value: data.patients_count,       color: 'var(--info)',    icon: Users },
    { label: 'Bugungi daromad',  value: formatMoney(data.total_income), color: 'var(--success)', icon: TrendingUp },
    { label: 'Naqt',             value: formatMoney(data.cash),     color: 'var(--gold)',    icon: null },
    { label: 'Karta',            value: formatMoney(data.card),     color: 'var(--info)',    icon: CreditCard },
  ] : []

  return (
    <div>
      <div className="mb-2">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="text-muted mt-1 text-sm">Bugungi ma'lumotlar — {new Date().toLocaleDateString('uz-UZ')}</p>
      </div>

      {/* Stats */}
      <div className="my-6">
        {!data ? (
          <CardSkeleton count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <div key={c.label} className="stat-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted text-xs uppercase tracking-wide">{c.label}</p>
                      <p className="mt-2 text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
                    </div>
                    {Icon && (
                      <div className="rounded-xl p-2" style={{ background: `${c.color}18` }}>
                        <Icon className="h-4 w-4" style={{ color: c.color }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link
          to="/admin/new-patient"
          className="card flex items-center gap-3 transition-all hover:border-gold/40"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="rounded-xl p-2.5" style={{ background: 'var(--gold-dim)' }}>
            <Plus className="h-5 w-5" style={{ color: 'var(--gold)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--gold)' }}>Yangi mijoz</span>
        </Link>
        <Link
          to="/admin/search"
          className="card flex items-center gap-3 transition-all"
        >
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(59,130,246,0.12)' }}>
            <Search className="h-5 w-5" style={{ color: 'var(--info)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--info)' }}>Qidirish</span>
        </Link>
        <Link
          to="/admin/today"
          className="card flex items-center gap-3 transition-all"
        >
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <List className="h-5 w-5" style={{ color: 'var(--success)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--success)' }}>Bugungi ro'yxat</span>
        </Link>
      </div>

      {/* Recent patients */}
      {today.length > 0 && (
        <div className="card p-0">
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="accent-value font-semibold">So'nggi mijozlar</h2>
            <Link
              to="/admin/today"
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--gold)' }}
            >
              Barchasi →
            </Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head border-b">
                  <th className="p-2 text-left">Sana</th>
                  <th className="p-2 text-left">Mijoz</th>
                  <th className="p-2 text-left">Xizmat</th>
                  <th className="p-2 text-left">To'lov</th>
                  <th className="p-2 text-left">Summa</th>
                </tr>
              </thead>
              <tbody>
                {today.slice(0, 8).map((p) => (
                  <tr key={p.id} className={`border-b ${p.is_cancelled ? 'row-cancelled' : 'table-row'}`}>
                    <td className="p-2 text-muted">{formatDate(p.created_at)}</td>
                    <td className="p-2 font-medium">{p.first_name} {p.last_name}</td>
                    <td className="p-2">{p.service_name}</td>
                    <td className="p-2">{paymentLabel(p.payment_type)}</td>
                    <td className="p-2 accent-value">{formatMoney(p.payment_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
