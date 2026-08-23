import { useEffect, useState } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons, PageHeader, EmptyState } from '../../components/UIKit'
import ReportTemplateModal from '../../components/ReportTemplateModal'

const HOLAT = {
  submitted: { text: 'Adminga yuborilgan', cls: 'badge-gold' },
  printed: { text: 'Chop etilgan', cls: 'badge-cyan' },
}

function vaqt(iso) {
  if (!iso) return '—'
  const [kun, soat] = iso.split('T')
  const [y, o, k] = (kun || '').split('-')
  return `${k}.${o}.${y} ${(soat || '').substring(0, 5)}`
}

// Shifokor shablonni to'ldirib "Saqlash"ni bosgan zahoti to'g'ridan-to'g'ri
// adminga ketadi (alohida "qoralama -> ko'rib chiqib yubor" bosqichi yo'q) —
// shuning uchun bu sahifa faqat o'zi yuborgan natijalar TARIXI, harakat
// qiladigan joy emas: belgilash, "hammasini yuborish" kabi hech qachon
// ishlamaydigan tugmalar olib tashlandi.
export default function MyResults() {
  const [rows, setRows] = useState(null)
  const [korish, setKorish] = useState(null)
  const toast = useToastStore((s) => s.add)

  const yukla = async () => {
    try {
      const res = await api('/report-submissions/mine')
      setRows(res || [])
    } catch (e) {
      setRows([])
      toast(e.message, 'error')
    }
  }
  useEffect(() => { yukla() }, [])

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-10">
      <PageHeader
        title="Natijalarim"
        subtitle="To'ldirib adminga yuborgan UZI va laboratoriya blankalaringiz tarixi"
        icon={Icons.fileText}
      >
        <Btn variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={yukla}>
          Yangilash
        </Btn>
      </PageHeader>

      {rows === null ? (
        <p className="text-xs text-muted italic text-center py-10">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="📋"
          message="Hali natija yuborilmagan. Doctor Panelidan bemorni chaqirib, blankani to'ldiring."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="card p-3 flex flex-wrap items-center gap-3 border-border">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-cyan text-[10px] font-bold">
                    {r.category === 'UZI' ? 'UZI' : 'Lab'}
                  </span>
                  <h4 className="font-extrabold text-sm text-body truncate">{r.template_label}</h4>
                  <span className={`badge ${HOLAT[r.status]?.cls || 'badge-muted'} text-[10px] font-bold`}>
                    {HOLAT[r.status]?.text || r.status}
                  </span>
                </div>
                <p className="text-[11px] text-muted font-semibold mt-0.5">
                  {r.ticket_number ? `${r.ticket_number} · ` : ''}
                  {r.patient_name} · {vaqt(r.created_at)}
                </p>
              </div>

              <Btn variant="ghost" size="xs" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setKorish(r)}>
                Ko'rish / Tahrirlash
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* Ko'rish/tahrirlash — ReportTemplateModal shu bir natijani darrov ochadi */}
      {korish && (
        <ReportTemplateModal
          patient={{
            id: korish.patient_id,
            first_name: (korish.patient_name || '').split(' ')[0] || '',
            last_name: (korish.patient_name || '').split(' ').slice(1).join(' '),
          }}
          category={korish.category}
          initialReportId={korish.id}
          onClose={() => {
            setKorish(null)
            yukla()
          }}
        />
      )}
    </div>
  )
}
