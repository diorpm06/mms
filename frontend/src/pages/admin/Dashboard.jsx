import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'
import { CardSkeleton } from '../../components/Skeleton'
import {
  Users,
  TrendingUp,
  CreditCard,
  Plus,
  Search,
  List,
  Wallet,
  ArrowDownRight,
  Landmark,
  Smartphone,
} from 'lucide-react'

// Mahalliy sana. new Date().toISOString() UTC beradi — Toshkent vaqti bilan
// yarim tundan ertalab 5 gacha KECHAGI kunni so'rab qolardi.
function bugun() {
  const d = new Date()
  const oy = String(d.getMonth() + 1).padStart(2, '0')
  const kun = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${oy}-${kun}`
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [today, setToday] = useState([])
  const [xato, setXato] = useState(false)

  const load = useCallback(() => {
    setXato(false)
    api(`/reports/admin-summary?date=${bugun()}`)
      .then((res) => {
        setData(res)
        setXato(false)
      })
      .catch(() => setXato(true))
    api('/patients/today').then(setToday).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="text-muted mt-1 text-sm">
            Bugungi hisob-kitoblar — {new Date().toLocaleDateString('uz-UZ')}
            {xato && data && (
              <span className="ml-2 text-[11px] font-bold text-amber-400">
                • yangilanmadi, oxirgi ma'lumot ko'rsatilyapti
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="my-6">
        {!data && xato ? (
          // Birinchi yuklash ham muvaffaqiyatsiz bo'lsa, skelet abadiy
          // aylanib turmasin — sababi ko'rsatilib, qayta urinish beriladi.
          <div className="card p-6 text-center space-y-3">
            <p className="text-sm font-bold text-body">
              Hisob-kitoblar yuklanmadi
            </p>
            <p className="text-xs text-muted">
              Server javob bermadi. Internet aloqasini tekshiring.
            </p>
            <button type="button" onClick={load} className="btn-gold text-sm px-4 py-2">
              Qayta urinish
            </button>
          </div>
        ) : !data ? (
          <CardSkeleton count={7} />
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {/* Card 1: Mijozlar */}
            <div className="stat-card border border-cyan-500/20 bg-cyan-500/5 flex flex-col justify-between p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide truncate">
                    Mijozlar
                  </p>
                  <p className="mt-2 text-2xl font-black text-body font-mono">
                    {data.patients_count}{' '}
                    <span className="text-xs text-muted font-normal">nafar</span>
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-cyan-500/15 text-cyan shrink-0">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 2: Bugungi Jami Daromad (Tushum) */}
            <div className="stat-card border border-emerald/30 bg-emerald/5 flex flex-col justify-between p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide truncate" title="Jami Tushum">
                    📈 Jami Tushum
                  </p>
                  <p className="mt-2 text-base xl:text-lg font-black font-mono text-emerald truncate" title={formatMoney(data.total_income)}>
                    {formatMoney(data.total_income)}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-emerald/15 text-emerald shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted">Navbatchilik:</span>
                <span className="font-bold text-amber-400">
                  {formatMoney(data.paper_entry_total || data.paper_income || 0)}
                </span>
              </div>
            </div>

            {/* Card 3: Naqd Tushum */}
            <div className="stat-card border border-gold/30 bg-gold/5 flex flex-col justify-between p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide truncate" title="Naqd Tushum">
                    💵 Naqd Tushum
                  </p>
                  <p className="mt-2 text-base xl:text-lg font-black font-mono text-gold truncate" title={formatMoney(data.cash)}>
                    {formatMoney(data.cash)}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-gold/15 text-gold shrink-0">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 4: Karta / QR Tushum */}
            <div className="stat-card border border-info/30 bg-info/5 flex flex-col justify-between p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide truncate" title="Karta / QR Tushum">
                    💳 Karta / QR
                  </p>
                  <p className="mt-2 text-base xl:text-lg font-black font-mono text-info truncate" title={formatMoney((data.card || 0) + (data.qr || 0))}>
                    {formatMoney((data.card || 0) + (data.qr || 0))}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-info/15 text-info shrink-0">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 5: Click / Payme Tushum */}
            <div className="stat-card border border-cyan-500/30 bg-cyan-500/5 flex flex-col justify-between p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide truncate" title="Click / Payme Tushum">
                    📱 Click / Payme
                  </p>
                  <p className="mt-2 text-base xl:text-lg font-black font-mono text-cyan-400 truncate" title={formatMoney(data.click || 0)}>
                    {formatMoney(data.click || 0)}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-cyan-500/15 text-cyan-400 shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 6: Jami Harajatlar */}
            <div className="stat-card border border-rose-500/30 bg-rose-500/5 flex flex-col justify-between p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide truncate" title="Harajatlar">
                    💸 Harajatlar
                  </p>
                  <p className="mt-2 text-base xl:text-lg font-black font-mono text-rose-400 truncate" title={`-${formatMoney(data.expenses)}`}>
                    -{formatMoney(data.expenses)}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-rose-500/15 text-rose-400 shrink-0">
                  <ArrowDownRight className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-rose-500/20 flex flex-col gap-0.5 text-[10px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Naqd:</span>
                  <span className="font-bold text-rose-300">{formatMoney(data.cash_expenses || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Karta:</span>
                  <span className="font-bold text-rose-300">{formatMoney(data.card_expenses || 0)}</span>
                </div>
              </div>
            </div>

            {/* Card 7: Kassada Qolgan Pul (Net Balance) */}
            <div className="stat-card border-2 border-emerald bg-emerald/10 flex flex-col justify-between p-3.5 rounded-2xl shadow-lg">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-emerald text-[11px] font-black uppercase tracking-wide truncate" title="Kassada Qolgan">
                    🏦 Kassada Qolgan
                  </p>
                  <p className="mt-2 text-base xl:text-lg font-black font-mono text-emerald truncate" title={formatMoney(data.net_total ?? Math.max(0, data.total_income - data.expenses))}>
                    {formatMoney(
                      data.net_total ?? Math.max(0, data.total_income - data.expenses)
                    )}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-emerald/20 text-emerald shrink-0">
                  <Landmark className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-emerald-500/30 flex justify-between items-center text-[10px] text-emerald font-mono font-bold">
                <span className="text-emerald/80">Naqdda:</span>
                <span>{formatMoney(data.net_cash ?? Math.max(0, data.cash - (data.cash_expenses || 0)))}</span>
              </div>
            </div>
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
          <div
            className="rounded-xl p-2.5"
            style={{ background: 'var(--gold-dim)' }}
          >
            <Plus className="h-5 w-5" style={{ color: 'var(--gold)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--gold)' }}>
            Yangi mijoz
          </span>
        </Link>
        <Link
          to="/admin/search"
          className="card flex items-center gap-3 transition-all"
        >
          <div
            className="rounded-xl p-2.5"
            style={{ background: 'rgba(59,130,246,0.12)' }}
          >
            <Search className="h-5 w-5" style={{ color: 'var(--info)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--info)' }}>
            Qidirish
          </span>
        </Link>
        <Link
          to="/admin/today"
          className="card flex items-center gap-3 transition-all"
        >
          <div
            className="rounded-xl p-2.5"
            style={{ background: 'rgba(16,185,129,0.12)' }}
          >
            <List className="h-5 w-5" style={{ color: 'var(--success)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--success)' }}>
            Bugungi ro'yxat
          </span>
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
                  <tr
                    key={p.id}
                    className={`border-b ${
                      p.is_cancelled ? 'row-cancelled' : 'table-row'
                    }`}
                  >
                    <td className="p-2 text-muted">{formatDate(p.created_at)}</td>
                    <td className="p-2 font-medium">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="p-2">{p.service_name}</td>
                    <td className="p-2">{paymentLabel(p.payment_type)}</td>
                    <td className="p-2 accent-value">
                      {formatMoney(p.payment_amount)}
                    </td>
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
