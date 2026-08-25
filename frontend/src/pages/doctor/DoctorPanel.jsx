import { useEffect, useRef, useState } from 'react'
import { api } from '../../utils/api'
import { playNotificationSound } from '../../utils/sound'
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
  const [selectedProviderId, setSelectedProviderId] = useState(() => {
    if (role === 'doctor') return null
    try {
      const saqlangan = sessionStorage.getItem('doctor-panel-provider')
      return saqlangan ? Number(saqlangan) : null
    } catch (_) {
      return null
    }
  })

  useEffect(() => {
    if (role === 'doctor') {
      setSelectedProviderId(null)
      try {
        sessionStorage.removeItem('doctor-panel-provider')
      } catch (_) {}
    }
  }, [role])

  const shifokorniTanla = (id) => {
    if (role === 'doctor') return
    setSelectedProviderId(id)
    try {
      if (id) sessionStorage.setItem('doctor-panel-provider', String(id))
      else sessionStorage.removeItem('doctor-panel-provider')
    } catch (_) {
      /* xotira ishlamasa ham panel ishlashda davom etadi */
    }
  }
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

  // Doctor KPI & Patient History Search Modals
  // KPI oynasi olib tashlandi — pul ma'lumotlari "Profilim" bo'limida
  const [historySearchModal, setHistorySearchModal] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyResults, setHistoryResults] = useState([])
  const [searchingHistory, setSearchingHistory] = useState(false)
  const [selectedHistoryPatient, setSelectedHistoryPatient] = useState(null)
  const [patientVisits, setPatientVisits] = useState([])
  const [loadingVisits, setLoadingVisits] = useState(false)

  // Audio Sound Notifications
  const prevWaitingCountRef = useRef(null)

  const handleSearchPatientHistory = async (q) => {
    setHistoryQuery(q)
    if (!q || q.trim().length < 2) {
      setHistoryResults([])
      return
    }
    setSearchingHistory(true)
    try {
      const res = await api(`/patients/search?q=${encodeURIComponent(q.trim())}`)
      setHistoryResults(res || [])
    } catch (_) {
      setHistoryResults([])
    } finally {
      setSearchingHistory(false)
    }
  }

  const handleOpenPatientVisits = async (p) => {
    setSelectedHistoryPatient(p)
    setLoadingVisits(true)
    try {
      const res = await api(`/patients/${p.id}/visits`)
      setPatientVisits(res || [])
    } catch (_) {
      setPatientVisits([])
    } finally {
      setLoadingVisits(false)
    }
  }

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
    if (data?.stats?.waiting !== undefined) {
      if (prevWaitingCountRef.current !== null && data.stats.waiting > prevWaitingCountRef.current) {
        playNotificationSound('patient_added')
        showToast('🔔 Yangi bemor navbatga qo\'shildi!')
      }
      prevWaitingCountRef.current = data.stats.waiting
    }
  }, [data?.stats?.waiting])

  useEffect(() => {
    if (!isManagement || selectedProviderId) {
      setLoading(true)
      fetchDoctorQueue()
      // Shifokorning o'z navbati — u yerda tezkorlik kerak, chunki
      // bemor eshik oldida turadi. Shuning uchun 4 -> 6 soniya, undan
      // ko'p oshirilmadi: navbat sekin yangilansa shifokor kutib qoladi.
      const interval = setInterval(fetchDoctorQueue, 6000)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
      // Shifokorlar TANLASH ekrani — bu yerda tezkorlik shart emas
      const interval = setInterval(fetchProviders, 15000)
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
              const isDr = prov.full_name?.startsWith('Dr.') || prov.full_name?.startsWith('Xona') || prov.full_name?.includes('xonasi') || prov.full_name?.includes('Xonasi')
              const displayName = isDr ? prov.full_name : `Dr. ${prov.full_name}`
              
              const specLower = (prov.specialization || '').toLowerCase()
              let cardIcon = '🩺'
              if (specLower.includes('ozon')) cardIcon = '🧪'
              else if (specLower.includes('ineks') || specLower.includes('ukol') || specLower.includes('muolaj')) cardIcon = '💉'
              else if (specLower.includes('fizio')) cardIcon = '⚡'
              else if (specLower.includes('uzi')) cardIcon = '📡'
              else if (specLower.includes('lab')) cardIcon = '🔬'

              return (
                <div
                  key={prov.id}
                  className="card hover:border-gold/50 transition-all cursor-pointer flex flex-col justify-between p-5 space-y-4 group border-border shadow-md"
                  onClick={() => shifokorniTanla(prov.id)}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0 bg-gold/15 text-gold border border-gold/30"
                        >
                          {cardIcon}
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
                        <span className="font-extrabold text-body">{doneCount} ta bemor</span>
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
                      shifokorniTanla(prov.id)
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
  // Joriy bemor Lab yoki UZI ga tegishlimi — tugmalar shunga qarab chiqadi
  const joriyShablonKat = data?.current_patient
    ? guessTemplateCategory(data.current_patient.service_category, data.current_patient.service_name)
    : null

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
        <div className="fixed top-5 right-5 z-50 bg-surface text-body px-5 py-3 rounded-xl shadow-2xl border border-cyan-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-bold">{message}</span>
        </div>
      )}

      {/* CEO / ADMIN DOCTOR SELECTOR TOP BAR */}
      {isManagement && role !== 'doctor' && providers.length > 0 && (
        <div className="card p-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-gold/40 bg-surface-2 shadow-md">
          <div className="flex items-center gap-2">
            <Btn
              variant="outline"
              size="xs"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => shifokorniTanla(null)}
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
              onChange={(e) => shifokorniTanla(+e.target.value)}
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
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {/* Utility actions — qidiruv va yangilash, asosiy amallardan ajratilgan */}
          <div className="flex items-center gap-1.5 sm:pr-2 sm:mr-1 sm:border-r border-border">
            <Btn
              variant="ghost"
              size="sm"
              icon={<Search className="h-4 w-4" />}
              onClick={() => setHistorySearchModal(true)}
              title="Bemorlar tarixini izlash"
              className="flex-1 sm:flex-none justify-center"
            >
              Bemorlar Tarixi
            </Btn>
            <button
              type="button"
              onClick={fetchDoctorQueue}
              title="Yangilash"
              className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-muted hover:text-body hover:bg-surface-2 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Ish holati boshqaruvi — ikkalasi bir xil o'lcham, aniq ajralgan */}
          <Btn
            variant={is_paused ? 'amber' : 'outline'}
            size="sm"
            icon={is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            loading={actionLoading}
            onClick={handleTogglePause}
            disabled={data?.is_shift_closed}
            className="w-full sm:w-auto justify-center"
          >
            {is_paused ? 'Qabulni Davom Ettirish' : 'Tanaffus'}
          </Btn>

          <Btn
            variant={data?.is_shift_closed ? 'success' : 'danger'}
            size="sm"
            icon={data?.is_shift_closed ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            loading={actionLoading}
            onClick={handleToggleShift}
            className="w-full sm:w-auto justify-center"
          >
            {data?.is_shift_closed ? 'Qabulni Ochish' : 'Ish Kunini Yakunlash'}
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

      {/* ── NAVBAT KO'RSATKICHLARI ──
          KPI, tushum va balans kartochkalari bu yerdan olib tashlandi —
          ular endi "Profilim" bo'limida. Bemor qabul paytida ekranga
          qarasa pul raqamlari ko'rinib qolmasligi uchun. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* COMPLETED COUNT */}
        <div className="card p-4 border-emerald-500/20 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block leading-tight">
              Yakunlangan
            </span>
            <span className="text-xl font-black font-mono text-emerald-400 leading-tight">{stats?.completed || 0} ta</span>
          </div>
        </div>

        {/* WAITING COUNT */}
        <div className="card p-4 border-amber-500/20 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/12 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block leading-tight">
              Navbatda Kutmoqda
            </span>
            <span className="text-xl font-black font-mono text-amber-400 leading-tight">{stats?.waiting || 0} ta</span>
          </div>
        </div>

        {/* TOTAL TODAY COUNT */}
        <div className="card p-4 border-purple-500/20 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/12 border border-purple-500/25 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block leading-tight">
              Bugungi Jami
            </span>
            <span className="text-xl font-black font-mono text-purple-400 leading-tight">{stats?.total_today || 0} ta</span>
          </div>
        </div>
      </div>

      {/* ── SHIFT CLOSED BANNER ── */}
      {data?.is_shift_closed && (
        <div className="card p-5 bg-rose-500/10 border-rose-500/40 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-rose-400">
              Bugungi ish kuni yakunlangan — qabul yopilgan
            </h3>
            <p className="text-xs text-muted font-medium mt-0.5">
              Tizim yangi navbat chaqirishni to'xtatgan. Qayta bemor qabul qilish uchun yuqoridagi <strong className="text-body">"Qabulni Ochish"</strong> tugmasini bosing.
            </p>
          </div>
        </div>
      )}

      {/* ── CURRENT PATIENT HERO SECTION ── */}
      <div className="card p-6 border-gold/50 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
              <Stethoscope className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h2 className="font-black text-base text-foreground">
                Hozirgi Qabuldagi Bemor
              </h2>
              <p className="text-xs text-muted font-medium">Xona: <strong className="text-gold">{cabinet || '1-Xona'}</strong></p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* RE-CALL CURRENT PATIENT BUTTON */}
            {current_patient && (
              <Btn
                variant="amber"
                size="md"
                icon={<Volume2 className="h-4 w-4" />}
                loading={actionLoading}
                disabled={data?.is_shift_closed || is_paused}
                onClick={handleRecallCurrent}
                className="font-bold justify-center w-full sm:w-auto"
                title="Hozirgi qabuldagi bemorni TV ekranda qayta chaqirish"
              >
                Qayta Chaqirish
              </Btn>
            )}

            {/* CALL NEXT BUTTON */}
            <Btn
              variant="gold"
              size="md"
              icon={<Volume2 className="h-4 w-4" />}
              loading={actionLoading}
              disabled={data?.is_shift_closed || is_paused || (stats?.waiting === 0 && !current_patient)}
              onClick={handleCallNext}
              className="font-black shadow-md justify-center w-full sm:w-auto"
            >
              Keyingi Bemorni Chaqirish
            </Btn>
          </div>
        </div>

        {current_patient ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Ticket & Name */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="badge badge-gold font-mono font-black text-lg px-3.5 py-1 shadow-sm">
                  {current_patient.ticket_number}
                </span>
                <span className="badge badge-success text-[11px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Hozir xonada
                </span>
              </div>

              <h3 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                {current_patient.first_name} {current_patient.last_name}
              </h3>

              {/* Qaysi xizmatga kelgani — shifokor uchun eng muhim ma'lumot,
                  shuning uchun kichik matn emas, ko'zga tashlanadigan chip. */}
              <div className="inline-flex items-center gap-2 bg-gold/12 border border-gold/30 rounded-xl px-3 py-1.5">
                <Stethoscope className="h-4 w-4 text-gold shrink-0" />
                <span className="text-sm font-black text-gold">{current_patient.service_name}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted font-semibold">
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-cyan shrink-0" /> {current_patient.phone}</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold"><CreditCard className="h-3.5 w-3.5 shrink-0" /> {current_patient.payment_amount?.toLocaleString()} so'm</span>
              </div>
            </div>

            {/* Joriy bemor amallari.
                Fizioterapiya uchun faqat ombordan material va qayta chaqirish.
                Lab / UZI bemorida natija blankasi, qolgan vrachlarda esa tashxis-retsept
                va laboratoriya javoblari. Ikkitadan ko'p amal bo'lsa 2 ustunli setka
                bilan chiqadi — ilgari to'liq kenglikda vertikal ustunda sig'mas edi. */}
            <div className="lg:col-span-3 flex flex-col justify-between gap-4 lg:border-l lg:border-border lg:pl-6">
              {!((specialization || '').toLowerCase().includes('massaj') || (current_patient?.service_category || '').toLowerCase().includes('massaj') || (current_patient?.service_name || '').toLowerCase().includes('massaj')) && (
                ((specialization || '').toLowerCase().match(/(fizio|физио|ozon|озон|ineks|инъек|ukol|muolaj)/i)) ? (
                  <Btn
                    variant="amber"
                    size="md"
                    icon={<Package className="h-4 w-4" />}
                    onClick={() => {
                      fetchInventory()
                      setInventoryModal(true)
                    }}
                    className="w-full font-extrabold justify-center"
                  >
                    Ombordan material yozish
                  </Btn>
                ) : joriyShablonKat ? (
                  <Btn
                    variant="gold"
                    size="md"
                    icon={<ClipboardList className="h-4 w-4" />}
                    onClick={() => setTemplatePatient(current_patient)}
                    className="w-full font-black justify-center"
                  >
                    Natija blankasini to'ldirish
                  </Btn>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Btn
                      variant="cyan"
                      size="sm"
                      icon={<FileText className="h-4 w-4" />}
                      onClick={() => openMedicalRecord(current_patient)}
                      className="w-full font-bold justify-center"
                    >
                      Tashxis / Retsept
                    </Btn>

                    <Btn
                      variant="info"
                      size="sm"
                      icon={<TestTube className="h-4 w-4" />}
                      onClick={() => setLabPatient(current_patient)}
                      className="w-full font-bold justify-center"
                    >
                      Lab javoblari
                    </Btn>

                    <Btn
                      variant="amber"
                      size="sm"
                      icon={<Package className="h-4 w-4" />}
                      onClick={() => {
                        fetchInventory()
                        setInventoryModal(true)
                      }}
                      className="w-full font-bold justify-center"
                    >
                      Material
                    </Btn>
                  </div>
                )
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-border/60">
                <Btn
                  variant="success"
                  size="md"
                  icon={<UserCheck className="h-4 w-4" />}
                  loading={actionLoading}
                  onClick={handleCompleteCurrent}
                  className="w-full sm:flex-1 font-black justify-center"
                >
                  Qabulni Yakunlash
                </Btn>

                <Btn
                  variant="outline"
                  size="md"
                  icon={<PhoneOff className="h-4 w-4" />}
                  loading={actionLoading}
                  onClick={handleSkipCurrent}
                  className="w-full sm:w-auto text-rose-400 border-rose-500/40 hover:bg-rose-500/10 font-bold justify-center"
                  title="Bemor kelmadi — navbatdan o'tkazib yuborish"
                >
                  O'tkazish
                </Btn>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto">
              <Stethoscope className="h-6 w-6 text-muted" />
            </div>
            <p className="text-muted font-bold text-sm">Hozir xonada bemor yo'q</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Navbatdagi bemorni xonaga chaqirish uchun yuqoridagi <strong className="text-body">"Keyingi Bemorni Chaqirish"</strong> tugmasini bosing.
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
                  <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-surface-2 px-2.5 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-gold text-sm w-16">
                        {p.ticket_number}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-sm text-body">{p.first_name} {p.last_name}</h4>
                        <p className="text-xs text-muted flex items-center gap-2.5">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</span>
                          <span className="flex items-center gap-1 text-cyan font-semibold"><Stethoscope className="h-3 w-3" /> {p.service_name}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!(specialization || '').toLowerCase().includes('massaj') && (
                        <Btn
                          variant="ghost"
                          size="xs"
                          icon={<FileText className="h-3.5 w-3.5" />}
                          onClick={() => openMedicalRecord(p)}
                        >
                          Karta / Retsept
                        </Btn>
                      )}

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
                  <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-surface-2 px-2.5 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-muted text-xs w-16">
                        {p.ticket_number}
                      </span>
                      <div>
                        <h4 className="font-extrabold text-sm text-body">{p.first_name} {p.last_name}</h4>
                        <p className="text-xs text-muted flex items-center gap-2.5">
                          <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {p.service_name}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.updated_at ? p.updated_at.split('T')[1]?.substring(0, 5) : '—'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs font-bold ${p.queue_status === 'yakunlandi' ? 'badge-success' : 'badge-danger'}`}>
                        {p.queue_status === 'yakunlandi' ? 'Qabul qilindi' : "O'tkazib yuborildi"}
                      </span>

                      {/* O'tkazib yuborilgan bemor keyin kelib qolsa, shifokor
                          uni qaytadan chaqira olishi kerak. Ilgari bunday
                          imkon yo'q edi — bemor navbatdan butunlay tushib
                          qolardi. */}
                      {p.queue_status !== 'yakunlandi' && (
                        <Btn
                          variant="gold"
                          size="xs"
                          icon={<Volume2 className="h-3.5 w-3.5" />}
                          loading={actionLoading}
                          disabled={data?.is_shift_closed || is_paused}
                          onClick={() => handleCallSpecific(p.id)}
                          title="Bemorni qaytadan xonaga chaqirish"
                        >
                          Qayta chaqirish
                        </Btn>
                      )}

                      {!(specialization || '').toLowerCase().includes('massaj') && (
                        <Btn
                          variant="outline"
                          size="xs"
                          icon={<FileText className="h-3.5 w-3.5" />}
                          onClick={() => setPrintableRecord(p)}
                        >
                          Blanka
                        </Btn>
                      )}
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
        size="xl"
      >
        <div className="space-y-5 text-xs p-1">
          {/* Search Inventory */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
            <input
              className="input-field pl-10 text-sm font-semibold py-2.5 rounded-xl"
              placeholder="Material yoki dori nomini izlang (masalan: spirt, shpris, paxta, gel)..."
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
            />
          </div>

          {/* List of items */}
          <div className="max-h-72 overflow-y-auto space-y-2 p-3 bg-surface-2 rounded-2xl border border-border">
            {inventoryLoading ? (
              <p className="text-center text-muted font-bold py-6">Yuklanmoqda...</p>
            ) : inventoryItems.filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase())).length === 0 ? (
              <p className="text-center text-muted font-bold py-6">Materiallar topilmadi</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {inventoryItems
                  .filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase()))
                  .map((item) => {
                    const isSelected = selectedInvItem?.id === item.id
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedInvItem(item)}
                        className={`p-3 rounded-xl cursor-pointer flex items-center justify-between border transition-all ${
                          isSelected
                            ? 'border-gold bg-gold/15 font-bold shadow-md ring-1 ring-gold/40'
                            : 'border-border/60 bg-surface-1 hover:bg-surface hover:border-gold/30'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <h5 className="font-extrabold text-body text-xs truncate">{item.name}</h5>
                          <p className="text-[11px] text-muted font-semibold mt-0.5">
                            Qoldiq: <strong className="text-emerald-400 font-mono">{item.quantity} {item.unit}</strong>
                          </p>
                        </div>
                        {isSelected && <span className="badge badge-gold text-[10px] shrink-0 font-extrabold">Tanlandi ✓</span>}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {selectedInvItem && (
            <div className="p-4 bg-surface-2 rounded-2xl border border-gold/40 space-y-4 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-extrabold text-gold text-sm block">
                    {selectedInvItem.name}
                  </span>
                  <span className="text-[11px] text-muted font-semibold">
                    Omborda bor: <strong className="text-emerald-400 font-mono">{selectedInvItem.quantity} {selectedInvItem.unit}</strong>
                  </span>
                </div>

                {/* + and - Quantity Control */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted mr-1">Hajm:</span>
                  <button
                    type="button"
                    onClick={() => setConsumeAmount((v) => String(Math.max(1, (Number(v) || 1) - 1)))}
                    className="w-9 h-9 rounded-xl bg-surface-1 hover:bg-rose-500/20 text-rose-400 border border-border flex items-center justify-center text-lg font-black transition-all active:scale-95 shadow-sm"
                    title="Kamaytirish (-1)"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="input-field text-base font-mono font-black text-center w-20 py-1.5 bg-surface-1 border-gold/50 rounded-xl"
                    value={consumeAmount}
                    onChange={(e) => setConsumeAmount(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setConsumeAmount((v) => String((Number(v) || 0) + 1))}
                    className="w-9 h-9 rounded-xl bg-surface-1 hover:bg-emerald-500/20 text-emerald-400 border border-border flex items-center justify-center text-lg font-black transition-all active:scale-95 shadow-sm"
                    title="Oshirish (+1)"
                  >
                    +
                  </button>
                  <span className="text-xs font-extrabold text-gold bg-gold/10 px-2.5 py-1.5 rounded-xl border border-gold/30">
                    {selectedInvItem.unit}
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted font-extrabold mr-1">Tezkor hajm:</span>
                {[1, 2, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setConsumeAmount(String(num))}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold transition-all ${
                      Number(consumeAmount) === num
                        ? 'bg-gold text-slate-950 border-gold shadow'
                        : 'bg-surface-1 text-muted border-border hover:text-body hover:border-gold/40'
                    }`}
                  >
                    {num} {selectedInvItem.unit}
                  </button>
                ))}
              </div>

              {data?.current_patient && (
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-slate-800 dark:text-body">
                    <input
                      type="checkbox"
                      checked={chargePatient}
                      onChange={(e) => setChargePatient(e.target.checked)}
                      className="rounded border-border bg-surface text-gold focus:ring-gold w-4 h-4"
                    />
                    <span>
                      Bemor (<strong className="text-amber-600 dark:text-gold font-black">{data.current_patient.first_name} {data.current_patient.last_name}</strong>) hisobiga to'lov qo'shilsin
                    </span>
                  </label>

                  {chargePatient && selectedInvItem.unit_price > 0 && (
                    <div className="flex items-center justify-between text-xs font-mono bg-surface-sunken p-3 rounded-xl border border-emerald-500/40 shadow-inner">
                      <span className="text-body font-sans font-extrabold">To'lov eslatmasi summasi:</span>
                      <span className="text-emerald-400 font-black text-base">
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
              className="flex-1 py-2.5 px-4 rounded-xl border border-border bg-surface-2 hover:bg-surface-hover text-body font-bold text-xs transition-all"
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

      {/* ── MODAL 5: PATIENT HISTORY SEARCH & TIMELINE ── */}
      <Modal
        open={historySearchModal}
        onClose={() => {
          setHistorySearchModal(false)
          setSelectedHistoryPatient(null)
        }}
        title="🔍 Bemorlar Tarixini Izlash va Tashriflar Arxivi"
        size="xl"
      >
        <div className="space-y-4 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
            <input
              type="text"
              className="input-field pl-10 text-xs font-bold"
              placeholder="Bemor ismi, familiyasi yoki telefon raqami bo'yicha izlang..."
              value={historyQuery}
              onChange={(e) => handleSearchPatientHistory(e.target.value)}
              autoFocus
            />
          </div>

          {selectedHistoryPatient ? (
            /* Selected Patient Visits Timeline */
            <div className="space-y-3">
              <div className="p-3 bg-surface-2 rounded-xl border border-cyan-500/40 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-cyan-400 flex items-center gap-2">
                    👤 {selectedHistoryPatient.first_name} {selectedHistoryPatient.last_name}
                  </h4>
                  <p className="text-xs text-muted font-semibold mt-0.5">
                    📱 {selectedHistoryPatient.phone || "Telefon yo'q"} • 📅 Tug'ilgan sana: {selectedHistoryPatient.birth_date || "Ko'rsatilmadi"}
                  </p>
                </div>
                <Btn
                  variant="outline"
                  size="xs"
                  icon={<ArrowLeft className="h-3.5 w-3.5" />}
                  onClick={() => setSelectedHistoryPatient(null)}
                >
                  ← Qidiruvga Qaytish
                </Btn>
              </div>

              <div>
                <h5 className="font-extrabold text-xs text-body mb-2">📜 Bemorning Barcha Tashriflari Tarixi:</h5>
                {loadingVisits ? (
                  <div className="py-8 text-center text-muted font-bold">Tashriflar tarixi yuklanmoqda...</div>
                ) : patientVisits.length === 0 ? (
                  <EmptyState icon="📜" message="Ushbu bemorning ilgarigi tashriflari topilmadi" />
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                    {patientVisits.map((v, vIdx) => (
                      <div key={v.id || vIdx} className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2">
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="badge badge-gold font-mono font-bold text-[10px]">
                              📅 {v.created_at ? v.created_at.split('T')[0] : '—'} ({v.created_at ? v.created_at.split('T')[1]?.substring(0, 5) : ''})
                            </span>
                            <span className="font-extrabold text-xs text-body">
                              🩺 {v.service_name || "Tibbiy Xizmat"}
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-emerald-400 text-xs">
                            {v.payment_amount?.toLocaleString()} so'm ({v.payment_type})
                          </span>
                        </div>

                        {/* Medical Details */}
                        {v.diagnosis && (
                          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-300 text-xs font-semibold">
                            <strong className="text-amber-400 font-extrabold">Qo'yilgan Tashxis (Diagnos):</strong> {v.diagnosis}
                          </div>
                        )}

                        {v.complaints && (
                          <div className="text-xs text-muted">
                            <strong className="text-body font-bold">Shikoyatlar:</strong> {v.complaints}
                          </div>
                        )}

                        {v.prescription && (
                          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-300 text-xs font-mono font-medium">
                            <strong className="text-emerald-400 font-sans font-bold">Tayinlangan Retsept:</strong> {v.prescription}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Search Results List */
            <div>
              {searchingHistory ? (
                <div className="py-8 text-center text-muted font-bold">Qidirilmoqda...</div>
              ) : historyResults.length === 0 ? (
                historyQuery.length >= 2 ? (
                  <EmptyState icon="🔍" message="Bemorlar topilmadi" />
                ) : (
                  <p className="text-center text-muted italic py-6">Izlash uchun kamida 2 ta harf kiriting...</p>
                )
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {historyResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleOpenPatientVisits(p)}
                      className="p-3 rounded-xl bg-surface-2 border border-border hover:border-gold/50 cursor-pointer flex items-center justify-between gap-3 transition-all"
                    >
                      <div>
                        <h4 className="font-extrabold text-xs text-body">{p.first_name} {p.last_name}</h4>
                        <p className="text-[11px] text-muted font-semibold mt-0.5">
                          📱 {p.phone || "Telefon yo'q"} • 🏠 {p.address || "Manzil ko'rsatilmadi"}
                        </p>
                      </div>
                      <Btn variant="gold" size="xs" icon={<FileText className="h-3.5 w-3.5" />}>
                        Tashriflar Tarixi ➔
                      </Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
