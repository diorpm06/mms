import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'

export default function Duty() {
  const [items, setItems] = useState([])
  const [employees, setEmployees] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ employee_id: '', duty_date: new Date().toISOString().slice(0, 10), shift: 'kunduz', note: '' })
  const toast = useToastStore((s) => s.add)

  const load = () => api('/duty').then(setItems)
  useEffect(() => {
    load()
    api('/employees').then(setEmployees)
  }, [])

  const save = async () => {
    try {
      await api('/duty', { method: 'POST', body: JSON.stringify({ ...form, employee_id: +form.employee_id }) })
      toast('Dejur tayinlandi')
      setModal(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div>
      <div className="mb-6 flex justify-between">
        <h1 className="text-2xl font-bold text-gold">Dejur jadvali</h1>
        <button type="button" className="btn-gold" onClick={() => setModal(true)}>+ Dejur tayinlash</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left text-gold">
              <th className="p-2">Sana</th><th className="p-2">Xodim</th><th className="p-2">Smena</th><th className="p-2">Izoh</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} className="border-b border-white/5">
                <td className="p-2">{d.duty_date}</td>
                <td className="p-2">{d.employee_name}</td>
                <td className="p-2 capitalize">{d.shift}</td>
                <td className="p-2">{d.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Dejur tayinlash">
        <div className="space-y-3">
          <select className="input-field" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
            <option value="">Xodim</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <input type="date" className="input-field" value={form.duty_date} onChange={(e) => setForm({ ...form, duty_date: e.target.value })} />
          <select className="input-field" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
            <option value="kunduz">Kunduz</option>
            <option value="tun">Tun</option>
          </select>
          <input className="input-field" placeholder="Izoh" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button type="button" className="btn-gold w-full" onClick={save}>Saqlash</button>
        </div>
      </Modal>
    </div>
  )
}
