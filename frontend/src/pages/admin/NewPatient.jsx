import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../utils/api'
import { formatMoney, formatWithCommas, parseDigits } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { savePendingPatient } from '../../utils/offline'
import PageHeader from '../../components/PageHeader'
import PaymentTicketModal from '../../components/PaymentTicketModal'
import Modal from '../../components/Modal'
import { Btn, Icons } from '../../components/UIKit'
import { Plus, Trash2 } from 'lucide-react'

const empty = {
  full_name: '',
  birth_date: '',
  phone: '',
  address: '',
  referrer_id: null,
  payment_type: 'cash', // 'cash' | 'card' | 'click' | 'qr' | 'split'
  cash_amount: 0,
  card_amount: 0,
  discount_type: 'none', // 'none' | 'percent' | 'amount'
  discount_value: '',
  discount_reason: '',
}

function normalizeBirthDate(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  const m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return ''
}

function toDisplayBirthDate(v) {
  const iso = normalizeBirthDate(v)
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatBirthDateInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export default function NewPatient({ homePath = '/admin' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToastStore((s) => s.add)
  const [form, setForm] = useState(empty)
  const [selectedServices, setSelectedServices] = useState([])
  const [referrers, setReferrers] = useState([])
  const [services, setServices] = useState([])
  const [providers, setProviders] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [createdPatient, setCreatedPatient] = useState(null)
  const [expandedCat, setExpandedCat] = useState(null) // accordion
  const [splitSecond, setSplitSecond] = useState('card') // 'card' | 'qr'
  const [newRefModal, setNewRefModal] = useState(false)
  const [newRefForm, setNewRefForm] = useState({ full_name: '', phone: '' })
  const [savingRef, setSavingRef] = useState(false)

  // Paper Journal Entry Mode
  const [isPaperMode, setIsPaperMode] = useState(false)
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })

  // Live Patient Search / Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState([])
  const [selectedExistingPatient, setSelectedExistingPatient] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const handleSearchChange = (field, value) => {
    const nextForm = { ...form, [field]: value }
    setForm(nextForm)

    const q = nextForm.full_name.trim() || nextForm.birth_date.trim() || nextForm.phone.trim()
    if (q.length >= 2) {
      api(`/patients/autocomplete?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (Array.isArray(res) && res.length > 0) {
            setSuggestions(res)
            setShowDropdown(true)
          } else {
            setSuggestions([])
            setShowDropdown(false)
          }
        })
        .catch(() => {})
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }
  }

  const handleSelectExisting = (p) => {
    setSelectedExistingPatient(p)
    setForm({
      ...form,
      full_name: p.full_name,
      birth_date: p.birth_date,
      address: p.address || form.address,
      phone: p.phone || form.phone,
      referrer_id: p.referrer_id || form.referrer_id,
    })
    setShowDropdown(false)
    toast(`✓ Bazadan topilgan bemor tanlandi (${p.full_name})`)
  }

  const handleQuickAddReferrer = async () => {
    if (!newRefForm.full_name.trim()) {
      toast("Yo'naltiruvchi ismini kiriting", 'error')
      return
    }
    setSavingRef(true)
    try {
      const res = await api('/referrers', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newRefForm.full_name.trim(),
          phone: newRefForm.phone ? newRefForm.phone.trim() : '',
          percentage: 0,
        }),
      })
      toast("Yangi yo'naltiruvchi saqlandi va tanlandi ✓")
      setReferrers((prev) => [...prev, res])
      setForm((prev) => ({ ...prev, referrer_id: res.id }))
      setNewRefModal(false)
      setNewRefForm({ full_name: '', phone: '' })
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSavingRef(false)
    }
  }

  useEffect(() => {
    Promise.all([
      api('/referrers'),
      api('/services'),
      api('/providers'),
    ])
      .then(([r, s, p]) => {
        setReferrers(r || [])
        setServices(s || [])
        setProviders(p || [])
        if (!s?.length) toast('Xizmat turlari topilmadi', 'error')
      })
      .catch((e) => toast(e.message || 'Ro\'yxatlar yuklanmadi', 'error'))
      .finally(() => setCatalogLoading(false))
  }, [])

  useEffect(() => {
    const prefill = location.state?.patient
    if (prefill) {
      const fullName = `${prefill.first_name || ''} ${prefill.last_name || ''}`.trim()
      setForm({
        full_name: fullName,
        birth_date: toDisplayBirthDate(prefill.birth_date),
        phone: prefill.phone || '',
        address: prefill.address || '',
        referrer_id: prefill.referrer_id,
        payment_type: 'cash',
        cash_amount: '',
        card_amount: '',
        discount_type: 'none',
        discount_value: '',
        discount_reason: '',
      })
      // Clear previously selected services for fresh registration
      setSelectedServices([])
    }
  }, [location.state])

  // Multi-service Handlers
  const handleAddServiceRow = () => {
    setSelectedServices((prev) => [
      ...prev,
      { service_id: '', price: 0 },
    ])
  }

  const handleRemoveServiceRow = (index) => {
    if (selectedServices.length <= 1) return
    setSelectedServices((prev) => prev.filter((_, i) => i !== index))
  }

  const handleServiceRowChange = (index, field, value) => {
    setSelectedServices((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }

      if (field === 'service_id') {
        const foundSvc = services.find((s) => s.id === +value)
        if (foundSvc) {
          copy[index].price = foundSvc.price
        }
      }
      return copy
    })
  }

  const findMatchingDoctor = (serviceId) => {
    const sid = Number(serviceId)
    if (!providers || providers.length === 0) return null

    // 1. Check if provider has service_ids array containing sid
    const matched = providers.find((p) => Array.isArray(p.service_ids) && p.service_ids.map(Number).includes(sid))
    if (matched) return matched.id

    // 2. Check if service object has provider_id
    const svc = services.find((s) => s.id === sid)
    if (svc && svc.provider_id) return svc.provider_id

    // 3. If there is only 1 provider overall, return that provider ID
    if (providers.length === 1) return providers[0].id

    return null
  }

  const isServiceSelected = (sid) => selectedServices.some((s) => String(s.service_id) === String(sid))

  const toggleServiceSelection = (s) => {
    const sid = String(s.id)
    if (isServiceSelected(sid)) {
      setSelectedServices((prev) => prev.filter((item) => String(item.service_id) !== sid))
    } else {
      const autoDoctorId = findMatchingDoctor(s.id)
      setSelectedServices((prev) => [
        ...prev.filter((item) => item.service_id),
        { service_id: sid, price: s.price, quantity: 1, provider_id: autoDoctorId || null },
      ])
    }
  }

  // Auto-assign doctor to selected services if provider_id is missing
  useEffect(() => {
    if (providers.length > 0 && selectedServices.length > 0) {
      setSelectedServices((prev) =>
        prev.map((item) => {
          if (!item.provider_id && item.service_id) {
            const autoId = findMatchingDoctor(item.service_id)
            return autoId ? { ...item, provider_id: autoId } : item
          }
          return item
        })
      )
    }
  }, [providers, services])

  const updateServiceQuantity = (sid, newQty) => {
    const qty = Math.max(1, parseInt(newQty, 10) || 1)
    setSelectedServices((prev) =>
      prev.map((item) =>
        String(item.service_id) === String(sid) ? { ...item, quantity: qty } : item
      )
    )
  }

  const updateServicePrice = (sid, newPrice) => {
    setSelectedServices((prev) =>
      prev.map((item) =>
        String(item.service_id) === String(sid) ? { ...item, price: newPrice } : item
      )
    )
  }

  const updateServiceDoctor = (sid, providerId) => {
    setSelectedServices((prev) =>
      prev.map((item) =>
        String(item.service_id) === String(sid)
          ? { ...item, provider_id: providerId ? Number(providerId) : null }
          : item
      )
    )
  }

  // Price & Discount Calculations across ALL selected services (with Quantity)
  const totalBasePrice = selectedServices.reduce(
    (acc, row) => acc + (Number(row.price) || 0) * (Number(row.quantity) || 1),
    0
  )

  let computedDiscount = 0
  const dVal = parseFloat(form.discount_value) || 0
  if (form.discount_type === 'percent' && dVal > 0) {
    computedDiscount = Math.round((totalBasePrice * Math.min(100, dVal)) / 100)
  } else if (form.discount_type === 'amount' && dVal > 0) {
    computedDiscount = Math.min(totalBasePrice, dVal)
  }
  const finalPrice = Math.max(0, totalBasePrice - computedDiscount)

  // Group services into 2 levels: Main Department -> Sub-Category -> Services list
  const nestedServices = services.reduce((acc, s) => {
    let rawCat = (s.category || 'Umumiy').trim()
    let mainCat = rawCat
    let subCat = 'Umumiy'

    if (rawCat.includes(':')) {
      const parts = rawCat.split(':')
      mainCat = parts[0].trim()
      subCat = parts[1].trim()
    } else if (rawCat.includes(' - ')) {
      const parts = rawCat.split(' - ')
      mainCat = parts[0].trim()
      subCat = parts[1].trim()
    }

    if (!acc[mainCat]) acc[mainCat] = {}
    if (!acc[mainCat][subCat]) acc[mainCat][subCat] = []
    acc[mainCat][subCat].push(s)
    return acc
  }, {})

  // Auto update split amounts if finalPrice changes
  useEffect(() => {
    if (form.payment_type === 'split') {
      const cash = Number(form.cash_amount) || 0
      setForm((prev) => ({
        ...prev,
        card_amount: Math.max(0, finalPrice - cash),
      }))
    }
  }, [finalPrice, form.payment_type])

  const submit = async () => {
    const normalizedBirthDate = normalizeBirthDate(form.birth_date)
    
    // 3 MANDATORY FIELDS CHECK
    if (!form.full_name.trim() || !normalizedBirthDate || !form.address.trim()) {
      toast("F.I.Sh, Tug'ilgan yili va Yashash manzili majburiy!", 'error')
      return
    }

    // Validate selected services
    const validServices = selectedServices.filter((s) => s.service_id)
    if (validServices.length === 0) {
      toast("Kamida bitta xizmat turini tanlang", 'error')
      return
    }

    // Validate split payment
    let cashAmt = Number(form.cash_amount) || 0
    let cardAmt = Number(form.card_amount) || 0

    if (form.payment_type === 'split') {
      if (cashAmt + cardAmt !== finalPrice) {
        toast(`Aralash to'lov yig'indisi (${formatMoney(cashAmt + cardAmt)}) jami summasiga (${formatMoney(finalPrice)}) teng bo'lishi kerak!`, 'error')
        return
      }
    } else if (form.payment_type === 'cash') {
      cashAmt = finalPrice
      cardAmt = 0
    } else {
      cashAmt = 0
      cardAmt = finalPrice
    }

    // Split F.I.Sh into first_name and last_name
    const nameParts = form.full_name.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const payload = {
      first_name: firstName,
      last_name: lastName,
      birth_date: normalizedBirthDate,
      phone: form.phone ? form.phone.trim() : '',
      address: form.address.trim(),
      referrer_id: form.referrer_id || null,
      payment_type: form.payment_type,
      cash_amount: cashAmt,
      card_amount: cardAmt,
      discount_amount: computedDiscount,
      discount_reason: computedDiscount > 0 ? form.discount_reason || 'Chegirma' : null,
      services: validServices.map((s) => ({
        service_id: +s.service_id,
        provider_id: s.provider_id ? +s.provider_id : null,
        price: Number(s.price) || 0,
        quantity: Math.max(1, Number(s.quantity) || 1),
      })),
    }

    if (isPaperMode && customDate) {
      payload.custom_date = customDate
      payload.is_paper_entry = true
    }

    setLoading(true)
    try {
      if (!navigator.onLine) {
        await savePendingPatient({ payload })
        toast('Offline saqlandi — ulanishda yuboriladi')
        navigate(homePath)
        return
      }
      let res
      try {
        res = await api('/patients', { method: 'POST', body: JSON.stringify(payload) })
      } catch (e) {
        if (e.status === 409) {
          const proceed = window.confirm(`${e.message}\n\nBaribir davom etasizmi?`)
          if (!proceed) return
          res = await api('/patients', { method: 'POST', body: JSON.stringify({ ...payload, confirm_duplicate: true }) })
        } else {
          throw e
        }
      }
      toast('To\'lov qabul qilindi ✓')
      setCreatedPatient(res)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── KLAVIATURA BILAN BOSHQARISH ────────────────────────────────────
  // Sichqonchasiz ishlash uchun: Enter — keyingi maydon, strelkalar —
  // tugmalar (xizmat, to'lov turi) orasida yurish, Ctrl+Enter — saqlash.
  const formRef = useRef(null)

  const getFocusables = () => {
    if (!formRef.current) return []
    return Array.from(
      formRef.current.querySelectorAll('input, select, textarea, button:not([disabled])')
    ).filter((el) => el.offsetParent !== null && !el.hasAttribute('data-kbd-skip'))
  }

  const handleFormKeyDown = (e) => {
    const el = e.target
    const tag = el.tagName

    // Ctrl+Enter — istalgan joydan saqlash
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (!loading) submit()
      return
    }

    // Enter matn maydonida — keyingi maydonga o'tadi (forma yuborilmaydi)
    if (e.key === 'Enter' && (tag === 'INPUT' || tag === 'SELECT')) {
      e.preventDefault()
      const items = getFocusables()
      const i = items.indexOf(el)
      const next = items.slice(i + 1).find((x) => x.tagName === 'INPUT' || x.tagName === 'SELECT')
      if (next) next.focus()
      else items[i + 1]?.focus()
      return
    }

    // Strelkalar — bir guruh ichidagi tugmalar orasida yurish
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      // Matn maydonida strelka o'z vazifasini bajarsin (kursor siljishi)
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const group = el.closest('[data-kbd-group]')
      const scope = group || formRef.current
      const buttons = Array.from(scope.querySelectorAll('button:not([disabled])'))
        .filter((b) => b.offsetParent !== null)
      const i = buttons.indexOf(el)
      if (i === -1) return

      e.preventDefault()
      const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight'
      const next = buttons[fwd ? i + 1 : i - 1]
      if (next) next.focus()
    }
  }

  const handleCloseReceipt = () => {
    setCreatedPatient(null)
    navigate(homePath)
  }

  return (
    <div className="max-w-3xl pb-10">
      <PageHeader title="Yangi Mijoz Qabul Qilish" subtitle="Bemor ma'lumotlari, xizmatlar va to'lov qabul qilish" backTo={homePath} />

      {/* THERMAL PRINT RECEIPT & QUEUE TICKET MODAL */}
      {createdPatient && (
        <PaymentTicketModal open={!!createdPatient} patient={createdPatient} onClose={handleCloseReceipt} />
      )}

      {/* Klaviatura yordami */}
      <div className="mb-3 text-[11px] text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-bold text-gold">⌨️ Klaviatura:</span>
        <span><kbd className="kbd">Enter</kbd> keyingi maydon</span>
        <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd><kbd className="kbd">←</kbd><kbd className="kbd">→</kbd> tanlash</span>
        <span><kbd className="kbd">Space</kbd> belgilash</span>
        <span><kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd> saqlash</span>
      </div>

      <div ref={formRef} onKeyDown={handleFormKeyDown} className="card space-y-5">

        {/* MODE SELECTOR: LIVE INTAKE VS PAPER SHIFT JOURNAL ENTRY */}
        <div className="p-3.5 rounded-2xl border border-gold/30 bg-gold/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
              📋 Qabul Rejimi
            </span>
            <p className="text-[11px] text-muted">
              {isPaperMode
                ? "Kechagi yoki o'tgan smena qog'oz jurnali ma'lumotlarini kiritish (Hisobotlarga qo'shiladi)"
                : "Bugungi jonli bemorlarni ro'yxatdan o'tkazish va TV navbatga qo'shish"}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsPaperMode(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                !isPaperMode
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-lg'
                  : 'bg-white/5 border-border text-muted hover:text-body'
              }`}
            >
              🟢 Bugungi Jonli Qabul
            </button>
            <button
              type="button"
              onClick={() => setIsPaperMode(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isPaperMode
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg'
                  : 'bg-white/5 border-border text-muted hover:text-body'
              }`}
            >
              📄 Qog'oz Jurnaldan Kiritish
            </button>
          </div>
        </div>

        {/* CUSTOM DATE PICKER WHEN IN PAPER MODE */}
        {isPaperMode && (
          <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <label className="form-label text-amber-300 font-bold text-xs mb-0">
                📅 Qog'oz smena sanasini tanlang (Hisobotlarda shu kunga yoziladi) *
              </label>
            </div>
            <input
              type="date"
              className="input-field font-bold text-amber-300 text-sm bg-surface border-amber-500/50"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              required
            />
            <p className="text-[11px] text-amber-200/80">
              💡 Ushbu kiritilgan bemorlar {customDate} sanasidagi moliyaviy va 10-kunlik hisobotlarda avtomatik aks etadi.
            </p>
          </div>
        )}
        
        {/* 1. PERSONAL INFORMATION (ONLY 3 MANDATORY: F.I.SH, BIRTH DATE, ADDRESS) */}
        <div className="space-y-3 relative">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
            👤 Bemor Ma'lumotlari
          </h3>

          {/* Selected Existing Patient Notification Badge */}
          {selectedExistingPatient && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-base">✓</span>
                <div>
                  <p className="font-extrabold text-body text-xs">
                    BAZADAN TOPILGAN BEMOR: {selectedExistingPatient.full_name} ({selectedExistingPatient.birth_date})
                  </p>
                  <p className="text-[11px] text-emerald-200/80 font-normal">
                    Oxirgi tashrif: {selectedExistingPatient.last_visit} ({selectedExistingPatient.visit_count}-marta kelgan) — Qayta kiritish shart emas!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExistingPatient(null)}
                className="text-[11px] font-bold text-rose-400 hover:underline shrink-0"
              >
                Bekor qilish
              </button>
            </div>
          )}

          <div className="relative">
            <label className="form-label">F.I.Sh (Ism va Familiya) *</label>
            <input
              className="input-field font-semibold"
              placeholder="Masalan: Karim Alisherov Vahobovich *"
              value={form.full_name}
              onChange={(e) => handleSearchChange('full_name', e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
              required
            />

            {/* LIVE AUTOCOMPLETE DROPDOWN */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-surface border-2 border-gold/40 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-border/40">
                <div className="px-3 py-2 bg-gold/10 text-gold text-[11px] font-black uppercase tracking-wider flex justify-between items-center">
                  <span>🔍 Bazada O'xshash Bemorlar Topildi ({suggestions.length})</span>
                  <button type="button" onClick={() => setShowDropdown(false)} className="text-muted hover:text-body">✕</button>
                </div>
                {suggestions.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectExisting(p)}
                    className="p-3 hover:bg-gold/10 cursor-pointer transition-colors flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-body text-sm">{p.full_name}</p>
                      <p className="text-[11px] text-body mt-0.5">
                        📅 {p.birth_date} | 📍 {p.address || "Manzil ko'rsatilmagan"} | 📞 {p.phone || '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black block">
                        ✓ {p.visit_count} marta kelgan
                      </span>
                      <span className="text-[10px] text-muted block mt-0.5">Tanlash ➔</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tug'ilgan yili / sana *</label>
              <input
                className="input-field font-semibold"
                placeholder="Masalan: 1995 *"
                inputMode="numeric"
                maxLength={10}
                value={form.birth_date}
                onChange={(e) => handleSearchChange('birth_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Yashash manzili *</label>
              <input
                className="input-field font-semibold"
                placeholder="Toshkent shahri, Chilonzor tumani..."
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label text-muted">Telefon raqami (ixtiyoriy)</label>
              <input
                className="input-field"
                placeholder="+998901234567 (ixtiyoriy)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label text-muted mb-0">Yo'naltiruvchi shifokor / muassasa</label>
                <button
                  type="button"
                  onClick={() => setNewRefModal(true)}
                  className="text-xs font-bold text-gold hover:underline flex items-center gap-1"
                >
                  + Yangi Qo'shish
                </button>
              </div>
              <select className="input-field" value={form.referrer_id || ''} onChange={(e) => setForm({ ...form, referrer_id: e.target.value ? +e.target.value : null })}>
                <option value="">— Yo'naltiruvchi yo'q</option>
                {referrers.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. ACCORDION CATEGORY → SERVICE SELECTION */}
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
              🩺 Xizmatlarni tanlang
            </h3>
            {selectedServices.filter((s) => s.service_id).length > 0 && (
              <span className="badge badge-gold text-xs font-bold">
                {selectedServices.filter((s) => s.service_id).length} ta tanlandi
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border overflow-hidden">
            {Object.entries(nestedServices).map(([mainCatName, subCatsDict]) => {
              const isOpen = expandedCat === mainCatName
              const allServicesInMain = Object.values(subCatsDict).flat()
              const selectedInMain = allServicesInMain.filter((s) => isServiceSelected(s.id))
              const selectedCount = selectedInMain.length

              return (
                <div key={mainCatName} className="border-b border-border/50 last:border-0">
                  {/* Category Header — Main Department */}
                  <button
                    type="button"
                    onClick={() => setExpandedCat(isOpen ? null : mainCatName)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 transition-all hover:bg-white/[0.03] text-left ${
                      selectedCount > 0 ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Selection indicator dot */}
                      <div className={`w-3 h-3 rounded-full shrink-0 transition-all ${
                        selectedCount > 0 ? 'bg-emerald-500 shadow-md animate-pulse' : 'bg-slate-600'
                      }`} />
                      <span className={`text-base font-extrabold tracking-wide ${
                        selectedCount > 0 ? 'text-emerald-400' : 'text-foreground'
                      }`}>
                        {mainCatName === 'Laboratoriya' ? '🧪 LABORATORIYA BO\'LIMI' : mainCatName.toUpperCase()}
                      </span>
                      {selectedCount > 0 && (
                        <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                          {selectedCount} ta tahlil tanlandi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Total price of selected in main category */}
                      {selectedCount > 0 && (
                        <span className="text-sm font-black text-emerald-400 tabular-nums font-mono">
                          {formatMoney(selectedInMain.reduce((a, s) => a + s.price, 0))}
                        </span>
                      )}
                      {/* Chevron */}
                      <svg
                        className={`w-5 h-5 text-muted transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-gold' : ''
                        }`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Body: Sub-Categories inside Main Department */}
                  {isOpen && (
                    <div className="px-4 py-3 bg-surface-sunken border-t border-border/40 space-y-4">
                      {Object.entries(subCatsDict).map(([subCatName, list]) => {
                        const selectedInSub = list.filter((s) => isServiceSelected(s.id)).length

                        return (
                          <div key={subCatName} className="space-y-2 border border-border rounded-xl p-3 bg-surface">
                            {/* Sub-Category Header */}
                            {subCatName !== 'Umumiy' && (
                              <div className="flex items-center justify-between border-b border-border pb-1.5 mb-2">
                                <span className="text-xs font-black uppercase tracking-wider text-gold flex items-center gap-1.5">
                                  📁 {subCatName}
                                </span>
                                {selectedInSub > 0 && (
                                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    {selectedInSub} ta tanlandi
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Service Buttons Grid */}
                            <div data-kbd-group="services" className="flex flex-wrap gap-2">
                              {list.map((s) => {
                                const selected = isServiceSelected(s.id)
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => toggleServiceSelection(s)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                      selected
                                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm'
                                        : 'bg-surface-2 border-border text-body hover:border-border-strong hover:text-body'
                                    }`}
                                  >
                                    <span className="block font-bold">{s.name} {s.allow_custom_price && <span className="text-[9px] text-cyan-300">✏️</span>}</span>
                                    <span className="block text-[10px] mt-0.5 tabular-nums opacity-80">
                                      {s.allow_custom_price ? (s.price > 0 ? `${formatMoney(s.price)} (Tavsiya)` : "✏️ Erkin narx") : formatMoney(s.price)}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {catalogLoading ? (
              <div className="py-10 text-center text-muted text-sm flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-gold border-t-transparent animate-spin" />
                Xizmatlar yuklanmoqda...
              </div>
            ) : Object.keys(nestedServices).length === 0 && (
              <div className="py-10 text-center text-muted text-sm">
                Hali xizmat qo'shilmagan — Sozlamalardan xizmat turini kiriting
              </div>
            )}
          </div>

        </div>

        {/* 2.5 TANLANGAN XIZMATLAR VA SONI (MIQDORI) CARD */}
        {selectedServices.filter((row) => row.service_id).length > 0 && (
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <span>🛒 Tanlangan Xizmatlar va Soni (Miqdori)</span>
              </h4>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Jami: {formatMoney(totalBasePrice)}
              </span>
            </div>

            <div className="space-y-4">
              {Object.entries(
                selectedServices
                  .filter((row) => row.service_id)
                  .reduce((acc, row) => {
                    const svcObj = services.find((s) => String(s.id) === String(row.service_id))
                    if (!svcObj) return acc
                    const cat = svcObj.category || 'Umumiy'
                    if (!acc[cat]) acc[cat] = []
                    acc[cat].push({ row, svcObj })
                    return acc
                  }, {})
              ).map(([catName, itemsList]) => (
                <div key={catName} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm">📁</span>
                    <h5 className="font-extrabold text-sm text-gold uppercase tracking-wide">{catName}</h5>
                    <span className="badge badge-muted text-[10px]">{itemsList.length} ta xizmat</span>
                  </div>

                  <div className="space-y-2">
                    {itemsList.map(({ row, svcObj }) => {
                      const qty = Number(row.quantity) || 1
                      const unitPrice = row.price !== undefined ? Number(row.price) : svcObj.price
                      const subtotal = unitPrice * qty

                      return (
                        <div
                          key={svcObj.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-emerald-500/20 text-xs ml-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-foreground text-sm">{svcObj.name}</p>
                              {svcObj.allow_custom_price && (
                                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/40">
                                  ✏️ Erkin Narx
                                </span>
                              )}
                            </div>

                            {svcObj.allow_custom_price ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[11px] font-bold text-cyan-300">Narx kiritish:</span>
                                <input
                                  type="text"
                                  value={formatWithCommas(row.price)}
                                  onChange={(e) => updateServicePrice(svcObj.id, parseDigits(e.target.value))}
                                  placeholder="0"
                                  className="w-28 px-2 py-1 rounded-lg bg-surface-sunken border border-cyan-500/60 font-mono font-bold text-cyan-300 text-xs text-center focus:outline-none focus:border-cyan-400"
                                />
                                <span className="text-[11px] text-cyan-300 font-semibold">so'm</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted mt-0.5">
                                1 dona: <span className="font-mono text-body">{formatMoney(unitPrice)}</span>
                              </p>
                            )}

                            {/* Doctor Selection Dropdown */}
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="text-[11px] text-amber-400 font-bold">👨‍⚕️ Shifokor:</span>
                              <select
                                value={row.provider_id || ''}
                                onChange={(e) => updateServiceDoctor(svcObj.id, e.target.value)}
                                className={`px-2 py-1 rounded-lg bg-surface-sunken border text-[11px] font-bold focus:outline-none focus:border-amber-400 max-w-[240px] ${
                                  row.provider_id ? 'border-emerald-500/60 text-emerald-300' : 'border-amber-500/40 text-amber-300'
                                }`}
                              >
                                <option value="">(Avto-biriktirish / Navbat bo'yicha)</option>
                                {providers.map((p) => {
                                  const isMatched = Array.isArray(p.service_ids) && p.service_ids.map(Number).includes(svcObj.id)
                                  return (
                                    <option key={p.id} value={p.id}>
                                      {p.full_name} ({p.specialization || 'Shifokor'}){isMatched ? ' ⭐ (Biriktirilgan)' : ''}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                            {/* Quantity Counter (- 1 +) */}
                            <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
                              <button
                                type="button"
                                onClick={() => updateServiceQuantity(svcObj.id, qty - 1)}
                                disabled={qty <= 1}
                                className="w-7 h-7 rounded-lg bg-slate-700 text-foreground font-bold hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) => updateServiceQuantity(svcObj.id, e.target.value)}
                                className="w-12 text-center font-mono font-black text-emerald-400 bg-transparent text-sm focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateServiceQuantity(svcObj.id, qty + 1)}
                                className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 flex items-center justify-center text-sm"
                              >
                                +
                              </button>
                              <span className="text-[10px] text-muted font-semibold px-1">dona</span>
                            </div>

                            {/* Subtotal */}
                            <div className="text-right min-w-24">
                              <span className="font-black text-sm text-emerald-400 font-mono block">
                                {formatMoney(subtotal)}
                              </span>
                              {qty > 1 && (
                                <span className="text-[10px] text-muted block">({unitPrice.toLocaleString()} × {qty})</span>
                              )}
                            </div>

                            {/* Remove Service */}
                            <button
                              type="button"
                              onClick={() => toggleServiceSelection(svcObj)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
                              title="Xizmatni olib tashlash"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. CHEGARMA VA AKSIYA SEKSIYASI */}
        <div className="border border-border rounded-xl p-3.5 bg-surface-2/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">🏷️ Chegirma / Aksiya</span>
            <div className="flex gap-1.5">
              {['none', 'percent', 'amount'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    form.discount_type === t ? 'bg-cyan-600 text-white shadow-sm' : 'bg-surface-2 text-muted'
                  }`}
                  onClick={() => setForm({ ...form, discount_type: t, discount_value: t === 'none' ? '' : form.discount_value })}
                >
                  {t === 'none' ? 'Chegirmasiz' : t === 'percent' ? 'Foiz (%)' : 'Summa (so\'m)'}
                </button>
              ))}
            </div>
          </div>

          {form.discount_type !== 'none' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  {form.discount_type === 'percent' ? 'Chegirma foizi (%)' : 'Chegirma summasi (so\'m)'}
                </label>
                <input
                  type={form.discount_type === 'percent' ? 'number' : 'text'}
                  className="input-field font-mono font-bold"
                  placeholder={form.discount_type === 'percent' ? '10%' : '15,000'}
                  value={form.discount_type === 'amount' ? formatWithCommas(form.discount_value) : form.discount_value}
                  onChange={(e) => {
                    const val = form.discount_type === 'amount' ? parseDigits(e.target.value) : e.target.value
                    setForm({ ...form, discount_value: val })
                  }}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">Chegirma sababi / Izoh</label>
                <input
                  className="input-field"
                  placeholder="Pensioner / Nogiron / Aksiya"
                  value={form.discount_reason}
                  onChange={(e) => setForm({ ...form, discount_reason: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. TO'LOV USULI */}
        <div className="space-y-3">
          <label className="form-label">💳 To'lov Usulini Tanlang</label>
          <div data-kbd-group="payment" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { id: 'cash',  label: '💵 Naqd',        desc: 'Naqd Pul' },
              // Ilgari "Karta" tugmasining qiymati 'click' edi — shuning uchun
              // Karta tanlansa ham hamma joyda "Click" deb ko'rinardi.
              { id: 'card',  label: '💳 Karta',       desc: 'Terminal / Bank kartasi' },
              { id: 'click', label: '📱 Click/Payme', desc: 'Click, Payme' },
              { id: 'split', label: '🔀 Aralash',     desc: 'Naqd + Karta' },
              { id: 'later', label: '⏳ Keyinroq',    desc: 'Nasiya / Qarz' },
              { id: 'qr',    label: '🔳 QR Kod',      desc: 'QR to\'lov' },
            ].map((pm) => (
              <button
                key={pm.id}
                type="button"
                className={`p-2.5 rounded-2xl border text-left transition-all ${
                  form.payment_type === pm.id
                    ? 'border-gold bg-gold/10 text-gold shadow-md font-bold'
                    : 'border-border bg-card text-muted hover:text-foreground'
                }`}
                onClick={() => {
                  const initialCash = pm.id === 'split' ? (Math.round(finalPrice / 2) || '') : ''
                  const initialCard = pm.id === 'split' ? (finalPrice - (Number(initialCash) || 0) || '') : ''
                  setForm({
                    ...form,
                    payment_type: pm.id,
                    cash_amount: initialCash,
                    card_amount: initialCard,
                  })
                }}
              >
                <div className="text-xs font-bold">{pm.label}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{pm.desc}</div>
              </button>
            ))}
          </div>

          {/* ARALASH TO'LOV — 2-usulni tanlash mumkin (Karta yoki QR) */}
          {form.payment_type === 'split' && (
            <div className="border border-gold/40 rounded-2xl p-4 bg-gold/5 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gold">🔀 Aralash To'lov</span>
                <span className="text-xs font-mono font-bold text-muted">Jami: {formatMoney(finalPrice)}</span>
              </div>

              {/* Naqd */}
              <div>
                <label className="text-[11px] font-bold text-emerald-400 block mb-1">💵 Naqd to'lanadigan summa (so'm)</label>
                <input
                  type="text"
                  className="input-field font-bold text-emerald-400 text-sm font-mono"
                  placeholder="0"
                  value={formatWithCommas(form.cash_amount)}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                      setForm({ ...form, cash_amount: '', card_amount: finalPrice || '' })
                    } else {
                      const val = Math.max(0, parseDigits(raw))
                      setForm({ ...form, cash_amount: val, card_amount: Math.max(0, finalPrice - val) })
                    }
                  }}
                />
              </div>

              {/* Second method selector */}
              <div>
                <label className="text-[11px] font-bold text-cyan-400 block mb-1.5">
                  {splitSecond === 'card' ? '💳' : '🔳'} 2-usulni tanlang:
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSplitSecond('card')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      splitSecond === 'card'
                        ? 'bg-cyan-600/20 border-cyan-500/60 text-cyan-300'
                        : 'bg-transparent border-border text-muted hover:border-border-strong'
                    }`}
                  >
                    💳 Karta
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitSecond('qr')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      splitSecond === 'qr'
                        ? 'bg-violet-600/20 border-violet-500/60 text-violet-300'
                        : 'bg-transparent border-border text-muted hover:border-border-strong'
                    }`}
                  >
                    🔳 QR kod
                  </button>
                </div>
                <input
                  type="text"
                  className={`input-field font-bold text-sm font-mono ${
                    splitSecond === 'card' ? 'text-cyan-400' : 'text-violet-400'
                  }`}
                  placeholder="0"
                  value={formatWithCommas(form.card_amount)}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                      setForm({ ...form, card_amount: '', cash_amount: finalPrice || '' })
                    } else {
                      const val = Math.max(0, parseDigits(raw))
                      setForm({ ...form, card_amount: val, cash_amount: Math.max(0, finalPrice - val) })
                    }
                  }}
                />
              </div>

              <p className="text-xs text-muted text-center pt-1 font-mono">
                💡 {formatMoney(form.cash_amount || 0)} Naqd +{' '}
                {formatMoney(form.card_amount || 0)} {splitSecond === 'card' ? 'Karta' : 'QR'}{' '}
                = <b className="text-gold">{formatMoney(finalPrice)}</b>
              </p>
            </div>
          )}
        </div>

        {/* 5. PRICE SUMMARY CARD */}
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 text-center">
          {computedDiscount > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted">Dastlabki xizmatlar summasi: <span className="line-through">{formatMoney(totalBasePrice)}</span></p>
              <p className="text-xs text-emerald-400 font-bold">Jami Chegirma: -{formatMoney(computedDiscount)} ({form.discount_reason || 'Aksiya'})</p>
              <p className="text-sm opacity-80 uppercase font-bold mt-1">Yakuniy To'lov Summasi</p>
              <p className="text-3xl font-black text-gold font-mono">{formatMoney(finalPrice)}</p>
            </div>
          ) : (
            <div>
              <p className="text-sm opacity-70 font-bold uppercase">To'lov Summasi ({selectedServices.length} ta xizmat)</p>
              <p className="text-3xl font-black text-gold font-mono">{formatMoney(totalBasePrice)}</p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Btn
          variant={isPaperMode ? 'success' : 'gold'}
          full
          size="lg"
          icon={Icons.save}
          loading={loading}
          disabled={loading}
          onClick={submit}
          className="py-3.5 text-base font-black"
        >
          {loading
            ? 'Saqlanmoqda...'
            : isPaperMode
            ? `📄 Tasdiqlash va Bazaga Qo'shish (${customDate} smenasi) ✓`
            : 'To\'lovni Qabul Qilish va Chek Chiqarish ✓'}
        </Btn>
      </div>

      {/* QUICK ADD NEW REFERRER MODAL */}
      <Modal open={newRefModal} onClose={() => setNewRefModal(false)} title="Yangi Yo'naltiruvchi Qo'shish" size="xs">
        <div className="space-y-3 pt-1">
          <div>
            <label className="form-label">Ism-Sharifi / Shifokor nomi *</label>
            <input
              className="input-field font-bold text-gold"
              placeholder="Dr. Ergashov Vazir"
              value={newRefForm.full_name}
              onChange={(e) => setNewRefForm({ ...newRefForm, full_name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Telefon raqami (ixtiyoriy)</label>
            <input
              className="input-field"
              placeholder="+998901234567 (ixtiyoriy)"
              value={newRefForm.phone}
              onChange={(e) => setNewRefForm({ ...newRefForm, phone: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setNewRefModal(false)}>
              Bekor
            </Btn>
            <Btn variant="gold" full icon={Icons.save} loading={savingRef} onClick={handleQuickAddReferrer}>
              Saqlash va Tanlash
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
