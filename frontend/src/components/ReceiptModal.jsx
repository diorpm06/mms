import { Printer, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { formatMoney } from '../utils/format'
import { BRAND } from '../config/brand'
import ReceiptHeader from './ReceiptHeader'

export default function ReceiptModal({ patient, onClose }) {
  if (!patient) return null

  const isPayLater = ['later', 'keyinroq', 'nasiya', 'qarz'].includes(String(patient.payment_type || '').toLowerCase())

  const handlePrint = () => {
    const container = document.getElementById('thermal-receipt-container')
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

  const ticket = patient.ticket_number || `A-${patient.id}`
  const createdDate = patient.created_at
    ? new Date(patient.created_at).toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('uz-UZ')

  const cleanServiceName = (name) => {
    if (!name) return "Umumiy ko'rik"
    let str = String(name).trim()
    if (str.startsWith('Sarflangan Material (') && str.endsWith(')')) {
      str = str.slice(21, -1).trim()
    }
    if (str.startsWith('Material: ')) {
      str = str.slice(10).trim()
    }
    return str || "Umumiy ko'rik"
  }

  const cleanCategory = (cat) => {
    if (!cat || cat === 'Ombor Materiali') return 'Umumiy'
    return cat
  }

  const allPrintItems = []
  const isBatch = patient.batch && Array.isArray(patient.patients)
  const patientList = isBatch ? patient.patients : [patient]

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
          #print-clone .bg-slate-100, #print-clone .bg-white, #print-clone .bg-slate-50 {
            background: #f1f5f9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 my-auto">
        
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-slate-600 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Notification (Pay Later vs Paid) */}
        {isPayLater ? (
          <div className="no-print mb-4 flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="text-xs">
              <strong className="block text-sm font-black">To'lov keyinroq amalga oshiriladi!</strong>
              Ushbu chek to'lov eslatmasi (nasiya cheki) sifatida tayyorlandi.
            </div>
          </div>
        ) : (
          <div className="no-print mb-4 flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <strong className="block text-sm font-black">To'lov muvaffaqiyatli qabul qilindi!</strong>
              Kassa chekini termoprinterda chop etishingiz mumkin.
            </div>
          </div>
        )}

        {/* ── THERMAL RECEIPT CONTENT (PRINTABLE AREA) ────────────────── */}
        <div
          id="thermal-receipt-container"
          className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs shadow-inner"
        >
          {/* Header */}
          <ReceiptHeader />

          {/* GIANT QUEUE TICKET NUMBER */}
          <div className="ticket-number-box my-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-900 rounded-xl text-center">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest block">
              SIZNING NAVBATINGIZ:
            </span>
            <div className="ticket-number-text text-4xl font-black text-slate-900 tracking-tight font-mono my-0.5 break-all leading-tight">
              {ticket}
            </div>
            <div className="text-xs font-bold text-slate-900 uppercase">
              {patient.cabinet || patient.provider_name || 'Qabulxona'}
            </div>
          </div>

          {/* Patient Info */}
          <div className="space-y-1.5 py-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-700">Mijoz:</span>
              <strong className="text-right">{patient.first_name} {patient.last_name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">Telefon:</span>
              <span>{patient.phone}</span>
            </div>
            {patient.birth_date && (
              <div className="flex justify-between">
                <span className="text-slate-700">Tug'ilgan sana:</span>
                <span>{new Date(patient.birth_date).toLocaleDateString('uz-UZ')}</span>
              </div>
            )}
            {patient.address && (
              <div className="flex justify-between">
                <span className="text-slate-700">Manzil:</span>
                <span>{patient.address}</span>
              </div>
            )}
          </div>

          {/* Service & Payment Info */}
          <div className="space-y-1.5 py-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <span className="text-slate-700 font-bold text-[10px] block">
              Xizmatlar va Ishlatilgan Materiallar ({allPrintItems.length} ta):
            </span>
            {Object.entries(
              allPrintItems.reduce((acc, item) => {
                const cat = item.category || 'Umumiy'
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(item)
                return acc
              }, {})
            ).map(([catName, list]) => (
              <div key={catName} className="space-y-1">
                <span className="font-black text-slate-800 dark:text-slate-200 text-[10px] block uppercase tracking-wide bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                  📁 {catName}
                </span>
                {list.map((it, i) => (
                  <div key={i} className="flex justify-between text-xs pl-1 font-mono">
                    <span className="text-slate-900 dark:text-slate-100 font-medium">
                      • {it.service_name}{it.quantity && it.quantity > 1 ? ` (${it.quantity} ta)` : ''}
                    </span>
                    <strong className="text-slate-900 dark:text-slate-100 font-bold font-mono">
                      {formatMoney(it.payment_amount || 0)}
                    </strong>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex justify-between pt-1 text-[11px]">
              <span className="text-slate-700">Shifokor:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{patient.provider_name || '—'}</span>
            </div>
            {patient.referrer_name && (
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-700">Yo'naltiruvchi:</span>
                <span>{patient.referrer_name}</span>
              </div>
            )}
          </div>

          {/* Total Amount */}
          <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1">
            {patient.discount_amount > 0 && (
              <div className="flex justify-between text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                <span>🏷️ Chegirma ({patient.discount_reason || 'Aksiya'}):</span>
                <span>-{formatMoney(patient.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs font-extrabold">
              <span>{isPayLater ? "TO'LANISHI KERAK SUMMA:" : "TO'LANGAN SUMMA:"}</span>
              <span className={`text-base font-mono ${isPayLater ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatMoney(patient.payment_amount)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-700 mt-1">
              <span>To'lov turi / holati:</span>
              <span className={`uppercase font-bold ${isPayLater ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                {isPayLater
                  ? "KEYINROQ TO'LANADI (NASIYA)"
                  : (patient.payment_type === 'cash' || patient.payment_type === 'naqd' ? 'NAQT KASSA' : 'KARTA')}
              </span>
            </div>

            {isPayLater && (
              <div className="mt-2.5 p-2 bg-amber-100 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-700 rounded-lg text-[10px] text-amber-900 dark:text-amber-200 font-black text-center uppercase tracking-tight">
                ⚠️ TO'LOV KUTILMOQDA: QABULDAN SO'NG KASSAGA TO'LASHINGIZ SO'RALADI
              </div>
            )}
          </div>

          {/* Timestamp & Cashier */}
          <div className="pt-3 text-[10px] text-slate-900 dark:text-slate-200 font-bold flex justify-between">
            <span>Sana/Vaqt: {createdDate}</span>
            <span>Kassa: {patient.creator_name || 'Admin'}</span>
          </div>

          {/* Footer Note */}
          <div className="mt-4 text-center border-t border-dashed border-slate-300 dark:border-slate-700 pt-3 space-y-1">
            <p className="font-bold text-[9px] text-slate-900 dark:text-slate-100">Marjona med servis sizning sog'lig'ingiz haqida qayg'uradi</p>
            <p className="font-bold text-[9px] text-slate-900 dark:text-slate-200">Iltimos, navbatingiz kelguncha TV ekranini kuzatib turing.</p>
            <p className="font-black text-[11px] text-slate-900 dark:text-slate-100 uppercase tracking-wider pt-1">BIZNI TANLAGANINGIZ UCHUN RAHMAT</p>
          </div>
        </div>

        {/* Modal Buttons (Hidden when printing) */}
        <div className="no-print mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-all"
          >
            Yopish
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all transform active:scale-95"
          >
            <Printer className="h-4 w-4" />
            🖨️ Chekni chop etish (Print)
          </button>
        </div>
      </div>
    </div>
  )
}
