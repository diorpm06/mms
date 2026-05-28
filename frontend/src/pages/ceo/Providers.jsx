import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'

const SOURCES = ['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa']

export default function CeoProviders() {
  const [items, setItems] = useState(null)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ full_name: '', specialization: '', phone: '+998', percentage: '' })
  const [payoutSource, setPayoutSource] = useState('Naqt kassa')
  const toast = useToastStore((s) => s.add)

  const load = () => api('/providers?active_only=false').then(setItems)
  useEffect(() => { load() }, [])

  const save = async () => {
    try {
      const body = { ...form, percentage: parseInt(form.percentage, 10) }
      if (edit) await api(`/providers/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/providers', { method: 'POST', body: JSON.stringify(body) })
      toast('Saqlandi')
      setModal(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const payout = async (id) => {
    try {
      const res = await api(`/providers/${id}/payout`, {
        method: 'POST',
        body: JSON.stringify({ source: payoutSource }),
      })
      toast(`Balans chiqarildi (${res.source || payoutSource}): ${formatMoney(res.amount)}`)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div>
      <div className="mb-6 flex justify-between">
        <h1 className="text-2xl font-bold text-gold">Xizmat ko'rsatuvchilar</h1>
        <div className="flex gap-2">
          <select className="input-field max-w-[180px]" value={payoutSource} onChange={(e) => setPayoutSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="btn-gold" onClick={() => { setEdit(null); setModal(true) }}>+ Qo'shish</button>
        </div>
      </div>
      {!items ? <TableSkeleton /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-gold">
                <th className="p-2">Ism</th><th className="p-2">Mutaxassislik</th><th className="p-2">Foiz</th>
                <th className="p-2">Balans</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="p-2">{p.full_name}</td>
                  <td className="p-2">{p.specialization}</td>
                  <td className="p-2">{p.percentage}%</td>
                  <td className="p-2 text-gold">{formatMoney(p.balance)}</td>
                  <td className="p-2 space-x-2">
                    {p.balance > 0 && (
                      <button type="button" className="text-gold" onClick={() => payout(p.id)}>Chiqarish</button>
                    )}
                    <button type="button" onClick={() => { setEdit(p); setForm(p); setModal(true) }}>Tahrirlash</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Provider">
        <div className="space-y-3">
          <input className="input-field" placeholder="Ism" value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input className="input-field" placeholder="Mutaxassislik" value={form.specialization || ''} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
          <input className="input-field" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input-field" type="number" placeholder="Foiz" value={form.percentage || ''} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
          <button type="button" className="btn-gold w-full" onClick={save}>Saqlash</button>
        </div>
      </Modal>
    </div>
  )
}
