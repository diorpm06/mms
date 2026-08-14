import { useEffect, useState } from 'react'
import { Printer, RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { PageHeader, Icons } from '../../components/UIKit'

export default function AdminReportQueue() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [printingId, setPrintingId] = useState(null)
  const toast = useToastStore((s) => s.add)

  const load = () => {
    setLoading(true)
    api('/report-submissions/pending')
      .then((res) => setItems(res || []))
      .catch((e) => toast(e.message || 'Yuklashda xatolik', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handlePrint = async (report) => {
    setPrintingId(report.id)
    try {
      const footer = `\n\n───────────────────────\nShifokor: ${report.doctor_name || ''}\nSana: ${report.created_at ? new Date(report.created_at).toLocaleString('uz-UZ') : ''}`
      await api('/print-jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: report.template_label,
          content: report.content + footer,
          printer_type: 'a4',
        }),
      })
      await api(`/report-submissions/${report.id}/mark-printed`, { method: 'PATCH' })
      toast('✓ Printerga yuborildi — bir necha soniyada chiqadi')
      load()
    } catch (e) {
      toast(e.message || 'Chop etishga yuborishda xatolik', 'error')
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Shablonlar (Chop etishni kutayotgan)"
        subtitle="Shifokorlar to'ldirgan UZI/Laboratoriya shablonlari — ko'rib chiqib printerga yuboring"
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
              <pre className="text-[10px] font-mono text-muted whitespace-pre-wrap bg-surface p-2.5 rounded-xl border border-border max-h-24 overflow-hidden">
                {r.content}
              </pre>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handlePrint(r)}
                  disabled={printingId === r.id}
                  className="btn-gold py-2 px-4 text-xs font-black flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {printingId === r.id ? 'Yuborilmoqda...' : 'Printerga yuborish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
