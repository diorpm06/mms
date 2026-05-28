import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'

export default function CeoServices() {
  const [items, setItems] = useState(null)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name: '', price: '' })
  const toast = useToastStore((s) => s.add)

  const load = () => api('/services/all').then(setItems)
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEdit(null)
    setForm({ name: '', price: '' })
    setModal(true)
  }

  const openEdit = (s) => {
    setEdit(s)
    setForm({ name: s.name, price: String(s.price) })
    setModal(true)
  }

  const save = async () => {
    try {
      const body = { name: form.name, price: parseInt(form.price, 10) }
      if (edit) await api(`/services/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/services', { method: 'POST', body: JSON.stringify(body) })
      toast('Saqlandi')
      setModal(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const remove = async (id) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return
    await api(`/services/${id}`, { method: 'DELETE' })
    toast("O'chirildi")
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gold">Xizmatlar</h1>
        <button type="button" className="btn-gold" onClick={openCreate}>+ Qo'shish</button>
      </div>
      {!items ? (
        <TableSkeleton />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-gold">
                <th className="p-2">Nomi</th>
                <th className="p-2">Narxi</th>
                <th className="p-2">Holati</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-white/5">
                  <td className="p-2">{s.name}</td>
                  <td className="p-2">{formatMoney(s.price)}</td>
                  <td className="p-2">{s.is_active ? 'Faol' : "Nofaol"}</td>
                  <td className="p-2 space-x-2">
                    <button type="button" className="text-gold" onClick={() => openEdit(s)}>Tahrirlash</button>
                    {s.is_active && (
                      <button type="button" className="text-red-400" onClick={() => remove(s.id)}>O'chirish</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Tahrirlash' : "Yangi xizmat"}>
        <div className="space-y-3">
          <input className="input-field" placeholder="Nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input-field" type="number" placeholder="Narxi" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <button type="button" className="btn-gold w-full" onClick={save}>Saqlash</button>
        </div>
      </Modal>
    </div>
  )
}
