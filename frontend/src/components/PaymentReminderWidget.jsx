import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { formatMoney } from '../utils/format'
import { useToastStore } from '../store/toastStore'
import { X, Check, CreditCard, DollarSign, Bell } from 'lucide-react'

export default function PaymentReminderWidget() {
  const [pendingItems, setPendingItems] = useState([])
  const [activeModalItem, setActiveModalItem] = useState(null)
  const [selectedPayType, setSelectedPayType] = useState('naqd')
  const [submitting, setSubmitting] = useState(false)
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

  return (
    <>
      {/* Floating Bottom-Left Container */}
      <div className="fixed bottom-5 left-5 z-50 max-w-sm w-full space-y-3 font-sans animate-in slide-in-from-bottom-5 duration-300">
        {pendingItems.map((item) => (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl transition-all hover:border-amber-400"
          >
            {/* Glowing Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 animate-pulse" />

            {/* Header / Ticket & Status Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 px-2.5 items-center justify-center rounded-lg bg-amber-500/20 font-mono font-black text-amber-400 text-xs border border-amber-500/40">
                  🎫 {item.ticket_number}
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                  <Bell className="h-3.5 w-3.5 animate-bounce text-amber-400" />
                  To'lov Kutilmoqda
                </span>
              </div>

              <span className="text-[10px] font-semibold text-slate-400">
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Body Info */}
            <div className="py-2.5 space-y-1.5">
              <p className="font-extrabold text-sm text-foreground tracking-tight flex items-center justify-between">
                <span>👤 {item.full_name}</span>
              </p>

              <div className="flex items-start justify-between gap-2 text-xs">
                <span className="text-slate-400 font-medium line-clamp-1">🩺 {item.reason}</span>
                <span className="font-mono font-black text-sm text-emerald-400 shrink-0">
                  {formatMoney(item.amount)}
                </span>
              </div>
            </div>

            {/* Action Button at Bottom */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModalItem(item)}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>To'lov Qildi</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Pay Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
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
