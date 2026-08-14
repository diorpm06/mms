import { useEffect, useState } from 'react'
import { Printer, RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { PageHeader, Icons } from '../../components/UIKit'

function buildPrintHtml(report) {
  const rows = Object.entries(report.filled_data || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td style="border:1px solid #000;padding:8px;font-weight:bold;">${k}</td>
        <td style="border:1px solid #000;padding:8px;text-align:right;font-weight:bold;">${v}</td>
      </tr>`).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${report.template_label}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
          .header h2 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
          .header p { margin: 4px 0 0; font-size: 12px; font-weight: bold; }
          .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 12px; }
          .info-box { border: 1px solid #000; padding: 8px 12px; border-radius: 6px; width: 48%; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
          th, td { border: 1px solid #000; padding: 8px 10px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
          .sig-line { width: 40%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-weight: bold; }
          @media print { body { padding: 0; } @page { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>MARJONA MED SERVICE</h2>
          <p>${(report.category || '').toUpperCase()} TEKSHIRUV NATIJASI — ${report.template_label}</p>
        </div>
        <div class="info-grid">
          <div class="info-box">
            <p style="margin:0;"><b>Bemor F.I.Sh:</b> ${report.patient_name || ''}</p>
            <p style="margin:4px 0 0;"><b>Shifokor:</b> ${report.doctor_name || ''}</p>
          </div>
          <div class="info-box" style="text-align:right;">
            <p style="margin:0;"><b>Tekshiruv:</b> ${report.template_label}</p>
            <p style="margin:4px 0 0;"><b>Sana:</b> ${report.created_at ? new Date(report.created_at).toLocaleString('uz-UZ') : ''}</p>
          </div>
        </div>
        <table>
          <thead><tr><th>Ko'rsatkich</th><th style="text-align:right;">Natija</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${report.notes ? `<p style="font-size:12px;font-style:italic;margin:10px 0;">Izoh/Xulosa: ${report.notes}</p>` : ''}
        <div class="signatures">
          <div class="sig-line">Shifokor Imzosi</div>
          <div class="sig-line">Bemor Imzosi</div>
        </div>
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
