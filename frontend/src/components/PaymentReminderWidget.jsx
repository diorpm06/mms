import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { formatMoney } from '../utils/format'
import { useToastStore } from '../store/toastStore'
import { X, Check, Bell, ChevronDown, ChevronUp } from 'lucide-react'

export default function PaymentReminderWidget() {
  const [pendingItems, setPendingItems] = useState([])
  const [activeModalItem, setActiveModalItem] = useState(null)
  const [selectedPayType, setSelectedPayType] = useState('naqd')
  const [cashAmountInput, setCashAmountInput] = useState('')
  const [cardAmountInput, setCardAmountInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const toast = useToastStore((s) => s.add)

  const fetchPending = () => {
    api('/queue/pending-payments')
      .then((data) => {
        if (Array.isArray(data)) {
          setPendingItems(data)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 5000)
    return () => clearInterval(interval)
  }, [])

  // Auto-set initial split amounts when modal item changes
  useEffect(() => {
    if (activeModalItem) {
      const total = activeModalItem.amount || 0
      setCashAmountInput(Math.floor(total / 2))
      setCardAmountInput(Math.ceil(total / 2))
    }
  }, [activeModalItem])

  if (!pendingItems || pendingItems.length === 0) return null

  const handleCashChange = (val) => {
    const num = Number(val) || 0
    setCashAmountInput(val)
    const total = activeModalItem?.amount || 0
    setCardAmountInput(Math.max(0, total - num))
  }

  const handlePaySubmit = async (e) => {
    if (e) e.preventDefault()
    if (!activeModalItem) return
    const targetId = activeModalItem.patient_id || activeModalItem.id
    if (!targetId) {
      toast("Bemor ID topilmadi", "error")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        payment_type: selectedPayType || 'naqd',
      }
      if (selectedPayType === 'aralash') {
        payload.cash_amount = Number(cashAmountInput) || 0
        payload.card_amount = Number(cardAmountInput) || 0
      }

      await api(`/patients/${targetId}/pay-later`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      toast(`✓ ${activeModalItem.full_name} to'lovi (${(selectedPayType || 'naqd').toUpperCase()}) qabul qilindi!`)
      setActiveModalItem(null)
      fetchPending()
      window.dispatchEvent(new CustomEvent('payment-updated'))
    } catch (err) {
      toast(err.message || "To'lovni saqlashda xatolik", 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = pendingItems.reduce((acc, item) => acc + (item.amount || 0), 0)

  // Minimized Compact Pill Mode (sal kichik, ekranning o'ng pastki burchagida)
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/50 bg-slate-950/85 hover:bg-slate-900 text-amber-300 shadow-xl backdrop-blur-md transition-all hover:scale-105 group"
          title="To'lov eslatmalarini ochish"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <Bell className="h-3.5 w-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-black tracking-wide">
            {pendingItems.length} ta to'lov
          </span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-500/30">
            {formatMoney(totalAmount)}
          </span>
          <ChevronUp className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Floating Bottom-Right Container - Compact & Translucent */}
      <div className="fixed bottom-4 right-4 z-50 w-72 max-w-[288px] space-y-2 font-sans opacity-90 hover:opacity-100 transition-opacity duration-200 animate-in slide-in-from-bottom-4">
        {/* Header Bar with Minimize Button */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-t-xl bg-slate-900/90 border border-amber-500/40 text-[11px] font-bold text-amber-300 backdrop-blur-md shadow-md">
          <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-400">
            <Bell className="h-3.5 w-3.5 animate-pulse text-amber-400" />
            To'lov Kutilmoqda ({pendingItems.length})
          </span>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition-colors"
            title="Kichiklashtirish / Yashirish"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Yashirish</span>
          </button>
        </div>

        {/* Pending Items List */}
        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-slate-950/85 p-3 shadow-xl backdrop-blur-md transition-all hover:border-amber-400 hover:bg-slate-950/95"
            >
              {/* Glowing Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

              {/* Header / Ticket & Status */}
              <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-amber-500/20">
                <span className="flex h-5 px-2 items-center justify-center rounded-md bg-amber-500/20 font-mono font-black text-amber-300 text-[11px] border border-amber-500/30">
                  🎫 {item.ticket_number}
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Body Info */}
              <div className="py-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-xs text-slate-100 truncate max-w-[170px]" title={item.full_name}>
                    👤 {item.full_name}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-slate-400 font-medium truncate max-w-[130px]" title={item.reason}>
                    🩺 {item.reason}
                  </span>
                  <span className="font-mono font-black text-xs text-emerald-400 shrink-0">
                    {formatMoney(item.amount)}
                  </span>
                </div>
              </div>

              {/* Action Button at Bottom */}
              <div className="pt-1.5 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setActiveModalItem(item)}
                  className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[11px] uppercase tracking-wider shadow-md hover:shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  <span>To'lov Qildi</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Pay Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handlePaySubmit}
            className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <h4 className="font-black text-amber-400 text-base tracking-wide">To'lovni Qabul Qilish</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Patient & Details Box */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-300 font-semibold">
                Bemor: <strong className="text-white font-extrabold">{activeModalItem.full_name}</strong>{' '}
                <span className="text-cyan-400 font-mono font-bold">({activeModalItem.ticket_number})</span>
              </p>
              <p className="text-slate-300 font-semibold">
                Xizmat / Sarflangan: <strong className="text-amber-300 font-bold">{activeModalItem.reason}</strong>
              </p>
              <div className="flex justify-between items-center pt-2.5 border-t border-slate-800">
                <span className="text-slate-200 font-extrabold text-xs">To'lov Summasi:</span>
                <span className="text-emerald-400 font-mono text-lg font-black tracking-tight">
                  {formatMoney(activeModalItem.amount)}
                </span>
              </div>
            </div>

            {/* Select Pay Type (4 Options Grid) */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-100 uppercase tracking-wider block">
                To'lov Turini Tanlang:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'naqd', label: '💵 Naqd pul' },
                  { id: 'karta', label: '💳 Karta / Terminal' },
                  { id: 'payme', label: '📱 QR-kod / Payme' },
                  { id: 'aralash', label: '🔀 Aralash (Naqd+Karta)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedPayType(t.id)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all text-left flex items-center justify-between ${
                      selectedPayType === t.id
                        ? 'border-amber-400 bg-amber-500/25 text-amber-300 shadow-md scale-[1.02]'
                        : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <span>{t.label}</span>
                    {selectedPayType === t.id && <span className="text-amber-400 font-black">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Aralash / Split Inputs */}
            {selectedPayType === 'aralash' && (
              <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/30 space-y-2.5 text-xs animate-in fade-in">
                <div className="text-amber-300 font-extrabold text-[11px] uppercase tracking-wide">
                  🔀 Aralash To'lov Taqsimoti:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-300 font-bold block mb-1">Naqd Summasi:</label>
                    <input
                      type="number"
                      value={cashAmountInput}
                      onChange={(e) => handleCashChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold text-xs focus:border-amber-400 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-300 font-bold block mb-1">Karta Summasi:</label>
                    <input
                      type="number"
                      value={cardAmountInput}
                      onChange={(e) => setCardAmountInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold text-xs focus:border-amber-400 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-right font-mono font-semibold">
                  Jami: <strong className="text-emerald-400">{formatMoney((Number(cashAmountInput) || 0) + (Number(cardAmountInput) || 0))}</strong> / {formatMoney(activeModalItem.amount)}
                </div>
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                {submitting ? "Saqlanmoqda..." : "TASDIQLASH ✓"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

