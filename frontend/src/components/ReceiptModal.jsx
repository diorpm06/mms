import { Printer, X, CheckCircle2 } from 'lucide-react'
import { formatMoney } from '../utils/format'

export default function ReceiptModal({ patient, onClose }) {
  if (!patient) return null

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
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Success Header Notification */}
        <div className="no-print mb-4 flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <strong className="block text-sm">To'lov muvaffaqiyatli qabul qilindi!</strong>
            Kassa chekini termoprinterda chop etishingiz mumkin.
          </div>
        </div>

        {/* ── THERMAL RECEIPT CONTENT (PRINTABLE AREA) ────────────────── */}
        <div
          id="thermal-receipt-container"
          className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs shadow-inner"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <img src="/logo.png" alt="Marjona Med Servis Logo" className="logo-img h-16 max-h-16 mx-auto mb-1 object-contain" />
            <h2 className="text-base font-black tracking-wider uppercase text-slate-900 dark:text-slate-100">MARJONA MED SERVIS</h2>
            <p className="text-[10px] text-slate-900 dark:text-slate-200 font-black mt-0.5">Tel: +998 (55) 604 44 24</p>
          </div>

          {/* GIANT QUEUE TICKET NUMBER */}
          <div className="ticket-number-box my-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-900 rounded-xl text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
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
              <span className="text-slate-500">Mijoz:</span>
              <strong className="text-right">{patient.first_name} {patient.last_name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Telefon:</span>
              <span>{patient.phone}</span>
            </div>
            {patient.birth_date && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tug'ilgan sana:</span>
                <span>{new Date(patient.birth_date).toLocaleDateString('uz-UZ')}</span>
              </div>
            )}
            {patient.address && (
              <div className="flex justify-between">
                <span className="text-slate-500">Manzil:</span>
                <span>{patient.address}</span>
              </div>
            )}
          </div>

          {/* Service & Payment Info */}
          <div className="space-y-1.5 py-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Xizmat turi:</span>
              <strong className="text-right text-cyan-700 dark:text-cyan-300">{patient.service_name || 'Umumiy ko\'rik'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Shifokor:</span>
              <span>{patient.provider_name || '—'}</span>
            </div>
            {patient.referrer_name && (
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Yo'naltiruvchi:</span>
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
            <div className="flex justify-between items-center text-sm font-extrabold">
              <span>TO'LANGAN SUMMA:</span>
              <span className="text-base text-emerald-600 dark:text-emerald-400 font-mono">
                {formatMoney(patient.payment_amount)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>To'lov turi:</span>
              <span className="uppercase font-bold">{patient.payment_type === 'cash' ? 'NAQT KASSA' : 'KARTA'}</span>
            </div>
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
