import { useEffect, useState } from 'react'
import { Printer, RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { PageHeader, Icons } from '../../components/UIKit'

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildPrintHtml(report) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(report.template_label)}</title>
        <style>
          body { font-family: 'Times New Roman', Cambria, serif; padding: 20px; color: #000; background: #fff; }
          pre {
            font-family: 'Times New Roman', Cambria, serif;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
            margin: 0;
          }
          .footer-note { margin-top: 24px; font-size: 11px; color: #444; }
          @media print { body { padding: 0; } @page { margin: 15mm; } }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(report.content)}</pre>
        <p class="footer-note">Shifokor: ${escapeHtml(report.doctor_name)} · Sana: ${report.created_at ? new Date(report.created_at).toLocaleString('uz-UZ') : ''}</p>
      </body>
    </html>
  `
}

export default function AdminReportQueue() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
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
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    printWindow.document.write(buildPrintHtml(report))
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 300)

    try {
      await api(`/report-submissions/${report.id}/mark-printed`, { method: 'PATCH' })
      toast('✓ Chop etildi deb belgilandi')
      load()
    } catch (e) {
      toast(e.message || 'Belgilashda xatolik', 'error')
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Shablonlar (Chop etishni kutayotgan)"
        subtitle="Shifokorlar to'ldirgan UZI/Laboratoriya shablonlari — ko'rib chiqib chop eting"
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
                  className="btn-gold py-2 px-4 text-xs font-black flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Ko'rish va Chop etish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
