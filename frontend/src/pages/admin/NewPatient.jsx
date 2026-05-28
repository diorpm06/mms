import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { savePendingPatient } from '../../utils/offline'
import PageHeader from '../../components/PageHeader'

const empty = {
  first_name: '',
  last_name: '',
  birth_date: '',
  phone: '+998',
  address: '',
  referrer_id: null,
  provider_id: '',
  service_id: '',
  payment_amount: 0,
  payment_type: 'cash',
}

function normalizeBirthDate(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
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
  const [referrers, setReferrers] = useState([])
  const [providers, setProviders] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api('/referrers'),
      api('/providers'),
      api('/services'),
    ])
      .then(([r, p, s]) => {
        setReferrers(r || [])
        setProviders(p || [])
        setServices(s || [])
        if (!s?.length) toast('Xizmat turlari topilmadi — CEO qo\'shishi kerak', 'error')
        if (!p?.length) toast('Xizmat ko\'rsatuvchilar topilmadi', 'error')
      })
      .catch((e) => toast(e.message || 'Ro\'yxatlar yuklanmadi', 'error'))
  }, [])

  useEffect(() => {
    const prefill = location.state?.patient
    if (prefill) {
      setForm({
        first_name: prefill.first_name,
        last_name: prefill.last_name,
        birth_date: toDisplayBirthDate(prefill.birth_date),
        phone: prefill.phone,
        address: prefill.address,
        referrer_id: prefill.referrer_id,
        provider_id: prefill.provider_id,
        service_id: prefill.service_id,
        payment_amount: prefill.payment_amount,
        payment_type: prefill.payment_type || 'cash',
      })
    }
  }, [location.state])

  const onServiceChange = (id) => {
    const svc = services.find((s) => s.id === +id)
    setForm((f) => ({
      ...f,
      service_id: id,
      payment_amount: svc ? svc.price : 0,
    }))
  }

  const submit = async () => {
    const normalizedBirthDate = normalizeBirthDate(form.birth_date)
    if (!form.first_name || !form.last_name || !normalizedBirthDate || !form.provider_id || !form.service_id) {
      toast("Barcha majburiy maydonlarni to'ldiring", 'error')
      return
    }
    const payload = {
      ...form,
      birth_date: normalizedBirthDate,
      referrer_id: form.referrer_id || null,
      provider_id: +form.provider_id,
      service_id: +form.service_id,
      payment_amount: +form.payment_amount,
    }
    setLoading(true)
    try {
      if (!navigator.onLine) {
        await savePendingPatient({ payload })
        toast('Offline saqlandi — ulanishda yuboriladi')
        navigate(homePath)
        return
      }
      await api('/patients', { method: 'POST', body: JSON.stringify(payload) })
      toast('To\'lov qabul qilindi ✓')
      navigate(homePath)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Yangi mijoz" backTo={homePath} />
      <div className="card space-y-4">
        <input className="input-field" placeholder="Ism *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        <input className="input-field" placeholder="Familiya *" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        <input
          className="input-field"
          placeholder="Tug'ilgan sana (kk/oo/yyyy) masalan: 25/12/1998 *"
          inputMode="numeric"
          maxLength={10}
          value={form.birth_date}
          onChange={(e) => setForm({ ...form, birth_date: formatBirthDateInput(e.target.value) })}
        />
        <input className="input-field" placeholder="+998901234567 *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input-field" placeholder="Manzil *" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <select className="input-field" value={form.referrer_id || ''} onChange={(e) => setForm({ ...form, referrer_id: e.target.value ? +e.target.value : null })}>
          <option value="">Yo'naltiruvchi — Yo'q</option>
          {referrers.map((r) => (
            <option key={r.id} value={r.id}>{r.full_name}</option>
          ))}
        </select>
        <select className="input-field" value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })} required>
          <option value="">Xizmat ko'rsatuvchi *</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
        <select className="input-field" value={form.service_id} onChange={(e) => onServiceChange(e.target.value)} required>
          <option value="">Xizmat turi *</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {formatMoney(s.price)}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {['cash', 'card'].map((t) => (
            <button
              key={t}
              type="button"
              className={form.payment_type === t ? 'btn-gold flex-1' : 'btn-outline flex-1'}
              onClick={() => setForm({ ...form, payment_type: t })}
            >
              {t === 'cash' ? 'Naqt' : 'Karta'}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 text-center">
          <p className="text-sm opacity-70">Narx</p>
          <p className="text-2xl font-bold text-gold">{formatMoney(form.payment_amount)}</p>
        </div>
        <button type="button" disabled={loading} className="btn-gold w-full py-3 text-lg disabled:opacity-50" onClick={submit}>
          {loading ? 'Saqlanmoqda...' : 'To\'lov qabul qilindi ✓'}
        </button>
      </div>
    </div>
  )
}
