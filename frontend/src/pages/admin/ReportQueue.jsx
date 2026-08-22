import { useEffect, useRef, useState } from 'react'
import { Printer, RefreshCw, FileText } from 'lucide-react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { PageHeader, Icons } from '../../components/UIKit'
import { playNotificationSound } from '../../utils/sound'

export default function AdminReportQueue() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const toast = useToastStore((s) => s.add)
  const prevCountRef = useRef(null)

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api('/report-submissions/pending')
      .then((res) => {
        const newItems = res || []
        if (prevCountRef.current !== null && newItems.length > prevCountRef.current) {
          playNotificationSound('doctor_submit')
          toast('🔔 Shifokor yangi shablon natijasini yubordi!')
        }
        prevCountRef.current = newItems.length
        setItems(newItems)
      })
      .catch((e) => {
        if (!silent) toast(e.message || 'Yuklashda xatolik', 'error')
      })
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 4000)
    return () => clearInterval(interval)
  }, [])

  const handleViewPdf = async (report) => {
    setBusyId(report.id)
    try {
      const blob = await api(`/report-submissions/${report.id}/pdf`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e) {
      toast(e.message || 'PDF yaratishda xatolik', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleSendToPrinter = async (report) => {
    setBusyId(report.id)
    try {
      const footer = `\n\n───────────────────────\nShifokor: ${report.doctor_name || ''}\nSana: ${report.created_at ? new Date(report.created_at).toLocaleString('uz-UZ') : ''}`
      const plainContent = (report.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      await api('/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: report.template_label,
          content: plainContent + footer,
          printer_type: 'a4',
        }),
      })
      await api(`/report-submissions/${report.id}/mark-printed`, { method: 'PATCH' })
      toast('✓ Printerga yuborildi — bir necha soniyada chiqadi')
      load()
    } catch (e) {
      toast(e.message || 'Chop etishga yuborishda xatolik', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="📋 Shablon Natijalari"
        subtitle="Shifokorlar to'ldirgan UZI va Laboratoriya shablon natijalari — ko'rish, PDF yuklab olish va printerga yuborish"
        icon={Icons.chart}
      >
        <button onClick={load} className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Yangilash
        </button>
      </PageHeader>

      {loading ? (
        <p className="text-xs text-muted italic text-center py-8">Yuklanmoqda...</p>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Hozircha chop etishni kutayotgan shablon yo'q.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <p className="font-bold text-sm text-cyan">
                    {r.category === 'UZI' ? '🩻' : '🔬'} {r.template_label}
                  </p>
                  <p className="text-xs text-muted">
                    Bemor: <strong className="text-body">{r.patient_name}</strong> · Shifokor: {r.doctor_name || '—'}
                  </p>
                </div>
                <span className="text-[11px] text-muted font-mono">
                  {r.created_at ? new Date(r.created_at).toLocaleString('uz-UZ') : ''}
                </span>
              </div>
              <div
                className="bg-white text-black rounded-xl p-3 text-[11px] leading-relaxed max-h-32 overflow-y-auto"
                style={{ fontFamily: "'Times New Roman', Cambria, serif" }}
                dangerouslySetInnerHTML={{ __html: r.content }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleViewPdf(r)}
                  disabled={busyId === r.id}
                  className="btn-outline py-2 px-4 text-xs font-black flex items-center gap-1.5 disabled:opacity-60"
                >
                  <FileText className="h-3.5 w-3.5" /> PDF ko'rish
                </button>
                <button
                  type="button"
                  onClick={() => handleSendToPrinter(r)}
                  disabled={busyId === r.id}
                  className="btn-gold py-2 px-4 text-xs font-black flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {busyId === r.id ? 'Yuborilmoqda...' : 'Printerga yuborish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
