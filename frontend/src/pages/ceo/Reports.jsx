import { useEffect, useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, downloadBlob } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { hasPositiveValues, paymentPieData, formatYAxis, moneyFormatter, truncateLabel } from '../../utils/charts'
import { exportToExcel, exportToPdf } from '../../utils/exportUtils'

const TABS = [
  { id: 'daily',   label: 'Kunlik' },
  { id: 'weekly',  label: 'Haftalik' },
  { id: 'monthly', label: 'Oylik' },
  { id: 'yearly',  label: 'Yillik' },
  { id: 'custom',  label: 'Maxsus' },
]

const FINANCE_COLORS = ['#d4af37', '#3b82f6', '#a855f7', '#10b981', '#ef4444', '#059669']

export default function CeoReports() {
  const { chartAxis, chartGrid, chartGold, chartColors, tooltipStyle } = useTheme()
  const [tab,   setTab]   = useState('daily')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [date,  setDate]  = useState(new Date().toISOString().slice(0, 10))
  const [year,  setYear]  = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [from,  setFrom]  = useState('')
  const [to,    setTo]    = useState('')

  const load = async () => {
    setLoading(true)
    try {
      let path = ''
      if (tab === 'daily')   path = `/reports/daily?date=${date}`
      else if (tab === 'weekly')  path = `/reports/weekly?date=${date}`
      else if (tab === 'monthly') path = `/reports/monthly?year=${year}&month=${month}`
      else if (tab === 'yearly')  path = `/reports/yearly?year=${year}`
      else path = `/reports/custom?from=${from}&to=${to}`
      setReport(await api(path))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab !== 'custom' || (from && to)) load()
  }, [tab, date, year, month])

  const exportFile = async (fmt) => {
    try {
      const p = new URLSearchParams({ type: tab })
      if (tab === 'daily' || tab === 'weekly') p.set('date', date)
      if (tab === 'monthly') { p.set('year', year); p.set('month', month) }
      if (tab === 'yearly') p.set('year', year)
      if (tab === 'custom') { p.set('from', from); p.set('to', to) }
      const blob = await api(`/reports/export/${fmt}?${p}`)
      downloadBlob(blob, `hisobot.${fmt === 'excel' ? 'xlsx' : 'pdf'}`)
    } catch (e) {
      if (fmt === 'excel') handleClientExcelExport()
      else handleClientPdfExport()
    }
  }

  const handleClientExcelExport = () => {
    if (!report) return
    const exportData = [
      { Parametr: 'Jami daromad', Qiymat: report.total_income },
      { Parametr: 'Naqt', Qiymat: report.cash },
      { Parametr: 'Karta', Qiymat: report.card },
      { Parametr: 'Yo\'naltiruvchi ulushi', Qiymat: report.referrer_share },
      { Parametr: 'Shifokor ulushi', Qiymat: report.provider_share },
      { Parametr: 'Klinika ulushi', Qiymat: report.center_share },
      { Parametr: 'Harajatlar', Qiymat: report.expenses },
      { Parametr: 'Sof foyda', Qiymat: report.net_profit },
      { Parametr: 'Joriy balans', Qiymat: report.current_balance },
      { Parametr: 'Jami mijozlar', Qiymat: report.patients_count },
    ]
    exportToExcel(exportData, `Moliyaviy_Hisobot_${tab}`)
  }

  const handleClientPdfExport = () => {
    if (!report) return
    const exportData = [
      { name: 'Jami daromad', val: formatMoney(report.total_income) },
      { name: 'Naqt', val: formatMoney(report.cash) },
      { name: 'Karta', val: formatMoney(report.card) },
      { name: 'Yo\'naltiruvchilar ulushi', val: formatMoney(report.referrer_share) },
      { name: 'Shifokorlar ulushi', val: formatMoney(report.provider_share) },
      { name: 'Klinika ulushi', val: formatMoney(report.center_share) },
      { name: 'Harajatlar', val: formatMoney(report.expenses) },
      { name: 'Sof foyda', val: formatMoney(report.net_profit) },
      { name: 'Joriy balans', val: formatMoney(report.current_balance) },
    ]
    const columns = [
      { header: 'Ko\'rsatkich Nomi', accessor: (r) => r.name },
      { header: 'Qiymati', accessor: (r) => r.val },
    ]
    exportToPdf(`Moliyaviy Hisobot (${tab.toUpperCase()})`, exportData, columns)
  }

  const NoData = ({ text = "Ma'lumot yo'q" }) => (
    <div className="flex h-48 items-center justify-center">
      <p className="text-muted text-sm">{text}</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title mb-1">Hisobotlar</h1>
          <p className="text-muted text-sm">Marjona Med Service — moliyaviy hisobot</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline py-2 text-sm" onClick={() => exportFile('excel')}>
            Excel
          </button>
          <button type="button" className="btn-outline py-2 text-sm" onClick={() => exportFile('pdf')}>
            PDF
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card mb-4 flex flex-wrap gap-1.5 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date pickers */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(tab === 'daily' || tab === 'weekly') && (
          <input type="date" className="input-field max-w-[180px]" value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        {(tab === 'monthly' || tab === 'yearly') && (
          <>
            <input type="number" className="input-field max-w-[100px]" value={year} onChange={(e) => setYear(+e.target.value)} />
            {tab === 'monthly' && (
              <input type="number" min={1} max={12} className="input-field max-w-[80px]" value={month} onChange={(e) => setMonth(+e.target.value)} />
            )}
          </>
        )}
        {tab === 'custom' && (
          <>
            <input type="date" className="input-field max-w-[180px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="input-field max-w-[180px]" value={to}   onChange={(e) => setTo(e.target.value)} />
            <button type="button" className="btn-gold" onClick={load}>Ko'rsatish</button>
          </>
        )}
      </div>

      {!report ? (
        <div className="card flex h-40 items-center justify-center">
          <p className="text-muted">{loading ? 'Yuklanmoqda...' : "Yuqoridan davr tanlang"}</p>
        </div>
      ) : (
        <>
          {/* Stat summary */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Jami daromad',   value: formatMoney(report.total_income),  color: 'var(--success)' },
              { label: 'Naqt',           value: formatMoney(report.cash),           color: 'var(--gold)' },
              { label: 'Karta',          value: formatMoney(report.card),           color: 'var(--info)' },
              { label: 'Sof foyda',      value: formatMoney(report.net_profit),     color: report.net_profit >= 0 ? 'var(--success)' : 'var(--danger)' },
            ].map((c) => (
              <div key={c.label} className="stat-card">
                <p className="text-muted text-xs uppercase tracking-wide">{c.label}</p>
                <p className="mt-2 text-lg font-bold" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Charts row 1 */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {/* Income dynamics */}
            <div className="card">
              <h3 className="text-body mb-4 font-semibold">Daromad dinamikasi</h3>
              {hasPositiveValues(report.income_chart || [], 'income') ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.income_chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                      <XAxis dataKey="date" stroke={chartAxis} tick={{ fill: chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis stroke={chartAxis} tick={{ fill: chartAxis, fontSize: 11 }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} width={44} />
                      <Tooltip formatter={(v) => [moneyFormatter(v), 'Daromad']} contentStyle={tooltipStyle} />
                      <Line
                        type="monotone"
                        dataKey="income"
                        stroke={chartGold}
                        strokeWidth={2.5}
                        dot={{ fill: chartGold, r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <NoData />}
            </div>

            {/* Cash / Card pie */}
            <div className="card">
              <h3 className="text-body mb-4 font-semibold">Naqt / Karta</h3>
              {hasPositiveValues(paymentPieData(report.cash, report.card, report.payment_chart)) ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                      <Pie
                        data={paymentPieData(report.cash, report.card, report.payment_chart)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={62}
                        innerRadius={36}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {paymentPieData(report.cash, report.card, report.payment_chart).map((_, i) => (
                          <Cell key={i} fill={chartColors[i % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => moneyFormatter(v)} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <NoData />}
            </div>
          </div>

          {/* Finance breakdown bar chart */}
          <div className="card mb-6">
            <h3 className="text-body mb-4 font-semibold">Mablag' taqsimoti</h3>
            {(report.finance_chart || []).filter((d) => d.value !== 0).length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(report.finance_chart || []).filter((d) => d.value !== 0)}
                    margin={{ top: 10, right: 10, bottom: 50, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={chartAxis}
                      tick={{ fill: chartAxis, fontSize: 10, fontWeight: 'bold' }}
                      tickFormatter={(v) => truncateLabel(v, 20)}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={55}
                    />
                    <YAxis
                      stroke={chartAxis}
                      tick={{ fill: chartAxis, fontSize: 11 }}
                      tickFormatter={formatYAxis}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip formatter={(v) => [moneyFormatter(v), '']} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {(report.finance_chart || []).filter((d) => d.value !== 0).map((_, i) => (
                        <Cell key={i} fill={FINANCE_COLORS[i % FINANCE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <NoData />}
          </div>

          {/* Bottom info cards */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Patients */}
            <div className="card">
              <h3 className="accent-value mb-4 font-semibold">Mijozlar statistikasi</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Jami',     report.patients_count,   'var(--text)'],
                  ['Yangi',    report.new_patients,      'var(--success)'],
                  ['Qaytgan',  report.repeat_patients,   'var(--info)'],
                  ['Naqt',     formatMoney(report.cash), 'var(--gold)'],
                ].map(([label, val, color]) => (
                  <div key={label} className="card-2 rounded-xl p-3">
                    <p className="text-muted text-xs">{label}</p>
                    <p className="mt-1 font-bold" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Finance */}
            <div className="card">
              <h3 className="accent-value mb-4 font-semibold">Moliyaviy xulosa</h3>
              <p className="text-muted mb-3 text-xs">
                Markaz ulushi = Jami tushgan − Yo'naltiruvchi hissi − Xizmat ko'rsatuvchi hissi.
              </p>
              <div className="space-y-2 text-sm">
                {[
                  ['Jami tushgan',           formatMoney(report.total_income),   'var(--success)'],
                  ["Yo'naltiruvchilar hissi (jami)",  formatMoney(report.referrer_share), 'var(--info)'],
                  ["Xizmat ko'rs. ulushi",   formatMoney(report.provider_share), 'var(--info)'],
                  ['Markaz ulushi (klinika)', formatMoney(report.center_share),   'var(--gold)'],
                  ['Harajatlar',             formatMoney(report.expenses),        'var(--danger)'],
                  ['Sof foyda',              formatMoney(report.net_profit),      report.net_profit >= 0 ? 'var(--success)' : 'var(--danger)'],
                ].map(([label, val, color]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold" style={{ color }}>{val}</span>
                  </div>
                ))}
                <div className="divider mt-2 mb-1" />
                <div className="flex items-center justify-between">
                  <span className="text-muted text-xs">Joriy balans</span>
                  <span className="accent-value text-sm">{formatMoney(report.current_balance)}</span>
                </div>
              </div>
              <div className="divider my-3" />
              <div>
                <p className="text-muted mb-2 text-xs">Yo'naltiruvchi hissi kimlarga ketgani:</p>
                {(report.referrers_breakdown || []).length === 0 ? (
                  <p className="text-muted text-sm">Yo'naltiruvchi yo'q</p>
                ) : (
                  <ul className="max-h-36 space-y-1 overflow-y-auto pr-1 text-sm">
                    {report.referrers_breakdown.map((r, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-body">{r.name} ({r.count} ta)</span>
                        <span className="accent-value">{formatMoney(r.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Yotganlar */}
            <div className="card">
              <h3 className="accent-value mb-4 font-semibold">Yotgan bemorlar</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Yotmoqda',   report.active_inpatients,       'var(--info)'],
                  ['Chiqdi',     report.discharged_today,         'var(--success)'],
                  ['Daromad',    formatMoney(report.inpatient_income), 'var(--gold)'],
                ].map(([label, val, color]) => (
                  <div key={label} className="card-2 rounded-xl p-3 text-center">
                    <p className="text-muted text-xs">{label}</p>
                    <p className="mt-1 font-bold text-lg" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Xizmatlar */}
            <div className="card">
              <h3 className="accent-value mb-4 font-semibold">Xizmatlar</h3>
              {(report.services_breakdown || []).length === 0 ? (
                <p className="text-muted text-sm">Ma'lumot yo'q</p>
              ) : (
                <ul className="max-h-44 space-y-1.5 overflow-y-auto text-sm pr-1">
                  {report.services_breakdown.map((s, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-body truncate mr-2">{s.name}: <span className="text-muted">{s.count} ta</span></span>
                      <span className="accent-value shrink-0">{formatMoney(s.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
