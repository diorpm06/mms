import { useEffect, useState } from 'react'
import {
  Search, User, Phone, Calendar, DollarSign, Activity, FileText,
  PlusCircle, History, Edit, Trash2, CheckCircle, ShieldAlert,
  UserCheck, HeartPulse, Filter, Grid, List, Sparkles, MapPin
} from 'lucide-react'
import { api } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'
import PatientMedicalCardModal from '../../components/PatientMedicalCardModal'
import ReRegisterPatientModal from '../../components/ReRegisterPatientModal'
import PaymentTicketModal from '../../components/PaymentTicketModal'
import { Btn, Icons, PageHeader, THead, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'

export default function CeoPatients() {
  const [activeViewTab, setActiveViewTab] = useState('unique') // 'unique' | 'all_transactions'
  const [layoutMode, setLayoutMode] = useState('table') // 'table' | 'cards'
  const [patients, setPatients] = useState(null)
  const [edit, setEdit] = useState(null)
  const [editReason, setEditReason] = useState('')
  const [cancelId, setCancelId] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [visitId, setVisitId] = useState(null)
  const [visits, setVisits] = useState([])
  const [ehrPatient, setEhrPatient] = useState(null)
  const [reRegisterPatient, setReRegisterPatient] = useState(null)
  const [newTicketPatient, setNewTicketPatient] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const toast = useToastStore((s) => s.add)

  const load = () => api('/patients?include_cancelled=true').then(setPatients)
  useEffect(() => { load() }, [])

  const handleDeletePatient = async (p) => {
    if (!p) return
    if (!window.confirm(`Haqiqatan ham "${p.first_name} ${p.last_name}" bemorini va uning barcha to'lovlarini tizimdan to'liq o'chirmoqchimisiz?`)) {
      return
    }
    try {
      await api(`/patients/${p.id}`, { method: 'DELETE' })
      toast(`✓ "${p.first_name} ${p.last_name}" bemori muvaffaqiyatli o'chirildi`)
      load()
    } catch (e) {
      toast(e.message || "O'chirishda xatolik", 'error')
    }
  }

  const saveEdit = async () => {
    if (editReason.length < 3) { toast('Sabab kamida 3 harf', 'error'); return }
    try {
      await api(`/patients/${edit.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...edit, reason: editReason }),
      })
      toast('✓ Bemor ma\'lumoti tahrirlandi')
      setEdit(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const doCancel = async () => {
    if (cancelReason.length < 3) { toast('Sabab kamida 3 harf', 'error'); return }
    try {
      await api(`/patients/${cancelId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      })
      toast('✓ To\'lov bekor qilindi')
      setCancelId(null)
      setCancelReason('')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const openVisits = async (p) => {
    setVisitId(p.id)
    const data = await api(`/patients/${p.id}/visits`)
    setVisits(data || [])
  }

  const filteredPatients = (patients || []).filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (p.first_name || '').toLowerCase().includes(q) ||
      (p.last_name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.service_name || '').toLowerCase().includes(q)
    )
  })

  // Grouping into Unique Patients (1 Row per Person)
  const uniquePatientsMap = {}
  ;(filteredPatients || []).forEach((p) => {
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
        created_at: p.created_at,
        visit_count: 0,
        total_spent: 0,
        services: [],
        latestPatient: p,
      }
    }
    uniquePatientsMap[key].visit_count += 1
    uniquePatientsMap[key].total_spent += (p.payment_amount || 0)
    // Bemor bir tashrifda bir nechta xizmat olgan bo'lishi mumkin —
    // hammasini olamiz (service_name faqat asosiysini beradi).
    const names = (p.services || []).length
      ? p.services.map((s) => s.service_name).filter(Boolean)
      : (p.service_name ? [p.service_name] : [])
    names.forEach((n) => {
      if (!uniquePatientsMap[key].services.includes(n)) {
        uniquePatientsMap[key].services.push(n)
      }
    })
  })
  const uniquePatientsList = Object.values(uniquePatientsMap)

  // Overall Metrics Calculation
  const totalUniqueCount = uniquePatientsList.length
  const totalRevenue = uniquePatientsList.reduce((acc, u) => acc + u.total_spent, 0)
  const totalVisitsCount = uniquePatientsList.reduce((acc, u) => acc + u.visit_count, 0)
  const averageSpent = totalUniqueCount > 0 ? totalRevenue / totalUniqueCount : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* EHR Modal */}
      {ehrPatient && (
        <PatientMedicalCardModal patient={ehrPatient} onClose={() => setEhrPatient(null)} />
      )}

      {/* Re-Register Modal */}
      {reRegisterPatient && (
        <ReRegisterPatientModal
          open={!!reRegisterPatient}
          patient={reRegisterPatient}
          onClose={() => setReRegisterPatient(null)}
          onSuccess={(res) => {
            load()
            setNewTicketPatient(res)
          }}
        />
      )}

      {/* Payment Ticket Modal */}
      {newTicketPatient && (
        <PaymentTicketModal
          open={!!newTicketPatient}
          patient={newTicketPatient}
          onClose={() => setNewTicketPatient(null)}
        />
      )}

      {/* Page Header */}
      <PageHeader
        title="👤 Barcha Bemorlar va Qidiruv (PRO)"
        subtitle="Klinikaga murojaat qilgan barcha bemorlar statistikasi, elektron tibbiy kartasi va qabullar tarixi"
        icon={Icons.user}
      />

      {/* ── PRO TOP KPI METRICS CARDS ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border-cyan-500/30 bg-cyan-500/5 flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-extrabold text-cyan uppercase tracking-wider">Unikal Bemorlar</span>
            <p className="text-2xl font-black text-body font-mono mt-1">{totalUniqueCount} <span className="text-xs font-normal text-muted">nafar</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-4 border-emerald/30 bg-emerald/5 flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-extrabold text-emerald uppercase tracking-wider">Jami Kelgan Tushum</span>
            <p className="text-2xl font-black text-emerald font-mono mt-1">{formatMoney(totalRevenue)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald/20 flex items-center justify-center text-emerald">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-4 border-gold/30 bg-gold/5 flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-extrabold text-gold uppercase tracking-wider">Jami Tashriflar</span>
            <p className="text-2xl font-black text-gold font-mono mt-1">{totalVisitsCount} <span className="text-xs font-normal text-muted">ta qabul</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gold/20 flex items-center justify-center text-gold">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        <div className="card p-4 border-purple-500/30 bg-purple-500/5 flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-extrabold text-purple-400 uppercase tracking-wider">O'rtacha Chek</span>
            <p className="text-2xl font-black text-purple-400 font-mono mt-1">{formatMoney(averageSpent)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400">
            <HeartPulse className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* ── SEARCH & VIEW FILTER CONTROL BAR ───────────────────────── */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4 border-border">
        
        {/* View Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveViewTab('unique')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeViewTab === 'unique'
                ? 'bg-gold text-slate-950 shadow-md font-black scale-105'
                : 'bg-surface-2 text-muted hover:text-body border border-border'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Unikal Bemorlar ({uniquePatientsList.length} nafar)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTab('all_transactions')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeViewTab === 'all_transactions'
                ? 'bg-cyan text-slate-950 shadow-md font-black scale-105'
                : 'bg-surface-2 text-muted hover:text-body border border-border'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Jamiki Qabullar Tarixi ({filteredPatients.length} ta)</span>
          </button>
        </div>

        {/* Search Bar & Grid/Table Layout Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px]">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted" />
            <input
              type="text"
              placeholder="🔎 Bemor ismi, tel yoki xizmat bo'yicha..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field text-xs py-2 pl-9 pr-8 font-semibold w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-muted hover:text-rose-400 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setLayoutMode('table')}
              className={`p-1.5 rounded-lg transition-all ${layoutMode === 'table' ? 'bg-gold text-slate-950 shadow' : 'text-muted hover:text-body'}`}
              title="Jadval shakli"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${layoutMode === 'cards' ? 'bg-gold text-slate-950 shadow' : 'text-muted hover:text-body'}`}
              title="PRO Kartochkalar shakli"
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CONTENT AREA (TABLE OR CARDS) ─────────────────────────── */}
      {!patients ? (
        <TableSkeleton />
      ) : layoutMode === 'cards' ? (
        /* ── PRO GRID CARDS VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(activeViewTab === 'unique' ? uniquePatientsList : filteredPatients).map((item, idx) => {
            const p = item.latestPatient || item
            const isUnique = activeViewTab === 'unique'
            const initials = `${(p.first_name || 'B')[0]}${(p.last_name || 'M')[0]}`.toUpperCase()

            return (
              <div
                key={item.key || p.id}
                className="card p-5 border-border hover:border-gold/50 transition-all duration-300 hover:shadow-xl space-y-4 relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold/30 to-amber-500/10 border border-gold/40 flex items-center justify-center text-gold font-black text-base shadow-sm">
                      {initials}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-body group-hover:text-gold transition-colors">
                        {p.first_name} {p.last_name}
                      </h4>
                      <p className="text-xs text-muted flex items-center gap-1 font-mono mt-0.5">
                        <Phone className="h-3 w-3 text-cyan" /> {p.phone || '—'}
                      </p>
                    </div>
                  </div>

                  <span className="badge badge-gold font-mono font-bold text-[11px]">
                    #{idx + 1}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                  <div className="bg-surface-2 p-2 rounded-xl border border-border/40">
                    <span className="text-[10px] font-bold text-muted uppercase block">Tashriflar</span>
                    <span className="font-extrabold text-cyan font-mono text-sm">
                      {isUnique ? `${item.visit_count} marta` : '1 ta qabul'}
                    </span>
                  </div>

                  <div className="bg-surface-2 p-2 rounded-xl border border-border/40">
                    <span className="text-[10px] font-bold text-muted uppercase block">Sarflangan</span>
                    <span className="font-extrabold text-emerald font-mono text-sm">
                      {formatMoney(isUnique ? item.total_spent : p.payment_amount)}
                    </span>
                  </div>
                </div>

                {isUnique ? (
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase block mb-1">Xizmatlar:</span>
                    <div className="flex flex-wrap gap-1">
                      {item.services.slice(0, 3).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan text-[10px] font-bold">
                          {s}
                        </span>
                      ))}
                      {item.services.length > 3 && (
                        <span className="text-[10px] text-muted font-bold">+{item.services.length - 3} ta</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase block mb-1">
                      {(p.services || []).length > 1 ? `Xizmatlar (${p.services.length} ta):` : 'Xizmat Nomi:'}
                    </span>
                    {(p.services || []).length > 1 ? (
                      <div className="space-y-0.5">
                        {p.services.map((s, i) => (
                          <span key={i} className="font-extrabold text-cyan text-xs block">
                            • {s.service_name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="font-extrabold text-cyan text-xs">
                        {p.services?.[0]?.service_name || p.service_name}
                      </span>
                    )}
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setEhrPatient(p)}
                    className="btn-gold py-1.5 px-3 text-xs font-bold flex-1 flex items-center justify-center gap-1"
                  >
                    <FileText className="h-3.5 w-3.5" /> Tibbiy Karta
                  </button>

                  <button
                    type="button"
                    onClick={() => setReRegisterPatient(p)}
                    className="btn-cyan py-1.5 px-3 text-xs font-bold flex-1 flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Qayta Yozish
                  </button>

                  <button
                    type="button"
                    onClick={() => openVisits(p)}
                    className="btn-outline py-1.5 px-2.5 text-xs text-muted hover:text-gold"
                    title="Tashriflar Tarixi"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePatient(p)}
                    className="btn-outline py-1.5 px-2.5 text-xs text-rose-400 hover:bg-rose-500/20 border-rose-500/40"
                    title="Bemorni bazadan to'liq o'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : activeViewTab === 'unique' ? (
        /* ── TAB 1: UNIQUE PATIENTS TABLE ── */
        <div className="card overflow-x-auto p-0 border-gold/20 shadow-lg">
          <table className="w-full text-xs">
            <THead cols={['#', 'Bemor F.I.SH', 'Telefon', 'Olgan Xizmatlari', 'Tashriflar', 'Jami Sarflangan', 'So\'nggi Tashrif', 'Harakatlar']} />
            <tbody className="divide-y divide-border font-semibold">
              {uniquePatientsList.length === 0 ? (
                <tr><td colSpan={8} className="py-8"><EmptyState icon="👤" message="Bemorlar topilmadi" /></td></tr>
              ) : uniquePatientsList.map((u, idx) => {
                const initials = `${(u.first_name || 'B')[0]}${(u.last_name || 'M')[0]}`.toUpperCase()
                return (
                  <tr key={u.key} className="hover:bg-surface-hover transition-colors whitespace-nowrap">
                    <td className="p-3 text-muted font-mono font-bold">#{idx + 1}</td>

                    <td className="p-3 text-body font-bold">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold font-extrabold text-xs">
                          {initials}
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-body">{u.first_name} {u.last_name}</p>
                          {u.address && <p className="text-[10px] text-muted flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {u.address}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="p-3 font-mono text-muted text-xs">
                      {u.phone || '—'}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {u.services.slice(0, 2).map((sn, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan text-[11px] font-bold">
                            {sn}
                          </span>
                        ))}
                        {u.services.length > 2 && (
                          <span className="px-2 py-0.5 rounded-md bg-gold/10 border border-gold/30 text-gold text-[11px] font-bold" title={u.services.join(', ')}>
                            +{u.services.length - 2} ta boshqa
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-mono font-bold text-center">
                      <span className="badge badge-info text-xs">{u.visit_count} marta</span>
                    </td>

                    <td className="p-3 font-mono font-black text-emerald text-sm">
                      {formatMoney(u.total_spent)}
                    </td>

                    <td className="p-3 text-muted font-mono text-xs">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Btn
                          variant="gold"
                          size="xs"
                          icon={Icons.folder}
                          onClick={() => setEhrPatient(u.latestPatient)}
                          title="Bemor elektron kartasi"
                        >
                          Karta
                        </Btn>

                        <Btn
                          variant="cyan"
                          size="xs"
                          onClick={() => setReRegisterPatient(u.latestPatient)}
                          title="Bemorni yangi xizmatga yozish"
                        >
                          ➕ Yozish
                        </Btn>

                        <Btn
                          variant="ghost"
                          size="xs"
                          icon={Icons.history}
                          onClick={() => openVisits(u.latestPatient)}
                          title="Tashriflar tarixi"
                        >
                          Tarix
                        </Btn>

                        <Btn
                          variant="danger"
                          size="xs"
                          icon={Icons.trash}
                          onClick={() => handleDeletePatient(u.latestPatient)}
                          title="Bemorni bazadan to'liq o'chirish"
                        >
                          O'chirish
                        </Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── TAB 2: ALL INDIVIDUAL VISITS TABLE ── */
        <div className="card overflow-x-auto p-0 border-cyan-500/20 shadow-lg">
          <table className="w-full text-xs">
            <THead cols={['Sana', 'Bemor F.I.SH', 'Telefon', 'Xizmat Nomi', 'Summa', 'Kiritdi', 'Harakatlar']} />
            <tbody className="divide-y divide-border font-semibold">
              {filteredPatients.length === 0 ? (
                <tr><td colSpan={7} className="py-8"><EmptyState icon="👤" message="Bemorlar topilmadi" /></td></tr>
              ) : filteredPatients.map((p) => (
                <tr
                  key={p.id}
                  className={p.is_cancelled ? 'bg-rose-500/10 text-rose-300' : 'hover:bg-surface-hover transition-colors whitespace-nowrap'}
                >
                  <td className="p-3 text-muted font-mono text-xs">{formatDate(p.created_at)}</td>

                  <td className="p-3 text-body font-bold text-sm">
                    {p.first_name} {p.last_name}
                  </td>

                  <td className="p-3 text-muted font-mono text-xs">{p.phone || '—'}</td>

                  <td className="p-3 text-cyan font-extrabold text-xs">
                    {(p.services || []).length > 1 ? (
                      <div className="space-y-0.5">
                        {p.services.map((s, i) => (
                          <span key={i} className="block">
                            {s.service_name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      p.services?.[0]?.service_name || p.service_name
                    )}
                  </td>

                  <td className="p-3 font-mono">
                    <span className="font-black text-emerald text-sm">{formatMoney(p.payment_amount)}</span>
                    <span className="badge badge-gold ml-1.5 text-[10px] uppercase font-bold">{paymentLabel(p.payment_type)}</span>
                  </td>

                  <td className="p-3 text-muted text-xs">{p.creator_name || '—'}</td>

                  <td className="p-3">
                    {p.is_cancelled ? (
                      <span className="text-xs font-bold text-rose-400">
                        ✗ Bekor: {p.cancel_reason}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Btn
                          variant="gold"
                          size="xs"
                          icon={Icons.folder}
                          onClick={() => setEhrPatient(p)}
                          title="Bemor to'liq tibbiy kartasi"
                        >
                          Karta
                        </Btn>

                        <Btn
                          variant="cyan"
                          size="xs"
                          onClick={() => setReRegisterPatient(p)}
                          title="Bemorni yangi xizmatga qayta yozish"
                        >
                          ➕ Yozish
                        </Btn>

                        <Btn
                          variant="ghost"
                          size="xs"
                          icon={Icons.history}
                          onClick={() => openVisits(p)}
                          title="Tashriflar tarixi"
                        >
                          Tarix
                        </Btn>

                        <Btn
                          variant="outline"
                          size="xs"
                          icon={Icons.edit}
                          onClick={() => { setEdit({ ...p }); setEditReason('') }}
                          title="Tahrirlash"
                        >
                          Tahrir
                        </Btn>

                        <Btn
                          variant="danger"
                          size="xs"
                          icon={Icons.trash}
                          onClick={() => { setCancelId(p.id); setCancelReason('') }}
                          title="To'lovni bekor qilish"
                        >
                          Bekor
                        </Btn>

                        <Btn
                          variant="danger"
                          size="xs"
                          icon={Icons.trash}
                          onClick={() => handleDeletePatient(p)}
                          title="Bemorni bazadan to'liq o'chirish"
                        >
                          O'chirish
                        </Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Bemor ma'lumotlarini tahrirlash" size="md">
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Ism</label>
                <input className="input-field text-xs font-bold" value={edit.first_name}
                  onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Familiya</label>
                <input className="input-field text-xs font-bold" value={edit.last_name}
                  onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Telefon</label>
              <input className="input-field text-xs font-bold font-mono" value={edit.phone}
                onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Manzil</label>
              <input className="input-field text-xs font-bold" value={edit.address}
                onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Tahrirlash sababi *</label>
              <input className="input-field text-xs" placeholder="Kamida 3 ta harf..."
                value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" full icon={Icons.x} onClick={() => setEdit(null)}>Bekor</Btn>
              <Btn variant="gold" full icon={Icons.save} onClick={saveEdit}>Saqlash</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel modal */}
      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="To'lovni bekor qilish" size="sm">
        <div className="rounded-xl p-3 mb-4 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold">
          ⚠️ To'lov bekor qilinsa, summa balansdan qaytariladi. Bu amal qaytarib bo'lmaydi.
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-muted block mb-1">Bekor qilish sababi *</label>
            <input className="input-field text-xs" placeholder="Kamida 3 ta harf..."
              value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setCancelId(null)}>Orqaga</Btn>
            <Btn variant="danger" full icon={Icons.trash} onClick={doCancel}>Ha, bekor qilish</Btn>
          </div>
        </div>
      </Modal>

      {/* Visits modal */}
      <Modal open={!!visitId} onClose={() => setVisitId(null)} title="Tashriflar tarixi" size="lg">
        {visits.length === 0 ? (
          <EmptyState icon="📅" message="Tashrif tarixi topilmadi" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <THead cols={['Sana', 'Xizmat', 'Shifokor', 'Summa', 'Holat']} />
              <tbody className="divide-y divide-border font-semibold">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-hover transition-colors">
                    <td className="p-2.5 text-muted text-xs font-mono">{formatDate(v.created_at)}</td>
                    <td className="p-2.5 text-body font-bold">{v.service_name || '—'}</td>
                    <td className="p-2.5 text-cyan font-bold">{v.provider_name || '—'}</td>
                    <td className="p-2.5 font-mono font-black text-emerald">{formatMoney(v.payment_amount)}</td>
                    <td className="p-2.5">
                      <StatusBadge status={v.is_cancelled ? 'bekor' : 'aktiv'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
