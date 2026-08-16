import { useEffect, useMemo, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/Modal'
import InpatientReceiptModal from '../../components/InpatientReceiptModal'
import VisualRoomMap from '../../components/VisualRoomMap'

export default function CeoInpatients() {
  const [active, setActive] = useState([])
  const [history, setHistory] = useState([])
  const [providers, setProviders] = useState([])
  const [referrers, setReferrers] = useState([])
  const [patients, setPatients] = useState([])
  const [patientSearch, setPatientSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [dischargeModal, setDischargeModal] = useState(null)
  const [dailyPayModal, setDailyPayModal] = useState(null)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [form, setForm] = useState({ patient_id: '', room_number: '', bed_number: '', doctor_id: '', referrer_id: '', diagnosis: '', daily_rate: '', planned_days: '' })
  const [discharge, setDischarge] = useState({ discharged_at: new Date().toISOString().slice(0, 10), payment_type: 'cash', days_count: 1, amount: '' })
  const [dailyPayment, setDailyPayment] = useState({ payment_date: new Date().toISOString().slice(0, 10), payment_type: 'cash', days_count: 1, amount: '' })
  const toast = useToastStore((s) => s.add)
  const role = useAuthStore((s) => s.role)
  const isCeo = role === 'ceo'

  const load = () => {
    api('/inpatients?status=yotmoqda').then(setActive)
    api('/inpatients/history').then(setHistory).catch(() => {})
  }

  useEffect(() => {
    load()
    api('/providers').then(setProviders)
    api('/referrers').then(setReferrers)
    api('/patients?include_cancelled=false').then(setPatients).catch(() => {})
  }, [])

  const admit = async () => {
    try {
      await api('/inpatients', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: +form.patient_id,
          room_number: form.room_number,
          bed_number: form.bed_number,
          doctor_id: +form.doctor_id,
          referrer_id: form.referrer_id ? +form.referrer_id : null,
          daily_rate: +form.daily_rate,
          diagnosis: form.diagnosis || null,
          planned_days: form.planned_days ? +form.planned_days : null,
        }),
      })
      toast('Bemor qabul qilindi')
      setForm({ patient_id: '', room_number: '', bed_number: '', doctor_id: '', referrer_id: '', diagnosis: '', daily_rate: '', planned_days: '' })
      setModal(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const doDischarge = async () => {
    try {
      const res = await api(`/inpatients/${dischargeModal.id}/discharge`, {
        method: 'POST',
        body: JSON.stringify({
          ...discharge,
          days_count: +discharge.days_count || undefined,
          amount: discharge.amount ? +discharge.amount : undefined,
        }),
      })
      toast(`Chiqarildi (Выписка): ${formatMoney(res.amount)}`)
      setSelectedReceipt({
        ...dischargeModal,
        discharged_at: discharge.discharged_at,
        days_count: discharge.days_count || dischargeModal.days || 1,
        daily_price: dischargeModal.daily_rate,
        total_paid: res.amount || dischargeModal.total_amount,
        status: 'chiqdi',
      })
      setDischargeModal(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const cancelInp = async (id) => {
    const reason = prompt('Bekor qilish sababi:')
    if (!reason || reason.length < 3) return
    await api(`/inpatients/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })
    toast('Bekor qilindi')
    load()
  }

  const submitDailyPayment = async () => {
    try {
      const res = await api(`/inpatients/${dailyPayModal.id}/daily-payment`, {
        method: 'POST',
        body: JSON.stringify({
          ...dailyPayment,
          days_count: +dailyPayment.days_count || 1,
          amount: dailyPayment.amount ? +dailyPayment.amount : undefined,
        }),
      })
      toast(`Kunlik to'lov: ${formatMoney(res.amount)}`)
      setDailyPayModal(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase()
    if (!q) return patients.slice(0, 100)
    return patients
      .filter((p) => `${p.first_name} ${p.last_name} ${p.phone}`.toLowerCase().includes(q))
      .slice(0, 100)
  }, [patients, patientSearch])

  const selectedPatient = patients.find((p) => p.id === +form.patient_id)

  return (
    <div>
      {/* THERMAL DISCHARGE RECEIPT MODAL */}
      {selectedReceipt && (
        <InpatientReceiptModal
          inpatient={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-title">Statsionar Yotgan Bemorlar</h1>
          <p className="text-xs text-muted mt-1">Klinika palatalarida yotib davolanayotgan bemorlarni boshqarish va выписка chekini chop etish</p>
        </div>
        {isCeo && <button type="button" className="btn-gold" onClick={() => setModal(true)}>+ Qabul qilish</button>}
      </div>

      {/* VISUAL ROOM & BED MAP */}
      <div className="mb-8">
        <VisualRoomMap
          activeInpatients={active}
          onAdmitRoom={(room, bed) => {
            setForm((f) => ({ ...f, room_number: room, bed_number: bed }))
            setModal(true)
          }}
          onDischarge={(inp) => {
            setDischarge({
              discharged_at: new Date().toISOString().slice(0, 10),
              payment_type: 'cash',
              days_count: inp.planned_days || inp.days || 1,
              amount: '',
            })
            setDischargeModal(inp)
          }}
          onPrintReceipt={(inp) => {
            setSelectedReceipt({
              ...inp,
              daily_price: inp.daily_rate || (inp.total_amount / (inp.days || 1)),
              total_paid: inp.total_amount,
              status: 'yotmoqda',
            })
          }}
        />
      </div>

      <div className="card mb-6 overflow-x-auto">
        <h2 className="mb-3 font-semibold text-gold">Aktiv yotganlar ({active.length})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left text-gold">
              <th className="p-3">Ism-Sharifi</th>
              <th className="p-3">Palata / Koyka</th>
              <th className="p-3">Doktor</th>
              <th className="p-3">Kunlar</th>
              <th className="p-3">Jami Summa</th>
              <th className="p-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {active.map((i) => (
              <tr key={i.id} className="border-b border-white/5 hover:bg-surface-hover">
                <td className="p-3 font-bold">{i.first_name} {i.last_name}</td>
                <td className="p-3 font-mono font-bold text-cyan-400">{i.room_number}/{i.bed_number}</td>
                <td className="p-3 text-muted">{i.doctor_name}</td>
                <td className="p-3 font-bold">{i.days}{i.planned_days ? ` / reja: ${i.planned_days}` : ''} kun</td>
                <td className="p-3 text-gold font-mono font-bold">{formatMoney(i.total_amount)}</td>
                <td className="p-3 text-right space-x-2">
                  <button type="button" className="btn-outline text-xs py-1 px-2.5" onClick={() => {
                    setDailyPayment({ payment_date: new Date().toISOString().slice(0, 10), payment_type: 'cash', days_count: 1, amount: '' })
                    setDailyPayModal(i)
                  }}>Kunlik to'lov</button>
                  <button type="button" className="btn-gold text-xs py-1 px-2.5" onClick={() => {
                    setDischarge({
                      discharged_at: new Date().toISOString().slice(0, 10),
                      payment_type: 'cash',
                      days_count: i.planned_days || i.days || 1,
                      amount: '',
                    })
                    setDischargeModal(i)
                  }}>Chiqarish (Выписка)</button>
                  <button type="button" className="btn-ghost text-xs text-rose-400 py-1 px-2.5" onClick={() => cancelInp(i.id)}>Bekor</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 font-semibold text-muted">Chiqarilganlar Tarixi ({history.length})</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                <th className="p-3">Ism-Sharifi</th>
                <th className="p-3">Palata</th>
                <th className="p-3">Jami Summa</th>
                <th className="p-3 text-right">Chek</th>
              </tr>
            </thead>
            <tbody>
              {history.map((i) => (
                <tr key={i.id} className="border-b border-white/5 hover:bg-surface-hover">
                  <td className="p-3 font-medium">{i.first_name} {i.last_name}</td>
                  <td className="p-3 font-mono text-muted">{i.room_number}</td>
                  <td className="p-3 font-mono font-bold text-gold">{formatMoney(i.total_amount)}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt({
                        ...i,
                        daily_price: i.daily_rate || (i.total_amount / (i.days || 1)),
                        total_paid: i.total_amount,
                        status: 'chiqdi',
                      })}
                      className="btn-outline text-xs py-1 px-2.5"
                    >
                      🧾 Chek
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Yotgan bemorni qabul qilish">
        <div className="space-y-3 pt-2">
          <input className="input-field" placeholder="Bazada bemor qidirish (ism/tel)" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
          <select className="input-field" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
            <option value="">Bazada bemorni tanlang *</option>
            {filteredPatients.map((p) => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.phone}</option>
            ))}
          </select>
          {selectedPatient && (
            <p className="text-cyan-400 text-xs font-bold">
              Tanlangan bemor: {selectedPatient.first_name} {selectedPatient.last_name} ({selectedPatient.phone})
            </p>
          )}
          <input className="input-field" placeholder="Palata xona raqami *" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
          <input className="input-field" placeholder="Koyka / Karavot raqami *" value={form.bed_number} onChange={(e) => setForm({ ...form, bed_number: e.target.value })} />
          <select className="input-field" value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
            <option value="">Mas'ul shifokor *</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <input className="input-field" type="number" placeholder="Kunlik yotish narxi *" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} />
          <input className="input-field" type="number" min={1} placeholder="Aniq muddat (kun) — ixtiyoriy" value={form.planned_days} onChange={(e) => setForm({ ...form, planned_days: e.target.value })} />
          <input className="input-field" placeholder="Tashxis / izoh (ixtiyoriy)" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          <button type="button" className="btn-gold w-full py-3" onClick={admit}>Saqlash</button>
        </div>
      </Modal>

      <Modal open={!!dischargeModal} onClose={() => setDischargeModal(null)} title="Bemorni chiqarish va Выписка Chekini yaratish">
        {dischargeModal && (
          <div className="space-y-3 pt-2">
            <p className="font-bold text-foreground">{dischargeModal.first_name} {dischargeModal.last_name} — {dischargeModal.days} kun × {formatMoney(dischargeModal.daily_rate)}</p>
            <p className="text-xl font-bold text-gold">Jami Summa: {formatMoney(dischargeModal.total_amount)}</p>
            <input type="date" className="input-field" value={discharge.discharged_at} onChange={(e) => setDischarge({ ...discharge, discharged_at: e.target.value })} />
            <input type="number" min={1} className="input-field" value={discharge.days_count} onChange={(e) => setDischarge({ ...discharge, days_count: e.target.value })} placeholder="Necha kun uchun to'lov" />
            <input type="number" min={1} className="input-field" value={discharge.amount} onChange={(e) => setDischarge({ ...discharge, amount: e.target.value })} placeholder="Miqdor (ixtiyoriy, qo'lda)" />
            <div className="flex gap-2">
              {['cash', 'card'].map((t) => (
                <button key={t} type="button" className={discharge.payment_type === t ? 'btn-gold flex-1' : 'btn-outline flex-1'} onClick={() => setDischarge({ ...discharge, payment_type: t })}>
                  {t === 'cash' ? 'Naqt' : 'Karta'}
                </button>
              ))}
            </div>
            <button type="button" className="btn-gold w-full py-3" onClick={doDischarge}>Chiqarish va Chekni Ochish 🖨️</button>
          </div>
        )}
      </Modal>

      <Modal open={!!dailyPayModal} onClose={() => setDailyPayModal(null)} title="Yotganlar — kunlik to'lov">
        {dailyPayModal && (
          <div className="space-y-3 pt-2">
            <p className="font-bold text-foreground">{dailyPayModal.first_name} {dailyPayModal.last_name}</p>
            <p className="text-sm">Kunlik narx: <b className="text-gold">{formatMoney(dailyPayModal.daily_rate)}</b></p>
            <input type="date" className="input-field" value={dailyPayment.payment_date} onChange={(e) => setDailyPayment({ ...dailyPayment, payment_date: e.target.value })} />
            <input type="number" min={1} className="input-field" value={dailyPayment.days_count} onChange={(e) => setDailyPayment({ ...dailyPayment, days_count: e.target.value })} placeholder="Kun soni" />
            <input type="number" min={1} className="input-field" value={dailyPayment.amount} onChange={(e) => setDailyPayment({ ...dailyPayment, amount: e.target.value })} placeholder="Miqdor (ixtiyoriy, qo'lda)" />
            <div className="flex gap-2">
              {['cash', 'card'].map((t) => (
                <button key={t} type="button" className={dailyPayment.payment_type === t ? 'btn-gold flex-1' : 'btn-outline flex-1'} onClick={() => setDailyPayment({ ...dailyPayment, payment_type: t })}>
                  {t === 'cash' ? 'Naqt' : 'Karta'}
                </button>
              ))}
            </div>
            <button type="button" className="btn-gold w-full py-3" onClick={submitDailyPayment}>To'lovni kiritish</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
