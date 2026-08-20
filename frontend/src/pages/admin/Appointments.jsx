import { useEffect, useState } from 'react'
import { Calendar as CalendarIcon, Clock, Plus, CheckCircle2, XCircle, UserCheck, Phone, Stethoscope } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney, ismTuzat } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [providers, setProviders] = useState([])
  const [services, setServices] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToastStore((s) => s.add)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '+998',
    appointment_date: new Date().toISOString().slice(0, 10),
    appointment_time: '10:00',
    provider_id: '',
    service_id: '',
    notes: '',
  })

  const loadData = () => {
    setLoading(true)
    api(`/appointments?appointment_date=${selectedDate}`)
      .then((res) => setAppointments(res || []))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [selectedDate])

  useEffect(() => {
    Promise.all([api('/providers'), api('/services')])
      .then(([p, s]) => {
        setProviders(p || [])
        setServices(s || [])
      })
      .catch((e) => toast(e.message, 'error'))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.provider_id || !form.service_id) {
      toast("Majburiy maydonlarni to'ldiring", 'error')
      return
    }

    try {
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          provider_id: +form.provider_id,
          service_id: +form.service_id,
        }),
      })
      toast('Qabulga oldindan yozildi ✓')
      setModalOpen(false)
      setForm({
        first_name: '',
        last_name: '',
        phone: '+998',
        appointment_date: new Date().toISOString().slice(0, 10),
        appointment_time: '10:00',
        provider_id: '',
        service_id: '',
        notes: '',
      })
      loadData()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleCheckIn = async (appntId) => {
    try {
      const res = await api(`/appointments/${appntId}/check-in`, { method: 'POST' })
      toast(`Bemor navbatga kiritildi! Taloni: ${res.ticket_number} ✓`)
      loadData()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleCancel = async (appntId) => {
    if (!confirm("Ushbu yozilishni bekor qilmoqchimisiz?")) return
    try {
      await api(`/appointments/${appntId}/cancel`, { method: 'POST' })
      toast("Yozilish bekor qilindi")
      loadData()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" /> Qabulga Yozilish Kalendari
          </h1>
          <p className="text-xs text-muted mt-1">Bemorlarni oldindan soatiga qarab navbatga yozish va kelganda navbatga kiritish (Check-in)</p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-gold py-2.5 px-4 text-xs font-bold flex items-center gap-2 shadow-lg"
        >
          <Plus className="h-4 w-4" /> + Qabulga Yozish
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted">Sana tanlang:</span>
          <input
            type="date"
            className="input-field max-w-[180px] text-xs font-bold"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2 text-xs">
          <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
            Kutilmoqda: {appointments.filter(a => a.status === 'kutilmoqda').length}
          </span>
          <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
            Kelgan: {appointments.filter(a => a.status === 'kelgan').length}
          </span>
        </div>
      </div>

      {/* Appointments List Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left text-gold">
              <th className="p-3">Vaqti</th>
              <th className="p-3">Mijoz Ism-Sharifi</th>
              <th className="p-3">Telefon</th>
              <th className="p-3">Shifokor</th>
              <th className="p-3">Xizmat va Narxi</th>
              <th className="p-3">Holat</th>
              <th className="p-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center text-muted text-xs">Yuklanmoqda...</td></tr>
            ) : appointments.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted text-xs italic">Ushbu sanada oldindan yozilishlar yo'q</td></tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="border-b border-border/40 hover:bg-surface-2/20 text-xs">
                  <td className="p-3 font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {a.appointment_time}
                  </td>
                  <td className="p-3 font-bold text-foreground">{a.first_name} {a.last_name}</td>
                  <td className="p-3 font-mono text-muted">{a.phone}</td>
                  <td className="p-3 text-muted">{a.provider_name || '—'}</td>
                  <td className="p-3 font-medium">
                    {a.service_name} — <span className="text-gold font-bold">{formatMoney(a.service_price)}</span>
                  </td>
                  <td className="p-3">
                    {a.status === 'kelgan' ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                        ✓ Kelgan (Navbatda)
                      </span>
                    ) : a.status === 'bekor' ? (
                      <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/30">
                        Bekor qilindi
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30">
                        Kutilmoqda
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {a.status === 'kutilmoqda' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCheckIn(a.id)}
                          className="btn-gold py-1 px-3 text-xs font-bold"
                        >
                          <UserCheck className="h-3.5 w-3.5 inline mr-1" /> Keldi (Navbatga)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(a.id)}
                          className="btn-ghost text-rose-400 py-1 px-2 text-xs"
                        >
                          Bekor
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE APPOINTMENT MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Qabulga Oldindan Yozish">
        <form onSubmit={handleCreate} className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field" placeholder="Ism *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: ismTuzat(e.target.value) })} required />
            <input className="input-field" placeholder="Familiya *" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: ismTuzat(e.target.value) })} required />
          </div>
          <input className="input-field" placeholder="Telefon raqami *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">Sana *</label>
              <input type="date" className="input-field" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} required />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">Vaqti (Soat) *</label>
              <input type="time" className="input-field font-mono" value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })} required />
            </div>
          </div>

          <select className="input-field" value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })} required>
            <option value="">Mas'ul Shifokor *</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name} ({p.cabinet || 'Xona'})</option>
            ))}
          </select>

          <select className="input-field" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} required>
            <option value="">Xizmat turi *</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.category ? `[${s.category}] ` : ''}{s.name} — {formatMoney(s.price)}</option>
            ))}
          </select>

          <input className="input-field" placeholder="Qo'shimcha izoh (ixtiyoriy)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <button type="submit" className="btn-gold w-full py-3 font-extrabold text-sm">
            Qabulga Saqlash ✓
          </button>
        </form>
      </Modal>
    </div>
  )
}
