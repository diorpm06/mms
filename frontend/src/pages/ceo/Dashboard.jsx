import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { RefreshCw, TrendingUp, Wallet, Users, Receipt } from 'lucide-react'
import { api, downloadBlob } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { formatYAxis, moneyFormatter } from '../../utils/charts'
import { CardSkeleton } from '../../components/Skeleton'
import { useTheme } from '../../hooks/useTheme'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons } from '../../components/UIKit'
import Modal from '../../components/Modal'
import PeakHeatmapChart from '../../components/PeakHeatmapChart'

const EMPTY = {
  daily_income: 0, current_balance: 0,
  today_patients: 0, month_expenses: 0,
  income_chart: [], top_services: [], top_referrers: [],
}

const CARD_ICONS = [TrendingUp, Wallet, Users, Receipt]
const CARD_COLORS = ['var(--success)', 'var(--gold)', 'var(--info)', 'var(--danger)']

export default function CeoDashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [referrerModal, setReferrerModal] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const location = useLocation()
  const { chartAxis, chartGrid, chartGold, chartColors, tooltipStyle } = useTheme()
  const toast = useToastStore((s) => s.add)

  const handleDownloadDailyPdf = async () => {
    setDownloadingPdf(true)
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const blob = await api(`/reports/export/pdf?type=daily&date=${todayStr}`)
      downloadBlob(blob, `Kunlik_Hisobot_${todayStr}.pdf`)
      toast("✓ Kunlik PDF Hisobot yuklab olindi!")
    } catch (e) {
      toast(e.message || "PDF hisobot yuklashda xatolik", 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const [chartPeriod, setChartPeriod] = useState('7days') // '7days' | '1-10' | '11-20' | '21-30'
  const [chartData, setChartData]     = useState([])

  const loadChart = useCallback(async (period) => {
    try {
      const data = await api(`/reports/period-chart?period=${period}`)
      setChartData(data || [])
    } catch (_) {}
  }, [])

  useEffect(() => {
    loadChart(chartPeriod)
  }, [chartPeriod, loadChart])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [res, forecastData] = await Promise.all([
        api('/reports/dashboard'),
        api('/reports/analytics/forecast').catch(() => null),
      ])
      setData({
        ...EMPTY, ...res,
        income_chart:  res.income_chart  || [],
        top_services:  res.top_services  || [],
        top_referrers: res.top_referrers || [],
        last_activity: res.last_activity || null,
      })
      if (chartPeriod === '7days' && res.income_chart) {
        setChartData(res.income_chart)
      }
      if (forecastData) setAnalytics(forecastData)
      setLastUpdate(new Date())
    } catch (e) {
      if (!silent) toast(e.message || 'Dashboard yuklanmadi', 'error')
      setData(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [toast, chartPeriod])

  useEffect(() => { load() }, [location.pathname, load])
  useEffect(() => {
    const t = setInterval(() => load(true), 30_000)
    return () => clearInterval(t)
  }, [load])
  useEffect(() => {
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  if (loading && !data) {
    return (
      <div>
        <h1 className="page-title mb-6">Rahbar Dashboard</h1>
        <CardSkeleton count={4} />
      </div>
    )
  }

  const d = data || EMPTY
  const cards = [
    { label: 'Kunlik daromad',      value: formatMoney(d.daily_income),    icon: CARD_ICONS[0], color: CARD_COLORS[0] },
    { label: 'Jami balans',         value: formatMoney(d.current_balance), icon: CARD_ICONS[1], color: CARD_COLORS[1] },
    { label: 'Bugungi mijozlar',    value: d.today_patients,               icon: CARD_ICONS[2], color: CARD_COLORS[2] },
    { label: 'Harajatlar (bu oy)',  value: formatMoney(d.month_expenses),  icon: CARD_ICONS[3], color: CARD_COLORS[3] },
  ]

  const openReferrerDetails = async (referrer) => {
    try {
      setReferrerModal(referrer)
      const rows = await api(`/reports/referrer-details/${referrer.id}`)
      setReferrerDetails(rows)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Rahbar Dashboard</h1>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-muted text-xs hidden sm:block">
              Yangilangan: {lastUpdate.toLocaleTimeString('uz-UZ')}
            </span>
          )}
          <Btn variant="gold" size="sm" icon={Icons.printer} loading={downloadingPdf} onClick={handleDownloadDailyPdf}>
            Kunlik PDF Hisobot
          </Btn>
          <button
            type="button"
            className="btn-outline flex items-center gap-2 py-2 text-sm"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yangilash</span>
          </button>
        </div>
      </div>

      {/* Last activity notice */}
      {d.last_activity && d.today_patients === 0 && d.daily_income === 0 && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--gold)', background: 'var(--gold-dim)' }}
        >
          Bugun hali to'lov yo'q. Oxirgi faol kun ({d.last_activity.date_label}):{' '}
          <strong style={{ color: 'var(--gold)' }}>{formatMoney(d.last_activity.income)}</strong>,{' '}
          {d.last_activity.patients} mijoz.
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted text-xs font-medium uppercase tracking-wide">{c.label}</p>
                  <p className="mt-2 text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
                </div>
                <div
                  className="rounded-xl p-2.5"
                  style={{ background: `${c.color}18` }}
                >
                  <Icon className="h-5 w-5" style={{ color: c.color }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Income chart with Dekada Periods (Rasm 2) */}
      <div className="card mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body font-bold text-base">
            {chartPeriod === '7days' && "So'nggi 7 kunlik daromad charti"}
            {chartPeriod === '1-10'  && "1–10 Avgust Daromad Hisoboti (1-Dekada)"}
            {chartPeriod === '11-20' && "11–20 Avgust Daromad Hisoboti (2-Dekada)"}
            {chartPeriod === '21-30' && "21–30 Avgust Daromad Hisoboti (3-Dekada)"}
          </h2>

          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
            {[
              { id: '7days', label: '7 kunlik' },
              { id: '1-10',  label: '1–10 kun' },
              { id: '11-20', label: '11–20 kun' },
              { id: '21-30', label: '21–30 kun' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartPeriod(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  chartPeriod === tab.id
                    ? 'bg-gold text-slate-950 shadow'
                    : 'text-muted hover:text-body'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.length > 0 ? chartData : d.income_chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={chartAxis}
                tick={{ fill: chartAxis, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke={chartAxis}
                tick={{ fill: chartAxis, fontSize: 11 }}
                tickFormatter={formatYAxis}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                formatter={(v) => [moneyFormatter(v), 'Daromad']}
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--gold-dim)' }}
              />
              <Bar dataKey="income" fill={chartGold} radius={[6, 6, 0, 0]}>
                {(chartData.length > 0 ? chartData : d.income_chart).map((_, i, arr) => (
                  <Cell
                    key={i}
                    fill={i === arr.length - 1 ? chartGold : `${chartGold}99`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analytics Forecast & Peak Hours Heatmap */}
      {analytics && (
        <div className="mb-6">
          <PeakHeatmapChart
            heatmap={analytics.heatmap}
            busiestHour={analytics.busiest_hour}
            avgDailyRevenue={analytics.avg_daily_revenue}
            projectedNext30Days={analytics.projected_next_30_days}
          />
        </div>
      )}

      {/* Top cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="accent-value mb-4 font-bold text-base">Top 5 bo'lim (Tushum bo'yicha)</h2>
          {d.top_services.length === 0 ? (
            <p className="text-muted text-sm">Ma'lumot yo'q</p>
          ) : (
            <ul className="space-y-3">
              {d.top_services.map((s, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-body font-bold">{s.name}</span>
                    <span className="text-xs text-muted font-mono">({s.count} ta qabul)</span>
                  </div>
                  <span className="accent-value font-mono font-black">{formatMoney(s.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="accent-value mb-4 font-semibold">Top 5 yo'naltiruvchi</h2>
          {d.top_referrers.length === 0 ? (
            <p className="text-muted text-sm">Ma'lumot yo'q</p>
          ) : (
            <ul className="space-y-3">
              {d.top_referrers.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}
                    >
                      {i + 1}
                    </span>
                    <button type="button" className="text-body hover:text-gold text-left" onClick={() => openReferrerDetails(r)}>
                      {r.name}: {r.count ?? 0} ta
                    </button>
                  </div>
                  <span className="accent-value">{formatMoney(r.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Modal open={!!referrerModal} onClose={() => setReferrerModal(null)} title="Yo'naltiruvchi tafsiloti">
        {referrerModal && (
          <div>
            <p className="mb-3 text-sm">
              <b>{referrerModal.name}</b> — jami: <span className="text-gold">{formatMoney(referrerModal.total)}</span>
            </p>
            <div className="max-h-80 overflow-y-auto">
              {referrerDetails.length === 0 ? (
                <p className="text-muted text-sm">Ma'lumot topilmadi</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {referrerDetails.map((d) => (
                    <li key={`${d.patient_id}-${d.created_at}`} className="card-2">
                      <p className="font-semibold">{d.patient_name}</p>
                      <p className="text-muted">Xizmat: {d.service_name}</p>
                      <p className="text-muted">Xizmat ko'rsatuvchi: {d.provider_name}</p>
                      <p>
                        Foiz: <b>{d.referrer_percent}%</b> | Ulushi: <b className="text-gold">{formatMoney(d.referrer_amount)}</b> | Jami: {formatMoney(d.total_amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
