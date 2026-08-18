import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Search, Check, Stethoscope, CreditCard } from 'lucide-react'
import { api } from '../utils/api'
import { formatMoney } from '../utils/format'
import { useToastStore } from '../store/toastStore'
import { Btn, Icons } from './UIKit'

const PAYMENT_TYPES = [
  { id: 'naqd', label: '💵 Naqd pul' },
  { id: 'karta', label: '💳 Karta / QR (Terminal)' },
  { id: 'click', label: '📱 Click / Payme' },
  { id: 'aralash', label: '⚖️ Aralash (Naqd + Karta)' },
  { id: 'later', label: '⏳ Keyinroq to\'lash (Nasiya)' },
]

export default function ReRegisterPatientModal({ open, patient, onClose, onSuccess }) {
  const [services, setServices] = useState([])
  const [serviceSearch, setServiceSearch] = useState('')
  const [providers, setProviders] = useState([])
  const [referrers, setReferrers] = useState([])
  
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedReferrerId, setSelectedReferrerId] = useState('')
  const [paymentType, setPaymentType] = useState('naqd')
  
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [cashAmount, setCashAmount] = useState(0)
  const [cardAmount, setCardAmount] = useState(0)
  
  const [loading, setLoading] = useState(false)
  const toast = useToastStore((s) => s.add)

  useEffect(() => {
    if (!open) return
    Promise.all([
      api('/services?active_only=true').catch(() => []),
      api('/providers?active_only=true').catch(() => []),
      api('/referrers?active_only=true').catch(() => []),
    ]).then(([svcs, provs, refs]) => {
      setServices(svcs || [])
      setProviders(provs || [])
      setReferrers(refs || [])
      if (svcs && svcs.length > 0) {
        setSelectedServices([
          { service_id: svcs[0].id, price: svcs[0].price || 0, quantity: 1, provider_id: null }
        ])
      }
    })
  }, [open])

  if (!open || !patient) return null

  const findMatchingDoctor = (serviceId) => {
    const sid = Number(serviceId)
    if (!providers || providers.length === 0) return null
    const matched = providers.find((p) => Array.isArray(p.service_ids) && p.service_ids.map(Number).includes(sid))
    if (matched) return matched.id
    const svc = services.find((s) => s.id === sid)
    if (svc && svc.provider_id) return svc.provider_id
    if (providers.length === 1) return providers[0].id
    return null
  }

  const addServiceRow = (svcObj = null) => {
    const found = svcObj || services[0]
    if (!found) return
    const autoDoctorId = findMatchingDoctor(found.id)
    setSelectedServices((prev) => [
      ...prev,
      {
        service_id: found.id,
        price: found.price || 0,
        quantity: 1,
        provider_id: autoDoctorId || null
      }
    ])
  }

  const removeServiceRow = (index) => {
    if (selectedServices.length <= 1) {
      toast("Kamida 1 ta xizmat bo'lishi kerak", "warning")
      return
    }
    setSelectedServices((prev) => prev.filter((_, idx) => idx !== index))
  }

  const updateServiceRow = (index, field, value) => {
    setSelectedServices((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      if (field === 'service_id') {
        const found = services.find((s) => String(s.id) === String(value))
        if (found) {
          copy[index].price = found.price || 0
          const autoDoc = findMatchingDoctor(found.id)
          if (autoDoc) copy[index].provider_id = autoDoc
        }
      }
      return copy
    })
  }

  // Calculate Total Base Price across all selected services with quantities
  const totalBasePrice = selectedServices.reduce(
    (acc, row) => acc + (Number(row.price) || 0) * Math.max(1, Number(row.quantity) || 1),
    0
  )

  const finalAmount = Math.max(0, totalBasePrice - (Number(discountAmount) || 0))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validServices = selectedServices.filter((s) => s.service_id)
    if (validServices.length === 0) {
      toast("Kamida bitta xizmat turini tanlang", "error")
      return
    }

    setLoading(true)
    try {
      const payload = {
        first_name: patient.first_name,
        last_name: patient.last_name || '',
        birth_date: patient.birth_date ? String(patient.birth_date).slice(0, 10) : '2000-01-01',
        phone: patient.phone || '+998',
        address: patient.address || '',
        referrer_id: selectedReferrerId ? Number(selectedReferrerId) : null,
        payment_type: paymentType,
        payment_amount: finalAmount,
        discount_amount: Number(discountAmount) || 0,
        discount_reason: discountReason || null,
        cash_amount: paymentType === 'aralash' ? Number(cashAmount) : (paymentType === 'naqd' ? finalAmount : 0),
        card_amount: paymentType === 'aralash'
          ? Number(cardAmount)
          : (['karta', 'click'].includes(paymentType) ? finalAmount : 0),
        services: validServices.map((s) => ({
          service_id: Number(s.service_id),
          provider_id: s.provider_id ? Number(s.provider_id) : null,
          price: Number(s.price) || 0,
          quantity: Math.max(1, Number(s.quantity) || 1),
        })),
      }

      const res = await api('/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast(`✓ ${patient.first_name} yangi xizmat(lar)ga muvaffaqiyatli yozildi! (Talon: ${res.ticket_number || `A-${res.id}`})`)
      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err) {
      toast(err.message || "Xizmatga yozishda xatolik", "error")
    } finally {
      setLoading(false)
    }
  }

  const filteredCatalogServices = services.filter((s) => {
    if (!serviceSearch.trim()) return true
    const q = serviceSearch.toLowerCase().trim()
    return (s.name || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q)
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan font-bold flex items-center justify-center border border-cyan-500/30 text-lg">
              ➕
            </div>
            <div>
              <h3 className="text-lg font-black text-gold uppercase tracking-wide">
                Qayta Xizmatga Yozish (Bir nechta xizmat va Soni)
              </h3>
              <p className="text-xs text-muted font-bold">
                Bemor: <strong className="text-cyan">{patient.first_name} {patient.last_name}</strong> ({patient.phone || 'Telefon yo\'q'})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:text-body transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          
          {/* Quick Search & Add Service */}
          <div className="space-y-2 card p-3 border-cyan-500/30 bg-surface-2">
            <label className="form-label text-xs font-black text-cyan uppercase tracking-wider mb-0">
              🔍 Xizmat qidirish va Ro'yxatga qo'shish
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Xizmat nomini yozing (masalan: UZI, Massaj, Elektrofarez)..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-surface border border-cyan-500/40 text-xs font-medium focus:outline-none focus:border-cyan-400"
              />
              <Search className="h-4 w-4 text-cyan-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {serviceSearch && (
                <button
                  type="button"
                  onClick={() => setServiceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-rose-400 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Click Badges if searching */}
            {serviceSearch.trim() && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1 border-t border-border/40">
                {filteredCatalogServices.slice(0, 10).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      addServiceRow(s)
                      setServiceSearch('')
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan border border-cyan-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <span>+ {s.name} ({formatMoney(s.price)})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Services List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="form-label text-xs font-black text-gold uppercase tracking-wider mb-0">
                📋 Tanlangan Xizmatlar Ro'yxati ({selectedServices.length} ta)
              </label>
              <Btn type="button" variant="cyan" size="xs" icon={Plus} onClick={() => addServiceRow()}>
                Xizmat Qo'shish
              </Btn>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedServices.map((row, idx) => {
                const curSvc = services.find((s) => String(s.id) === String(row.service_id))
                return (
                  <div key={idx} className="p-3 rounded-xl bg-surface-2 border border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-sm">
                    {/* Service Dropdown */}
                    <div className="min-w-[180px] flex-1">
                      <select
                        className="input-field text-xs font-bold text-body py-1.5"
                        value={row.service_id}
                        onChange={(e) => updateServiceRow(idx, 'service_id', e.target.value)}
                      >
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.category ? `[${s.category}] ` : ''}{s.name} — {formatMoney(s.price)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Doctor Dropdown */}
                    <div className="w-40 shrink-0">
                      <select
                        className="input-field text-xs text-muted py-1.5"
                        value={row.provider_id || ''}
                        onChange={(e) => updateServiceRow(idx, 'provider_id', e.target.value)}
                      >
                        <option value="">— Shifokor —</option>
                        {providers.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            Dr. {pr.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity (Soni) input with - / + buttons */}
                    <div className="flex items-center gap-1 border border-border rounded-lg bg-surface px-1 py-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateServiceRow(idx, 'quantity', Math.max(1, (Number(row.quantity) || 1) - 1))}
                        className="w-6 h-6 rounded-md bg-surface-2 hover:bg-white/10 font-bold text-xs text-muted flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        className="w-10 text-center font-mono font-bold text-xs bg-transparent focus:outline-none text-gold"
                        value={row.quantity || 1}
                        onChange={(e) => updateServiceRow(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                      />
                      <button
                        type="button"
                        onClick={() => updateServiceRow(idx, 'quantity', (Number(row.quantity) || 1) + 1)}
                        className="w-6 h-6 rounded-md bg-surface-2 hover:bg-white/10 font-bold text-xs text-muted flex items-center justify-center"
                      >
                        +
                      </button>
                      <span className="text-[10px] text-muted font-bold pr-1">ta</span>
                    </div>

                    {/* Price Subtotal */}
                    <div className="w-24 text-right font-mono font-extrabold text-xs text-emerald shrink-0">
                      {formatMoney((Number(row.price) || 0) * (Number(row.quantity) || 1))}
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeServiceRow(idx)}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                      title="O'chirish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Select Referrer */}
          <div>
            <label className="form-label text-xs font-bold text-muted">🤝 Yo'naltiruvchi Shifokor / Muassasa (Ixtiyoriy)</label>
            <select
              className="input-field text-xs text-muted py-2"
              value={selectedReferrerId}
              onChange={(e) => setSelectedReferrerId(e.target.value)}
            >
              <option value="">— Yo'naltiruvchi yo'q —</option>
              {referrers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} ({r.phone || '—'})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Type */}
          <div>
            <label className="form-label text-xs font-bold">💳 To'lov Usuli</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setPaymentType(pt.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                    paymentType === pt.id
                      ? 'border-gold bg-gold-dim text-gold shadow-sm'
                      : 'border-border bg-surface-2 text-muted hover:border-gold-glow'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing & Discount Calculation */}
          <div className="p-3.5 rounded-2xl card-2 space-y-2 border border-gold/30">
            <div className="flex justify-between items-center text-xs text-muted">
              <span>Xizmatlar Jami Narxi:</span>
              <span className="font-mono font-bold text-body">{formatMoney(totalBasePrice)}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-amber font-bold">Chegirma (so'm):</span>
              <input
                type="number"
                className="input-field max-w-[140px] text-right font-mono font-bold py-1 text-amber text-xs"
                placeholder="0"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
              />
            </div>

            <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-border">
              <span className="text-cyan">TO'LANADIGAN UMUMIY SUMMA:</span>
              <span className="text-emerald font-mono text-base">{formatMoney(finalAmount)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full icon={Icons.x} type="button" onClick={onClose}>
              Bekor
            </Btn>
            <Btn variant="gold" full icon={Icons.check} type="submit" loading={loading}>
              Yangi Xizmat(lar)ga Yozish
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
