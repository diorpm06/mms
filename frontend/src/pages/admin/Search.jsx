import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import PageHeader from '../../components/PageHeader'
import PatientMedicalCardModal from '../../components/PatientMedicalCardModal'
import ReRegisterPatientModal from '../../components/ReRegisterPatientModal'
import PaymentTicketModal from '../../components/PaymentTicketModal'
import { Btn, Icons } from '../../components/UIKit'
import { User, Phone, MapPin, Calendar, ShieldCheck, Stethoscope, Clock, Plus, Printer, FileText } from 'lucide-react'

export default function Search({ homePath = '/admin' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [ehrPatient, setEhrPatient] = useState(null)
  const [showReRegister, setShowReRegister] = useState(false)
  const [newTicketPatient, setNewTicketPatient] = useState(null)
  const [reissuing, setReissuing] = useState(false)
  const navigate = useNavigate()
  const toast = useToastStore((s) => s.add)

  const fetchPatients = useCallback(async (term = '') => {
    const data = await api(`/patients?search=${encodeURIComponent(term)}&include_cancelled=true`)
    setResults(data || [])
    return data
  }, [])

  useEffect(() => {
    fetchPatients()
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [fetchPatients, toast])

  const search = async () => {
    setLoading(true)
    try {
      await fetchPatients(q)
      setSelected(null)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Grouping into Unique Persons (1 Card Per Person)
  const uniquePatientsMap = {}
  ;(results || []).forEach((p) => {
    const key = (p.phone && p.phone !== '+998' ? p.phone : `${p.first_name}_${p.last_name}`).trim().toLowerCase()
    if (!uniquePatientsMap[key]) {
      uniquePatientsMap[key] = {
        key,
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone,
        address: p.address,
        birth_date: p.birth_date,
        referrer_name: p.referrer_name,
        provider_name: p.provider_name,
        creator_name: p.creator_name,
        created_at: p.created_at,
        visit_count: 0,
        total_spent: 0,
        latestPatient: p,
      }
    }
    uniquePatientsMap[key].visit_count += 1
    uniquePatientsMap[key].total_spent += (p.payment_amount || 0)
  })

  const uniquePatientsList = Object.values(uniquePatientsMap)

  const selectPatient = async (u) => {
    setSelected(u)
    try {
      const v = await api(`/patients/${u.latestPatient.id}/visits`)
      setVisits(v || [])
    } catch (_) {
      setVisits([])
    }
  }

  const handleReissueTicket = async () => {
    if (!selected) return
    setReissuing(true)
    try {
      const res = await api(`/patients/${selected.latestPatient.id}/reissue-ticket`, { method: 'POST' })
      toast(`✓ Qayta navbat berildi: ${res.ticket_number}`)
      setNewTicketPatient(res)
      fetchPatients(q)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setReissuing(false)
    }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {ehrPatient && (
        <PatientMedicalCardModal patient={ehrPatient} onClose={() => setEhrPatient(null)} />
      )}
      {showReRegister && selected && (
        <ReRegisterPatientModal
          open={showReRegister}
          patient={selected.latestPatient}
          onClose={() => setShowReRegister(false)}
          onSuccess={(res) => {
            setShowReRegister(false)
            if (res) setNewTicketPatient(res)
            fetchPatients(q)
          }}
        />
      )}
      {newTicketPatient && (
        <PaymentTicketModal open={!!newTicketPatient} patient={newTicketPatient} onClose={() => setNewTicketPatient(null)} />
      )}

      <PageHeader
        title="Bemorlar Qidiruvi va Profil Boshqaruvi"
        subtitle="Mijozlar bazasidan qidirish, profil ma'lumotlari, tashriflar tarixi va tibbiy karta"
        backTo={homePath}
      />

      {/* SEARCH INPUT BAR */}
      <div className="card p-4 flex gap-3 items-center border-gold/30">
        <div className="relative flex-1">
          <input
            className="input-field text-xs py-2.5 font-bold text-body"
            placeholder="🔎 Ism, familiya yoki telefon raqami bo'yicha qidiring..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
        </div>
        <Btn variant="gold" icon={Icons.search} loading={loading} onClick={search} className="py-2.5 px-6">
          Qidirish
        </Btn>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        
        {/* LEFT COLUMN: UNIQUE PATIENTS SEARCH LIST (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-gold uppercase tracking-wider">
              {q.trim() ? 'Qidiruv natijalari' : 'Unikal Mijozlar Bazasi'}
            </h2>
            <span className="badge badge-gold font-mono text-[11px]">
              {uniquePatientsList.length} kishi
            </span>
          </div>

          {loading && uniquePatientsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted card-2 italic">Mijozlar yuklanmoqda...</div>
          ) : uniquePatientsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted card-2">Mijozlar topilmadi</div>
          ) : (
            <div className="max-h-[38rem] space-y-2.5 overflow-y-auto pr-1">
              {uniquePatientsList.map((u) => {
                const isSelected = selected?.key === u.key
                return (
                  <div
                    key={u.key}
                    onClick={() => selectPatient(u)}
                    className={`card p-4 cursor-pointer transition-all duration-150 relative overflow-hidden border ${
                      isSelected
                        ? 'border-gold bg-gold-dim shadow-lg ring-1 ring-gold'
                        : 'border-border bg-surface hover:border-gold-glow hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-extrabold text-sm text-body">{u.first_name} {u.last_name}</h3>
                      <span className="badge badge-info text-[10px] font-mono">{u.visit_count} marta</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted font-mono font-bold">{u.phone || '—'}</span>
                      <span className="text-emerald font-mono font-bold text-xs">{formatMoney(u.total_spent)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: EXPANDED PATIENT SIDE PROFILE DRAWER (3 Cols) */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card p-12 text-center text-xs text-muted space-y-3 border-dashed border-border">
              <div className="text-4xl">👤</div>
              <p className="font-bold text-body text-sm">Bemor Profilini Ko'rish uchun Chap Tomondan Tanlang</p>
              <p className="text-[11px] text-muted">
                Tanlangan bemorning to'liq ma'lumotlari, tashriflar tarixi va tibbiy kartasi shu yerda namoyon bo'ladi.
              </p>
            </div>
          ) : (
            <div className="card p-6 space-y-5 border-gold/40 animate-in fade-in">
              
              {/* Profile Top Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border card-2 p-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gold-dim border-2 border-border-strong text-gold font-mono font-black text-2xl flex items-center justify-center shadow-md">
                    👤
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gold uppercase tracking-wide">
                      {selected.first_name} {selected.last_name}
                    </h2>
                    <p className="text-xs text-cyan font-bold font-mono mt-0.5 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {selected.phone || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEhrPatient(selected.latestPatient)}
                    className="btn-gold py-2 px-3.5 text-xs font-black flex items-center gap-1.5"
                  >
                    <FileText className="h-4 w-4" /> Tibbiy Karta (EHR)
                  </button>
                </div>
              </div>

              {/* Patient Profile Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs card-2 p-3.5">
                <div>
                  <span className="text-muted text-[10px] uppercase font-bold block">🏠 Manzil:</span>
                  <strong className="font-bold text-body">{selected.address || "Belgilanmagan"}</strong>
                </div>
                <div>
                  <span className="text-muted text-[10px] uppercase font-bold block">🗓️ Tug'ilgan Yili:</span>
                  <strong className="font-mono font-bold text-body">{selected.birth_date ? String(selected.birth_date).slice(0, 10) : '—'}</strong>
                </div>
                <div>
                  <span className="text-muted text-[10px] uppercase font-bold block">🤝 Yo'naltiruvchi:</span>
                  <strong className="font-bold text-amber">{selected.referrer_name || "To'g'ridan-to'g'ri"}</strong>
                </div>
                <div>
                  <span className="text-muted text-[10px] uppercase font-bold block">🏥 Jami Tashriflar:</span>
                  <strong className="font-mono font-black text-cyan text-sm">{selected.visit_count} marta</strong>
                </div>
                <div>
                  <span className="text-muted text-[10px] uppercase font-bold block">💰 Jami To'lov (LTV):</span>
                  <strong className="font-mono font-black text-emerald text-sm">{formatMoney(selected.total_spent)}</strong>
                </div>
                <div>
                  <span className="text-muted text-[10px] uppercase font-bold block">⚡ So'nggi Qabul:</span>
                  <strong className="font-mono font-bold text-gold">{formatDate(selected.created_at)}</strong>
                </div>
              </div>

              {/* Visits History List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-xs font-black text-gold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> Barcha Tashriflar va Xizmatlar Tarixi ({visits.length})
                  </h3>
                </div>

                {visits.length === 0 ? (
                  <p className="text-xs text-muted italic text-center py-6">Tashrif tarixi topilmadi</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {visits.map((v) => (
                      <div key={v.id} className="card-2 p-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-cyan flex items-center gap-2">
                            <span>{v.service_name}</span>
                            <span className="badge badge-gold text-[10px] font-mono">{formatMoney(v.payment_amount)}</span>
                          </div>
                          <span className="text-[11px] text-muted block mt-0.5">
                            Shifokor: {v.provider_name || '—'} • To'lov: <span className="uppercase text-gold font-bold">{v.payment_type || 'Naqd'}</span>
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-muted">{formatDate(v.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-border flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowReRegister(true)}
                  className="btn-gold py-2.5 px-4 text-xs font-black flex items-center gap-1.5 flex-1 justify-center"
                >
                  <Plus className="h-4 w-4" /> ➕ Qayta Xizmatga Yozish
                </button>

                <button
                  type="button"
                  onClick={handleReissueTicket}
                  disabled={reissuing}
                  className="btn-cyan py-2.5 px-4 text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" /> Qayta Navbat Talon
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  )
}
