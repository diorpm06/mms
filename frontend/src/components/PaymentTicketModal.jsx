import { Printer, X, AlertTriangle } from 'lucide-react'
import { formatMoney, paymentLabel } from '../utils/format'
import { Btn, Icons } from './UIKit'

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

  const rawTickets = patientList.map((p) => p.ticket_number || `A-${p.id}`).filter(Boolean)
  const uniqueTickets = Array.from(new Set(rawTickets))
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
    } else {
      allPrintItems.push({
        category: cleanCategory(p.service_category || p.category),
        service_name: cleanServiceName(p.service_name || p.diagnosis || p.title),
        payment_amount: p.payment_amount || p.price || 0,
        quantity: p.quantity || 1,
      })
    }
  })

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
            max-height: 18mm !important;
            height: 18mm !important;
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
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-muted transition-all"
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
          <div className="text-center pb-1.5 border-b border-dashed border-slate-400">
            <img src="/logo.png" alt="Marjona Med Servis Logo" className="logo-img h-16 max-h-16 mx-auto mb-1 object-contain" />
            <h2 className="font-black text-xs uppercase tracking-wide text-slate-900">MARJONA MED SERVIS</h2>
            <p className="text-[9px] text-slate-900 font-black mt-0.5">Tel: +998 (55) 604 44 24</p>
          </div>

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
              <strong className="text-slate-900 text-right">{firstPatient.first_name} {firstPatient.last_name}</strong>
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

            <div className="flex justify-between border-b border-slate-200 pb-1 pt-1">
              <span className="text-slate-600 font-bold">To'lov Turi:</span>
              <strong className="uppercase text-right text-slate-900">
                {firstPatient.payment_type === 'split' || firstPatient.payment_type === 'aralash'
                  ? `Aralash (${formatMoney(totalCash)} Naqd + ${formatMoney(totalCard)} Karta/2-Usul)`
                  : paymentLabel(firstPatient.payment_type)}
              </strong>
            </div>

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
