import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { formatMoney } from '../utils/format'
import { useToastStore } from '../store/toastStore'
import { X, Check, Bell, ChevronDown, ChevronUp, Printer, Receipt } from 'lucide-react'
import PaymentTicketModal from './PaymentTicketModal'

export default function PaymentReminderWidget() {
  const [pendingItems, setPendingItems] = useState([])
  const [activeModalItem, setActiveModalItem] = useState(null)
  const [receiptPatient, setReceiptPatient] = useState(null)
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
    // Nasiya eslatmasi tez-tez o'zgarmaydi — 5 soniya o'rniga 15.
    // Har bir ochiq panel daqiqasiga 12 ta so'rov yuborardi, endi 4 ta.
    const interval = setInterval(fetchPending, 15000)
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
        related_patient_ids: activeModalItem.related_patient_ids || [targetId],
      }
      if (selectedPayType === 'aralash') {
        payload.cash_amount = Number(cashAmountInput) || 0
        payload.card_amount = Number(cardAmountInput) || 0
      }

      const res = await api(`/patients/${targetId}/pay-later`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      toast(`✓ ${activeModalItem.full_name} to'lovi (${(selectedPayType || 'naqd').toUpperCase()}) qabul qilindi!`)

      // Construct patient object for thermal receipt printing modal
      const paidData = res?.patient || {}
      const breakdownItems = activeModalItem.breakdown || []

      const receiptObj = {
        ...paidData,
        first_name: paidData.first_name || activeModalItem.first_name,
        last_name: paidData.last_name || activeModalItem.last_name,
        ticket_number: activeModalItem.ticket_number || paidData.ticket_number,
        payment_amount: activeModalItem.amount || paidData.payment_amount,
        payment_type: selectedPayType || 'naqd',
        cash_amount: selectedPayType === 'aralash' ? Number(cashAmountInput) : (selectedPayType === 'naqd' ? activeModalItem.amount : 0),
        card_amount: selectedPayType === 'aralash' ? Number(cardAmountInput) : (selectedPayType === 'karta' ? activeModalItem.amount : 0),
        sub_items: breakdownItems.map((b) => ({
          service_name: b.title || b.service_name || 'Tibbiy Xizmat',
          category: b.category || 'Umumiy',
          price: b.price || 0,
          quantity: b.quantity || 1,
        })),
      }

      setActiveModalItem(null)
      setReceiptPatient(receiptObj)
      fetchPending()
      window.dispatchEvent(new CustomEvent('payment-updated'))
    } catch (err) {
      toast(err.message || "To'lovni saqlashda xatolik", 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = (pendingItems || []).reduce((acc, item) => acc + (item.amount || 0), 0)

  if (!pendingItems || pendingItems.length === 0) return (
    <>
      <PaymentTicketModal
        open={!!receiptPatient}
        patient={receiptPatient}
        onClose={() => setReceiptPatient(null)}
      />
    </>
  )

  // Minimized Compact Pill Mode
  if (isMinimized) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/50 bg-surface-sunken hover:bg-surface text-amber-300 shadow-xl backdrop-blur-md transition-all hover:scale-105 group"
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
            <ChevronUp className="h-3.5 w-3.5 text-muted group-hover:text-body" />
          </button>
        </div>

        <PaymentTicketModal
          open={!!receiptPatient}
          patient={receiptPatient}
          onClose={() => setReceiptPatient(null)}
        />
      </>
    )
  }

  return (
    <>
      {/* Floating Bottom-Right Container - Compact & Translucent */}
      <div className="fixed bottom-4 right-4 z-50 w-72 max-w-[288px] space-y-2 font-sans opacity-90 hover:opacity-100 transition-opacity duration-200 animate-in slide-in-from-bottom-4">
        {/* Header Bar with Minimize Button */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-t-xl bg-surface border border-amber-500/40 text-[11px] font-bold text-amber-300 backdrop-blur-md shadow-md">
          <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-400">
            <Bell className="h-3.5 w-3.5 animate-pulse text-amber-400" />
            To'lov Kutilmoqda ({pendingItems.length})
          </span>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-2 hover:bg-surface-hover text-body hover:text-body text-[10px] transition-colors"
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
              onClick={() => setActiveModalItem(item)}
              className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-surface-sunken p-3 shadow-xl backdrop-blur-md transition-all hover:border-amber-400 hover:bg-surface-sunken cursor-pointer group"
            >
              {/* Glowing Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

              {/* Header / Ticket & Status */}
              <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-amber-500/20">
                <span className="flex h-5 px-2 items-center justify-center rounded-md bg-amber-500/20 font-mono font-black text-amber-300 text-[11px] border border-amber-500/30">
                  🎫 {item.ticket_number}
                </span>
                <span className="text-[10px] font-medium text-muted">
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Body Info */}
              <div className="py-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-extrabold text-xs text-body truncate max-w-[170px]" title={item.full_name}>
                    👤 {item.full_name}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-muted font-medium truncate max-w-[130px]" title={item.reason}>
                    🩺 {item.reason}
                  </span>
                  <span className="font-mono font-black text-xs text-emerald-400 shrink-0">
                    {formatMoney(item.amount)}
                  </span>
                </div>
              </div>

              {/* Action Button at Bottom */}
              <div className="pt-1.5 border-t border-border">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveModalItem(item)
                  }}
                  className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[11px] uppercase tracking-wider shadow-md hover:shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  <span>To'lov Qildi / Tafsilotlar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Pay & Detailed Breakdown Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handlePaySubmit}
            className="bg-surface border border-amber-500/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <div>
                  <h4 className="font-black text-amber-400 text-base tracking-wide">To'lov Eslatmasi va Qabul Qilish</h4>
                  <p className="text-[11px] text-muted font-medium">Quyida bu pul nimalar hisobiga kelib chiqqani ro'yxati ko'rsatilgan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="text-muted hover:text-body p-1 rounded-lg hover:bg-surface-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Patient Info Box */}
            <div className="bg-surface-sunken p-3 rounded-xl border border-border text-xs flex justify-between items-center">
              <div>
                <span className="text-muted text-[10px] block uppercase font-bold">Bemor:</span>
                <strong className="text-body text-sm font-extrabold">{activeModalItem.full_name}</strong>
                {activeModalItem.phone && <span className="text-muted text-[11px] block">📱 {activeModalItem.phone}</span>}
              </div>
              <div className="text-right">
                <span className="text-muted text-[10px] block uppercase font-bold">Navbat chiptasi:</span>
                <span className="inline-block bg-amber-500/20 text-amber-300 font-mono font-black text-xs px-2 py-0.5 rounded border border-amber-500/40">
                  🎫 {activeModalItem.ticket_number}
                </span>
              </div>
            </div>

            {/* Breakdown List ("Nimalar Hisobiga Kelib Chiqqani Ro'yxati") */}
            <div className="space-y-2 bg-surface-sunken p-3.5 rounded-xl border border-amber-500/30">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  📋 To'lov Tarkibi va Manbasi:
                </span>
                <span className="text-[10px] text-muted font-mono font-bold">
                  {(activeModalItem.breakdown || []).length} ta positsiya
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {(activeModalItem.breakdown && activeModalItem.breakdown.length > 0) ? (
                  activeModalItem.breakdown.map((bItem, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface border border-border text-xs hover:border-border transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-body truncate text-xs">
                          {bItem.title || bItem.service_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted mt-1">
                          <span className="bg-surface-2 px-1.5 py-0.5 rounded text-amber-300 font-medium">
                            📁 {bItem.category || 'Umumiy'}
                          </span>
                          {bItem.provider_name && (
                            <span className="truncate max-w-[130px]">
                              👨‍⚕️ {bItem.provider_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-emerald-400 text-xs">
                          {formatMoney(bItem.price)}
                        </div>
                        {bItem.ticket_number && (
                          <span className="text-[9px] font-mono text-cyan-400 font-bold block mt-0.5">
                            🎫 {bItem.ticket_number}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-body p-2">
                    {activeModalItem.reason || activeModalItem.service_name}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-border font-bold">
                <span className="text-body text-xs uppercase tracking-wide">Jami To'lov Summasi:</span>
                <span className="text-emerald-400 font-mono text-lg font-black tracking-tight">
                  {formatMoney(activeModalItem.amount)}
                </span>
              </div>
            </div>

            {/* Select Pay Type (4 Options Grid) */}
            <div className="space-y-2">
              <label className="text-xs font-black text-body uppercase tracking-wider block">
                To'lov Turini Tanlang:
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'naqd', label: '💵 Naqd' },
                  { id: 'karta', label: '💳 Karta' },
                  { id: 'click', label: '📱 Click/Payme' },
                  { id: 'aralash', label: '🔀 Aralash' },
                  { id: 'qr', label: '🔳 QR Kod' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedPayType(t.id)}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                      selectedPayType === t.id
                        ? 'border-amber-400 bg-amber-500/25 text-amber-300 shadow-md scale-[1.02]'
                        : 'border-border bg-surface-2 text-body hover:bg-surface-2 hover:border-border-strong'
                    }`}
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aralash / Split Inputs */}
            {selectedPayType === 'aralash' && (
              <div className="p-3 bg-surface-sunken rounded-xl border border-amber-500/30 space-y-2.5 text-xs animate-in fade-in">
                <div className="text-amber-300 font-extrabold text-[11px] uppercase tracking-wide">
                  🔀 Aralash To'lov Taqsimoti:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-body font-bold block mb-1">Naqd Summasi:</label>
                    <input
                      type="number"
                      value={cashAmountInput}
                      onChange={(e) => handleCashChange(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg p-2 text-body font-mono font-bold text-xs focus:border-amber-400 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-body font-bold block mb-1">Karta Summasi:</label>
                    <input
                      type="number"
                      value={cardAmountInput}
                      onChange={(e) => setCardAmountInput(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg p-2 text-body font-mono font-bold text-xs focus:border-amber-400 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-muted text-right font-mono font-semibold">
                  Jami: <strong className="text-emerald-400">{formatMoney((Number(cashAmountInput) || 0) + (Number(cardAmountInput) || 0))}</strong> / {formatMoney(activeModalItem.amount)}
                </div>
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-hover text-body text-xs font-bold border border-border transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Printer className="h-4 w-4" />
                <span>{submitting ? "Saqlanmoqda..." : "TASDIQLASH VA CHEK CHOP ETISH 🖨️"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Receipt / Check Modal (Opens automatically after paying) */}
      <PaymentTicketModal
        open={!!receiptPatient}
        patient={receiptPatient}
        onClose={() => setReceiptPatient(null)}
      />
    </>
  )
}


