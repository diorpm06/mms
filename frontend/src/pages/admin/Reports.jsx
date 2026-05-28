import { useCallback, useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { hasPositiveValues, paymentPieData, truncateLabel } from '../../utils/charts'
import { useTheme } from '../../hooks/useTheme'
import { useToastStore } from '../../store/toastStore'

const PIE_COLORS = ['#D4AF37', '#22C55E']

export default function AdminReports() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [autoAdjusted, setAutoAdjusted] = useState(false)
  const { chartAxis, chartGrid, chartGold } = useTheme()
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

  const stats = [
    { label: 'Mijozlar keldi', value: `${report.patients_count} nafar` },
    { label: 'Yangi / Qayta', value: `${report.new_patients} / ${report.repeat_patients}` },
    { label: 'Jami tushgan mablag', value: formatMoney(report.total_income) },
    { label: 'Naqt', value: formatMoney(report.cash) },
    { label: 'Karta', value: formatMoney(report.card) },
    { label: 'Harajatlar', value: formatMoney(report.expenses) },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-muted text-sm">{s.label}</p>
            <p className="accent-value mt-2 text-xl">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card min-h-[280px]">
          <h3 className="text-body mb-3 font-semibold">Naqt / Karta</h3>
          {hasPositiveValues(pieData) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={62}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted py-12 text-center text-sm">To'lov ma'lumoti yo'q</p>
          )}
        </div>
        <div className="card min-h-[280px]">
          <h3 className="text-body mb-3 font-semibold">Xizmatlar bo'yicha</h3>
          {hasPositiveValues(services, 'total') ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={services} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis
                  dataKey="name"
                  stroke={chartAxis}
                  tick={{ fill: chartAxis, fontSize: 10 }}
                  tickFormatter={(v) => truncateLabel(v, 10)}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis stroke={chartAxis} tick={{ fill: chartAxis, fontSize: 10 }} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Bar dataKey="total" fill={chartGold} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted py-12 text-center text-sm">Xizmat ma'lumoti yo'q</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="accent-value mb-3 font-semibold">Qaysi xizmatlardan foydalanildi</h3>
        {services.length === 0 ? (
          <p className="text-muted text-sm">—</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {services.map((s, i) => (
              <li key={i} className="text-body flex justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                <span>{s.name} — {s.count} ta mijoz</span>
                <span className="accent-value">{formatMoney(s.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
