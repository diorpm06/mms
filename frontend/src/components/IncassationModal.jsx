import { useEffect, useState } from 'react'
import { Wallet, Printer, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api } from '../utils/api'
import { formatMoney } from '../utils/format'
import { useToastStore } from '../store/toastStore'

export default function IncassationModal({ open, onClose }) {
  const [shiftData, setShiftData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actualCash, setActualCash] = useState('')
  const [incassationAmount, setIncassationAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [completedSlip, setCompletedSlip] = useState(null)
  const toast = useToastStore((s) => s.add)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api('/incassation/current-shift')
      .then((res) => {
        setShiftData(res)
        setActualCash(String(res.expected_cash_in_drawer || 0))
        setIncassationAmount(String(res.expected_cash_in_drawer || 0))
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const handleCloseShift = async (e) => {
    e.preventDefault()
    try {
      const res = await api('/incassation/close-shift', {
        method: 'POST',
        body: JSON.stringify({
          actual_cash: +actualCash || 0,
          incassation_amount: +incassationAmount || 0,
          notes: notes,
        }),
      })
      toast("Smena yopildi va inkassatsiya topshirildi ✓")
      setCompletedSlip(res)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handlePrint = () => {
    const container = document.getElementById('incassation-slip-container')
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

  const expected = shiftData?.expected_cash_in_drawer || 0
  const actual = +actualCash || 0
  const variance = actual - expected

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
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

      <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-2 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {completedSlip ? (
          /* COMPLETED INCASSATION PRINT SLIP AREA */
          <div className="space-y-4">
            <div className="no-print p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Smena muvaffaqiyatli yopildi! Dalolatnomani chop eting.</span>
            </div>

            <div id="incassation-slip-container" className="bg-white text-slate-900 p-5 rounded-2xl font-mono text-xs space-y-3 border border-slate-300 shadow-inner">
              <div className="text-center pb-2 border-b border-dashed border-slate-900">
                <div className="flex justify-center mb-1">
                  <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
                </div>
                <h2 className="font-black text-base uppercase text-slate-900">MARJONA MED SERVICE</h2>
                <p className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Kassa Inkassatsiya Dalolatnomasi</p>
                <p className="text-[10px] text-slate-900 mt-0.5">Sana: {new Date().toLocaleString('uz-UZ')}</p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-900">
                <div className="flex justify-between"><span>Kassir:</span><strong className="text-slate-900">{completedSlip.cashier_name}</strong></div>
                <div className="flex justify-between"><span>Sana:</span><span className="text-slate-900">{completedSlip.date}</span></div>
                <div className="border-t border-dashed border-slate-900 my-1 pt-1" />
                <div className="flex justify-between"><span>Kassadagi Naqd:</span><span className="font-bold text-slate-900">{formatMoney(completedSlip.expected_cash)}</span></div>
                <div className="flex justify-between"><span>Sanalgan Naqd:</span><span className="font-bold text-slate-900">{formatMoney(completedSlip.actual_cash)}</span></div>
                <div className="flex justify-between font-black border-t-2 border-b-2 border-slate-900 py-1.5 my-1 text-sm text-slate-900">
                  <span>Seyfga topshirildi:</span>
                  <span className="text-slate-900 font-mono font-black">{formatMoney(completedSlip.incassation_amount)}</span>
                </div>
                {completedSlip.variance !== 0 && (
                  <div className="flex justify-between text-slate-900 font-black">
                    <span>Farq (Kamomad/Ortiqcha):</span>
                    <span className="text-slate-900">{formatMoney(completedSlip.variance)}</span>
                  </div>
                )}
                {completedSlip.notes && (
                  <div className="text-[10px] text-slate-900 pt-1">
                    <span>Izoh: </span>
                    <span className="italic font-semibold text-slate-900">{completedSlip.notes}</span>
                  </div>
                )}
              </div>

              <div className="pt-6 text-[10px] text-center border-t border-slate-900 space-y-4">
                <div className="flex justify-between items-center text-slate-900">
                  <span>Kassir Imzosi:</span>
                  <span className="font-bold">_____________________</span>
                </div>
                <div className="flex justify-between items-center text-slate-900">
                  <span>Rahbar / Mas'ul Imzosi:</span>
                  <span className="font-bold">_____________________</span>
                </div>
                <p className="text-[9px] text-slate-900 italic pt-2">
                  *** Smena yopilganligi haqida dalolatnoma ***
                </p>
              </div>
            </div>

            <div className="no-print flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-outline py-2 px-4 text-xs font-bold">Yopish</button>
              <button type="button" onClick={handlePrint} className="btn-gold py-2 px-5 text-xs font-black flex items-center gap-1.5 shadow-md">
                <Printer className="h-4 w-4" /> Chop etish (Print)
              </button>
            </div>
          </div>
        ) : (
          /* SHIFT CLOSURE AUDIT FORM */
          <form onSubmit={handleCloseShift} className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Wallet className="h-5 w-5 text-gold" />
              <h3 className="font-extrabold text-base text-foreground">Smenani Yopish va Inkassatsiya</h3>
            </div>

            {loading ? (
              <p className="text-xs text-muted">Yuklanmoqda...</p>
            ) : (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 rounded-2xl bg-surface-2/30 border border-border space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted">Bugungi naqd tushum:</span><strong className="text-emerald-400 font-mono">{formatMoney(shiftData?.cash_payments)}</strong></div>
                  <div className="flex justify-between"><span className="text-muted">Bugungi karta tushum:</span><strong className="text-cyan-400 font-mono">{formatMoney(shiftData?.card_payments)}</strong></div>
                  <div className="flex justify-between"><span className="text-muted">Bugungi naqd harajat:</span><strong className="text-rose-400 font-mono">-{formatMoney(shiftData?.today_expenses)}</strong></div>
                  <div className="flex justify-between pt-1 border-t border-border font-bold">
                    <span className="text-gold">Kassada bo'lishi kerak bo'lgan naqd:</span>
                    <span className="text-gold font-mono text-sm">{formatMoney(expected)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-muted font-bold block mb-1">Qo'lda sanalgan naqd pul miqdori *</label>
                  <input
                    type="number"
                    className="input-field font-mono text-sm font-bold"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    required
                  />
                </div>

                {variance !== 0 && (
                  <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${variance < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Farq: {variance > 0 ? '+' : ''}{formatMoney(variance)} {variance < 0 ? '(Kamomad)' : '(Ortiqcha)'}</span>
                  </div>
                )}

                <div>
                  <label className="text-muted font-bold block mb-1">Seyfga topshiriladigan inkassatsiya summasi *</label>
                  <input
                    type="number"
                    className="input-field font-mono text-sm font-bold text-cyan-400"
                    value={incassationAmount}
                    onChange={(e) => setIncassationAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-muted font-bold block mb-1">Izoh (ixtiyoriy)</label>
                  <input
                    className="input-field"
                    placeholder="Smena yopilishi izohi..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-gold w-full py-3 text-sm font-black shadow-lg mt-2">
                  Smenani Yopish va Inkassatsiya Topshirish ✓
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
