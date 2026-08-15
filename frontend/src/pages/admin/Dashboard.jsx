import { DollarSign, Wallet, ArrowDownRight, CheckCircle2 } from 'lucide-react'

export default function AdminDashboard() {
  const [data,  setData]  = useState(null)
  const [today, setToday] = useState([])

  const load = useCallback(() => {
    const d = new Date().toISOString().slice(0, 10)
    api(`/reports/admin-daily?date=${d}`)
      .then(setData)
      .catch(() => setData({ patients_count: 0, total_income: 0, cash: 0, card: 0, expenses: 0 }))
    api('/patients/today').then(setToday)
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
          <p className="text-muted mt-1 text-sm">Bugungi ma'lumotlar — {new Date().toLocaleDateString('uz-UZ')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="my-6">
        {!data ? (
          <CardSkeleton count={5} />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {/* Card 1: Mijozlar */}
            <div className="stat-card border border-cyan-500/20 bg-cyan-500/5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide">Mijozlar</p>
                  <p className="mt-2 text-2xl font-black text-body font-mono">{data.patients_count} <span className="text-xs text-muted font-normal">nafar</span></p>
                </div>
                <div className="rounded-xl p-2 bg-cyan-500/15 text-cyan">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 2: Naqd tushum */}
            <div className="stat-card border border-gold/30 bg-gold/5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide">💵 Naqd Tushum</p>
                  <p className="mt-2 text-xl font-black font-mono text-gold">{formatMoney(data.cash)}</p>
                </div>
                <div className="rounded-xl p-2 bg-gold/15 text-gold">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 3: Karta & Click tushum */}
            <div className="stat-card border border-info/30 bg-info/5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide">💳 Karta / Click</p>
                  <p className="mt-2 text-xl font-black font-mono text-info">{formatMoney((data.card || 0) + (data.click || 0) + (data.qr || 0))}</p>
                  <p className="text-[10px] text-muted font-mono mt-1">
                    Karta: {formatMoney(data.card)} · Click: {formatMoney(data.click || 0)}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-info/15 text-info">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 4: Jami Harajatlar */}
            <div className="stat-card border border-rose-500/30 bg-rose-500/5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted text-[11px] font-extrabold uppercase tracking-wide">💸 Jami Harajatlar</p>
                  <p className="mt-2 text-xl font-black font-mono text-rose-400">-{formatMoney(data.expenses)}</p>
                  <p className="text-[10px] text-muted font-mono mt-1">
                    Naqd: {formatMoney(data.cash_expenses || 0)} · Karta: {formatMoney(data.card_expenses || 0)}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-rose-500/15 text-rose-400">
                  <ArrowDownRight className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Card 5: Qolgan Sof Summa */}
            <div className="stat-card border border-emerald/40 bg-emerald/10 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-emerald text-[11px] font-black uppercase tracking-wide">🏦 Qolgan Summa</p>
                  <p className="mt-2 text-xl font-black font-mono text-emerald">{formatMoney(data.net_total ?? Math.max(0, data.total_income - data.expenses))}</p>
                  <p className="text-[10px] text-emerald/80 font-mono font-bold mt-1">
                    Naqd: {formatMoney(data.net_cash ?? Math.max(0, data.cash - (data.cash_expenses || 0)))} · Karta: {formatMoney(data.net_card ?? Math.max(0, (data.card + (data.click || 0)) - (data.card_expenses || 0)))}
                  </p>
                </div>
                <div className="rounded-xl p-2 bg-emerald/20 text-emerald">
                  <TrendingUp className="h-5 w-5" />
                </div>
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
