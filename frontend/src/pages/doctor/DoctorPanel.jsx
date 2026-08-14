import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import {
  UserCheck,
  PhoneOff,
  Volume2,
  Play,
  Pause,
  Clock,
  UserPlus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  Info,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  History,
  Users,
  X,
  FileText,
  Save,
  Search,
  ArrowLeft,
  ChevronDown,
  LogOut,
  Package,
  MinusCircle,
  TestTube,
  ClipboardList,
} from 'lucide-react'
import MedicalReportModal from '../../components/MedicalReportModal'
import Modal from '../../components/Modal'
import LabResultsModal from '../../components/LabResultsModal'
import ReportTemplateModal from '../../components/ReportTemplateModal'
import { guessTemplateCategory } from '../../utils/reportTemplates'
import { Btn, Icons, PageHeader, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'

export default function DoctorPanel() {
  const role = useAuthStore((s) => s.role)
  const logout = useAuthStore((s) => s.logout)
  const accessToken = useAuthStore((s) => s.accessToken)
  const navigate = useNavigate()

  // Management mode: only true when logged in as CEO or ADMIN
  const isManagement = role === 'ceo' || role === 'admin'

  const handleLogout = async () => {
    try {
      if (accessToken) await api('/auth/logout', { method: 'POST' })
    } catch (_) {}
    logout()
    navigate('/login', { replace: true })
  }

  // Doctors list for CEO/Admin selection
  const [providers, setProviders] = useState([])
  const [selectedProviderId, setSelectedProviderId] = useState(null)
  const [doctorSearch, setDoctorSearch] = useState('')
  const [liveQueueData, setLiveQueueData] = useState([])

  // Queue & Doctor State
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

  // Lab Modal State
  const [labPatient, setLabPatient] = useState(null)

  // Report Template Modal State (UZI/Lab shablonlari)
  const [templatePatient, setTemplatePatient] = useState(null)

  // Inventory Modal State
  const [inventoryModal, setInventoryModal] = useState(false)
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [invSearch, setInvSearch] = useState('')
  const [selectedInvItem, setSelectedInvItem] = useState(null)
  const [consumeAmount, setConsumeAmount] = useState('1')
  const [chargePatient, setChargePatient] = useState(true)
  const [consuming, setConsuming] = useState(false)

  const fetchInventory = async () => {
    setInventoryLoading(true)
    try {
      const data = await api('/inventory')
      setInventoryItems(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setInventoryLoading(false)
    }
  }

  const handleConsumeInventory = async () => {
    if (!selectedInvItem || !consumeAmount) return
    const amt = Number(consumeAmount)
    if (amt <= 0) return
    setConsuming(true)
    try {
      const curPatient = data?.current_patient
      await api(`/inventory/${selectedInvItem.id}/consume`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          patient_id: curPatient?.id,
          ticket_number: curPatient?.ticket_number,
          patient_name: curPatient ? `${curPatient.first_name} ${curPatient.last_name}` : undefined,
          charge_patient: curPatient ? chargePatient : false,
          payment_type: 'later',
          notes: `Shifokor ${curPatient ? `${curPatient.first_name} ${curPatient.last_name} (${curPatient.ticket_number})` : 'qabulida'} ishlatdi`,
        }),
      })
      const unitP = selectedInvItem.unit_price || 0
      const totalCharge = unitP * amt
      if (curPatient && chargePatient && totalCharge > 0) {
        showToast(`✓ ${selectedInvItem.name} (${amt} ${selectedInvItem.unit}) ishlatildi hamda ${curPatient.first_name} uchun ${totalCharge.toLocaleString()} so'm to'lov bildirishnomasi Admin panelga yuborildi!`)
      } else {
        showToast(`✓ ${selectedInvItem.name} dan ${amt} ${selectedInvItem.unit} ishlatildi`)
      }
      setSelectedInvItem(null)
      setConsumeAmount('1')
      setInventoryModal(false)
      fetchInventory()
      fetchDoctorQueue()
    } catch (e) {
      showToast(e.message || 'Xatolik yuz berdi')
    } finally {
      setConsuming(false)
    }
  }
  const [message, setMessage] = useState(null)
  const [activeTab, setActiveTab] = useState('waiting') // 'waiting' | 'history'
  const [selectedPatientModal, setSelectedPatientModal] = useState(null)
  const [medicalRecordModal, setMedicalRecordModal] = useState(null)
  const [printableRecord, setPrintableRecord] = useState(null)
  const [medForm, setMedForm] = useState({ diagnosis: '', complaints: '', prescription: '' })

  // Fetch Providers list for CEO/Admin selection
  const fetchProviders = async () => {
    try {
      const [list, live] = await Promise.all([
        api('/providers?active_only=true'),
        api('/patients/today').catch(() => []),
      ])
      setProviders(list || [])
      setLiveQueueData(live || [])
    } catch (_) {}
  }

  useEffect(() => {
    if (isManagement) {
      fetchProviders()
    }
  }, [isManagement])

  // Fetch selected Doctor's queue dashboard
  const fetchDoctorQueue = async () => {
    try {
      setError(null)
      const url = selectedProviderId
        ? `/queue/doctor/my-queue?provider_id=${selectedProviderId}`
        : '/queue/doctor/my-queue'
      const res = await api(url)
      setData(res)
    } catch (err) {
      console.error('Doctor queue fetch error:', err)
      setError(err.message || 'Ma’lumotlarni yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isManagement || selectedProviderId) {
      setLoading(true)
      fetchDoctorQueue()
      const interval = setInterval(fetchDoctorQueue, 4000)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
      const interval = setInterval(fetchProviders, 5000)
      return () => clearInterval(interval)
    }
  }, [selectedProviderId, isManagement])

  const showToast = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }

  // 1) Toggle Doctor Pause Status
  const handleTogglePause = async () => {
    try {
      setActionLoading(true)
      const url = selectedProviderId
        ? `/queue/doctor/toggle-pause?provider_id=${selectedProviderId}`
        : '/queue/doctor/toggle-pause'
      const res = await api(url, { method: 'POST' })
      setData((prev) => ({ ...prev, is_paused: res.is_paused }))
      showToast(res.is_paused ? 'Tanaffus yoqildi (Pauza)' : 'Qabul davom ettirilmoqda')
    } catch (err) {
      showToast(err.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

  // 1.5) Toggle Daily Shift Status (End Workday / Close Appointments)
  const handleToggleShift = async () => {
    const isCurrentlyClosed = data?.is_shift_closed
    const confirmMsg = isCurrentlyClosed
      ? "Bugungi qabulni qayta ochishni tasdiqlaysizmi?"
      : "Bugungi ish kunini yakunlashni va qabulni yopishni tasdiqlaysizmi?"
    if (!confirm(confirmMsg)) return

    try {
      setActionLoading(true)
      const url = selectedProviderId
        ? `/queue/doctor/toggle-shift?provider_id=${selectedProviderId}`
        : '/queue/doctor/toggle-shift'
      const res = await api(url, { method: 'POST' })
      setData((prev) => ({ ...prev, is_shift_closed: res.is_shift_closed }))
      showToast(res.message || 'Ish kuni holati o\'zgartirildi')
    } catch (err) {
      showToast(err.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

  // 2) Call Next Waiting Patient
  const handleCallNext = async () => {
    try {
      setActionLoading(true)
      const res = await api('/queue/doctor/call-next', {
        method: 'POST',
        body: JSON.stringify(selectedProviderId ? { provider_id: selectedProviderId } : {}),
      })
      showToast(res.message || 'Keyingi mijoz chaqirildi')
      fetchDoctorQueue()
    } catch (err) {
      showToast(err.message || 'Navbatda kutayotgan mijoz yo\'q')
    } finally {
      setActionLoading(false)
    }
  }

  // 2.5) Re-call current patient on TV screen
  const handleRecallCurrent = async () => {
    try {
      setActionLoading(true)
      const curId = data?.current_patient?.id
      const url = curId ? `/queue/${curId}/recall` : '/queue/doctor/recall-current'
      const res = await api(url, {
        method: 'POST',
        body: JSON.stringify(selectedProviderId ? { provider_id: selectedProviderId } : {}),
      })
      showToast(res.message || 'Bemor qayta chaqirildi 📢')
      fetchDoctorQueue()
    } catch (err) {
      showToast(err.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

  // 3) Complete current patient visit
  const handleCompleteCurrent = async () => {
    if (!data?.current_patient) return
    try {
      setActionLoading(true)
      const res = await api(`/queue/${data.current_patient.id}/complete`, { method: 'POST' })
      showToast(res.message || 'Qabul yakunlandi')
      fetchDoctorQueue()
    } catch (err) {
      showToast(err.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

  // 4) Skip current patient
  const handleSkipCurrent = async () => {
    if (!data?.current_patient) return
    try {
      setActionLoading(true)
      const res = await api(`/queue/${data.current_patient.id}/skip`, { method: 'POST' })
      showToast(res.message || 'Mijoz o\'tkazib yuborildi')
      fetchDoctorQueue()
    } catch (err) {
      showToast(err.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

  // 5) Call specific patient from list
  const handleCallSpecific = async (patientId) => {
    try {
      setActionLoading(true)
      const res = await api(`/queue/${patientId}/call`, {
        method: 'POST',
        body: JSON.stringify({ cabinet: data?.cabinet || 'Qabulxona' }),
      })
      showToast(res.message || 'Mijoz chaqirildi')
      fetchDoctorQueue()
    } catch (err) {
      showToast(err.message || 'Xatolik yuz berdi')
    } finally {
      setActionLoading(false)
    }
  }

  // Open Medical Record Modal
  const openMedicalRecord = (p) => {
    setMedicalRecordModal(p)
    setMedForm({
      diagnosis: p.diagnosis || '',
      complaints: p.complaints || '',
      prescription: p.prescription || '',
    })
  }

  // Save Medical Record
  const handleSaveMedicalRecord = async () => {
    if (!medicalRecordModal) return
    try {
      setActionLoading(true)
      await api(`/patients/${medicalRecordModal.id}/medical-record`, {
        method: 'POST',
        body: JSON.stringify(medForm),
      })
      showToast("Tashxis va retsept muvaffaqiyatli saqlandi ✓")
      setMedicalRecordModal(null)
      fetchDoctorQueue()
    } catch (err) {
      showToast(err.message || "Xatolik yuz berdi", "error")
    } finally {
      setActionLoading(false)
    }
  }

  // ─── VIEW 1: DOCTOR CARDS SELECTOR (When CEO/Admin hasn't selected a doctor yet) ───
  if (selectedProviderId === null && isManagement) {
    const filteredProviders = (providers || []).filter((p) =>
      p.full_name?.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      p.specialization?.toLowerCase().includes(doctorSearch.toLowerCase())
    )

    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        <PageHeader
          title="Shifokorlar Paneli (Boshqaruv)"
          subtitle="Shifokor profilini tanlang va uning navbati va qabul jarayonini ko'ring"
          icon={<Stethoscope className="h-6 w-6 text-gold" />}
        >
          <Btn variant="ghost" size="sm" icon={Icons.refresh} onClick={fetchProviders}>
            Yangilash
          </Btn>
        </PageHeader>

        {/* Doctor Search Bar */}
        <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              className="input-field pl-9 text-xs font-semibold"
              placeholder="Shifokor ismi yoki mutaxassisligi..."
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
            />
          </div>
          <span className="badge badge-gold text-xs font-bold">
            Jami {providers.length} ta shifokor
          </span>
        </div>

        {/* Doctors Grid */}
        {filteredProviders.length === 0 ? (
          <div className="card py-12">
            <EmptyState icon="🩺" message="Shifokorlar topilmadi" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProviders.map((prov) => {
              const provPatients = (liveQueueData || []).filter((p) => p.provider_id === prov.id && !p.is_cancelled)
              const waitingCount = provPatients.filter((p) => p.queue_status === 'kutmoqda').length
              const doneCount = provPatients.filter((p) => p.queue_status === 'yakunlandi').length
              const displayName = prov.full_name?.startsWith('Dr.') ? prov.full_name : `Dr. ${prov.full_name}`

              return (
                <div
                  key={prov.id}
                  className="card hover:border-gold/50 transition-all cursor-pointer flex flex-col justify-between p-5 space-y-4 group border-border shadow-md"
                  onClick={() => setSelectedProviderId(prov.id)}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 bg-gold/15 text-gold border border-gold/30"
                        >
                          🩺
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-body group-hover:text-gold transition-colors">
                            {displayName}
                          </h3>
                          <p className="text-xs font-bold text-gold mt-0.5">
                            {prov.specialization}
                          </p>
                        </div>
                      </div>
                      <span className="badge badge-gold font-mono font-extrabold text-[11px]">
                        {prov.percentage}% KPI
                      </span>
                    </div>

                    {/* Phone / Username */}
                    <div className="text-xs text-muted space-y-1 mb-4 font-semibold">
                      {prov.phone && <p>📱 {prov.phone}</p>}
                      {prov.username && <p className="font-mono text-cyan-400 font-bold">@{prov.username}</p>}
                    </div>

                    {/* Live Status Pills */}
                    <div className="bg-surface-2 rounded-xl space-y-2 p-3 text-xs border border-border/60">
                      <div className="flex justify-between items-center">
                        <span className="text-muted font-bold">⏳ Kutayotganlar:</span>
                        <span className="font-extrabold text-gold">{waitingCount} ta bemor</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted font-bold">✓ Bugun qabul qildi:</span>
                        <span className="font-extrabold text-slate-300">{doneCount} ta bemor</span>
                      </div>
                    </div>
                  </div>

                  {/* Select Doctor Button */}
                  <Btn
                    variant="gold"
                    full
                    size="md"
                    icon={Icons.user}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedProviderId(prov.id)
                    }}
                    className="font-extrabold"
                  >
                    Doctor Panelini Ochish 🩺
                  </Btn>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── VIEW 2: SELECTED DOCTOR'S LIVE PANEL ───
  if (loading && !data) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-10 w-10 text-cyan-500 animate-spin mb-4" />
        <p className="text-muted font-bold text-sm">Shifokor paneli yuklanmoqda...</p>
      </div>
    )
  }

  const { doctor_name, specialization, cabinet, is_paused, stats, current_patient, waiting_list, history_list } = data || {}

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Toast Notification */}
      {message && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-cyan-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-bold">{message}</span>
        </div>
      )}

      {/* CEO / ADMIN DOCTOR SELECTOR TOP BAR */}
      {isManagement && providers.length > 0 && (
        <div className="card p-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-gold/40 bg-surface-2 shadow-md">
          <div className="flex items-center gap-2">
            <Btn
              variant="outline"
              size="xs"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => setSelectedProviderId(null)}
            >
              ← Shifokorlar Ro'yxatiga Qaytish
            </Btn>
            <span className="font-extrabold text-xs text-body border-l border-border pl-2 ml-1">
              Hozirgi Tanlangan: <strong className="text-gold">{doctor_name || 'Shifokor'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted font-bold whitespace-nowrap">🔄 Shifokor bo'limini almashtirish:</span>
            <select
              className="input-field text-xs py-1.5 font-bold text-gold bg-surface-1 border-gold/40 max-w-[260px] rounded-xl shadow-sm"
              value={selectedProviderId || providers[0]?.id || ''}
              onChange={(e) => setSelectedProviderId(+e.target.value)}
            >
              {(providers || []).map((p) => {
                const displayName = p.full_name?.startsWith('Dr.') ? p.full_name : `Dr. ${p.full_name}`
                return (
                  <option key={p.id} value={p.id}>
                    {displayName} ({p.specialization})
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      )}

      {/* ── PRINTABLE MEDICAL BLANK MODAL ─────────────────────────── */}
      {printableRecord && (
        <MedicalReportModal
          patient={printableRecord}
          onClose={() => setPrintableRecord(null)}
        />
      )}

      {/* Header Bar */}
      <PageHeader
        title={`${doctor_name || 'Shifokor'} Paneli`}
        subtitle={`${specialization || 'Shifokor'} • Xona: ${cabinet || '1-Xona'}`}
        icon={<Stethoscope className="h-6 w-6 text-gold" />}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Work Shift Close / Open Button */}
          <Btn
            variant={data?.is_shift_closed ? 'success' : 'danger'}
            size="sm"
            icon={data?.is_shift_closed ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            loading={actionLoading}
            onClick={handleToggleShift}
          >
            {data?.is_shift_closed ? '🟢 Qabulni Ochish' : '🔴 Ish Kunini Yakunlash (Yopish)'}
          </Btn>

          {/* Pause Toggle Button */}
          <Btn
            variant={is_paused ? 'warning' : 'outline'}
            size="sm"
            icon={is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            loading={actionLoading}
            onClick={handleTogglePause}
            disabled={data?.is_shift_closed}
          >
            {is_paused ? '▶ Qabulni Davom Ettirish' : '⏸ Tanaffus (Pauza)'}
          </Btn>

          <Btn variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchDoctorQueue}>
            Yangilash
          </Btn>
        </div>
      </PageHeader>

      {/* Error Alert */}
      {error && (
        <div className="card p-4 bg-rose-500/10 border-rose-500/30 text-rose-300 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <Btn variant="outline" size="xs" onClick={fetchDoctorQueue}>Qayta Urinish</Btn>
        </div>
      )}

      {/* ── TOP KPI STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 border-emerald-500/30 bg-emerald-500/5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block mb-1">
            ✓ Yakunlangan Qabullar
          </span>
          <span className="text-2xl font-black font-mono text-emerald-400">{stats?.completed || 0} ta</span>
        </div>

        <div className="card p-4 border-gold/30 bg-gold/5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gold block mb-1">
            ⏳ Navbatda Kutayotganlar
          </span>
          <span className="text-2xl font-black font-mono text-gold">{stats?.waiting || 0} ta</span>
        </div>

        <div className="card p-4 border-rose-500/30 bg-rose-500/5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 block mb-1">
            ⏭ O'tkazib Yuborilgan
          </span>
          <span className="text-2xl font-black font-mono text-rose-400">{stats?.skipped || 0} ta</span>
        </div>

        <div className="card p-4 border-cyan-500/30 bg-cyan-500/5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 block mb-1">
            👥 Bugungi Jami Bemorlar
          </span>
          <span className="text-2xl font-black font-mono text-cyan-400">{stats?.total_today || 0} ta</span>
        </div>
      </div>

      {/* ── SHIFT CLOSED BANNER ── */}
      {data?.is_shift_closed && (
        <div className="card p-5 bg-rose-500/10 border-rose-500/40 text-center space-y-2">
          <h3 className="text-lg font-black text-rose-400 flex items-center justify-center gap-2">
            🔒 Bugungi Ish Kuni Yakunlangan (Qabul Yopilgan)
          </h3>
          <p className="text-xs text-muted max-w-xl mx-auto font-medium">
            Tizim yangi navbat chaqirishni to'xtatgan. Qayta bemor qabul qilish uchun yuqoridagi <strong>"🟢 Qabulni Ochish"</strong> tugmasini bosing.
          </p>
        </div>
      )}

      {/* ── CURRENT PATIENT HERO SECTION ── */}
      <div className="card p-6 border-gold/50 shadow-2xl relative overflow-hidden bg-gradient-to-br from-surface-1 via-surface-2 to-surface-1">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-black text-xl shadow-inner">
              🩺
            </div>
            <div>
              <h2 className="font-black text-lg text-foreground flex items-center gap-2">
                Hozirgi Qabuldagi Bemor
              </h2>
              <p className="text-xs text-muted font-medium">Xona: <strong className="text-gold">{cabinet || '1-Xona'}</strong></p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* RE-CALL CURRENT PATIENT BUTTON */}
            {current_patient && (
              <Btn
                variant="warning"
                size="md"
                icon={<Volume2 className="h-5 w-5" />}
                loading={actionLoading}
                disabled={data?.is_shift_closed || is_paused}
                onClick={handleRecallCurrent}
                className="px-5 py-3 text-sm font-black shadow-lg bg-amber-500 hover:bg-amber-600 text-slate-950"
                title="Hozirgi qabuldagi bemorni TV ekranda qayta chaqirish"
              >
                🔊 Qayta Chaqirish
              </Btn>
            )}

            {/* CALL NEXT BUTTON */}
            <Btn
              variant="gold"
              size="md"
              icon={<Volume2 className="h-5 w-5" />}
              loading={actionLoading}
              disabled={data?.is_shift_closed || is_paused || (stats?.waiting === 0 && !current_patient)}
              onClick={handleCallNext}
              className="px-6 py-3 text-sm font-black shadow-lg scale-105"
            >
              📢 Keyingi Bemorni Chaqirish
            </Btn>
          </div>
        </div>

        {current_patient ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Ticket & Name */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <span className="badge badge-gold font-mono font-black text-xl px-4 py-1.5 shadow-md">
                  {current_patient.ticket_number}
                </span>
                <span className="badge badge-success text-xs font-bold animate-pulse">
                  🟢 Hozir Xonada (Qabulda)
                </span>
              </div>

              <h3 className="text-2xl font-black text-foreground tracking-tight">
                {current_patient.first_name} {current_patient.last_name}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted font-semibold">
                <span className="flex items-center gap-1.5 text-body"><Phone className="h-3.5 w-3.5 text-cyan" /> {current_patient.phone}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-body"><Stethoscope className="h-3.5 w-3.5 text-gold" /> {current_patient.service_name}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold"><CreditCard className="h-3.5 w-3.5" /> {current_patient.payment_amount?.toLocaleString()} so'm</span>
              </div>
            </div>

            {/* Actions for Current Patient */}
            <div className="flex flex-col gap-2.5">
              <Btn
                variant="cyan"
                size="md"
                icon={<FileText className="h-4 w-4" />}
                onClick={() => openMedicalRecord(current_patient)}
                className="w-full font-bold"
              >
                📝 Tashxis & Retsept Yozish
              </Btn>

              <Btn
                variant="info"
                size="sm"
                icon={<TestTube className="h-4 w-4" />}
                onClick={() => setLabPatient(current_patient)}
                className="w-full font-bold"
              >
                🧪 Laboratoriya Javoblari
              </Btn>

              {guessTemplateCategory(current_patient.service_category, current_patient.service_name) && (
                <Btn
                  variant="success"
                  size="sm"
                  icon={<ClipboardList className="h-4 w-4" />}
                  onClick={() => setTemplatePatient(current_patient)}
                  className="w-full font-bold"
                >
                  📋 Shablonni To'ldirish
                </Btn>
              )}

              <Btn
                variant="amber"
                size="sm"
                icon={<Package className="h-4 w-4" />}
                onClick={() => {
                  fetchInventory()
                  setInventoryModal(true)
                }}
                className="w-full font-bold"
              >
                💊 Material / Dorilar Sarflash
              </Btn>

              <div className="flex gap-2 pt-1">
                <Btn
                  variant="success"
                  size="sm"
                  icon={<UserCheck className="h-4 w-4" />}
                  loading={actionLoading}
                  onClick={handleCompleteCurrent}
                  className="flex-1 font-bold"
                >
                  ✓ Qabulni Yakunlash
                </Btn>

                <Btn
                  variant="outline"
                  size="sm"
                  icon={<PhoneOff className="h-4 w-4" />}
                  loading={actionLoading}
                  onClick={handleSkipCurrent}
                  className="text-rose-400 border-rose-500/40 hover:bg-rose-500/10 font-bold"
                  title="O'tkazib yuborish"
                >
                  O'tkazib Yuborish
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-3">
            <div className="text-4xl">🩺</div>
            <p className="text-muted font-bold text-sm">Hozir xonada bemor yo'q</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Navbatdagi bemorni xonaga chaqirish uchun yuqoridagi <strong>"📢 Keyingi Bemorni Chaqirish"</strong> tugmasini bosing.
            </p>
          </div>
        )}
      </div>

      {/* ── QUEUE LIST TABS (WAITING / HISTORY) ── */}
      <div className="card p-0 overflow-hidden border-border">
        <div className="flex border-b border-border bg-surface-2">
          <button
            type="button"
            onClick={() => setActiveTab('waiting')}
            className={`flex-1 py-3 px-4 font-extrabold text-xs flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'waiting'
                ? 'border-gold text-gold bg-surface-1'
                : 'border-transparent text-muted hover:text-body'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Kutayotgan Bemorlar ({waiting_list?.length || 0} ta)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 font-extrabold text-xs flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-gold text-gold bg-surface-1'
                : 'border-transparent text-muted hover:text-body'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Bugungi Qabullar Tarixi ({history_list?.length || 0} ta)</span>
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'waiting' ? (
            /* ── WAITING LIST ── */
            (!waiting_list || waiting_list.length === 0) ? (
              <EmptyState icon="⏳" message="Navbatda kutayotgan bemorlar yo'q" />
            ) : (
              <div className="divide-y divide-border/40">
                {(waiting_list || []).map((p, idx) => (
                  <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-gold text-sm w-16">
                        {p.ticket_number}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-sm text-body">{p.first_name} {p.last_name}</h4>
                        <p className="text-xs text-muted flex items-center gap-2">
                          <span>📞 {p.phone}</span>
                          <span>•</span>
                          <span className="text-cyan font-semibold">🩺 {p.service_name}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Btn
                        variant="ghost"
                        size="xs"
                        icon={<FileText className="h-3.5 w-3.5" />}
                        onClick={() => openMedicalRecord(p)}
                      >
                        Karta / Retsept
                      </Btn>

                      <Btn
                        variant="gold"
                        size="xs"
                        icon={<Volume2 className="h-3.5 w-3.5" />}
                        loading={actionLoading}
                        onClick={() => handleCallSpecific(p.id)}
                      >
                        Chaqirish
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── HISTORY LIST ── */
            (!history_list || history_list.length === 0) ? (
              <EmptyState icon="📜" message="Bugun hali bemor qabul qilinmadi" />
            ) : (
              <div className="divide-y divide-border/40">
                {(history_list || []).map((p) => (
                  <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-muted text-xs w-16">
                        {p.ticket_number}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-sm text-body">{p.first_name} {p.last_name}</h4>
                        <p className="text-xs text-muted flex items-center gap-2">
                          <span>🩺 {p.service_name}</span>
                          <span>•</span>
                          <span>🕒 {p.updated_at ? p.updated_at.split('T')[1]?.substring(0, 5) : '—'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs font-bold ${p.queue_status === 'yakunlandi' ? 'badge-success' : 'badge-danger'}`}>
                        {p.queue_status === 'yakunlandi' ? '✓ Qabul qilindi' : '⏭ O\'tkazib yuborildi'}
                      </span>

                      <Btn
                        variant="outline"
                        size="xs"
                        icon={<FileText className="h-3.5 w-3.5" />}
                        onClick={() => setPrintableRecord(p)}
                      >
                        Kvitansiya / Blanka
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── MODAL 1: MEDICAL RECORD (DIAGNOSIS & PRESCRIPTION) ── */}
      <Modal
        open={!!medicalRecordModal}
        onClose={() => setMedicalRecordModal(null)}
        title={`Tashxis va Retsept Yozish — [ ${medicalRecordModal?.first_name} ${medicalRecordModal?.last_name} ]`}
        size="lg"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="form-label font-bold">Bemor Shikoyatlari (Anamnez)</label>
            <textarea
              className="input-field text-xs font-medium h-20"
              placeholder="Bemorning shikoyatlarini kiriting..."
              value={medForm.complaints}
              onChange={(e) => setMedForm({ ...medForm, complaints: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label font-bold text-gold">Qoyilgan Tashxis (Diagnos) *</label>
            <input
              className="input-field text-xs font-extrabold text-gold"
              placeholder="Masalan: O'tkir gastrit, Birlamchi arterial gipertenziya"
              value={medForm.diagnosis}
              onChange={(e) => setMedForm({ ...medForm, diagnosis: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label font-bold text-emerald">Tayinlangan Retsept va Davolash Rejasi</label>
            <textarea
              className="input-field text-xs font-medium h-28"
              placeholder="1. Tab. Amoksitsillin 500mg 1t x 3m (5 kun)..."
              value={medForm.prescription}
              onChange={(e) => setMedForm({ ...medForm, prescription: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setMedicalRecordModal(null)}>
              Bekor Qilish
            </Btn>
            <Btn variant="gold" full icon={<Save className="h-4 w-4" />} loading={actionLoading} onClick={handleSaveMedicalRecord}>
              ✓ Saqlash va Chop Etish
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 2: LAB RESULTS ── */}
      {labPatient && (
        <LabResultsModal
          patient={labPatient}
          onClose={() => setLabPatient(null)}
        />
      )}

      {/* ── MODAL 2b: REPORT TEMPLATE (UZI/Lab shabloni) ── */}
      {templatePatient && (
        <ReportTemplateModal
          patient={templatePatient}
          category={guessTemplateCategory(templatePatient.service_category, templatePatient.service_name)}
          defaultTemplateKey={templatePatient.template_key}
          serviceId={templatePatient.service_id}
          onClose={() => setTemplatePatient(null)}
        />
      )}

      {/* ── MODAL 3: INVENTORY CONSUMPTION ── */}
      <Modal
        open={inventoryModal}
        onClose={() => setInventoryModal(false)}
        title="💊 Material yoki Dori Ishlatish (Omborxona)"
        size="md"
      >
        <div className="space-y-4 text-xs">
          {/* Search Inventory */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              className="input-field pl-9 text-xs font-semibold"
              placeholder="Material yoki dori nomini izlang..."
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
            />
          </div>

          {/* List of items */}
          <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-surface-2 rounded-xl border border-border">
            {inventoryLoading ? (
              <p className="text-center text-muted font-bold py-4">Yuklanmoqda...</p>
            ) : inventoryItems.filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase())).length === 0 ? (
              <p className="text-center text-muted font-bold py-4">Materiallar topilmadi</p>
            ) : (
              inventoryItems
                .filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase()))
                .map((item) => {
                  const isSelected = selectedInvItem?.id === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedInvItem(item)}
                      className={`p-2.5 rounded-lg cursor-pointer flex items-center justify-between border transition-all ${
                        isSelected
                          ? 'border-gold bg-gold/10 font-bold'
                          : 'border-border/60 hover:bg-surface-1'
                      }`}
                    >
                      <div>
                        <h5 className="font-extrabold text-body">{item.name}</h5>
                        <p className="text-[10px] text-muted">Mavjud qoldiq: <strong className="text-emerald">{item.quantity} {item.unit}</strong></p>
                      </div>
                      {isSelected && <span className="badge badge-gold text-[10px]">Tanlandi ✓</span>}
                    </div>
                  )
                })
            )}
          </div>

          {selectedInvItem && (
            <div className="p-3 bg-surface-2 rounded-xl border border-gold/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gold text-xs block">Ishlatiladigan miqdor:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    className="input-field text-sm font-mono font-bold w-24 py-1"
                    value={consumeAmount}
                    onChange={(e) => setConsumeAmount(e.target.value)}
                  />
                  <span className="text-xs font-bold text-muted">{selectedInvItem.unit}</span>
                </div>
              </div>

              {data?.current_patient && (
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={chargePatient}
                      onChange={(e) => setChargePatient(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-gold focus:ring-gold w-4 h-4"
                    />
                    <span>
                      Bemor (<strong className="text-amber-600 dark:text-gold font-black">{data.current_patient.first_name} {data.current_patient.last_name}</strong>) hisobiga to'lov qo'shilsin
                    </span>
                  </label>

                  {chargePatient && selectedInvItem.unit_price > 0 && (
                    <div className="flex items-center justify-between text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-emerald-500/40 shadow-inner">
                      <span className="text-slate-300 font-sans font-extrabold">To'lov eslatmasi summasi:</span>
                      <span className="text-emerald-400 font-black text-sm">
                        {((selectedInvItem.unit_price || 0) * (Number(consumeAmount) || 1)).toLocaleString()} so'm
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setInventoryModal(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all"
            >
              Bekor Qilish
            </button>

            <button
              type="button"
              disabled={!selectedInvItem || consuming || !consumeAmount || Number(consumeAmount) <= 0}
              onClick={handleConsumeInventory}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {consuming ? "Saqlanmoqda..." : "✓ Ishlatishni Tasdiqlash"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
