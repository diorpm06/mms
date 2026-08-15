import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, downloadBlob } from '../../utils/api'
import { formatMoney, paymentLabel } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import PaymentTicketModal from '../../components/PaymentTicketModal'
import PatientMedicalCardModal from '../../components/PatientMedicalCardModal'
import ReRegisterPatientModal from '../../components/ReRegisterPatientModal'
import { Btn, Icons, PageHeader, THead, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'

export default function TodayPatients() {
  const [patients, setPatients] = useState([])
  const [callingId, setCallingId] = useState(null)
  const [cabinetInput, setCabinetInput] = useState('')
  const [selectedReceiptPatient, setSelectedReceiptPatient] = useState(null)
  const [ehrPatient, setEhrPatient] = useState(null)
  const [reRegisterPatient, setReRegisterPatient] = useState(null)
  const [reissuingId, setReissuingId] = useState(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cancelPatient, setCancelPatient] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const toast = useToastStore((s) => s.add)

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

  const filteredPatients = patients.filter((p) => {
    if (entryFilter === 'live' && p.is_paper_entry) return false
    if (entryFilter === 'paper' && !p.is_paper_entry) return false

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
          <Btn variant="gold" size="sm" icon={Icons.printer} loading={downloadingPdf} onClick={handleDownloadDailyPdf}>
            Kunlik PDF Hisobot
          </Btn>
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

      {/* Table */}
      <div className="card overflow-x-auto p-0 border-cyan-500/20">
        <table className="w-full text-sm">
          <THead cols={['Talon', 'Vaqt', 'Bemor', 'Xizmat & Shifokor', 'Summa', 'Kabinet', 'Holat', 'Harakatlar']} />
          <tbody>
            {filteredPatients.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState icon="📋" message="Bugun hali bemor yo'q yoki qidiruv bo'yicha topilmadi" />
                </td>
              </tr>
            ) : (
              filteredPatients.map((p) => (
                <tr
                  key={p.id}
                  className={p.is_cancelled ? 'row-cancelled' : 'hover:bg-white/[0.02] transition-colors'}
                >
                  {/* Talon */}
                  <td className="td-cell whitespace-nowrap">
                    <span className="font-mono font-black text-cyan-300 text-sm tracking-wider whitespace-nowrap inline-block bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                      {p.ticket_number || `A-${p.id}`}
                    </span>
                  </td>

                  {/* Vaqt */}
                  <td className="td-muted text-xs whitespace-nowrap font-mono">
                    {p.created_at?.slice(11, 16)}
                  </td>

                  {/* Bemor */}
                  <td className="td-cell whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-body">{p.first_name} {p.last_name}</span>
                      {p.is_paper_entry ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">📄 Navbatchilik</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">🟢 Jonli</span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted font-mono block">{p.phone}</span>
                  </td>

                  {/* Xizmat & Shifokor — bemor bir nechta xizmat olgan bo'lsa
                      hammasi ko'rsatiladi (avval faqat bittasi ko'rinardi) */}
                  <td className="td-cell">
                    {(p.services || []).length > 1 ? (
                      <div className="space-y-0.5">
                        {p.services.map((s, i) => (
                          <div key={i} className="flex items-baseline gap-1.5">
                            <span className="font-bold text-cyan text-xs">
                              {s.service_name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}
                            </span>
                            <span className="text-[10px] text-muted font-mono">{formatMoney(s.total_price)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="font-bold block text-cyan">
                        {p.services?.[0]?.service_name || p.service_name}
                      </span>
                    )}
                    <span className="text-[11px] text-muted font-medium">{p.provider_name || '—'}</span>
                  </td>

                  {/* Summa */}
                  <td className="td-cell whitespace-nowrap">
                    <span className="accent-value font-mono font-black text-emerald">{formatMoney(p.payment_amount)}</span>
                    <span className="badge badge-gold ml-1.5 text-[10px] uppercase font-bold">{paymentLabel(p.payment_type)}</span>
                    {p.discount_amount > 0 && (
                      <span className="block text-[10px] text-amber font-bold mt-0.5">
                        🏷️ chegirma −{formatMoney(p.discount_amount)}
                      </span>
                    )}
                    {(p.services || []).length > 1 && (
                      <span className="block text-[10px] text-muted mt-0.5">
                        {p.services.length} ta xizmat
                      </span>
                    )}
                  </td>

                  {/* Kabinet */}
                  <td className="td-cell whitespace-nowrap">
                    <span className="font-bold text-xs" style={{ color: 'var(--gold)' }}>
                      {p.cabinet || '—'}
                    </span>
                  </td>

                  {/* Holat */}
                  <td className="td-cell whitespace-nowrap">
                    <StatusBadge status={p.queue_status} />
                  </td>

                  {/* Action Buttons */}
                  <td className="py-2 px-3 whitespace-nowrap text-right align-middle">
                    {p.is_cancelled ? (
                      <div className="text-right">
                        <span className="badge badge-danger text-[10px] font-black uppercase">
                          ✗ Bekor qilingan
                        </span>
                        {p.cancel_reason && (
                          <span className="block text-[10px] text-muted mt-0.5 no-underline">
                            {p.cancel_reason}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1 min-w-[250px] max-w-[280px] ml-auto">
                        {/* Karta */}
                        <Btn
                          variant="gold"
                          size="xs"
                          icon={Icons.folder}
                          onClick={() => setEhrPatient(p)}
                          title="Bemor elektron kartochkasi va retseptlari"
                        >
                          Karta
                        </Btn>

                        {/* Chek */}
                        <Btn
                          variant="amber"
                          size="xs"
                          icon={Icons.printer}
                          onClick={() => setSelectedReceiptPatient(p)}
                          title="Talon va Chekni chop etish"
                        >
                          Chek
                        </Btn>

                        {/* Chaqir / Tugatish */}
                        {p.queue_status !== 'qabulda' && p.queue_status !== 'yakunlandi' ? (
                          <Btn
                            variant="success"
                            size="xs"
                            icon={Icons.bell}
                            onClick={() => openCallModal(p)}
                            title="Xonaga chaqirish"
                          >
                            Chaqir
                          </Btn>
                        ) : p.queue_status === 'qabulda' ? (
                          <Btn
                            variant="info"
                            size="xs"
                            icon={Icons.check}
                            onClick={() => handleUpdateStatus(p.id, 'yakunlandi')}
                            title="Qabulni yakunlash"
                          >
                            Tugatish
                          </Btn>
                        ) : (
                          <div className="flex items-center justify-center text-[10px] font-bold text-muted border border-border/40 rounded-xl px-1">✓ Yakunlandi</div>
                        )}

                        {/* Qayta Yozish */}
                        <Btn
                          variant="cyan"
                          size="xs"
                          onClick={() => setReRegisterPatient(p)}
                          title="Bemorni boshqa xizmatga qayta yozish"
                        >
                          ➕ Yozish
                        </Btn>

                        {/* Qayta Navbat */}
                        <Btn
                          variant="outline"
                          size="xs"
                          icon={Icons.refresh}
                          loading={reissuingId === p.id}
                          onClick={() => handleReissueTicket(p)}
                          title="Navbati o'tib ketganda qayta navbat berish"
                        >
                          Navbat
                        </Btn>

                        {/* Bekor */}
                        <Btn
                          variant="danger"
                          size="xs"
                          icon={Icons.x}
                          onClick={() => { setCancelPatient(p); setCancelReason('') }}
                          title="To'lovni bekor qilish (yozuv saqlanadi)"
                        >
                          Bekor
                        </Btn>
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
          <div className="card max-w-sm w-full p-6 shadow-2xl" style={{ borderColor: 'rgba(6,182,212,0.4)' }}>
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

      {/* TO'LOVNI BEKOR QILISH */}
      {cancelPatient && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
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
    </div>
  )
}
