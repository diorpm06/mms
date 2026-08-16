import { Printer, X, Building2, CheckCircle2 } from 'lucide-react'
import { formatMoney } from '../utils/format'
import { BRAND } from '../config/brand'
import ReceiptHeader from './ReceiptHeader'

export default function InpatientReceiptModal({ inpatient, onClose }) {
  if (!inpatient) return null

  const handlePrint = () => {
    const container = document.getElementById('inpatient-receipt-container')
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

  const admitDate = inpatient.created_at
    ? new Date(inpatient.created_at).toLocaleDateString('uz-UZ')
    : new Date().toLocaleDateString('uz-UZ')

  const dischargeDate = inpatient.discharged_at
    ? new Date(inpatient.discharged_at).toLocaleDateString('uz-UZ')
    : new Date().toLocaleDateString('uz-UZ')

  const daysCount = inpatient.days_count || 1
  const dailyPrice = inpatient.daily_price || 0
  const totalPaid = inpatient.total_paid || (daysCount * dailyPrice)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto overscroll-contain">
      {/* ── PRINT-ONLY STYLES FOR POS THERMAL PRINTERS ── */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            width: 80mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          #root {
            display: none !important;
          }
          #print-clone {
            display: block !important;
            width: 80mm !important;
            padding: 3mm 4mm !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
          }
          #print-clone * {
            color: #000000 !important;
            opacity: 1 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-slate-600 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Success Header Notification */}
        <div className="no-print mb-4 flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300">
          <Building2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <strong className="block text-sm">Statsionar bemor kvitansiyasi (Выписка)</strong>
            Termoprinterda kvitansiyani chop etishingiz mumkin.
          </div>
        </div>

        {/* ── THERMAL RECEIPT CONTENT (PRINTABLE AREA) ────────────────── */}
        <div
          id="inpatient-receipt-container"
          className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs shadow-inner"
        >
          {/* Header */}
          <ReceiptHeader subtitle="Statsionar Bemor Kvitansiyasi" />

          {/* PALATA & KOYKA BADGE */}
          <div className="my-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-center">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
              PALATA / KOYKA
            </span>
            <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight font-mono my-0.5">
              {inpatient.room_number || 'Palata №1'}
            </div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {inpatient.doctor_name ? `Biriktirilgan vrach: ${inpatient.doctor_name}` : 'Statsionar Bo\'limi'}
            </div>
          </div>

          {/* Patient Info */}
          <div className="space-y-1.5 py-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-700">Mijoz:</span>
              <strong className="text-right">{inpatient.first_name} {inpatient.last_name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">Telefon:</span>
              <span>{inpatient.phone}</span>
            </div>
            {inpatient.diagnosis && (
              <div className="flex justify-between">
                <span className="text-slate-700">Tashxis:</span>
                <span className="font-bold text-right">{inpatient.diagnosis}</span>
              </div>
            )}
          </div>

          {/* Stay Details */}
          <div className="space-y-1.5 py-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-700">Yotqizilgan sana:</span>
              <span>{admitDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">Chiqarilgan sana:</span>
              <span>{dischargeDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">Jami kunlar:</span>
              <strong className="text-cyan-700 dark:text-cyan-300">{daysCount} kun</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">Kunlik stavka:</span>
              <span>{formatMoney(dailyPrice)}</span>
            </div>
          </div>

          {/* Total Amount */}
          <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between items-center text-sm font-extrabold">
              <span>JAMI TO'LOV:</span>
              <span className="text-base text-emerald-600 dark:text-emerald-400 font-mono">
                {formatMoney(totalPaid)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-700 mt-1">
              <span>Holat:</span>
              <span className="uppercase font-bold text-emerald-600">{inpatient.status === 'chiqdi' ? 'ЧИКДИ (ВЫПИСКА)' : 'YOTMOQDA'}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center">
            <div className="inline-block font-mono tracking-widest text-[14px] font-black border-t-2 border-b-2 border-slate-900 dark:border-slate-100 px-4 py-0.5">
              ||| ||||| |||| || |||||| | |||
            </div>
            <p className="text-[9px] text-slate-600 mt-2 italic">
              Klinikamizda davolanganingiz uchun rahmat! Tugal salomatlik tilaymiz!
            </p>
          </div>
        </div>

        {/* Modal Buttons */}
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
