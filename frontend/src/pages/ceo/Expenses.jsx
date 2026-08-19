import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney, formatDate } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, PageHeader, THead, EmptyState } from '../../components/UIKit'

const STAFF_CATEGORIES = ['Avans', 'Oylik']
const CATEGORIES = ['Kommunal', "Ta'mirlash", 'Jihozlar', "Dori-darmon", 'Transport', 'Reklama', ...STAFF_CATEGORIES, 'Boshqa']
const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']

const CAT_COLORS = {
  'Kommunal': '#3b82f6', "Ta'mirlash": '#ef4444', 'Jihozlar': '#d4af37',
  "Dori-darmon": '#10b981', 'Transport': '#a855f7', 'Reklama': '#f97316',
  'Avans': '#f59e0b', 'Oylik': '#10b981', 'Boshqa': '#64748b',
}

export default function CeoExpenses() {
  const [items,        setItems]        = useState(null)
  const [month,        setMonth]        = useState(new Date().getMonth() + 1)
  const [year,         setYear]         = useState(new Date().getFullYear())
  const [showCancelled, setShowCancelled] = useState(false)
  const [total,        setTotal]        = useState(0)
  const [cancelId,     setCancelId]     = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [description,  setDescription]  = useState('')
  const [amount,       setAmount]       = useState('')
  const [category,     setCategory]     = useState('')
  const [source,       setSource]       = useState('Naqt kassa')
  const [employeeId,  setEmployeeId]  = useState('')
  const [staffList,   setStaffList]   = useState([])
  const [empSummary,  setEmpSummary]  = useState(null)
  const [addLoading,   setAddLoading]   = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [editForm,    setEditForm]    = useState({ description: '', amount: '', category: '', source: 'Naqt kassa' })
  const [editLoading, setEditLoading] = useState(false)
  const toast = useToastStore((s) => s.add)

  const openEditModal = (item) => {
    setEditExpense(item)
    setEditForm({
      description: item.description || '',
      amount: String(item.amount || 0),
      category: item.category || '',
      source: item.source || 'Naqt kassa',
    })
  }

  const handleSaveEdit = async () => {
    if (!editExpense) return
    const newAmt = parseInt(editForm.amount, 10) || 0
    if (!editForm.description.trim()) {
      toast("Harajat tavsifi (sababi)ni kiriting", "error")
      return
    }
    setEditLoading(true)
    try {
      await api(`/expenses/${editExpense.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: editForm.description.trim(),
          amount: newAmt,
          category: editForm.category || null,
          source: editForm.source || null,
        }),
      })
      toast("Harajat tahrirlandi — kassa balansi va hisobotlar avtomatik yangilandi ✓")
      setEditExpense(null)
      load()
    } catch (err) {
      toast(err.message || "Saqlashda xatolik", "error")
    } finally {
      setEditLoading(false)
    }
  }

  const isStaffPayment = STAFF_CATEGORIES.includes(category)

  const load = () => {
    api(`/expenses?month=${month}&year=${year}&include_cancelled=${showCancelled}`).then(setItems)
    api(`/expenses/summary?month=${month}&year=${year}`).then((r) => setTotal(r.total))
  }
  useEffect(() => { load() }, [month, year, showCancelled])

  useEffect(() => {
    if (isStaffPayment && !staffList.length) {
      Promise.all([
        api('/employees?include_inactive=false').catch(() => []),
        api('/providers?active_only=true').catch(() => []),
      ]).then(([empList, provList]) => {
        const formattedProv = (provList || []).map((p) => ({
          value: `prov_${p.id}`,
          type: 'provider',
          rawId: p.id,
          label: `🩺 ${p.full_name} — Shifokor (${p.specialization || 'Umumiy'})`,
        }))
        const formattedEmp = (empList || []).map((e) => ({
          value: `emp_${e.id}`,
          type: 'employee',
          rawId: e.id,
          label: `👤 ${e.full_name} — ${e.position || 'Xodim'}`,
        }))
        setStaffList([...formattedProv, ...formattedEmp])
      })
    }
    if (!isStaffPayment) { setEmployeeId(''); setEmpSummary(null) }
  }, [isStaffPayment])

  useEffect(() => {
    if (!employeeId) { setEmpSummary(null); return }
    const [type, rawId] = employeeId.split('_')
    const endpoint = type === 'prov' ? `/providers/${rawId}/payroll-summary` : `/employees/${rawId}/payroll-summary`
    api(endpoint)
      .then((res) => {
        setEmpSummary({
          base_salary: res.base_salary || res.monthly_salary || 0,
          advances_total: res.advances_total || 0,
          remaining: res.remaining ?? Math.max(0, (res.base_salary || 0) - (res.advances_total || 0)),
        })
      })
      .catch(() => setEmpSummary(null))
  }, [employeeId])

  const handleAddExpense = async () => {
    const summa = parseInt(amount, 10) || 0
    if (isStaffPayment) {
      if (!employeeId) { toast('Xodim yoki shifokorni tanlang', 'error'); return }
      if (!summa && category !== 'Oylik') { toast('Summa kiriting', 'error'); return }
      const [type, rawId] = employeeId.split('_')
      setAddLoading(true)
      try {
        if (category === 'Avans') {
          if (type === 'prov') {
            const res = await api('/advances', {
              method: 'POST',
              body: JSON.stringify({ recipient_type: 'provider', recipient_id: +rawId, amount: summa, note: description || null }),
            })
            toast(`Shifokor ${res.recipient_name}: avans ${formatMoney(res.amount)} berildi ✓`)
          } else {
            const res = await api(`/employees/${rawId}/advance`, {
              method: 'POST',
              body: JSON.stringify({ amount: summa, note: description || null }),
            })
            toast(`${res.employee_name}: avans ${formatMoney(res.amount)} — qolgan oylik ${formatMoney(res.remaining)}`)
          }
        } else {
          if (type === 'prov') {
            const res = await api(`/providers/${rawId}/payout`, {
              method: 'POST',
              body: JSON.stringify({ source }),
            })
            toast(`Shifokor maoshi to'landi: ${formatMoney(res.amount)} ✓`)
          } else {
            const res = await api(`/employees/${rawId}/pay-salary`, { method: 'POST' })
            toast(`Maosh to'landi: ${formatMoney(res.amount)}`)
          }
        }
        setDescription(''); setAmount(''); setEmployeeId(''); setCategory(''); setAddModalOpen(false)
        load()
      } catch (e) { toast(e.message, 'error') }
      finally { setAddLoading(false) }
      return
    }

    if (!description || !amount) { toast('Tavsif va summa kiriting', 'error'); return }
    setAddLoading(true)
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ description, amount: summa, category: category || null, source }),
      })
      toast('Harajat saqlandi ✓')
      setDescription('')
      setAmount('')
      setCategory('')
      setSource('Naqt kassa')
      setAddModalOpen(false)
      load()
    } catch (e) { toast(e.message, 'error') }
    finally { setAddLoading(false) }
  }

  const doCancel = async () => {
    const reasonText = cancelReason.trim() || "CEO tomonidan o'chirildi"
    try {
      await api(`/expenses/${cancelId}`, { method: 'DELETE', body: JSON.stringify({ reason: reasonText }) })
      toast('Harajat o\'chirildi va balans qaytarildi ✓')
      setCancelId(null)
      setCancelReason('')
      load()
    } catch (e) {
      toast(e.message || "O'chirishda xatolik", 'error')
    }
  }

  const handleDeleteDirectly = async (eItem) => {
    if (!window.confirm(`"${eItem.description || 'Harajat'}" (${formatMoney(eItem.amount)}) o'chirilsinmi?\nSumma balansga qaytariladi.`)) return
    try {
      await api(`/expenses/${eItem.id}`, { method: 'DELETE' })
      toast('Harajat o\'chirildi ✓')
      load()
    } catch (err) {
      toast(err.message || "O'chirishda xatolik", 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Harajatlar"
        subtitle="Oylik xarajatlar nazorati va yangi harajat kiritish"
        icon={Icons.chart}
      >
        <Btn variant="gold" size="sm" icon={Icons.plus} onClick={() => setAddModalOpen(true)}>
          + Harajat Kiritish
        </Btn>
        {/* Filtr */}
        <select className="input-field text-xs py-2" value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <input type="number" className="input-field text-xs py-2 w-24" value={year} onChange={(e) => setYear(+e.target.value)} />

        <button
          type="button"
          onClick={() => setShowCancelled(!showCancelled)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            showCancelled
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
              : 'bg-surface-2 border-border text-muted hover:text-body'
          }`}
        >
          {showCancelled ? "🔴 O'chirilganlar ko'rinmoqda" : "👁️ O'chirilganlarni ko'rsat"}
        </button>

        {/* Jami */}
        <div className="flex items-center gap-2 rounded-xl border px-4 py-2" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          <span className="text-xs text-muted">Jami harajat:</span>
          <span className="font-black text-base" style={{ color: 'var(--danger)' }}>{formatMoney(total)}</span>
        </div>
      </PageHeader>

      {!items ? <TableSkeleton /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="💸" message="Bu oyda harajat yo'q" />
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <THead cols={['Sana', 'Kategoriya', 'Manba', 'Tavsif', 'Summa', 'Amallar']} />
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className={`hover:bg-white/[0.02] transition-colors ${e.is_cancelled ? 'bg-rose-500/5 opacity-70 line-through' : ''}`}>
                  <td className="td-muted text-xs whitespace-nowrap">{formatDate(e.created_at)}</td>
                  <td className="td-cell">
                    {e.category ? (
                      <span
                        className="badge text-xs"
                        style={{
                          background: `${CAT_COLORS[e.category] || '#64748b'}18`,
                          color: CAT_COLORS[e.category] || '#64748b',
                        }}
                      >
                        {e.category}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="td-muted text-xs">{e.source || '—'}</td>
                  <td className="td-cell">
                    <div>{e.description}</div>
                    {e.is_cancelled && e.cancel_reason && (
                      <div className="text-[10px] text-rose-400 no-underline font-semibold mt-0.5">
                        ⚠️ O'chirish sababi: {e.cancel_reason}
                      </div>
                    )}
                  </td>
                  <td className="td-cell font-bold" style={{ color: 'var(--danger)' }}>
                    {formatMoney(e.amount)}
                  </td>
                  <td className="td-cell">
                    {!e.is_cancelled ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(e)}
                          className="px-2 py-1 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs font-bold transition-all"
                        >
                          ✏️ Tahrirlash
                        </button>
                        <Btn
                          variant="danger"
                          size="xs"
                          icon={Icons.trash}
                          onClick={() => handleDeleteDirectly(e)}
                          title="O'chirish (balansga qaytarish)"
                        >
                          O'chirish
                        </Btn>
                      </div>
                    ) : (
                      <Btn
                        variant="cyan"
                        size="xs"
                        onClick={async () => {
                          if (!confirm("Ushbu harajatni qayta tiklamoqchimisiz?")) return
                          try {
                            await api(`/expenses/${e.id}/restore`, { method: 'POST' })
                            toast("Harajat qayta tiklandi ✓")
                            load()
                          } catch (err) {
                            toast(err.message, 'error')
                          }
                        }}
                        title="Harajatni qayta tiklash"
                      >
                        ↩️ Tiklash
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="Harajatni bekor qilish" size="sm">
        <div className="rounded-xl p-3 mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          ⚠️ Harajat bekor qilinsa, summa balansga qaytariladi.
        </div>
        <div className="space-y-3">
          <div>
            <label className="form-label">Bekor qilish sababi *</label>
            <input className="input-field" placeholder="Kamida 3 ta harf..."
              value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setCancelId(null)}>Orqaga</Btn>
            <Btn variant="danger" full icon={Icons.trash} onClick={doCancel}>Bekor qilish</Btn>
          </div>
        </div>
      </Modal>

      {/* Harajat Kiritish Modali */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Yangi Harajat Kiritish" size="md">
        <div className="space-y-4">
          <div>
            <label className="form-label">Kategoriya</label>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— Kategoriya tanlanmagan</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{STAFF_CATEGORIES.includes(c) ? `👤 ${c}` : c}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Pul Manbasi</label>
            <select className="input-field" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="Naqt kassa">Naqt kassa</option>
              <option value="Karta kassa">Karta kassa</option>
              <option value="Bank hisob">Bank hisob</option>
              <option value="Boshqa">Boshqa</option>
            </select>
          </div>

          {/* Avans / Oylik tanlansa — kim uchun ekanini belgilash */}
          {isStaffPayment && (
            <div className="p-3.5 rounded-2xl border border-gold/40 bg-gold/5 space-y-3 animate-in fade-in">
              <span className="text-xs font-bold uppercase tracking-wider text-gold">
                👤 {category} kim uchun?
              </span>

              <select className="input-field font-semibold" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">— Xodim yoki shifokorni tanlang —</option>
                {staffList.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>

              {empSummary && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-surface-2 border border-border">
                    <span className="block text-[10px] text-muted uppercase font-bold">Oylik/Ulush</span>
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
            </div>
          )}

          <div>
            <label className="form-label">{isStaffPayment ? 'Izoh (ixtiyoriy)' : 'Tavsif (nima uchun?) *'}</label>
            <input className="input-field" placeholder={isStaffPayment ? 'Masalan: bayram oldidan' : "Masalan: Elektr to'lovi, Shprits xaridi..."}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Summa (so'm) *</label>
            <input className="input-field" type="number" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} disabled={category === 'Oylik'} />
          </div>

          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full onClick={() => setAddModalOpen(false)}>Orqaga</Btn>
            <Btn variant="gold" full icon={Icons.save} loading={addLoading} onClick={handleAddExpense}>
              {addLoading ? 'Saqlanmoqda...' : category === 'Avans' ? 'Avansni berish' : category === 'Oylik' ? "Oylikni to'lash" : 'Harajatni Saqlash'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* EDIT EXPENSE MODAL */}
      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Harajatni Tahrirlash (Balans avtomatik yangilanadi)">
        <div className="space-y-4 pt-1">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            ⚠️ Summa yoki tavsif o'zgartirilganda, kassa balansi va moliya hisobotlari avtomatik qayta hisoblanadi.
          </div>

          <div>
            <label className="form-label">Kategoriya</label>
            <select
              className="input-field text-xs font-bold"
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
            >
              <option value="">— Kategoriya tanlanmagan</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Pul Manbasi</label>
            <select
              className="input-field text-xs font-bold"
              value={editForm.source}
              onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
            >
              {['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Tavsif (Sababi / Nima uchun?) *</label>
            <input
              type="text"
              className="input-field text-xs font-bold"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="Harajat sababini yozing..."
            />
          </div>

          <div>
            <label className="form-label">Summa (so'm) *</label>
            <input
              type="number"
              className="input-field text-sm font-mono font-bold text-rose-400"
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setEditExpense(null)}>
              Bekor qilish
            </Btn>
            <Btn variant="gold" full icon={Icons.save} loading={editLoading} onClick={handleSaveEdit}>
              Saqlash ✓
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
