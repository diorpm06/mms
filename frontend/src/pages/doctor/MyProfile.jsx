import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Calendar, CalendarClock, Wallet, ChevronDown, ChevronUp, Eye, X, Stethoscope, FileText } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { Btn, EmptyState, PageHeader } from '../../components/UIKit'

export default function MyProfile() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openDay, setOpenDay] = useState(null)
  const [previewReport, setPreviewReport] = useState(null)
  const toast = useToastStore((s) => s.add)

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('/providers/my-10day-report')
      setData(res)
      if (res?.days?.length > 0) {
        setOpenDay(res.days[0].date) // Open today by default
      }
    } catch (e) {
      toast(e.message || 'Ma\'lumotlarni yuklashda xatolik', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const toggleDay = (dateStr) => {
    setOpenDay((prev) => (prev === dateStr ? null : dateStr))
  }

  const today = data?.today || { patients_count: 0, earned_amount: 0, patients: [] }
  const yesterday = data?.yesterday || { patients_count: 0, earned_amount: 0, patients: [] }
  const days = data?.days || []

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Page Header */}
      <PageHeader
        title="Profilim va Hisobotim"
        subtitle={`Dr. ${data?.provider_name || 'Shifokor'} — bugungi, kechagi va 10 kunlik shaxsiy ish hisoboti`}
        icon={<Stethoscope className="h-6 w-6 text-gold" />}
      >
        <Btn variant="ghost" size="sm" icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />} onClick={loadReport} disabled={loading}>
          Yangilash
        </Btn>
      </PageHeader>

      {loading && !data ? (
        <div className="p-12 text-center text-xs text-muted">Hisobot yuklanmoqda...</div>
      ) : (
        <>
          {/* Top Quick Stats Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Today */}
            <div className="card p-4 border-emerald-500/25 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-500">
                    Bugun
                  </span>
                </div>
                <span className="badge badge-emerald text-[10px] font-bold">
                  {today.patients_count} ta bemor
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(today.earned_amount)}
              </p>
              <p className="text-[10px] text-muted font-semibold">
                Bugun qabul qilingan bemorlardan kelgan KPI ulushingiz
              </p>
            </div>

            {/* Yesterday */}
            <div className="card p-4 border-cyan-500/25 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/12 border border-cyan-500/25 flex items-center justify-center shrink-0">
                    <CalendarClock className="h-4 w-4 text-cyan-500" />
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-500">
                    Kecha
                  </span>
                </div>
                <span className="badge badge-cyan text-[10px] font-bold">
                  {yesterday.patients_count} ta bemor
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                {formatMoney(yesterday.earned_amount)}
              </p>
              <p className="text-[10px] text-muted font-semibold">
                Kecha qabul qilingan bemorlardan kelgan KPI ulushingiz
              </p>
            </div>

            {/* Balance */}
            <div className="card p-4 border-gold/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gold/12 border border-gold/25 flex items-center justify-center shrink-0">
                    <Wallet className="h-4 w-4 text-gold" />
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-gold">
                    Joriy Balansim
                  </span>
                </div>
                <span className="badge badge-gold text-[10px] font-bold">Kassadan</span>
              </div>
              <p className="text-2xl font-black font-mono text-gold">
                {formatMoney(data?.balance || 0)}
              </p>
              <p className="text-[10px] text-muted font-semibold">
                Kassadan yechib olinmagan qolgan hisobingiz
              </p>
            </div>
          </div>

          {/* 10-DAY BREAKDOWN SECTION */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gold" />
                <span>Oxirgi 10 Kunlik Kunlik Hisobot va Bemorlar Ro'yxati</span>
              </h3>
              <span className="badge badge-muted text-xs font-bold">
                Jami {days.length} kunlik ma'lumot
              </span>
            </div>

            {days.length === 0 ? (
              <EmptyState icon="📊" message="Oxirgi 10 kunda hali qabul qilingan bemorlar yo'q" />
            ) : (
              <div className="space-y-3">
                {days.map((dayItem) => {
                  const isOpen = openDay === dayItem.date
                  const isTodayStr = dayItem.date === today.date
                  const formattedDate = dayItem.date ? new Date(dayItem.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : dayItem.date

                  return (
                    <div
                      key={dayItem.date}
                      className="card p-0 overflow-hidden border-border transition-all duration-200"
                    >
                      {/* Accordion Day Header */}
                      <div
                        onClick={() => toggleDay(dayItem.date)}
                        className={`flex items-center justify-between p-4 cursor-pointer select-none transition-colors ${
                          isOpen ? 'bg-gold/10 border-b border-border' : 'hover:bg-surface-2'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-muted font-bold text-xs">
                            {isOpen ? <ChevronUp className="h-4 w-4 text-gold" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-foreground flex items-center gap-2">
                              <span>{formattedDate}</span>
                              {isTodayStr && (
                                <span className="badge badge-emerald text-[10px] font-bold">BUGUN</span>
                              )}
                            </span>
                            <span className="text-xs text-muted font-semibold block mt-0.5">
                              {dayItem.patients_count} ta bemor qabul qilingan
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black font-mono text-emerald-500">
                            + {formatMoney(dayItem.earned_amount)}
                          </span>
                          <span className="text-[10px] text-muted font-bold block">Shifokor KPI ulushi</span>
                        </div>
                      </div>

                      {/* Day Patients List Table */}
                      {isOpen && (
                        <div className="p-4 bg-surface-1 space-y-3">
                          {dayItem.patients.length === 0 ? (
                            <p className="text-xs text-muted italic text-center py-4">Bu kunda bemorlar to'lovi yo'q</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-border text-muted uppercase text-[10px] font-extrabold">
                                    <th className="py-2.5 px-3">Talon</th>
                                    <th className="py-2.5 px-3">Bemor Ism-Familiyasi</th>
                                    <th className="py-2.5 px-3">Xizmat Nomi</th>
                                    <th className="py-2.5 px-3">Vaqt</th>
                                    <th className="py-2.5 px-3 text-right">Bemor To'lagan</th>
                                    <th className="py-2.5 px-3 text-right">Shifokor Ulushi</th>
                                    <th className="py-2.5 px-3 text-center">Shablon Natijasi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 font-semibold">
                                  {dayItem.patients.map((pt, idx) => (
                                    <tr key={pt.patient_id || idx} className="hover:bg-white/[0.02]">
                                      <td className="py-3 px-3">
                                        <span className="badge badge-gold font-mono text-[10px] font-black">
                                          {pt.ticket_number}
                                        </span>
                                      </td>
                                      <td className="py-3 px-3 font-extrabold text-foreground">
                                        {pt.patient_name}
                                      </td>
                                      <td className="py-3 px-3 text-cyan">
                                        <span className="inline-flex items-center gap-1.5">
                                          <Stethoscope className="h-3.5 w-3.5" /> {pt.service_name}
                                        </span>
                                      </td>
                                      <td className="py-3 px-3 text-muted font-mono text-[11px]">
                                        {pt.created_at || '—'}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono text-body font-bold">
                                        {formatMoney(pt.total_amount)}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono text-emerald-500 font-extrabold">
                                        + {formatMoney(pt.provider_amount)}
                                      </td>
                                      <td className="py-3 px-3 text-center">
                                        {pt.has_report ? (
                                          <button
                                            type="button"
                                            onClick={() => setPreviewReport(pt)}
                                            className="btn-cyan py-1 px-2.5 text-[10px] font-extrabold inline-flex items-center gap-1 shadow-sm"
                                          >
                                            <Eye className="h-3 w-3" /> Natijani Ko'rish
                                          </button>
                                        ) : (
                                          <span className="text-muted text-[11px] italic">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* PREVIEW REPORT MODAL */}
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-3xl w-full p-6 relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>{previewReport.report_label || 'Shablon Natijasi'}</span>
                </h3>
                <p className="text-xs text-muted font-bold mt-0.5">
                  Bemor: <strong className="text-cyan">{previewReport.patient_name}</strong> ({previewReport.ticket_number})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="p-1.5 rounded-xl text-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="bg-white text-black rounded-xl p-5 text-[13px] leading-relaxed max-h-[70vh] overflow-y-auto shadow-inner"
              style={{ fontFamily: "'Times New Roman', Cambria, serif" }}
              dangerouslySetInnerHTML={{ __html: previewReport.report_content || '<p>Natija matni yo\'q</p>' }}
            />

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="btn-gold py-2 px-5 text-xs font-black"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
