import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney, formatWithCommas, parseDigits } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons, PageHeader, THead, EmptyState } from '../../components/UIKit'

// "Avans" va "Oylik" oddiy harajat emas — ular aniq xodimga bog'lanadi va
// maosh hisob-kitobiga ta'sir qiladi, shuning uchun alohida ajratilgan.
const STAFF_CATEGORIES = ['Avans', 'Oylik']
const CATEGORIES = ['Kommunal', "Ta'mirlash", 'Jihozlar', 'Dori-darmon', 'Transport', 'Reklama', ...STAFF_CATEGORIES, 'Boshqa']
const SOURCES    = ['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa']

export default function AdminExpenses() {
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [category,    setCategory]    = useState('')
  const [source,      setSource]      = useState('Naqt kassa')
  const [employeeId,  setEmployeeId]  = useState('')
  const [employees,   setEmployees]   = useState([])
  const [empSummary,  setEmpSummary]  = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [todayList,   setTodayList]   = useState([])
  const toast = useToastStore((s) => s.add)

  const isStaffPayment = STAFF_CATEGORIES.includes(category)

  const loadToday = () => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    api(`/expenses?from=${today}&to=${today}`).then((r) => setTodayList(r || [])).catch(() => {})
  }

  useEffect(() => { loadToday() }, [])

  // Xodim ro'yxati faqat kerak bo'lganda yuklanadi
  useEffect(() => {
    if (isStaffPayment && !employees.length) {
      api('/employees?include_inactive=false').then(setEmployees).catch(() => {})
    }
    if (!isStaffPayment) { setEmployeeId(''); setEmpSummary(null) }
  }, [isStaffPayment])

  // Tanlangan xodimning oylik/avans holati
  useEffect(() => {
    if (!employeeId) { setEmpSummary(null); return }
    api(`/employees/${employeeId}/payroll-summary`)
      .then(setEmpSummary)
      .catch(() => setEmpSummary(null))
  }, [employeeId])

  const submit = async () => {
    const summa = parseInt(parseDigits(amount), 10) || 0
    if (!summa) { toast('Summa kiriting', 'error'); return }

    if (isStaffPayment) {
      if (!employeeId) { toast('Xodimni tanlang', 'error'); return }
      setLoading(true)
      try {
        if (category === 'Avans') {
          const res = await api(`/employees/${employeeId}/advance`, {
            method: 'POST',
            body: JSON.stringify({ amount: summa, note: description || null }),
          })
          toast(`${res.employee_name}: avans ${formatMoney(res.amount)} — qolgan oylik ${formatMoney(res.remaining)}`)
        } else {
          const res = await api(`/employees/${employeeId}/pay-salary`, { method: 'POST' })
          toast(`Maosh to'landi: ${formatMoney(res.amount)}`)
        }
        setDescription(''); setAmount(''); setEmployeeId(''); setCategory('')
        loadToday()
      } catch (e) { toast(e.message, 'error') }
      finally { setLoading(false) }
      return
    }

    if (!description) { toast('Nima uchun ekanini yozing', 'error'); return }
    setLoading(true)
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ description, amount: summa, category: category || null, source }),
      })
      toast('Harajat saqlandi ✓')
      setDescription(''); setAmount(''); setCategory(''); setSource('Naqt kassa')
      loadToday()
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const todayTotal = todayList.reduce((a, x) => a + (x.amount || 0), 0)

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        title="Harajat Kiritish"
        subtitle="Kassadan chiqim sifatida qayd etiladi"
        icon={Icons.chart}
      />

      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Kategoriya</label>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— Kategoriya tanlanmagan</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{STAFF_CATEGORIES.includes(c) ? `👤 ${c}` : c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Pul Manbasi</label>
            <select className="input-field" value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Avans / Oylik tanlansa — kim uchun ekanini belgilash */}
        {isStaffPayment && (
          <div className="p-3.5 rounded-2xl border border-gold/40 bg-gold/5 space-y-3 animate-in fade-in">
            <span className="text-xs font-bold uppercase tracking-wider text-gold">
              👤 {category} kim uchun?
            </span>

            <select className="input-field" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— Xodimni tanlang</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} — {e.position}</option>
              ))}
            </select>

            {empSummary && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-surface-2 border border-border">
                  <span className="block text-[10px] text-muted uppercase font-bold">Oylik</span>
                  <span className="block text-sm font-mono font-black text-body">{formatMoney(empSummary.base_salary)}</span>
                </div>
                <div className="p-2 rounded-xl bg-surface-2 border border-border">
                  <span className="block text-[10px] text-muted uppercase font-bold">Olingan avans</span>
                  <span className="block text-sm font-mono font-black text-amber-400">{formatMoney(empSummary.advances_total)}</span>
                </div>
                <div className="p-2 rounded-xl bg-surface-2 border border-border">
                  <span className="block text-[10px] text-muted uppercase font-bold">Qoladi</span>
                  <span className="block text-sm font-mono font-black text-emerald">
                    {formatMoney(Math.max(0, empSummary.base_salary - empSummary.advances_total))}
                  </span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted">
              {category === 'Avans'
                ? "Avans oylikdan ayiriladi — Rahbar hisobotida «oylik / olingan avans / qolgan» ko'rinishida chiqadi."
                : "Oylik to'lash: qolgan summa (oylik − olingan avanslar) to'lanadi."}
            </p>
          </div>
        )}

        <div>
          <label className="form-label">
            {isStaffPayment ? 'Izoh (ixtiyoriy)' : 'Tavsif (nima uchun?) *'}
          </label>
          <input
            className="input-field"
            placeholder={isStaffPayment ? 'Masalan: bayram oldidan' : "Masalan: Elektr to'lovi, Shprits xaridi..."}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Summa (so'm) *</label>
          {/* Raqamlar 50,000 ko'rinishida yoziladi */}
          <input
            className="input-field font-mono font-bold text-base"
            inputMode="numeric"
            placeholder="0"
            value={formatWithCommas(amount)}
            onChange={(e) => setAmount(parseDigits(e.target.value))}
            disabled={category === 'Oylik'}
          />
          {category === 'Oylik' && (
            <p className="text-[11px] text-muted mt-1">
              Oylikda summa avtomatik hisoblanadi (oylik − olingan avanslar).
            </p>
          )}
        </div>

        <Btn variant="gold" full size="md" icon={Icons.save} loading={loading} onClick={submit}>
          {loading ? 'Saqlanmoqda...'
            : category === 'Avans' ? 'Avansni berish'
            : category === 'Oylik' ? "Oylikni to'lash"
            : 'Harajatni Saqlash'}
        </Btn>
      </div>

      {/* Bugungi harajatlar — nima uchun qilingani ko'rinib tursin */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-gold uppercase tracking-wide">Bugungi harajatlar</h3>
          <span className="text-xs font-mono font-bold text-rose-400">
            Jami: {formatMoney(todayTotal)}
          </span>
        </div>

        {todayList.length === 0 ? (
          <EmptyState message="Bugun harajat kiritilmagan" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <THead cols={['Vaqt', 'Kategoriya', 'Nima uchun', 'Summa']} />
              <tbody className="divide-y divide-border">
                {todayList.map((x) => (
                  <tr key={x.id} className="hover:bg-surface-hover font-semibold">
                    <td className="p-2.5 font-mono text-muted">
                      {x.created_at ? new Date(x.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="p-2.5">
                      <span className="badge badge-muted text-[10px]">{x.category || 'Boshqa'}</span>
                    </td>
                    <td className="p-2.5 text-body">{x.description || '—'}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-400">
                      -{formatMoney(x.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
