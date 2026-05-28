import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'

export default function CeoEmployees() {
  const [items,       setItems]       = useState(null)
  const [modal,       setModal]       = useState(false)
  const [edit,        setEdit]        = useState(null)
  const [form,        setForm]        = useState({ full_name: '', position: '', monthly_salary: '' })
  const [confirmPayId, setConfirmPayId] = useState(null)
  const [paySummary,  setPaySummary]  = useState(null)
  const [historyEmp,  setHistoryEmp]  = useState(null)
  const [history,     setHistory]     = useState([])
  const [reminder, setReminder] = useState({ enabled: false, time: '09:00', day_of_month: 1, month: 0 })
  const toast = useToastStore((s) => s.add)

  const load = async () => {
    const [emps, rem] = await Promise.all([api('/employees'), api('/employees/salary-reminder/config')])
    setItems(emps)
    setReminder({
      enabled: !!rem.enabled,
      time: rem.time || '09:00',
      day_of_month: rem.day_of_month || 1,
      month: rem.month || 0,
    })
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.full_name || !form.position || !form.monthly_salary) {
      toast("Barcha maydonlarni to'ldiring", 'error')
      return
    }
    try {
      const body = { ...form, monthly_salary: parseInt(form.monthly_salary, 10) }
      if (edit) await api(`/employees/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/employees', { method: 'POST', body: JSON.stringify(body) })
      toast('Saqlandi')
      setModal(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const paySalary = async (id) => {
    try {
      const res = await api(`/employees/${id}/pay-salary`, { method: 'POST' })
      toast(
        `Maosh to'landi: ${formatMoney(res.amount)} | Balans: ${formatMoney(res.current_balance || 0)} | Qolgan foyda: ${formatMoney(res.net_profit || 0)}`,
      )
      setConfirmPayId(null)
      setPaySummary(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
      setConfirmPayId(null)
      setPaySummary(null)
    }
  }

  const openHistory = async (emp) => {
    setHistoryEmp(emp)
    const data = await api(`/employees/${emp.id}/salary-history`)
    setHistory(data || [])
  }

  const saveReminder = async () => {
    try {
      await api('/employees/salary-reminder/config', {
        method: 'POST',
        body: JSON.stringify(reminder),
      })
      toast('Maosh eslatma vaqti saqlandi')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div>
      <div className="card mb-4">
        <h2 className="accent-value mb-3 font-semibold">Maosh eslatmasi</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reminder.enabled} onChange={(e) => setReminder({ ...reminder, enabled: e.target.checked })} />
            Eslatma yoqilsin
          </label>
          <input className="input-field" type="time" value={reminder.time} onChange={(e) => setReminder({ ...reminder, time: e.target.value })} />
          <input className="input-field" type="number" min={1} max={31} value={reminder.day_of_month} onChange={(e) => setReminder({ ...reminder, day_of_month: +e.target.value || 1 })} placeholder="Kun (1-31)" />
          <select className="input-field" value={reminder.month} onChange={(e) => setReminder({ ...reminder, month: +e.target.value })}>
            <option value={0}>Har oy</option>
            <option value={1}>Yanvar</option><option value={2}>Fevral</option><option value={3}>Mart</option><option value={4}>Aprel</option>
            <option value={5}>May</option><option value={6}>Iyun</option><option value={7}>Iyul</option><option value={8}>Avgust</option>
            <option value={9}>Sentabr</option><option value={10}>Oktabr</option><option value={11}>Noyabr</option><option value={12}>Dekabr</option>
          </select>
          <button type="button" className="btn-gold" onClick={saveReminder}>Saqlash</button>
        </div>
        <p className="text-muted mt-2 text-xs">Kun, oy va vaqt bo'yicha bildirishnomalarda maosh eslatmasi chiqadi.</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Xodimlar</h1>
        <button
          type="button"
          className="btn-gold"
          onClick={() => { setEdit(null); setForm({ full_name: '', position: '', monthly_salary: '' }); setModal(true) }}
        >
          + Qo'shish
        </button>
      </div>

      {!items ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <div className="card flex h-40 items-center justify-center">
          <p className="text-muted">Hali xodim qo'shilmagan</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                {['Ism', 'Lavozim', 'Oylik maosh', ''].map((h) => (
                  <th key={h} className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr
                  key={e.id}
                  className="border-b table-row"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="p-3 font-medium">{e.full_name}</td>
                  <td className="p-3 text-muted">{e.position}</td>
                  <td className="p-3 font-semibold accent-value">{formatMoney(e.monthly_salary)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="btn-ghost py-1 px-2 text-xs"
                        onClick={() => openHistory(e)}
                      >
                        Tarix
                      </button>
                      <button
                        type="button"
                        className="btn-outline py-1 px-2 text-xs"
                        onClick={() => {
                          setEdit(e)
                          setForm({ ...e, monthly_salary: String(e.monthly_salary) })
                          setModal(true)
                        }}
                      >
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        className="btn-gold py-1 px-2 text-xs"
                        onClick={async () => {
                          setConfirmPayId(e.id)
                          try {
                            const s = await api(`/employees/${e.id}/payroll-summary`)
                            setPaySummary(s)
                          } catch (_) {
                            setPaySummary(null)
                          }
                        }}
                      >
                        Maosh
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={edit ? 'Xodimni tahrirlash' : "Yangi xodim qo'shish"}
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="text-muted mb-1 block text-xs">To'liq ism *</label>
            <input
              className="input-field"
              placeholder="Familiya Ism"
              value={form.full_name || ''}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs">Lavozim *</label>
            <input
              className="input-field"
              placeholder="Hamshira, Shifokor, ..."
              value={form.position || ''}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs">Oylik maosh (so'm) *</label>
            <input
              className="input-field"
              type="number"
              placeholder="0"
              value={form.monthly_salary || ''}
              onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-outline flex-1" onClick={() => setModal(false)}>
              Bekor
            </button>
            <button type="button" className="btn-gold flex-1" onClick={save}>
              Saqlash
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm pay modal */}
      <Modal open={!!confirmPayId} onClose={() => { setConfirmPayId(null); setPaySummary(null) }} title="Maosh berish" size="sm">
        <p className="text-muted mb-4 text-sm">
          Xodimga oylik maosh berilsinmi? Bu amal balansdan ayiriladi.
        </p>
        {paySummary && (
          <div className="mb-4 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <p>Oy: <b>{paySummary.month}</b></p>
            <p>Asosiy oylik: <b>{formatMoney(paySummary.base_salary)}</b></p>
            <p>Avanslar jami: <b>{formatMoney(paySummary.advances_total)}</b></p>
            <p>Beriladigan yakuniy summa: <b className="text-gold">{formatMoney(paySummary.payable_salary)}</b></p>
            {paySummary.current_balance != null && (
              <>
                <p>To'lovdan keyingi balans: <b>{formatMoney(paySummary.current_balance)}</b></p>
                <p>Qolgan foyda: <b>{formatMoney(paySummary.net_profit || 0)}</b></p>
              </>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-outline flex-1" onClick={() => { setConfirmPayId(null); setPaySummary(null) }}>
            Bekor
          </button>
          <button type="button" className="btn-gold flex-1" onClick={() => paySalary(confirmPayId)}>
            Ha, berish
          </button>
        </div>
      </Modal>

      {/* Salary history modal */}
      <Modal
        open={!!historyEmp}
        onClose={() => setHistoryEmp(null)}
        title={historyEmp ? `${historyEmp.full_name} — maosh tarixi` : ''}
        size="md"
      >
        {history.length === 0 ? (
          <p className="text-muted text-sm">Maosh tarixi topilmadi</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                  {['Oy', 'Summa', 'Sana'].map((h) => (
                    <th key={h} className="p-2 font-semibold" style={{ color: 'var(--gold)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((l) => {
                  const d = new Date(l.paid_at)
                  return (
                    <tr
                      key={l.id}
                      className="border-b table-row"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="p-2">
                        <span className="badge badge-gold">{l.month}</span>
                      </td>
                      <td className="p-2 font-semibold accent-value">
                        {formatMoney(l.amount)}
                      </td>
                      <td className="p-2 text-muted text-xs">
                        {d.toLocaleDateString('uz-UZ')} {d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
