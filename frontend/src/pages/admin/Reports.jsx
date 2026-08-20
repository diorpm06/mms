import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { RefreshCw, Printer, Download } from 'lucide-react'
import { api, downloadBlob } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { hasPositiveValues, paymentPieData, truncateLabel, formatYAxis } from '../../utils/charts'
import { useTheme } from '../../hooks/useTheme'
import { useToastStore } from '../../store/toastStore'

const PIE_COLORS = ['#D4AF37', '#3B82F6', '#06B6D4', '#A855F7']

function getTodayLocalStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function AdminReports() {
  const [date, setDate] = useState(getTodayLocalStr())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const { chartAxis, chartGrid, chartGold, tooltipStyle } = useTheme()
  const toast = useToastStore((s) => s.add)

  const handleDownloadDailyPdf = async () => {
    setDownloadingPdf(true)
    try {
      const blob = await api(`/reports/export/pdf?type=daily&date=${date}`)
      downloadBlob(blob, `Kunlik_Hisobot_${date}.pdf`)
      toast("✓ Kunlik PDF Hisobot yuklab olindi!")
    } catch (e) {
      toast(e.message || "PDF hisobot yuklashda xatolik", 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handlePrintReport = async () => {
    setDownloadingPdf(true)
    try {
      const blob = await api(`/reports/export/pdf?type=daily&date=${date}`)
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = url
      document.body.appendChild(iframe)
      iframe.onload = () => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
          URL.revokeObjectURL(url)
        }, 60000)
      }
    } catch (e) {
      toast(e.message || "PDF chop etishda xatolik", 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api(`/reports/admin-daily?date=${date}`)
      setReport(res)
    } catch (e) {
      toast(e.message || 'Hisobot yuklanmadi', 'error')
    } finally {
      setLoading(false)
    }
  }, [date, toast])

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
    { label: 'Jami Mijozlar', value: `${report.patients_count} nafar` },
    { label: '🟢 Jonli Qabul', value: `${report.live_patients_count || 0} nafar (${formatMoney(report.live_patients_total || 0)})` },
    { label: "📄 Navbatchilik (qog'oz)", value: `${report.paper_entry_count || 0} nafar (${formatMoney(report.paper_entry_total || 0)})` },
    { label: '🏥 Statsionar (yotganlar)', value: `${report.active_inpatients || 0} nafar yotibdi (${formatMoney(report.inpatient_income || 0)})` },
    { label: '🔴 Bekor Qilinganlar (-)', value: `${report.cancelled_count || 0} nafar (-${formatMoney(report.cancelled_total || 0)})` },
    { label: "Xizmatlar to'liq summasi", value: formatMoney(report.gross_income ?? report.total_income) },
    { label: 'Chegirmalar (-)', value: `-${formatMoney(report.total_discount || 0)}` },
    { label: "Jami tushgan mablag'", value: formatMoney(report.total_income) },
    { label: '💸 Harajatlar (-)', value: `-${formatMoney(report.expenses || 0)}` },
    {
      label: "✅ Sof qoldiq (tushum - harajat)",
      value: formatMoney((report.total_income || 0) - (report.expenses || 0)),
    },
    { label: '💵 Naqd', value: formatMoney(report.cash) },
    { label: '💳 Karta / QR', value: formatMoney((report.card || 0) + (report.qr || 0)) },
    { label: '📱 Click / Payme', value: formatMoney(report.click || 0) },
  ]

  const expensesList = report.expenses_list || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="page-title mb-0.5">Kunlik Hisobot</h1>
          <p className="text-muted text-xs">Mijozlar, xizmatlar, tushum va harajatlar</p>
        </div>

        {/* Action Controls Toolbar — Neat single line layout */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input-field text-xs py-2 font-mono font-bold max-w-[160px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-surface-2 hover:bg-white/10 border border-border text-body text-xs font-bold flex items-center gap-1.5 transition-all"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-gold ${loading ? 'animate-spin' : ''}`} />
            <span>Ko'rsatish</span>
          </button>

          <button
            type="button"
            className="btn-gold px-3.5 py-2 text-xs font-black flex items-center gap-1.5 shadow-md"
            onClick={handleDownloadDailyPdf}
            disabled={downloadingPdf}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{downloadingPdf ? "Yuklanmoqda..." : "PDF Yuklab Olish"}</span>
          </button>

          <button
            type="button"
            className="btn-cyan px-3.5 py-2 text-xs font-black flex items-center gap-1.5 shadow-md"
            onClick={handlePrintReport}
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Chop Etish</span>
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

          {/* Qaysi xizmatdan qancha tushgani — bemorlar ro'yxatidan oldin,
              chunki hisobotda birinchi navbatda shu kerak bo'ladi. */}
          {(report.paper_entry_departments || []).length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-left">
                    <th className="p-2.5">Bo'lim / Xizmat</th>
                    <th className="p-2.5 text-right w-24">Soni</th>
                    <th className="p-2.5 text-right w-32">Summa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10">
                  {report.paper_entry_departments.map((d) => (
                    <Fragment key={d.department}>
                      <tr className="bg-amber-500/10 font-black">
                        <td className="p-2.5 text-amber-900 dark:text-amber-200">{d.department}</td>
                        <td className="p-2.5 text-right font-mono text-amber-900 dark:text-amber-200">{d.count} ta</td>
                        <td className="p-2.5 text-right font-mono text-amber-900 dark:text-amber-200">{formatMoney(d.total)}</td>
                      </tr>
                      {(report.paper_entry_services || [])
                        .filter((s) => s.department === d.department)
                        .map((s) => (
                          <tr key={`${d.department}-${s.service_name}`} className="font-semibold">
                            <td className="p-2.5 pl-6 text-muted">{s.service_name}</td>
                            <td className="p-2.5 text-right font-mono text-muted">{s.count} ta</td>
                            <td className="p-2.5 text-right font-mono text-emerald">{formatMoney(s.total)}</td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                  <tr className="border-t-2 border-amber-500/40 bg-amber-500/10 font-black">
                    <td className="p-2.5 text-amber-900 dark:text-amber-200 uppercase">Jami</td>
                    <td className="p-2.5 text-right font-mono text-amber-900 dark:text-amber-200">
                      {report.paper_entry_count} ta
                    </td>
                    <td className="p-2.5 text-right font-mono text-amber-900 dark:text-amber-200">
                      {formatMoney(report.paper_entry_total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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

      {/* Harajatlar — sababi va vaqti bilan, oxirida sof qoldiq */}
      {expensesList.length > 0 && (
        <div className="card border border-rose-500/30 bg-rose-500/[0.03]">
          <h3 className="text-rose-500 dark:text-rose-400 mb-1 font-bold text-sm uppercase tracking-wide">
            💸 Harajatlar — {expensesList.length} ta, jami {formatMoney(report.expenses || 0)}
          </h3>
          <p className="text-muted text-[11px] mb-3">
            Bugun kassadan chiqarilgan pullar. Tushumdan ayirilgach kassada
            {' '}{formatMoney((report.total_income || 0) - (report.expenses || 0))} qoladi.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                  <th className="p-3">#</th>
                  <th className="p-3">Turi</th>
                  <th className="p-3">Sababi / Izoh</th>
                  <th className="p-3">Vaqt</th>
                  <th className="p-3 text-right">Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expensesList.map((ex, i) => (
                  <tr key={ex.id || i} className="hover:bg-surface-hover font-semibold">
                    <td className="p-3 text-muted font-mono">#{i + 1}</td>
                    <td className="p-3 text-body font-bold">{ex.category}</td>
                    <td className="p-3 text-muted">{ex.description}</td>
                    <td className="p-3 font-mono text-muted">
                      {ex.created_at ? ex.created_at.slice(11, 16) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-500 dark:text-rose-400">
                      -{formatMoney(ex.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-surface-2 font-black">
                  <td className="p-3" colSpan={3}>
                    <span className="text-body uppercase">Jami harajat</span>
                  </td>
                  <td className="p-3" />
                  <td className="p-3 text-right font-mono text-rose-500 dark:text-rose-400">
                    -{formatMoney(report.expenses || 0)}
                  </td>
                </tr>
                <tr className="bg-emerald-500/10 font-black">
                  <td className="p-3" colSpan={3}>
                    <span className="text-emerald uppercase">Kassada qolgan (tushum - harajat)</span>
                  </td>
                  <td className="p-3" />
                  <td className="p-3 text-right font-mono text-emerald">
                    {formatMoney((report.total_income || 0) - (report.expenses || 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bekor qilingan to'lovlar — alohida ro'yxat va summa */}
      {(report.cancelled_count || 0) > 0 && (
        <div className="card border border-rose-500/40 bg-rose-500/5">
          <h3 className="text-rose-400 mb-1 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
            <span>🔴 Bekor Qilingan To'lovlar — {report.cancelled_count} ta, jami -{formatMoney(report.cancelled_total)}</span>
          </h3>
          <p className="text-muted text-[11px] mb-3">
            Bemor to'lovidan voz kechganda bekor qilingan yozuvlar (kassadan va balansdan chiqarilgan).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-rose-500/30 text-rose-300 font-bold text-left bg-rose-950/40">
                  <th className="p-3">#</th>
                  <th className="p-3">Bemor F.I.Sh</th>
                  <th className="p-3">Xizmat Nomi</th>
                  <th className="p-3">Bekor Qilish Sababi</th>
                  <th className="p-3">Vaqt</th>
                  <th className="p-3 text-right">Qaytarilgan Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-500/20">
                {report.cancelled_list.map((c, i) => (
                  <tr key={c.id || i} className="hover:bg-rose-500/10 font-semibold text-rose-200">
                    <td className="p-3 font-mono opacity-80">#{i + 1}</td>
                    <td className="p-3 font-bold text-foreground">{c.patient_name}</td>
                    <td className="p-3">{c.service_name}</td>
                    <td className="p-3 italic text-rose-300">{c.cancel_reason}</td>
                    <td className="p-3 font-mono text-muted">{c.date}</td>
                    <td className="p-3 text-right font-mono font-bold text-rose-400">-{formatMoney(c.amount)}</td>
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
