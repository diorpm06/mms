import { Printer, X, AlertTriangle } from 'lucide-react'
import { formatMoney, paymentLabel, birthYear } from '../utils/format'
import { Btn, Icons } from './UIKit'
import { BRAND } from '../config/brand'
import ReceiptHeader from './ReceiptHeader'

export default function PaymentTicketModal({ open, patient, onClose }) {
  if (!open || !patient) return null

  const handlePrint = () => {
    const container = document.getElementById('payment-ticket-container')
    if (!container) return

    const clone = container.cloneNode(true)
    clone.id = 'print-clone'
    document.body.appendChild(clone)

    const root = document.getElementById('root')
    if (root) root.style.display = 'none'

    window.print()

    document.body.removeChild(clone)
    if (root) root.style.display = ''
  }

  // Handle single patient vs batch patients
  const isBatch = patient.batch && Array.isArray(patient.patients)
  const patientList = isBatch ? patient.patients : [patient]
  const firstPatient = patientList[0] || {}

  const isPayLater = ['later', 'keyinroq', 'nasiya', 'qarz'].includes(String(firstPatient.payment_type || '').toLowerCase())

  const rawTickets = []
  patientList.forEach((p) => {
    if (p.ticket_number) {
      rawTickets.push(p.ticket_number)
    }
    if (p.services && Array.isArray(p.services)) {
      p.services.forEach((s) => {
        if (s.ticket_number) rawTickets.push(s.ticket_number)
      })
    }
    if (!p.ticket_number && (!p.services || !p.services.some(s => s.ticket_number))) {
      rawTickets.push(`#BM-${p.id}`)
    }
  })
  const realQueueTickets = rawTickets.filter((t) => t && !t.startsWith('#BM-'))
  const uniqueTickets = realQueueTickets.length > 0
    ? Array.from(new Set(realQueueTickets))
    : Array.from(new Set(rawTickets))
  const ticketsStr = uniqueTickets.join(', ')
  const totalAmount = isBatch
    ? patient.total_amount
    : (patient.payment_amount || patient.total_amount || 0)

  const totalCash = patient.cash_amount !== undefined
    ? patient.cash_amount
    : patientList.reduce((acc, p) => acc + (p.cash_amount || 0), 0)

  const totalCard = patient.card_amount !== undefined
    ? patient.card_amount
    : patientList.reduce((acc, p) => acc + (p.card_amount || 0), 0)

  // Chegirma bo'limlar orasida bo'linadi (har bir bo'lim alohida yozuv),
  // shuning uchun chekda ko'rsatish uchun hammasini yig'amiz.
  const totalDiscount = patientList.reduce((acc, p) => acc + (p.discount_amount || 0), 0)
  const discountReason = patientList.find((p) => p.discount_reason)?.discount_reason || ''

  const dateStr = firstPatient.created_at
    ? new Date(firstPatient.created_at).toLocaleString('uz-UZ')
    : new Date().toLocaleString('uz-UZ')

  const getCabinetLabel = (cab) => {
    if (!cab) return "QABULXONA"
    if (cab === '-' || cab === '—') return "-"
    const uppercaseCab = String(cab).toUpperCase()
    if (uppercaseCab.includes('XONA') || uppercaseCab.includes('KABINET')) {
      return uppercaseCab
    }
    return `${uppercaseCab}-XONA`
  }

  const cleanServiceName = (name) => {
    if (!name) return 'Xizmat'
    let str = String(name).trim()
    if (str.startsWith('Sarflangan Material (') && str.endsWith(')')) {
      str = str.slice(21, -1).trim()
    }
    if (str.startsWith('Material: ')) {
      str = str.slice(10).trim()
    }
    return str || 'Xizmat'
  }

  const cleanCategory = (cat) => {
    if (!cat || cat === 'Ombor Materiali' || cat === 'Sarflangan Material') return 'Umumiy'
    return cat
  }

  // Flatten patientList to all individual sub-services and consumed materials for printing
  const allPrintItems = []
  patientList.forEach((p) => {
    if (p.breakdown && Array.isArray(p.breakdown) && p.breakdown.length > 0) {
      p.breakdown.forEach((sub) => {
        allPrintItems.push({
          category: cleanCategory(sub.category || p.service_category || p.category),
          service_name: cleanServiceName(sub.service_name || sub.title),
          payment_amount: sub.price || sub.payment_amount || 0,
          quantity: sub.quantity || 1,
        })
      })
    } else if (p.sub_items && Array.isArray(p.sub_items) && p.sub_items.length > 0) {
      p.sub_items.forEach((sub) => {
        allPrintItems.push({
          category: cleanCategory(sub.category || p.service_category || p.category),
          service_name: cleanServiceName(sub.service_name || sub.title),
          payment_amount: sub.price || sub.payment_amount || 0,
          quantity: sub.quantity || 1,
        })
      })
    } else if (p.services && Array.isArray(p.services) && p.services.length > 0) {
      // Bemor bir nechta xizmat tanlagan bo'lsa (masalan 3 ta laboratoriya
      // tahlili) — hammasi chekda alohida qator bo'lib chiqishi kerak.
      // Ilgari bu yerga tushib qolgan chek faqat BITTA (asosiy) xizmatni
      // ko'rsatardi, chunki ro'yxat faqat breakdown/sub_items dan olinardi.
      p.services.forEach((s) => {
        allPrintItems.push({
          category: cleanCategory(s.category || p.service_category || p.category),
          service_name: cleanServiceName(s.service_name),
          payment_amount: s.total_price ?? s.price ?? 0,
          quantity: s.quantity || 1,
        })
      })
    } else {
      allPrintItems.push({
        category: cleanCategory(p.service_category || p.category),
        service_name: cleanServiceName(p.service_name || p.diagnosis || p.title),
        payment_amount: p.payment_amount || p.price || 0,
        quantity: p.quantity || 1,
      })
    }
  })

  // Bir necha kunga oldindan to'langan xizmatlar (masalan 3 ta elektroforez).
  // Bularni chekda ALOHIDA, ko'rinarli qutida ko'rsatamiz — bemor 2- va
  // 3-kuni kelganda qayta to'lov so'ralmasligi uchun.
  // Bir xil xizmat bir necha chekka bo'linib kiritilishi mumkin (masalan
  // avval 1 kun, keyin 3 kun). Ilgari har bir yozuv alohida sanalgani uchun
  // chekda 4 kun o'rniga 3 kun chiqardi. Endi xizmat NOMI bo'yicha qo'shiladi.
  const kursMap = {}
  patientList.forEach((p) => {
    ;(p.services || []).forEach((s) => {
      // STRICT RULE: Only print "OLDINDAN TO'LANGAN" course box on receipt
      // if the service was explicitly marked as a multi-day course (is_course === true).
      // Purchasing 10 items for a single visit (is_course = false) must NEVER print the course box.
      if (!s.is_course) return
      const nomi = cleanServiceName(s.service_name)
      if (!nomi) return
      if (!kursMap[nomi]) kursMap[nomi] = { nomi, soni: 0, narx: 0 }
      kursMap[nomi].soni += Number(s.quantity) || 1
      kursMap[nomi].narx += Number(s.total_price) || 0
    })
  })
  const kurslar = Object.values(kursMap)
    .filter((k) => k.soni > 1)
    .map((k) => ({ ...k, ishlatilgan: 0 }))

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            height: auto !important;
            display: block !important;
            background: #fff !important;
            color: #000 !important;
            overflow: visible !important;
          }
          #print-clone {
            display: block !important;
            position: static !important;
            width: 78mm !important;
            height: max-content !important;
            min-height: 0 !important;
            padding: 1mm !important;
            margin: 0 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 9px !important;
            line-height: 1.15 !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
          }
          #print-clone .rounded-2xl, #print-clone .rounded-xl, #print-clone .rounded-3xl { border-radius: 0 !important; }
          #print-clone .shadow-inner, #print-clone .shadow-2xl, #print-clone .shadow-lg { box-shadow: none !important; }
          #print-clone img.logo-img {
            display: block !important;
            max-height: 24mm !important;
            height: 24mm !important;
            width: auto !important;
            margin: 0 auto 1mm !important;
          }
          #print-clone * {
            color: #000000 !important;
            opacity: 1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-clone .ticket-number-box {
            border: 2px solid #000 !important;
            border-radius: 6px !important;
            background: #f1f5f9 !important;
            padding: 1mm 1.5mm !important;
            margin: 1mm 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-clone .ticket-number-text {
            font-size: 18px !important;
            line-height: 1.1 !important;
            word-break: break-all !important;
          }
          #print-clone .service-group {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 1mm !important;
          }
          #print-clone .service-group > span {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          #print-clone .bg-slate-100, #print-clone .bg-white {
            background: #f1f5f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="bg-card border border-border rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 my-auto">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-2 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Pay Later Warning Box in Modal */}
        {isPayLater && (
          <div className="no-print mb-4 flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 text-xs">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <strong className="block font-bold">To'lov keyinroq amalga oshiriladi!</strong>
              Ushbu chek to'lov eslatmasi (nasiya cheki) sifatida chop etiladi.
            </div>
          </div>
        )}

        {/* PRINTABLE RECEIPT CONTAINER */}
        <div id="payment-ticket-container" className="bg-white text-slate-900 p-3 rounded-2xl font-mono text-xs space-y-2 border border-slate-300">

          {/* Header */}
          <ReceiptHeader compact />

          {/* QUEUE TICKET NUMBER BOX */}
          <div className="ticket-number-box bg-slate-100 p-3 rounded-xl border-2 border-slate-900 text-center my-1">
            <span className="text-[9px] uppercase font-bold text-slate-700 block">SIZNING NAVBATINGIZ:</span>
            <span className="ticket-number-text text-3xl font-black text-slate-900 block my-1 break-all leading-tight">
              {ticketsStr}
            </span>
            <span className="text-[10px] font-black text-slate-900 uppercase block">
              {getCabinetLabel(firstPatient.cabinet)}
            </span>
          </div>

          {/* PATIENT & PAYMENT DETAILS */}
          <div className="space-y-1 text-[10px] pt-1">
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span className="text-slate-600 font-bold">Bemor:</span>
              <strong className="text-slate-900 text-right">
                {birthYear(firstPatient.birth_date) ? `(${birthYear(firstPatient.birth_date)}-y.) ` : ''}
                {firstPatient.first_name} {firstPatient.last_name}
              </strong>
            </div>

            {/* SERVICES LIST GROUPED BY DEPARTMENT */}
            <div className="border-b border-slate-200 pb-2 space-y-1.5 pt-1">
              <span className="text-slate-600 block font-bold text-[10px]">Xizmatlar ({allPrintItems.length} ta):</span>
              {Object.entries(
                allPrintItems.reduce((acc, item) => {
                  const cat = item.category || 'Umumiy'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(item)
                  return acc
                }, {})
              ).map(([catName, list]) => (
                <div key={catName} className="space-y-0.5 service-group">
                  <span className="font-black text-slate-900 text-[10px] block uppercase tracking-wide bg-slate-100 px-1 py-0.5 rounded border border-slate-300">
                    📁 {catName}
                  </span>
                  {list.map((it, i) => (
                    <div key={i} className="flex justify-between text-[10px] pl-1 font-mono">
                      <span>• {it.service_name}{it.quantity && it.quantity > 1 ? ` (${it.quantity} ta)` : ''}</span>
                      <span className="font-bold">{formatMoney(it.payment_amount || 0)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* ── OLDINDAN TO'LANGAN KURS ──────────────────────────────
                Bemor bir necha kunlik xizmatni bir marta to'lagan. Chekda buni
                ko'rinarli qilib yozamiz: keyingi kunlarda qayta pul so'ralmasin
                va bemorning qo'lida dalil bo'lsin. */}
            {kurslar.length > 0 && (
              <div className="border-2 border-slate-900 rounded p-1.5 my-1.5 space-y-1">
                <div className="text-center font-black text-[11px] tracking-wide text-slate-900 border-b border-slate-400 pb-0.5">
                  OLDINDAN TO'LANGAN
                </div>
                {kurslar.map((k, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-900">
                      <span>{k.nomi}</span>
                      <span className="font-mono">{k.soni} KUN</span>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center pt-0.5">
                      {Array.from({ length: k.soni }).map((_, n) => (
                        <span
                          key={n}
                          className={`text-[9px] font-mono border border-slate-700 rounded px-1 py-[1px] ${
                            n < k.ishlatilgan ? 'bg-slate-900 text-white font-black' : 'text-slate-700'
                          }`}
                        >
                          {n + 1}-kun{n < k.ishlatilgan ? ' ✓' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="text-center text-[9px] font-bold text-slate-900 border-t border-slate-400 pt-0.5">
                  Keyingi kunlarda QAYTA TO'LOV OLINMAYDI.
                  <br />
                  Ushbu chekni saqlang va har kelganingizda ko'rsating.
                </div>
              </div>
            )}

            {/* Oldindan to'langan kursning navbatdagi kuni — bu talonda
                to'lov yo'q, chunki pul birinchi kuni olingan. */}
            {firstPatient.is_prepaid_visit && (
              <div className="border-2 border-slate-900 rounded p-1.5 my-1.5 text-center space-y-0.5">
                <div className="font-black text-[11px] tracking-wide text-slate-900">
                  OLDINDAN TO'LANGAN TASHRIF
                </div>
                {/* Bemor bir kelishda bir necha muolaja olishi mumkin —
                    har biri o'z qatorida, nechanchi kuni ekani bilan. */}
                {(firstPatient.prepaid_lines || []).map((q, i) => (
                  <div key={i} className="flex justify-between text-[10px] font-bold text-slate-900">
                    <span>{cleanServiceName(q.service_name)}</span>
                    <span className="font-mono">{q.day}-kun / {q.total} kun</span>
                  </div>
                ))}
                <div className="text-[9px] font-bold text-slate-900">
                  Bugun to'lov olinmaydi.
                </div>
              </div>
            )}

            <div className="flex justify-between border-b border-slate-200 pb-1 pt-1">
              <span className="text-slate-600 font-bold">To'lov Turi:</span>
              <strong className="uppercase text-right text-slate-900">
                {firstPatient.payment_type === 'split' || firstPatient.payment_type === 'aralash'
                  ? `Aralash (${[
                      totalCash > 0 ? `${formatMoney(totalCash)} Naqd` : '',
                      totalCard > 0 ? `${formatMoney(totalCard)} Karta` : '',
                      (patient.click_amount || firstPatient.click_amount) > 0 ? `${formatMoney(patient.click_amount || firstPatient.click_amount)} Click` : '',
                      (patient.qr_amount || firstPatient.qr_amount) > 0 ? `${formatMoney(patient.qr_amount || firstPatient.qr_amount)} QR` : '',
                    ].filter(Boolean).join(' + ') || 'Aralash'})`
                  : paymentLabel(firstPatient.payment_type)}
              </strong>
            </div>

            {totalDiscount > 0 && (
              <>
                <div className="flex justify-between pt-1 text-slate-600">
                  <span>Xizmatlar summasi:</span>
                  <span className="font-mono">{formatMoney(totalAmount + totalDiscount)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>🏷️ Chegirma{discountReason ? ` (${discountReason})` : ''}:</span>
                  <span className="font-mono">-{formatMoney(totalDiscount)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between pt-1 font-bold text-xs border-t-2 border-slate-900 my-1">
              <span>{isPayLater ? "TO'LANISHI KERAK SUMMA:" : "TO'LANGAN SUMMA:"}</span>
              <span className="text-slate-900 font-mono font-black">{formatMoney(totalAmount)}</span>
            </div>

            {isPayLater && (
              <div className="my-1.5 p-2 bg-amber-100 border border-slate-900 rounded-lg text-[9px] text-slate-900 font-black text-center uppercase tracking-tight">
                ⚠️ TO'LOV KUTILMOQDA: QABULDAN SO'NG KASSAGA TO'LASHINGIZ SO'RALADI
              </div>
            )}

            <div className="text-[9px] text-slate-900 font-bold text-center pt-1">
              Sana: {dateStr}
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center border-t border-dashed border-slate-400 pt-2 space-y-1">
            <p className="font-bold text-[9px] text-slate-900">Marjona med servis sizning sog'lig'ingiz haqida qayg'uradi</p>
            <p className="font-bold text-[9px] text-slate-900">Iltimos, navbatingiz kelguncha TV ekranini kuzatib turing.</p>
            <p className="font-black text-[11px] text-slate-900 uppercase tracking-wider pt-1">BIZNI TANLAGANINGIZ UCHUN RAHMAT</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="no-print mt-5 flex gap-2">
          <Btn
            variant="outline"
            full
            size="md"
            onClick={onClose}
          >
            Yopish
          </Btn>

          <Btn
            variant="gold"
            full
            size="md"
            icon={<Printer className="h-4 w-4" />}
            onClick={handlePrint}
          >
            Chop Etish (Print)
          </Btn>
        </div>
      </div>
    </div>
  )
}
