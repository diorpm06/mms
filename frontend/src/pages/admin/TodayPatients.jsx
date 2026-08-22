import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, downloadBlob } from '../../utils/api'
import { formatMoney, paymentLabel } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import PaymentTicketModal from '../../components/PaymentTicketModal'
import PatientMedicalCardModal from '../../components/PatientMedicalCardModal'
import ReRegisterPatientModal from '../../components/ReRegisterPatientModal'
import PayUnpaidServicesModal from '../../components/PayUnpaidServicesModal'
import { Btn, Icons, PageHeader, THead, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'
import ActionMenu from '../../components/ActionMenu'

export default function TodayPatients() {
  const [patients, setPatients] = useState([])
  const [callingId, setCallingId] = useState(null)
  const [cabinetInput, setCabinetInput] = useState('')
  const [selectedReceiptPatient, setSelectedReceiptPatient] = useState(null)

  // Bir odamni tanish uchun kalit: telefon bo'lsa telefon, aks holda
  // ism/familiya va tug'ilgan sana (hisobotlardagi bilan bir xil qoida).
  const odamKaliti = (p) => {
    const tel = (p.phone || '').trim()
    if (tel && tel !== '+998') return `tel:${tel}`
    return `ism:${(p.first_name || '').trim().toLowerCase()}|${(p.last_name || '').trim().toLowerCase()}|${p.birth_date || ''}`
  }

  // Chekni ochadi. Bemor kun davomida bir necha marta kassaga kelgan bo'lsa
  // (alohida cheklar), hammasi BITTA chekka yig'iladi va umumiy summa
  // ko'rsatiladi. Ilgari har bir kelish alohida chek bo'lib chiqardi.
  // Chekni ochadi: Bosilgan alohida xizmat qatori uchun aynan o'sha xizmat cheki chiqariladi
  const chekniOch = (p) => {
    setSelectedReceiptPatient(p)
  }

  // Barcha bugungi xizmatlarini bitta chekka yig'ib chiqarish
  const chekniBirlashtiribOch = (p) => {
    const kalit = odamKaliti(p)
    const hammasi = (patients || []).filter(
      (x) => !x.is_cancelled && odamKaliti(x) === kalit
    )
    if (hammasi.length <= 1) {
      setSelectedReceiptPatient(p)
      return
    }
    const yig = (maydon) => hammasi.reduce((s, x) => s + (x[maydon] || 0), 0)
    setSelectedReceiptPatient({
      ...p,
      batch: true,
      patients: hammasi,
      total_amount: yig('payment_amount'),
      cash_amount: yig('cash_amount'),
      card_amount: yig('card_amount'),
      click_amount: yig('click_amount'),
      qr_amount: yig('qr_amount'),
    })
  }
  const [ehrPatient, setEhrPatient] = useState(null)
  const [reRegisterPatient, setReRegisterPatient] = useState(null)
  const [payUnpaidPatient, setPayUnpaidPatient] = useState(null)
  const [reissuingId, setReissuingId] = useState(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cancelPatient, setCancelPatient] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [editForm, setEditForm] = useState({ referrer_id: '', payment_type: '', reason: '' })
  const [editServices, setEditServices] = useState([])
  const [allServices, setAllServices] = useState([])
  const [addServiceId, setAddServiceId] = useState('')
  const [referrers, setReferrers] = useState([])
  const [saving, setSaving] = useState(false)
  const toast = useToastStore((s) => s.add)

  const openEdit = (p) => {
    setEditPatient(p)
    const paidAmt = Math.max(0, (p.payment_amount || 0))
    const initialCash = p.cash_amount ?? (p.payment_type === 'cash' ? paidAmt : p.payment_type === 'split' ? Math.round(paidAmt / 2) : 0)
    const initialCard = p.card_amount ?? (p.payment_type === 'split' ? paidAmt - initialCash : (p.payment_type !== 'cash' && p.payment_type !== 'later') ? paidAmt : 0)

    setEditForm({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      birth_date: p.birth_date ? p.birth_date.slice(0, 10) : '',
      phone: p.phone || '+998',
      address: p.address || '',
      referrer_id: p.referrer_id || '',
      payment_type: p.payment_type || 'cash',
      cash_amount: initialCash,
      card_amount: initialCard,
      click_amount: p.click_amount || 0,
      qr_amount: p.qr_amount || 0,
      discount_amount: p.discount_amount || 0,
      discount_reason: p.discount_reason || '',
      reason: '',
    })
    // Bemorning hozirgi xizmatlari (tahrirlash uchun nusxa)
    setEditServices(
      (p.services || []).map((s) => ({
        service_id: s.service_id,
        service_name: s.service_name,
        quantity: s.quantity || 1,
        price: s.unit_price ?? s.total_price,
        department_name: s.department_name || s.category || '',
      }))
    )
    setAddServiceId('')
    if (!referrers.length) api('/referrers').then(setReferrers).catch(() => {})
    if (!allServices.length) api('/services').then(setAllServices).catch(() => {})
  }

  const removeEditService = (i) =>
    setEditServices((prev) => prev.filter((_, idx) => idx !== i))

  const changeEditQty = (i, q) =>
    setEditServices((prev) => prev.map((s, idx) =>
      idx === i ? { ...s, quantity: Math.max(1, Number(q) || 1) } : s))

  const addEditService = (sid) => {
    if (!sid) return
    const svc = allServices.find((x) => String(x.id) === String(sid))
    if (!svc) return
    setEditServices((prev) => [
      ...prev,
      {
        service_id: svc.id,
        service_name: svc.name,
        quantity: 1,
        price: svc.price,
        department_name: svc.department_name || svc.category || '',
      },
    ])
    setAddServiceId('')
  }

  const editTotal = editServices.reduce(
    (a, s) => a + (Number(s.price) || 0) * (Number(s.quantity) || 1), 0)

  // Yo'naltiruvchi yoki to'lov turi xato kiritilgan bo'lsa tuzatish uchun.
  // Backend pul taqsimotini avtomatik qayta hisoblaydi (yo'naltiruvchi
  // ulushi, shifokor ulushi va kassa balansi to'g'rilanadi).
  const handleSaveEdit = async () => {
    if (editForm.reason.trim().length < 3) {
      toast("O'zgartirish sababini yozing (kamida 3 harf)", 'error')
      return
    }
    if (!editServices.length) {
      toast('Kamida bitta xizmat qolishi kerak', 'error')
      return
    }

    const discAmt = Math.max(0, Number(editForm.discount_amount) || 0)
    const totalToPay = Math.max(0, editTotal - discAmt)
    let cashAmt = Number(editForm.cash_amount) || 0
    let cardAmt = Number(editForm.card_amount) || 0
    let clickAmt = Number(editForm.click_amount) || 0
    let qrAmt = Number(editForm.qr_amount) || 0

    if (editForm.payment_type === 'split') {
      if (cashAmt < 0 || cardAmt < 0 || clickAmt < 0 || qrAmt < 0) {
        toast("Aralash to'lov miqdorini to'g'ri kiriting", 'error')
        return
      }
      const sumEntered = cashAmt + cardAmt + clickAmt + qrAmt
      if (sumEntered !== totalToPay) {
        toast(`Kiritilgan to'lovlar yig'indisi (${formatMoney(sumEntered)}) to'lanadigan summa (${formatMoney(totalToPay)})ga teng bo'lishi kerak!`, 'error')
        return
      }
    } else if (editForm.payment_type === 'cash') {
      cashAmt = totalToPay
      cardAmt = 0; clickAmt = 0; qrAmt = 0
    } else if (editForm.payment_type === 'later') {
      cashAmt = 0; cardAmt = 0; clickAmt = 0; qrAmt = 0
    } else if (editForm.payment_type === 'click') {
      cashAmt = 0; cardAmt = 0; qrAmt = 0; clickAmt = totalToPay
    } else if (editForm.payment_type === 'qr') {
      cashAmt = 0; cardAmt = 0; clickAmt = 0; qrAmt = totalToPay
    } else {
      cashAmt = 0; clickAmt = 0; qrAmt = 0
      cardAmt = totalToPay
    }

    setSaving(true)
    try {
      await api(`/patients/${editPatient.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: editForm.first_name.trim(),
          // Bu maydonlar bazada bo'sh bo'lishi mumkin, lekin NULL emas.
          // Ilgari null yuborilardi va familiyasi yo'q bemorni saqlashda
          // server xato berardi.
          last_name: editForm.last_name?.trim() || '',
          birth_date: editForm.birth_date || null,
          phone: editForm.phone?.trim() || '',
          address: editForm.address?.trim() || '',
          referrer_id: (editForm.referrer_id && Number(editForm.referrer_id) > 0) ? Number(editForm.referrer_id) : null,
          payment_type: editForm.payment_type,
          discount_amount: discAmt,
          discount_reason: editForm.discount_reason?.trim() || null,
          cash_amount: cashAmt,
          card_amount: cardAmt,
          click_amount: clickAmt,
          qr_amount: qrAmt,
          services: editServices.map((s) => ({
            service_id: s.service_id,
            quantity: s.quantity,
            price: Number(s.price) || 0,
          })),
          reason: editForm.reason.trim(),
        }),
      })
      toast("Saqlandi — pul taqsimoti qayta hisoblandi")
      setEditPatient(null)
      fetchPatients()
    } catch (e) {
      toast(e.message || 'Saqlashda xatolik', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Bemor to'lovdan keyin voz kechsa: yozuv o'chmaydi, "bekor qilingan"
  // holatiga o'tadi va pul (klinika, shifokor, yo'naltiruvchi ulushi)
  // avtomatik qaytariladi.
  const handleCancelPayment = async () => {
    if (cancelReason.trim().length < 3) {
      toast('Bekor qilish sababini yozing (kamida 3 harf)', 'error')
      return
    }
    setCancelling(true)
    try {
      await api(`/patients/${cancelPatient.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      toast("To'lov bekor qilindi — yozuv saqlanib qoldi")
      setCancelPatient(null)
      setCancelReason('')
      fetchPatients()
    } catch (e) {
      toast(e.message || 'Bekor qilishda xatolik', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const handleDownloadDailyPdf = async () => {
    setDownloadingPdf(true)
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const blob = await api(`/reports/export/pdf?type=daily&date=${todayStr}`)
      downloadBlob(blob, `Kunlik_Hisobot_${todayStr}.pdf`)
      toast("✓ Kunlik PDF Hisobot yuklab olindi!")
    } catch (e) {
      toast(e.message || "PDF hisobot yuklashda xatolik", 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const fetchPatients = () => {
    api('/patients/today').then(setPatients).catch(() => {})
  }

  useEffect(() => {
    fetchPatients()
    const t = setInterval(fetchPatients, 10000)
    return () => clearInterval(t)
  }, [])

  const handleUpdateStatus = async (patientId, newStatus, cabinet = null) => {
    try {
      await api(`/queue/${patientId}/status`, {
        method: 'POST',
        body: JSON.stringify({ queue_status: newStatus, cabinet }),
      })
      setCallingId(null)
      setCabinetInput('')
      fetchPatients()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleReissueTicket = async (patient) => {
    setReissuingId(patient.id)
    try {
      const res = await api(`/patients/${patient.id}/reissue-ticket`, { method: 'POST' })
      toast(`✓ Qayta navbat berildi: ${res.ticket_number}`)
      setSelectedReceiptPatient(res)
      fetchPatients()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setReissuingId(null)
    }
  }

  const openCallModal = (patient) => {
    setCallingId(patient.id)
    setCabinetInput(patient.cabinet || `${patient.provider_name || '1'}-xona`)
  }

  const [entryFilter, setEntryFilter] = useState('all') // 'all' | 'live' | 'paper'
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all') // 'all' | 'split' | 'click' | 'cash' | 'card' | 'later'
  const [bolimFilter, setBolimFilter] = useState('all')

  // Bo'lim nomi "Laboratoriya: GORMONLAR" ko'rinishida bo'lishi mumkin —
  // filtr uchun faqat asosiy qismini olamiz
  const asosiyBolim = (p) => {
    const raw = (p.service_category || p.category || '').trim()
    if (!raw) return 'Boshqa'
    return raw.includes(':') ? raw.split(':')[0].trim() : raw
  }

  // Bugungi bemorlarda uchragan bo'limlar — bo'sh tugma chiqmasligi uchun
  const bolimlar = [...new Set(patients.map(asosiyBolim))].sort((a, b) => a.localeCompare(b))

  const filteredPatients = patients.filter((p) => {
    if (entryFilter === 'live' && p.is_paper_entry) return false
    if (entryFilter === 'paper' && !p.is_paper_entry) return false
    if (paymentTypeFilter !== 'all' && (p.payment_type || '').toLowerCase() !== paymentTypeFilter) return false
    if (bolimFilter !== 'all' && asosiyBolim(p) !== bolimFilter) return false

    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (p.first_name || '').toLowerCase().includes(q) ||
      (p.last_name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q) ||
      (p.ticket_number || '').toLowerCase().includes(q) ||
      (p.service_name || '').toLowerCase().includes(q)
    )
  })

  // Stats
  const total     = patients.length
  const liveCount = patients.filter(p => !p.is_paper_entry).length
  const paperCount= patients.filter(p => p.is_paper_entry).length
  const waiting   = patients.filter(p => p.queue_status === 'kutmoqda').length
  const inRoom    = patients.filter(p => p.queue_status === 'qabulda').length
  const done      = patients.filter(p => p.queue_status === 'yakunlandi').length

  return (
    <div className="space-y-5">
      {selectedReceiptPatient && (
        <PaymentTicketModal
          open={!!selectedReceiptPatient}
          patient={selectedReceiptPatient}
          onClose={() => setSelectedReceiptPatient(null)}
        />
      )}

      {ehrPatient && (
        <PatientMedicalCardModal
          patient={ehrPatient}
          onClose={() => setEhrPatient(null)}
        />
      )}

      {reRegisterPatient && (
        <ReRegisterPatientModal
          open={!!reRegisterPatient}
          patient={reRegisterPatient}
          onClose={() => setReRegisterPatient(null)}
          onSuccess={(newPatient) => {
            fetchPatients()
            setSelectedReceiptPatient(newPatient)
          }}
        />
      )}

      <PageHeader
        title="Bugungi Bemorlar va Navbat"
        subtitle="Navbatni boshqarish, xonaga chaqirish va chek chop etish"
        icon={Icons.list}
      >
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="🔎 Qidirish (Ism, Tel, Talon)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field text-xs py-2 min-w-[200px]"
          />
          <Btn variant="ghost" size="sm" icon={Icons.refresh} onClick={fetchPatients}>
            Yangilash
          </Btn>
        </div>
      </PageHeader>

      {/* FILTER TABS: JONLI VS NAVBATCHILIK */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-surface-2 rounded-2xl border border-border">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEntryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              entryFilter === 'all'
                ? 'bg-gold text-slate-950 shadow-md font-black'
                : 'bg-surface text-muted hover:text-body border border-border'
            }`}
          >
            📋 Barcha Bemorlar ({total})
          </button>
          <button
            type="button"
            onClick={() => setEntryFilter('live')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              entryFilter === 'live'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-surface text-emerald-400 hover:text-emerald-300 border border-border'
            }`}
          >
            🟢 Jonli Kelganlar ({liveCount})
          </button>
          <button
            type="button"
            onClick={() => setEntryFilter('paper')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              entryFilter === 'paper'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-surface text-amber-400 hover:text-amber-300 border border-border'
            }`}
          >
            📄 Navbatchilik / Qog'oz Jurnali ({paperCount})
          </button>
        </div>

        <div className="text-[11px] font-bold text-muted px-2">
          {entryFilter === 'live' && "Faqat bugun klinikaga jonli kelgan bemorlar ko'rsatilmoqda"}
          {entryFilter === 'paper' && "Faqat navbatchilik/qog'oz jurnalidan kiritilgan bemorlar ko'rsatilmoqda"}
          {entryFilter === 'all' && `Jonli: ${liveCount} ta | Navbatchilik: ${paperCount} ta`}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Jami Bemorlar', value: total,  color: 'var(--text)' },
          { label: '🟢 Jonli Qabul', value: liveCount, color: '#34d399' },
          { label: '📄 Navbatchilik', value: paperCount, color: '#fbbf24' },
          { label: '⏳ Kutmoqda', value: waiting, color: 'var(--gold)' },
          { label: '✓ Yakunlandi', value: done,   color: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} className="card-2 flex flex-col items-center py-3">
            <span className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs text-muted mt-0.5 font-bold uppercase">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Bo'lim bo'yicha filtr — faqat bugun uchragan bo'limlar chiqadi */}
      {bolimlar.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface-2/80 rounded-2xl border border-border">
          <span className="text-xs font-bold text-muted px-2">Bo'lim bo'yicha:</span>
          {['all', ...bolimlar].map((b) => {
            const count = b === 'all' ? patients.length : patients.filter((p) => asosiyBolim(p) === b).length
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBolimFilter(b)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  bolimFilter === b
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black scale-105'
                    : 'bg-surface-1 text-muted hover:text-body hover:bg-surface-2'
                }`}
              >
                {b === 'all' ? 'Barchasi' : b}{' '}
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 font-mono">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* To'lov turi bo'yicha tezkor filtrlar */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface-2/80 rounded-2xl border border-border">
        <span className="text-xs font-bold text-muted px-2">To'lov turi bo'yicha:</span>
        {[
          { id: 'all', label: 'Barchasi' },
          { id: 'split', label: '🔀 Aralash' },
          { id: 'click', label: '📱 Click / Payme' },
          { id: 'cash', label: '💵 Naqd' },
          { id: 'card', label: '💳 Karta / QR' },
          { id: 'later', label: '⏳ Nasiya' },
        ].map((f) => {
          const count = f.id === 'all'
            ? patients.length
            : patients.filter((p) => {
                const pt = (p.payment_type || '').toLowerCase()
                if (f.id === 'card') return pt === 'card' || pt === 'karta' || pt === 'qr'
                return pt === f.id
              }).length
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setPaymentTypeFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                paymentTypeFilter === f.id
                  ? 'bg-gold text-slate-950 shadow-md font-black scale-105'
                  : 'bg-surface-1 text-muted hover:text-body hover:bg-surface-2'
              }`}
            >
              {f.label}{' '}
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 font-mono">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0 border-cyan-500/20">
        <table className="w-full text-xs">
          <THead cols={['Talon / Vaqt', 'Bemor', 'Xizmat & Shifokor', 'Summa', 'Kabinet & Holat', 'Amallar']} />
          <tbody className="divide-y divide-border">
            {filteredPatients.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon="📋" message="Bugun hali bemor yo'q yoki qidiruv bo'yicha topilmadi" />
                </td>
              </tr>
            ) : (
              <>
                {/* 1. JONLI BEMORLAR RO'YXATI */}
                {filteredPatients.filter((p) => !p.is_paper_entry).map((p) => (
                  <tr
                    key={p.id}
                    className={p.is_cancelled ? 'row-cancelled' : 'hover:bg-white/[0.02] transition-colors'}
                  >
                    {/* Talon & Vaqt */}
                    <td className="p-2 text-center w-24">
                      <span className="font-mono font-black text-cyan-300 text-xs tracking-wider inline-block bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                        {p.ticket_number || `A-${p.id}`}
                      </span>
                      <span className="text-[10px] text-muted font-mono block mt-0.5">
                        {p.created_at ? (
                          p.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)
                            ? p.created_at.slice(11, 16)
                            : `${p.created_at.slice(8, 10)}.${p.created_at.slice(5, 7)} ${p.created_at.slice(11, 16)}`
                        ) : '—'}
                      </span>
                    </td>

                    {/* Bemor */}
                    <td className="p-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-body text-xs">{p.first_name} {p.last_name}</span>
                          <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">🟢 Jonli</span>
                        </div>
                        <span className="text-[10px] text-muted font-mono block">{p.phone || '—'}</span>
                      </div>
                    </td>

                    {/* Xizmat & Shifokor */}
                    <td className="p-2 max-w-[200px]">
                      {(() => {
                        const list = p.services || []
                        if (list.length > 2) {
                          const firstTwo = list.slice(0, 2)
                          const remaining = list.length - 2
                          const allNames = list.map((s) => `${s.service_name}${s.quantity > 1 ? ` (x${s.quantity})` : ''}`).join(', ')
                          return (
                            <div className="space-y-0.5" title={allNames}>
                              {firstTwo.map((s, i) => (
                                <span key={i} className="font-bold text-cyan text-xs block leading-tight truncate">
                                  {s.service_name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}
                                </span>
                              ))}
                              <span className="inline-block mt-0.5 text-[10px] font-black text-gold bg-gold/10 border border-gold/30 px-1.5 py-0.5 rounded cursor-help">
                                +{remaining} ta xizmat
                              </span>
                            </div>
                          )
                        }
                        if (list.length > 1) {
                          return (
                            <div className="space-y-0.5">
                              {list.map((s, i) => (
                                <span key={i} className="font-bold text-cyan text-xs block leading-tight truncate">
                                  {s.service_name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}
                                </span>
                              ))}
                            </div>
                          )
                        }
                        return (
                          <span className="font-bold text-cyan text-xs block leading-tight truncate">
                            {list[0]?.service_name || p.service_name}
                          </span>
                        )
                      })()}
                      <span className="text-[10px] text-muted font-semibold block truncate">
                        👨‍⚕️ {p.provider_name || p.provider?.full_name || '—'}
                      </span>
                    </td>

                    {/* Summa */}
                    <td className="p-2">
                      <div className="font-mono text-xs">
                        <span className="font-extrabold text-gold block">{formatMoney(p.payment_amount)}</span>
                        <span className="text-[10px] text-muted block font-semibold">{paymentLabel(p.payment_type)}</span>
                      </div>
                    </td>

                    {/* Kabinet & Holat */}
                    <td className="p-2">
                      <div className="space-y-1">
                        <StatusBadge status={p.queue_status} />
                        {p.cabinet && (
                          <span className="text-[10px] text-muted block font-semibold">🚪 {p.cabinet}</span>
                        )}
                      </div>
                          (p.card_amount || 0) > 0 && `${formatMoney(p.card_amount)} K`,
                          (p.click_amount || 0) > 0 && `${formatMoney(p.click_amount)} Cl`,
                          (p.qr_amount || 0) > 0 && `${formatMoney(p.qr_amount)} QR`,
                        ].filter(Boolean).join(' + ')}
                      </span>
                    )}
                    {p.discount_amount > 0 && (
                      <span className="block text-[9px] text-amber font-bold">
                        🏷️ chegirma −{formatMoney(p.discount_amount)}
                      </span>
                    )}
                  </td>

                  {/* Kabinet & Holat */}
                  <td className="p-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-amber">{p.cabinet || '—'}</span>
                      <StatusBadge status={p.queue_status} />
                    </div>
                  </td>

                  {/* Fast Action Button + 3 Dots Menu */}
                  <td className="p-2 text-right align-middle">
                    {p.is_cancelled ? (
                      <span className="badge badge-danger text-[9px] font-black uppercase">
                        ✗ Bekor qilingan
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Btn
                          variant="amber"
                          size="xs"
                          icon={Icons.printer}
                          onClick={() => chekniOch(p)}
                          title="Talon va Chekni chop etish (bugungi barcha to'lovlari bitta chekda)"
                        >
                          Chek
                        </Btn>

                        <ActionMenu
                          items={[
                            {
                              label: 'Ushbu xizmat cheki',
                              icon: Icons.printer,
                              onClick: () => chekniOch(p),
                            },
                            {
                              label: 'Barcha xizmatlar cheki (Birlashtirilgan)',
                              icon: Icons.printer,
                              variant: 'gold',
                              onClick: () => chekniBirlashtiribOch(p),
                            },
                            {
                              label: "💳 Xizmatlar uchun to'lov (Chek chiqarish)",
                              icon: Icons.cash,
                              variant: 'gold',
                              onClick: () => setPayUnpaidPatient(p),
                            },
                            p.queue_status !== 'qabulda' && p.queue_status !== 'yakunlandi' ? {
                              label: 'Xonaga chaqirish',
                              icon: Icons.bell,
                              variant: 'success',
                              onClick: () => openCallModal(p),
                            } : p.queue_status === 'qabulda' ? {
                              label: 'Qabulni yakunlash',
                              icon: Icons.check,
                              variant: 'cyan',
                              onClick: () => handleUpdateStatus(p.id, 'yakunlandi'),
                            } : null,
                            {
                              label: 'Bemor kartasi',
                              icon: Icons.folder,
                              variant: 'gold',
                              onClick: () => setEhrPatient(p),
                            },
                            {
                              label: 'Boshqa xizmatga yozish',
                              icon: Icons.plus,
                              onClick: () => setReRegisterPatient(p),
                            },
                            {
                              label: 'Qayta navbat berish',
                              icon: Icons.refresh,
                              onClick: () => handleReissueTicket(p),
                            },
                            {
                              label: 'Tahrirlash',
                              icon: Icons.edit,
                              onClick: () => openEdit(p),
                            },
                            {
                              label: "To'lovni bekor qilish",
                              icon: Icons.cancel,
                              variant: 'danger',
                              onClick: () => { setCancelPatient(p); setCancelReason('') },
                            },
                          ].filter(Boolean)}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Call modal */}
      {callingId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain" style={{ borderColor: 'rgba(6,182,212,0.4)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-xl p-2" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9' }}>
                {Icons.bell}
              </div>
              <div>
                <h3 className="font-bold text-base">Xonaga Chaqirish</h3>
                <p className="text-xs text-muted">Qaysi kabinet/xonaga chaqirasiz?</p>
              </div>
            </div>

            <label className="form-label">Kabinet / Xona nomi</label>
            <input
              type="text"
              value={cabinetInput}
              onChange={(e) => setCabinetInput(e.target.value)}
              placeholder="Masalan: 1-Xona (UZI)"
              className="input-field mb-4 font-semibold"
              style={{ color: 'var(--gold)' }}
              autoFocus
            />

            <div className="flex gap-2">
              <Btn variant="ghost" full onClick={() => setCallingId(null)} icon={Icons.x}>
                Bekor
              </Btn>
              <Btn
                variant="success"
                full
                icon={Icons.bell}
                onClick={() => handleUpdateStatus(callingId, 'qabulda', cabinetInput)}
              >
                Chaqirish
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* YOZUVNI TAHRIRLASH (yo'naltiruvchi / to'lov turi) */}
      {editPatient && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain">
            <div>
              <h3 className="text-lg font-black text-gold">Bemor Ma'lumotlarini Tahrirlash</h3>
              <p className="text-xs text-muted mt-1">
                <strong className="text-body">{editPatient.first_name} {editPatient.last_name}</strong>
                {' — '}{formatMoney(editPatient.payment_amount)} · {editPatient.ticket_number}
              </p>
            </div>

            {/* BEMOR SHAXSIY MA'LUMOTLARI (Ism, Familiya, Tug'ilgan sanasi, Telefon, Manzil) */}
            <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-3 shadow-inner">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-400 block border-b border-border/40 pb-1.5">
                👤 Bemor Shaxsiy Ma'lumotlari
              </span>
              
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Ism *</label>
                  <input
                    type="text"
                    className="input-field text-xs font-bold"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    placeholder="Ism"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Familiya</label>
                  <input
                    type="text"
                    className="input-field text-xs font-bold"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    placeholder="Familiya"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Tug'ilgan sanasi / yili</label>
                  <input
                    type="date"
                    className="input-field text-xs font-bold"
                    value={editForm.birth_date}
                    onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Telefon raqami</label>
                  <input
                    type="text"
                    className="input-field text-xs font-bold font-mono"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+998"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">Yashash manzili</label>
                <input
                  type="text"
                  className="input-field text-xs font-medium"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Masalan: Urganch shahar"
                />
              </div>
            </div>

            {/* XIZMATLAR */}
            <div>
              <label className="form-label font-bold">Xizmatlar</label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {editServices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-2 border border-border">
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="text-xs font-bold text-body truncate">{s.service_name}</div>
                      {(s.department_name || s.category) && (
                        <div className="text-[10px] font-semibold text-cyan-400 truncate">
                          📁 {s.department_name || s.category}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={s.quantity}
                        onChange={(e) => changeEditQty(i, e.target.value)}
                        className="w-12 px-1 py-1 rounded-lg bg-surface border border-border text-center text-xs font-mono font-bold"
                        title="Soni"
                      />
                      <span className="text-xs font-mono font-bold text-emerald whitespace-nowrap">
                        {formatMoney((Number(s.price) || 0) * (Number(s.quantity) || 1))}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEditService(i)}
                        className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition-all shrink-0 ml-1"
                        title="Olib tashlash"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {!editServices.length && (
                  <p className="text-[11px] text-rose-400 italic">Xizmat qolmadi — kamida bittasi kerak</p>
                )}
              </div>

              <select
                className="input-field text-xs mt-2 font-bold"
                value={addServiceId}
                onChange={(e) => addEditService(e.target.value)}
              >
                <option value="">+ Xizmat qo'shish (bo'limlar bo'yicha)...</option>
                {Object.entries(
                  allServices
                    .filter((x) => x.is_active !== false)
                    .reduce((acc, s) => {
                      const dept = s.department_name || s.category || "Boshqa bo'limlar"
                      if (!acc[dept]) acc[dept] = []
                      acc[dept].push(s)
                      return acc
                    }, {})
                ).map(([deptName, deptServices]) => (
                  <optgroup key={deptName} label={`📂 ${deptName.toUpperCase()}`}>
                    {deptServices.map((x) => (
                      <option key={x.id} value={x.id}>
                        [📁 {deptName}] {x.name} — {formatMoney(x.price)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <div className="flex justify-between mt-2 pt-2 border-t border-border text-xs font-bold">
                <span className="text-muted">Xizmatlar jami summasi:</span>
                <span className="font-mono text-body">{formatMoney(editTotal)}</span>
              </div>

              {/* Editable Discount Section */}
              <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-surface-2 rounded-xl border border-amber-500/30">
                <div>
                  <label className="text-[11px] font-bold text-amber-400 block mb-1">🏷️ Chegirma Summasi (so'm)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.discount_amount}
                    onChange={(e) => {
                      const dVal = Math.max(0, Number(e.target.value) || 0)
                      const newToPay = Math.max(0, editTotal - dVal)
                      setEditForm({
                        ...editForm,
                        discount_amount: dVal,
                        cash_amount: editForm.payment_type === 'cash' ? newToPay : editForm.cash_amount,
                        card_amount: editForm.payment_type === 'card' ? newToPay : editForm.card_amount,
                      })
                    }}
                    placeholder="0"
                    className="input-field text-xs font-mono font-bold text-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted block mb-1">Chegirma Sababi</label>
                  <input
                    type="text"
                    value={editForm.discount_reason}
                    onChange={(e) => setEditForm({ ...editForm, discount_reason: e.target.value })}
                    placeholder="Masalan: avval to'lagan"
                    className="input-field text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-between text-xs font-black pt-1">
                <span>Yakuniy To'lanadigan Summa:</span>
                <span className="font-mono text-emerald text-sm font-extrabold">
                  {formatMoney(Math.max(0, editTotal - (Number(editForm.discount_amount) || 0)))}
                </span>
              </div>
            </div>

            <div>
              <label className="form-label font-bold">Yo'naltiruvchi</label>
              <select
                className="input-field text-sm"
                value={editForm.referrer_id}
                onChange={(e) => setEditForm({ ...editForm, referrer_id: e.target.value })}
              >
                <option value="">— Yo'naltiruvchi yo'q</option>
                {referrers.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label font-bold">To'lov turi</label>
              <select
                className="input-field text-sm font-bold"
                value={editForm.payment_type}
                onChange={(e) => {
                  const newType = e.target.value
                  const totalToPay = Math.max(0, editTotal - (editPatient?.discount_amount || 0))
                  setEditForm({
                    ...editForm,
                    payment_type: newType,
                    cash_amount: newType === 'cash' ? totalToPay : 0,
                    card_amount: newType === 'card' ? totalToPay : 0,
                    click_amount: newType === 'click' ? totalToPay : 0,
                    qr_amount: newType === 'qr' ? totalToPay : 0,
                  })
                }}
              >
                <option value="cash">💵 Naqd</option>
                <option value="card">💳 Karta / QR (Terminal & Bank)</option>
                <option value="click">📱 Click / Payme</option>
                <option value="split">🔀 Aralash (Naqd + Karta/QR)</option>
                <option value="later">⏳ Keyinroq (nasiya)</option>
              </select>
            </div>

            {/* ARALASH TO'LOV BULINISHI */}
            {editForm.payment_type === 'split' && (
              <div className="p-3.5 rounded-2xl border border-gold/40 bg-gold/5 space-y-3 animate-in fade-in">
                <span className="text-xs font-bold uppercase tracking-wider text-gold block">
                  🔀 Aralash to'lov taqsimoti
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label font-bold text-xs">💵 Naqd (so'm)</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field text-xs font-mono font-bold"
                      value={editForm.cash_amount}
                      onChange={(e) => setEditForm({ ...editForm, cash_amount: Number(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="form-label font-bold text-xs">💳 Karta (so'm)</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field text-xs font-mono font-bold"
                      value={editForm.card_amount}
                      onChange={(e) => setEditForm({ ...editForm, card_amount: Number(e.target.value) || 0 })}
                    />
                  </div>
                  
                  <div>
                    <label className="form-label font-bold text-xs">📱 Click (so'm)</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field text-xs font-mono font-bold"
                      value={editForm.click_amount}
                      onChange={(e) => setEditForm({ ...editForm, click_amount: Number(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="form-label font-bold text-xs">🔳 QR Kod (so'm)</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field text-xs font-mono font-bold"
                      value={editForm.qr_amount}
                      onChange={(e) => setEditForm({ ...editForm, qr_amount: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono font-extrabold pt-1 border-t border-gold/20 text-body">
                  <span>Yig'indi:</span>
                  <span className="text-emerald">
                    {formatMoney(Number(editForm.cash_amount || 0) + Number(editForm.card_amount || 0) + Number(editForm.click_amount || 0) + Number(editForm.qr_amount || 0))} / {formatMoney(Math.max(0, editTotal - (editPatient?.discount_amount || 0)))}
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-surface-2 border border-border text-[11px] text-muted">
              Saqlanganda pul taqsimoti qayta hisoblanadi — yo'naltiruvchi va
              shifokor ulushi hamda kassa balansi (Naqd va Karta alohida) avtomatik to'g'rilanadi.
            </div>

            <div>
              <label className="form-label font-bold">O'zgartirish sababi *</label>
              <input
                className="input-field text-sm"
                placeholder="Masalan: yo'naltiruvchi qo'shilmay qolgan edi"
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit() }}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Btn variant="ghost" full icon={Icons.x} onClick={() => setEditPatient(null)}>
                Yopish
              </Btn>
              <Btn variant="gold" full icon={Icons.save} loading={saving} onClick={handleSaveEdit}>
                Saqlash
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* TO'LOVNI BEKOR QILISH */}
      {cancelPatient && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain">
            <div>
              <h3 className="text-lg font-black text-rose-400">To'lovni bekor qilish</h3>
              <p className="text-xs text-muted mt-1">
                <strong className="text-body">{cancelPatient.first_name} {cancelPatient.last_name}</strong>
                {' — '}{formatMoney(cancelPatient.payment_amount)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-surface-2 border border-border text-[11px] text-muted space-y-1">
              <p>• Yozuv <strong className="text-body">o'chmaydi</strong> — "bekor qilingan" bo'lib turadi</p>
              <p>• Pul kassadan, shifokor va yo'naltiruvchi hisobidan qaytariladi</p>
              <p>• Hisobotlarda bu tashrif hisobga olinmaydi</p>
            </div>

            <div>
              <label className="form-label font-bold">Bekor qilish sababi *</label>
              <input
                className="input-field text-sm"
                placeholder="Masalan: bemor xizmatdan voz kechdi"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCancelPayment() }}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Btn variant="ghost" full icon={Icons.x} onClick={() => setCancelPatient(null)}>
                Yopish
              </Btn>
              <Btn variant="danger" full loading={cancelling} onClick={handleCancelPayment}>
                Ha, bekor qilinsin
              </Btn>
            </div>
          </div>
        </div>
      )}
      {payUnpaidPatient && (
        <PayUnpaidServicesModal
          open={Boolean(payUnpaidPatient)}
          patient={payUnpaidPatient}
          onClose={() => setPayUnpaidPatient(null)}
          onSuccess={() => {
            setPayUnpaidPatient(null)
            loadPatients()
          }}
        />
      )}
    </div>
  )
}
