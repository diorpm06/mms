import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney, formatDate } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, PageHeader, THead, EmptyState } from '../../components/UIKit'

const CATEGORIES = ['Kommunal', "Ta'mirlash", 'Jihozlar', "Dori-darmon", 'Transport', 'Reklama', 'Boshqa']
const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']

const CAT_COLORS = {
  'Kommunal': '#3b82f6', "Ta'mirlash": '#ef4444', 'Jihozlar': '#d4af37',
  "Dori-darmon": '#10b981', 'Transport': '#a855f7', 'Reklama': '#f97316', 'Boshqa': '#64748b',
}

export default function CeoExpenses() {
  const [items,        setItems]        = useState(null)
  const [month,        setMonth]        = useState(new Date().getMonth() + 1)
  const [year,         setYear]         = useState(new Date().getFullYear())
  const [total,        setTotal]        = useState(0)
  const [cancelId,     setCancelId]     = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [description,  setDescription]  = useState('')
  const [amount,       setAmount]       = useState('')
  const [category,     setCategory]     = useState('')
  const [source,       setSource]       = useState('Naqt kassa')
  const [addLoading,   setAddLoading]   = useState(false)
  const toast = useToastStore((s) => s.add)

  const load = () => {
    api(`/expenses?month=${month}&year=${year}`).then(setItems)
    api(`/expenses/summary?month=${month}&year=${year}`).then((r) => setTotal(r.total))
  }
  useEffect(() => { load() }, [month, year])

  const handleAddExpense = async () => {
    if (!description || !amount) { toast('Tavsif va summa kiriting', 'error'); return }
    setAddLoading(true)
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ description, amount: parseInt(amount, 10), category: category || null, source }),
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
    if (cancelReason.length < 3) { toast('Sabab kamida 3 harf', 'error'); return }
    try {
      await api(`/expenses/${cancelId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: cancelReason }) })
      toast('Harajat bekor qilindi')
      setCancelId(null)
      setCancelReason('')
      load()
    } catch (e) { toast(e.message, 'error') }
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
            <THead cols={['Sana', 'Kategoriya', 'Manba', 'Tavsif', 'Summa', '']} />
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className={`hover:bg-white/[0.02] transition-colors ${e.is_cancelled ? 'opacity-40' : ''}`}>
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
                  <td className="td-cell">{e.description}</td>
                  <td className="td-cell font-bold" style={{ color: 'var(--danger)' }}>
                    {formatMoney(e.amount)}
                  </td>
                  <td className="td-cell">
                    {!e.is_cancelled && (
                      <Btn
                        variant="danger"
                        size="xs"
                        icon={Icons.cancel}
                        onClick={() => { setCancelId(e.id); setCancelReason('') }}
                        title="Bekor qilish"
                      >
                        Bekor
                      </Btn>
                    )}
                    {e.is_cancelled && (
                      <span className="text-xs" style={{ color: 'var(--danger)' }}>✗ Bekor</span>
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
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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

          <div>
            <label className="form-label">Tavsif (nima uchun?) *</label>
            <input className="input-field" placeholder="Masalan: Elektr to'lovi, Shprits xaridi..."
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Summa (so'm) *</label>
            <input className="input-field" type="number" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full onClick={() => setAddModalOpen(false)}>Orqaga</Btn>
            <Btn variant="gold" full icon={Icons.save} loading={addLoading} onClick={handleAddExpense}>
              {addLoading ? 'Saqlanmoqda...' : 'Harajatni Saqlash'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
