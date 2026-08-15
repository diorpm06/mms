import { useCallback, useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { hasPositiveValues, paymentPieData, truncateLabel, formatYAxis } from '../../utils/charts'
import { useTheme } from '../../hooks/useTheme'
import { useToastStore } from '../../store/toastStore'

const PIE_COLORS = ['#D4AF37', '#22C55E']

export default function AdminReports() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [autoAdjusted, setAutoAdjusted] = useState(false)
  const { chartAxis, chartGrid, chartGold, tooltipStyle } = useTheme()
  const toast = useToastStore((s) => s.add)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api(`/reports/admin-daily?date=${date}`)
      if (
        !autoAdjusted
        && res.suggested_date
        && res.patients_count === 0
        && res.total_income === 0
      ) {
        setAutoAdjusted(true)
        setDate(res.suggested_date)
        toast(`Bugun ma'lumot yo'q. Oxirgi kun ko'rsatildi: ${res.suggested_date}`, 'info')
        return
      }
      setReport(res)
    } catch (e) {
      toast(e.message || 'Hisobot yuklanmadi', 'error')
    } finally {
      setLoading(false)
    }
  }, [date, toast, autoAdjusted])

  useEffect(() => {
    load()
  }, [load])

  if (!report && loading) {
    return <p className="text-muted">Yuklanmoqda...</p>
  }

  if (!report) {
    return (
      <div>
        <h1 className="page-title mb-4">Kunlik hisobot</h1>
        <button type="button" className="btn-gold" onClick={load}>Qayta yuklash</button>
      </div>
    )
  }

  const pieData = paymentPieData(report.cash, report.card, report.payment_chart)
  const services = report.services_breakdown || []

  // Top 8 services for clean, non-overlapping chart display
  const topServicesForChart = [...services]
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 8)

  const stats = [
    { label: 'Mijozlar keldi', value: `${report.patients_count} nafar` },
    { label: 'Yangi / Qayta', value: `${report.new_patients} / ${report.repeat_patients}` },
    { label: 'Xizmatlar to\'liq summasi', value: formatMoney(report.gross_income ?? report.total_income) },
    { label: 'Chegirmalar (-)', value: `-${formatMoney(report.total_discount || 0)}` },
    { label: 'Jami tushgan mablag\'', value: formatMoney(report.total_income) },
    { label: 'Naqd', value: formatMoney(report.cash) },
    { label: 'Karta', value: formatMoney(report.card) },
    { label: 'Harajatlar', value: formatMoney(report.expenses) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title mb-1">Kunlik hisobot</h1>
          <p className="text-muted text-sm">Mijozlar, xizmatlar, tushum va harajatlar</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            className="input-field max-w-[180px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="button" className="btn-gold flex items-center gap-2" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Ko'rsatish
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-muted text-sm">{s.label}</p>
            <p className="accent-value mt-2 text-xl font-mono font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        
        {/* Naqd / Karta Pie Chart */}
        <div className="card min-h-[320px]">
          <h3 className="text-body mb-3 font-bold text-sm uppercase tracking-wide">Naqd / Karta Taqsimoti</h3>
          {hasPositiveValues(pieData) ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted py-16 text-center text-sm italic">To'lov ma'lumoti yo'q</p>
          )}
        </div>

        {/* Xizmatlar Bo'yicha BarChart (Non-Overlapping) */}
        <div className="card min-h-[320px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-body font-bold text-sm uppercase tracking-wide">Top Xizmatlar bo'yicha (Daromad)</h3>
            <span className="text-[11px] text-muted font-bold">Top 8 ta xizmat</span>
          </div>

          {hasPositiveValues(topServicesForChart, 'total') ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topServicesForChart} margin={{ top: 10, right: 10, bottom: 55, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={chartAxis}
                  tick={{ fill: chartAxis, fontSize: 9.5, fontWeight: 'bold' }}
                  tickFormatter={(v) => truncateLabel(v, 20)}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                />
                <YAxis stroke={chartAxis} tick={{ fill: chartAxis, fontSize: 10 }} tickFormatter={formatYAxis} width={45} />
                <Tooltip formatter={(v) => [formatMoney(v), 'Daromad']} contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill={chartGold} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted py-16 text-center text-sm italic">Xizmat ma'lumoti yo'q</p>
          )}
        </div>

      </div>

      {/* Full Services Breakdown Table */}
      <div className="card">
        <h3 className="accent-value mb-4 font-bold text-sm uppercase tracking-wide">Barcha Xizmatlar Tushumi Ro'yxati</h3>
        {services.length === 0 ? (
          <p className="text-muted text-sm italic py-4 text-center">Ma'lumot topilmadi</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                  <th className="p-3">#</th>
                  <th className="p-3">Xizmat Nomi</th>
                  <th className="p-3 text-center">Mijozlar Soni</th>
                  <th className="p-3 text-right">Jami Tushum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {services.map((s, i) => (
                  <tr key={i} className="hover:bg-surface-hover font-semibold">
                    <td className="p-3 text-muted font-mono">#{i + 1}</td>
                    <td className="p-3 text-body font-bold">{s.name}</td>
                    <td className="p-3 text-center">
                      <span className="badge badge-info">{s.count} nafar</span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald">{formatMoney(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Berilgan chegirmalar — sababi bilan */}
      {(report.discounts || []).length > 0 && (
        <div className="card">
          <h3 className="text-amber-400 mb-1 font-bold text-sm uppercase tracking-wide">
            🏷️ Berilgan chegirmalar — {report.discounts.length} ta, jami {formatMoney(report.total_discount)}
          </h3>
          <p className="text-muted text-[11px] mb-3">
            Xizmatlar to'liq summasi {formatMoney(report.gross_income)} edi, chegirmadan keyin {formatMoney(report.total_income)} tushdi.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                  <th className="p-3">#</th>
                  <th className="p-3">Bemor</th>
                  <th className="p-3">Sababi</th>
                  <th className="p-3">Vaqt</th>
                  <th className="p-3 text-right">To'lagan</th>
                  <th className="p-3 text-right">Chegirma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.discounts.map((d, i) => (
                  <tr key={i} className="hover:bg-surface-hover font-semibold">
                    <td className="p-3 text-muted font-mono">#{i + 1}</td>
                    <td className="p-3 text-body font-bold">{d.patient_name}</td>
                    <td className="p-3 text-muted">{d.reason}</td>
                    <td className="p-3 font-mono text-muted">{d.date}</td>
                    <td className="p-3 text-right font-mono text-emerald">{formatMoney(d.paid)}</td>
                    <td className="p-3 text-right font-mono font-bold text-amber-400">-{formatMoney(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navbatchilikda (qog'oz jurnalidan) kiritilgan bemorlar — alohida ro'yxat */}
      {(report.paper_entry_count || 0) > 0 && (
        <div className="card">
          <h3 className="text-amber-400 mb-1 font-bold text-sm uppercase tracking-wide">
            📄 Navbatchilikda kiritilgan bemorlar — {report.paper_entry_count} ta, jami {formatMoney(report.paper_entry_total)}
          </h3>
          <p className="text-muted text-[11px] mb-3">Ish vaqtidan tashqari qog'ozga yozilib, keyin tizimga kiritilgan bemorlar. Yuqoridagi umumiy statistikaga allaqachon qo'shilgan.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                  <th className="p-3">#</th>
                  <th className="p-3">F.I.Sh</th>
                  <th className="p-3">Xizmat</th>
                  <th className="p-3">Vaqt</th>
                  <th className="p-3 text-right">Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.paper_entry_patients.map((p, i) => (
                  <tr key={p.id} className="hover:bg-surface-hover font-semibold">
                    <td className="p-3 text-muted font-mono">#{i + 1}</td>
                    <td className="p-3 text-body font-bold">{p.full_name}</td>
                    <td className="p-3 text-muted">{p.service_name}</td>
                    <td className="p-3 font-mono text-amber-400">{p.visit_time}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald">{formatMoney(p.amount)}</td>
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
