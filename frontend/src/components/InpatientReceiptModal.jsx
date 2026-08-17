import { Printer, X, Building2 } from 'lucide-react'
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

  const admitDate = inpatient.admitted_at || inpatient.created_at
    ? new Date(inpatient.admitted_at || inpatient.created_at).toLocaleDateString('uz-UZ')
    : new Date().toLocaleDateString('uz-UZ')

  const dischargeDate = inpatient.discharged_at
    ? new Date(inpatient.discharged_at).toLocaleDateString('uz-UZ')
    : new Date().toLocaleDateString('uz-UZ')

  const daysCount = inpatient.days || inpatient.days_count || 1
  const dailyPrice = inpatient.daily_rate || inpatient.daily_price || 0
  const roomTotal = inpatient.room_total || (daysCount * dailyPrice)

  const items = inpatient.items || []
  const payments = inpatient.payments || []

  const extraItemsTotal = inpatient.extra_items_total || items.filter(it => !it.is_included_in_tariff).reduce((sum, it) => sum + (it.total_price || 0), 0)
  const grandTotal = inpatient.total_amount || (roomTotal + extraItemsTotal)
  const paidTotal = inpatient.paid_total || inpatient.total_paid || payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const balanceDue = inpatient.balance_due !== undefined ? inpatient.balance_due : Math.max(0, grandTotal - paidTotal)

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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 my-8">
        
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
          className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs shadow-inner"
        >
          {/* Header */}
          <ReceiptHeader subtitle="Statsionar Bemor Kvitansiyasi" />

          {/* PALATA & KOYKA BADGE */}
          <div className="my-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-center">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
              PALATA / KOYKA
            </span>
            <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight font-mono">
              {inpatient.room_number || 'Palata'}/{inpatient.bed_number || '1'}
            </div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {inpatient.tariff_name ? `Tarif: ${inpatient.tariff_name}` : 'Standart Palata'}
            </div>
          </div>

          {/* Patient Info */}
          <div className="space-y-1 py-2 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-700">Mijoz:</span>
              <strong className="text-right">{inpatient.first_name} {inpatient.last_name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">Telefon:</span>
              <span>{inpatient.phone}</span>
            </div>
            {inpatient.doctor_name && (
              <div className="flex justify-between">
                <span className="text-slate-700">Vrach:</span>
                <span>{inpatient.doctor_name}</span>
              </div>
            )}
            {inpatient.diagnosis && (
              <div className="flex justify-between">
                <span className="text-slate-700">Tashxis:</span>
                <span className="font-bold text-right">{inpatient.diagnosis}</span>
              </div>
            )}
          </div>

          {/* Stay & Room Cost */}
          <div className="space-y-1 py-2 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-700">Yotqizilgan:</span>
              <span>{admitDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700">Chiqarilgan:</span>
              <span>{dischargeDate}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Palata: {daysCount} kun × {formatMoney(dailyPrice)}</span>
              <span>{formatMoney(roomTotal)}</span>
            </div>
          </div>

          {/* Additional Items & Materials */}
          {items && items.length > 0 && (
            <div className="py-2 border-b border-dashed border-slate-300 dark:border-slate-700">
              <div className="font-bold text-slate-700 uppercase mb-1 text-[10px]">Qo'shimcha Xizmatlar / Materiallar:</div>
              <div className="space-y-1">
                {items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>
                      {it.name} ({it.quantity}x)
                      {it.is_included_in_tariff && <span className="text-cyan-600 font-bold ml-1">(Tarifda)</span>}
                    </span>
                    <span className="font-bold">
                      {it.is_included_in_tariff ? '0 so\'m' : formatMoney(it.total_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments Breakdown */}
          {payments && payments.length > 0 && (
            <div className="py-2 border-b border-dashed border-slate-300 dark:border-slate-700">
              <div className="font-bold text-slate-700 uppercase mb-1.5 text-[10px]">Qilingan To'lovlar Tarixi (Sanalari bilan):</div>
              <div className="space-y-1.5">
                {payments.map((p, idx) => {
                  const stLabel = p.payment_stage === 'advance' ? '🟢 Bosh to\'lov' : (p.payment_stage === 'interim' ? '🟡 Oraliq to\'lov' : '🔴 Chiqish to\'lovi')
                  const pTypeMap = { cash: 'Naqd', card: 'Karta', click: 'Click', payme: 'Payme', split: 'Aralash', qr: 'QR Kod', later: 'Nasiya' }
                  const typeLabel = pTypeMap[p.payment_type] || p.payment_type || 'Naqd'
                  const pDate = p.created_at ? new Date(p.created_at).toLocaleDateString('uz-UZ') : ''
                  const daysTxt = p.days_count ? ` • ${p.days_count} kunlik` : ''

                  return (
                    <div key={idx} className="flex justify-between items-start text-[11px] bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {idx + 1}-to'lov {pDate ? `(${pDate})` : ''}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {stLabel} • {typeLabel}{daysTxt}
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono pt-0.5">
                        - {formatMoney(p.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div className="py-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-700">Jami Hisoblangan Summa:</span>
              <strong className="font-mono">{formatMoney(grandTotal)}</strong>
            </div>
            {paidTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-700">- Jami To'langan (Bosh to'lov/Oraliq):</span>
                <strong className="font-mono text-emerald-600">- {formatMoney(paidTotal)}</strong>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-extrabold pt-1 border-t border-slate-300 dark:border-slate-700">
              <span>QOLDIQ (TO'LANADIGAN):</span>
              <span className="text-base text-rose-600 dark:text-rose-400 font-mono">
                {balanceDue > 0 ? formatMoney(balanceDue) : '0 so\'m (To\'liq)'}
              </span>
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
