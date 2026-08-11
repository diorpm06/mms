import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { formatMoney } from '../utils/format'
import { useToastStore } from '../store/toastStore'
import { X, Check, Bell, ChevronDown, ChevronUp } from 'lucide-react'

export default function PaymentReminderWidget() {
  const [pendingItems, setPendingItems] = useState([])
  const [activeModalItem, setActiveModalItem] = useState(null)
  const [selectedPayType, setSelectedPayType] = useState('naqd')
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

  if (!pendingItems || pendingItems.length === 0) return null

  const handlePaySubmit = async () => {
    if (!activeModalItem) return
    setSubmitting(true)
    try {
      await api(`/patients/${activeModalItem.patient_id}/pay-later`, {
        method: 'POST',
        body: JSON.stringify({
          payment_type: selectedPayType,
        }),
      })
      toast(`✓ ${activeModalItem.full_name} to'lovi (${selectedPayType.toUpperCase()}) qabul qilindi!`)
      setActiveModalItem(null)
      fetchPending()
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
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <h4 className="font-extrabold text-amber-400 text-sm">To'lovni Qabul Qilish</h4>
              </div>
              <button onClick={() => setActiveModalItem(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <p className="text-slate-400">Bemor: <strong className="text-white">{activeModalItem.full_name}</strong> (#{activeModalItem.ticket_number})</p>
              <p className="text-slate-400">Xizmat: <strong className="text-amber-300">{activeModalItem.reason}</strong></p>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold">
                <span>To'lov Summasi:</span>
                <span className="text-emerald-400 font-mono text-base">{formatMoney(activeModalItem.amount)}</span>
              </div>
            </div>

            {/* Select Pay Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">To'lov Turini Tanlang:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'naqd', label: '💵 Naqd pul' },
                  { id: 'karta', label: '💳 Karta / Click' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedPayType(t.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      selectedPayType === t.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-xs font-bold hover:bg-slate-800"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handlePaySubmit}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-lg shadow-emerald-600/30"
              >
                {submitting ? "Saqlanmoqda..." : "Tasdiqlash ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

