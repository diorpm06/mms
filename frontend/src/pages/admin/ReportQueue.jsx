import { useEffect, useRef, useState } from 'react'
import { Printer, RefreshCw, FileText } from 'lucide-react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { PageHeader, Icons } from '../../components/UIKit'
import { playNotificationSound } from '../../utils/sound'
import { sarlavhaniTuzat } from '../../utils/reportTemplates'

const HOLAT = {
  submitted: { text: 'Chop etishni kutmoqda', cls: 'badge-gold' },
  printed: { text: 'Chop etilgan', cls: 'badge-cyan' },
}

export default function AdminReportQueue() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const toast = useToastStore((s) => s.add)
  const prevCountRef = useRef(null)

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    api('/report-submissions/recent')
      .then((res) => {
        const newItems = res || []
        const kutayotgan = newItems.filter((r) => r.status === 'submitted').length
        if (prevCountRef.current !== null && kutayotgan > prevCountRef.current) {
          playNotificationSound('doctor_submit')
          toast('🔔 Shifokor yangi shablon natijasini yubordi!')
        }
        prevCountRef.current = kutayotgan
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

  // Fon-jarayondagi (agent kutadigan) plain-text chop etish o'rniga
  // serverda tayyorlangan PDF (A4, bemor sarlavhasi bilan) brauzer
  // orqali to'g'ridan-to'g'ri chop etishga yuboriladi — o'lchami va
  // joylashuvi doim to'g'ri, alohida printer-agent shart emas.
  const handlePrint = async (report) => {
    setBusyId(report.id)
    try {
      const blob = await api(`/report-submissions/${report.id}/pdf`)
      const url = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = url
      document.body.appendChild(iframe)
      iframe.onload = () => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
          URL.revokeObjectURL(url)
        }, 1500)
      }

      await api(`/report-submissions/${report.id}/mark-printed`, { method: 'PATCH' })
      toast('✓ Chop etildi deb belgilandi')
      load()
    } catch (e) {
      toast(e.message || 'Chop etishda xatolik', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const kutayotganSoni = items.filter((r) => r.status === 'submitted').length

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Shablon Natijalari"
        subtitle="Shifokorlar to'ldirgan UZI va Laboratoriya shablon natijalari — ko'rish va chop etish. Chop etilganlar ham ro'yxatda qoladi."
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
          Oxirgi kunlarda shablon natijasi yuborilmagan.
        </div>
      ) : (
        <div className="space-y-3">
          {kutayotganSoni > 0 && (
            <p className="text-xs text-muted font-bold">
              {kutayotganSoni} ta chop etishni kutmoqda
            </p>
          )}
          {items.map((r) => (
            <div key={r.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-cyan">{r.template_label}</p>
                    <span className={`badge ${HOLAT[r.status]?.cls || 'badge-muted'} text-[10px] font-bold`}>
                      {HOLAT[r.status]?.text || r.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    Bemor: <strong className="text-body">{r.patient_name}</strong> · Shifokor: {r.doctor_name || '—'}
                  </p>
                </div>
                <span className="text-[11px] text-muted font-mono">
                  {r.created_at ? new Date(r.created_at).toLocaleString('uz-UZ') : ''}
                </span>
              </div>
              <div
                className="mms-shablon bg-white text-black rounded-xl p-3 text-[11px] leading-relaxed max-h-32 overflow-y-auto overflow-x-auto"
                style={{ fontFamily: "'Times New Roman', Cambria, serif" }}
                dangerouslySetInnerHTML={{ __html: sarlavhaniTuzat(r.content) }}
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
                  onClick={() => handlePrint(r)}
                  disabled={busyId === r.id}
                  className="btn-gold py-2 px-4 text-xs font-black flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Printer className="h-3.5 w-3.5" />
                  {busyId === r.id ? 'Ochilmoqda...' : r.status === 'printed' ? 'Qayta chop etish' : 'Chop etish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
