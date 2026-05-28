import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatDate, formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'

const SOURCES = ['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa']

export default function CeoAdvances() {
  const [employees, setEmployees] = useState([])
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ employee_id: '', amount: '', source: 'Naqt kassa', note: '' })
  const [summary, setSummary] = useState(null)
  const toast = useToastStore((s) => s.add)

  const load = async () => {
    const [emps, list] = await Promise.all([api('/employees'), api('/advances')])
    setEmployees(emps)
    setItems(list)
  }

  useEffect(() => {
    load().catch((e) => toast(e.message, 'error'))
  }, [])

  useEffect(() => {
    if (!form.employee_id) {
      setSummary(null)
      return
    }
    api(`/employees/${form.employee_id}/payroll-summary`)
      .then(setSummary)
      .catch((e) => toast(e.message, 'error'))
  }, [form.employee_id])

  const submit = async () => {
    if (!form.employee_id || !form.amount) return toast("Xodim va summa kiriting", 'error')
    try {
      await api('/advances', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: +form.employee_id,
          amount: +form.amount,
          source: form.source,
          note: form.note || null,
        }),
      })
      toast("Avans saqlandi")
      setForm({ employee_id: '', amount: '', source: 'Naqt kassa', note: '' })
      await load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3">
        <h1 className="page-title mb-2">Avans berish</h1>
        <select className="input-field" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
          <option value="">Xodim tanlang</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <input className="input-field" type="number" placeholder="Summa" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {summary && (
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <p className="mb-1 text-muted">Joriy oy: {summary.month}</p>
            <p>Asosiy oylik: <b className="accent-value">{formatMoney(summary.base_salary)}</b></p>
            <p>Olingan avans (jami): <b>{formatMoney(summary.advances_total)}</b></p>
            <p>Qoladigan oylik: <b className="text-gold">{formatMoney(summary.payable_salary)}</b></p>
          </div>
        )}
        <input className="input-field" placeholder="Izoh (ixtiyoriy)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button type="button" className="btn-gold w-full" onClick={submit}>Avans berish</button>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="accent-value mb-3 font-semibold">Oxirgi avanslar</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head border-b">
              <th className="p-2 text-left">Sana</th>
              <th className="p-2 text-left">Xodim</th>
              <th className="p-2 text-left">Manba</th>
              <th className="p-2 text-left">Summa</th>
              <th className="p-2 text-left">Asosiy oylik</th>
              <th className="p-2 text-left">Qoldiq</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="table-row border-b">
                <td className="p-2">{formatDate(a.created_at)}</td>
                <td className="p-2">{a.employee_name}</td>
                <td className="p-2">{a.source || '—'}</td>
                <td className="p-2 accent-value">{formatMoney(a.amount)}</td>
                <td className="p-2">{formatMoney(a.base_salary || 0)}</td>
                <td className="p-2 text-gold">{formatMoney(a.remaining_salary || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
