import { useState, useEffect } from 'react'
import Modal from './Modal'
import { Btn } from './UIKit'
import { Check, CreditCard, DollarSign, Printer, Receipt, X } from 'lucide-react'
import { api } from '../utils/api'
import { useToastStore } from '../store/toastStore'

export default function PayUnpaidServicesModal({ open, patient, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [unpaidServices, setUnpaidServices] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [paymentType, setPaymentType] = useState('cash')
  
  const [cashAmount, setCashAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [clickAmount, setClickAmount] = useState('')
  const [qrAmount, setQrAmount] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [receiptData, setReceiptData] = useState(null)

  const toast = useToastStore((s) => s.add)

  useEffect(() => {
    if (!open || !patient?.id) return
    setLoading(true)
    setReceiptData(null)
    api(`/patients/${patient.id}/unpaid-services`)
      .then((res) => {
        const list = res || []
        setUnpaidServices(list)
        // Default select all unpaid services
        setSelectedIds(list.map((it) => it.id))
      })
      .catch((err) => {
        toast(err.message || 'Nasiya xizmatlarni yuklashda xatolik', 'error')
      })
      .finally(() => setLoading(false))
  }, [open, patient?.id])

  if (!open || !patient) return null

  const selectedItems = unpaidServices.filter((it) => selectedIds.includes(it.id))
  const totalSelectedAmount = selectedItems.reduce((sum, it) => sum + (it.amount || 0), 0)

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handlePaySubmit = async (e) => {
    e.preventDefault()
    if (selectedIds.length === 0) {
      toast("Kamida bitta to'lanadigan xizmatni belgilang", 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await api(`/patients/${patient.id}/pay-services`, {
        method: 'POST',
        body: JSON.stringify({
          patient_ids: selectedIds,
          payment_type: paymentType,
          cash_amount: cashAmount ? Number(cashAmount) : 0,
          card_amount: cardAmount ? Number(cardAmount) : 0,
          click_amount: clickAmount ? Number(clickAmount) : 0,
          qr_amount: qrAmount ? Number(qrAmount) : 0,
        }),
      })

      toast(res.message || "To'lov muvaffaqiyatli qabul qilindi!", 'success')
      setReceiptData(res)
      if (onSuccess) onSuccess(res)
    } catch (err) {
      toast(err.message || "To'lovda xatolik", 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`💳 Xizmatlar uchun to'lov — ${patient.full_name || patient.first_name}`}
    >
      <div className="space-y-4">

        {/* CHEK PRINT VIEW IF PAID */}
        {receiptData ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0" />
              <span>To'lov qabul qilindi hamda bugungi hisobotlarga yozildi!</span>
            </div>

            {/* Thermal Receipt Preview Box */}
            <div className="p-4 bg-surface-2 border border-border rounded-2xl text-xs font-mono space-y-2 select-text">
              <div className="text-center font-bold text-sm border-b border-border pb-2">
                MARJONA MED KLINIKASI<br />
                <span className="text-[10px] font-sans font-normal text-muted">To'lov Cheki (Kassa)</span>
              </div>
              <div className="flex justify-between">
                <span>Bemor:</span>
                <span className="font-bold">{receiptData.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Navbat / Talon:</span>
                <span>{receiptData.ticket_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Sana (To'lov kuni):</span>
                <span>{receiptData.payment_date}</span>
              </div>
              <div className="flex justify-between">
                <span>To'lov turi:</span>
                <span className="uppercase font-bold">{receiptData.payment_type}</span>
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                <div className="font-sans font-bold text-[11px]">To'langan Xizmatlar:</div>
                {receiptData.services?.map((s, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>{idx + 1}. {s.service_name}</span>
                    <span>{s.price?.toLocaleString()} so'm</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-dashed border-border pt-2 flex justify-between font-extrabold text-sm text-gold">
                <span>JAMI TO'LANDI:</span>
                <span>{receiptData.total_amount?.toLocaleString()} so'm</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Btn
                variant="gold"
                full
                icon={<Printer className="h-4 w-4" />}
                onClick={handlePrintReceipt}
              >
                Chekni Chop Etish (Print) 🧾
              </Btn>
              <Btn variant="surface" onClick={onClose}>
                Yopish
              </Btn>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePaySubmit} className="space-y-4">
            
            {/* UNPAID SERVICES CHECKBOX LIST */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-body flex items-center justify-between">
                <span>1. To'lanadigan xizmatlarni belgilang:</span>
                <span className="text-gold font-mono text-[11px]">
                  {selectedIds.length} ta xizmat belgilandi
                </span>
              </label>

              {loading ? (
                <div className="p-6 text-center text-xs text-muted">Yuklanmoqda...</div>
              ) : unpaidServices.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted italic">
                  Ushbu bemorda to'lanmagan nasiya xizmatlari topilmadi.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {unpaidServices.map((it) => {
                    const isChecked = selectedIds.includes(it.id)
                    return (
                      <div
                        key={it.id}
                        onClick={() => toggleSelect(it.id)}
                        className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-gold/15 border-gold/50 text-gold shadow-sm'
                            : 'bg-surface hover:bg-surface-2 border-border text-body'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-border text-gold focus:ring-gold"
                          />
                          <div>
                            <div className="font-extrabold text-xs">{it.service_name}</div>
                            <div className="text-[10px] text-muted font-semibold mt-0.5">
                              {it.category} • Shifokor: {it.provider_name}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-extrabold text-xs font-mono text-gold">
                            {it.amount?.toLocaleString()} so'm
                          </div>
                          <div className="text-[9px] text-muted font-mono mt-0.5">
                            Nasiya vaqti: {it.registered_at ? new Date(it.registered_at).toLocaleDateString('uz-UZ') : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* TOTAL AMOUNT & PAYMENT METHOD */}
            {unpaidServices.length > 0 && (
              <>
                <div className="p-3 bg-surface-2 border border-border rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-extrabold text-muted">Jami To'lanadigan Summa:</span>
                  <span className="text-base font-black text-gold font-mono">
                    {totalSelectedAmount.toLocaleString()} so'm
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-body">2. To'lov turini tanlang:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'cash', label: '💵 Naqd' },
                      { id: 'card', label: '💳 Karta' },
                      { id: 'click', label: '📱 Click' },
                      { id: 'qr', label: '📲 QR' },
                    ].map((pt) => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setPaymentType(pt.id)}
                        className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all ${
                          paymentType === pt.id
                            ? 'bg-gold text-surface-dark border-gold shadow'
                            : 'bg-surface border-border text-body hover:bg-surface-2'
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Btn
                  type="submit"
                  variant="gold"
                  full
                  loading={submitting}
                  disabled={submitting || selectedIds.length === 0}
                  icon={<Receipt className="h-4 w-4" />}
                >
                  To'lovni Qabul Qilish va Chek Chiqarish 🧾
                </Btn>
              </>
            )}

          </form>
        )}

      </div>
    </Modal>
  )
}
