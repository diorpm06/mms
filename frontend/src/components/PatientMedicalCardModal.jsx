import { useEffect, useState } from 'react'
import { X, FileText, Calendar, Phone, Stethoscope, User, Printer, Plus, ShieldCheck, MapPin, DollarSign, Clock, Tag } from 'lucide-react'
import { api } from '../utils/api'
import { formatMoney, formatDate } from '../utils/format'
import ReRegisterPatientModal from './ReRegisterPatientModal'
import PaymentTicketModal from './PaymentTicketModal'
import LabResultsModal from './LabResultsModal'
import PayUnpaidServicesModal from './PayUnpaidServicesModal'
import { BRAND } from '../config/brand'

export default function PatientMedicalCardModal({ patient, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ehr') // 'ehr' | 'visits'
  const [showReRegister, setShowReRegister] = useState(false)
  const [showLab, setShowLab] = useState(false)
  const [showPayUnpaid, setShowPayUnpaid] = useState(false)
  const [newTicketPatient, setNewTicketPatient] = useState(null)

  const [ticketModalData, setTicketModalData] = useState(null)

  const fetchHistory = () => {
    if (!patient) return
    setLoading(true)
    api(`/patients/${patient.id}/visits`)
      .then((res) => setHistory(res || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchHistory()
  }, [patient])

  if (!patient) return null

  const handlePrint = () => {
    const printArea = document.getElementById('patient-ehr-container')
    if (!printArea) return

    const printWindow = window.open('', '_blank', 'width=800,height=900')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bemor Elektron Tibbiy Kartasi — ${patient.first_name} ${patient.last_name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #000; background: #fff; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
            .header h2 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 12px; font-weight: bold; }
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 12px; }
            .info-box { border: 1px solid #000; padding: 8px 12px; border-radius: 6px; width: 48%; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
            th { background: #f0f0f0; font-weight: bold; }
            .section-title { font-size: 13px; font-weight: 900; text-transform: uppercase; margin: 12px 0 6px; border-bottom: 1px solid #000; padding-bottom: 2px; }
            .prescription-box { border: 1px solid #000; padding: 10px; background: #fafafa; border-radius: 6px; font-size: 12px; margin-bottom: 12px; white-space: pre-line; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
            .sig-line { width: 40%; border-top: 1px solid #000; text-align: center; paddingTop: 4px; font-weight: bold; }
            .no-print { display: none !important; }
            @media print {
              body { padding: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  const activeVisits = history.filter(h => !h.is_cancelled)
  const totalSpent = activeVisits.length > 0 
    ? activeVisits.reduce((acc, h) => acc + (h.payment_amount || 0), 0) 
    : (patient.is_cancelled ? 0 : (patient.payment_amount || 0))
  const totalVisitsCount = activeVisits.length > 0 ? activeVisits.length : 1
  const lastVisit = activeVisits.length > 0 ? activeVisits[0].created_at : patient.created_at

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="card max-w-3xl w-full p-5 sm:p-6 relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto space-y-5">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="no-print absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-1.5 rounded-xl text-muted hover:text-rose-400 hover:bg-rose-500/15 transition-all border border-border/80 bg-surface shadow-sm"
          title="Yopish"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ── EHR CONTENT CONTAINER (PRINTABLE AREA) ────────────────── */}
        <div id="patient-ehr-container" className="space-y-5">
          
          {/* Header Profile Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border card-2 p-4 pr-12">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-dim text-gold font-mono font-black text-3xl flex items-center justify-center border-2 border-border-strong shadow-lg">
                👤
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-gold uppercase tracking-wide">
                    {patient.first_name} {patient.last_name}
                  </h2>
                  <span className="badge badge-info text-[10px] font-bold font-mono">
                    #BM-{patient.id}
                  </span>
                </div>
                <p className="text-xs text-cyan font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Bemor Elektron Tibbiy Kartasi (EHR Record)
                </p>
              </div>
            </div>

            <div className="no-print flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowLab(true)}
                className="btn-cyan py-2 px-3 text-xs"
              >
                🔬 Lab Tahlillari
              </button>

              <button
                type="button"
                onClick={() => setShowReRegister(true)}
                className="btn-gold py-2 px-4 text-xs font-black"
              >
                <Plus className="h-4 w-4" />
                ➕ Qayta Xizmatga Yozish
              </button>
            </div>
          </div>

          {/* Quick Stat Counter Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card-2 p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-muted block">🏥 Jami Tashriflar</span>
              <span className="text-lg font-black text-cyan font-mono">{totalVisitsCount} marta</span>
            </div>
            <div className="card-2 p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-muted block">💰 Jami Sarflangan</span>
              <span className="text-lg font-black text-emerald font-mono">{formatMoney(totalSpent)}</span>
            </div>
            <div className="card-2 p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-muted block">⚡ So'nggi Tashrif</span>
              <span className="text-xs font-bold text-gold font-mono block mt-1">
                {lastVisit ? new Date(lastVisit).toLocaleDateString('uz-UZ') : '—'}
              </span>
            </div>
          </div>

          {/* Patient Details Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs card-2 p-3.5">
            <div>
              <span className="text-muted text-[10px] uppercase font-bold block">📞 Telefon:</span>
              <strong className="font-mono font-bold text-body">{patient.phone || '—'}</strong>
            </div>
            <div>
              <span className="text-muted text-[10px] uppercase font-bold block">🗓️ Tug'ilgan yili:</span>
              <strong className="font-mono font-bold text-body">
                {patient.birth_date ? (patient.birth_date.length >= 4 ? `${patient.birth_date.slice(0, 4)}-yil` : patient.birth_date) : '—'}
              </strong>
            </div>
            <div>
              <span className="text-muted text-[10px] uppercase font-bold block">🏠 Manzil:</span>
              <strong className="font-bold text-body">{patient.address || "Belgilanmagan"}</strong>
            </div>
            <div>
              <span className="text-muted text-[10px] uppercase font-bold block">🤝 Yo'naltiruvchi:</span>
              <strong className="font-bold text-amber">{patient.referrer_name || "To'g'ridan-to'g'ri"}</strong>
            </div>
          </div>

          {/* TABS SELECTOR */}
          <div className="no-print flex gap-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('ehr')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'ehr'
                  ? 'bg-gold text-slate-950 font-black shadow-md'
                  : 'bg-surface-2 text-muted hover:text-body border border-border'
              }`}
            >
              <FileText className="h-4 w-4" />
              🩺 Tashxislar va Retseptlar Tarixi
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visits')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'visits'
                  ? 'bg-cyan text-body font-black shadow-md'
                  : 'bg-surface-2 text-muted hover:text-body border border-border'
              }`}
            >
              <Clock className="h-4 w-4" />
              📜 Barcha Tashriflar va To'lovlar ({totalVisitsCount})
            </button>
          </div>

          {/* TAB 1: EHR MEDICAL DIAGNOSES & PRESCRIPTIONS */}
          {activeTab === 'ehr' && (
            <div className="space-y-4">
              {loading ? (
                <p className="text-xs text-muted italic text-center py-6">Yuklanmoqda...</p>
              ) : history.length === 0 && !patient.diagnosis && !patient.prescription ? (
                <div className="p-6 rounded-2xl card-2 text-center text-xs text-muted space-y-2">
                  <p className="text-sm font-bold text-body">Hali retsept yoki tashxis kiritilmagan</p>
                  <p>Shifokor qabulida bemor uchun retsept va tashxis yozilganda shu yerda saqlanadi.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current/Latest record if available */}
                  {(patient.diagnosis || patient.prescription) && (
                    <div className="p-4 rounded-2xl border border-cyan/40 bg-surface-2 shadow-md space-y-3 text-xs">
                      <div className="flex items-center justify-between font-bold border-b border-border pb-2">
                        <span className="text-cyan font-mono">
                          🗓️ Bugungi Tashrif: {patient.service_name || 'Xizmat'} ({patient.provider_name || 'Shifokor'})
                        </span>
                        <span className="text-emerald font-mono font-bold">{formatMoney(patient.payment_amount)}</span>
                      </div>
                      {patient.diagnosis && (
                        <div>
                          <span className="font-black text-cyan uppercase tracking-wider block text-[11px] mb-1">🩺 Shifokor Tashxisi:</span>
                          <p className="p-3 rounded-xl bg-surface text-body border border-border font-semibold">{patient.diagnosis}</p>
                        </div>
                      )}
                      {patient.prescription && (
                        <div>
                          <span className="font-black text-emerald uppercase tracking-wider block text-[11px] mb-1">💊 Retsept & Tavsiyalar:</span>
                          <p className="p-3 rounded-xl bg-surface text-body border border-border whitespace-pre-line font-mono font-bold leading-relaxed">{patient.prescription}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Past history entries */}
                  {history.map((h, idx) => (
                    <div key={h.id || idx} className="p-4 rounded-2xl border border-border bg-surface-2 space-y-3 text-xs">
                      <div className="flex items-center justify-between font-bold border-b border-border pb-2">
                        <span className="text-cyan flex items-center gap-1.5 font-mono">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(h.created_at).toLocaleDateString('uz-UZ')} — {h.service_name || 'Xizmat'}
                        </span>
                        <span className="text-emerald font-mono font-bold">{formatMoney(h.payment_amount)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <p><span className="text-muted">Shifokor:</span> <strong className="text-body">{h.provider_name || '—'}</strong></p>
                        <p><span className="text-muted">To'lov turi:</span> <strong className="text-gold uppercase">{h.payment_type || 'Naqd'}</strong></p>
                      </div>

                      {h.diagnosis && (
                        <div>
                          <span className="font-bold text-cyan block mb-1">🩺 Tashxis:</span>
                          <p className="p-2.5 rounded-xl bg-surface text-body border border-border font-medium">{h.diagnosis}</p>
                        </div>
                      )}

                      {h.prescription && (
                        <div>
                          <span className="font-bold text-emerald block mb-1">💊 Retsept:</span>
                          <p className="p-2.5 rounded-xl bg-surface text-body border border-border whitespace-pre-line font-mono font-semibold">{h.prescription}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VISITS & PAYMENTS TABLE (GROUPED BY DATE WITH COMBINED RECEIPT) */}
          {activeTab === 'visits' && (
            <div className="space-y-4">
              {(() => {
                const allVisits = [
                  ...(patient ? [patient] : []),
                  ...history.filter((h) => h.id !== patient?.id),
                ]

                if (allVisits.length === 0) {
                  return (
                    <div className="p-6 rounded-2xl card-2 text-center text-xs text-muted">
                      Hali tashriflar tarixi mavjud emas
                    </div>
                  )
                }

                // Group all visits by formatted date YYYY-MM-DD
                const groupedByDate = allVisits.reduce((acc, v) => {
                  const rawDate = v.created_at || new Date().toISOString()
                  const dStr = new Date(rawDate).toLocaleDateString('uz-UZ')
                  if (!acc[dStr]) acc[dStr] = []
                  acc[dStr].push(v)
                  return acc
                }, {})

                return Object.entries(groupedByDate).map(([dateStr, dateVisits]) => {
                  const totalDayAmount = dateVisits.reduce((sum, v) => sum + (Number(v.payment_amount) || 0), 0)
                  const totalDayCash = dateVisits.reduce((sum, v) => sum + (Number(v.cash_amount) || (v.payment_type === 'cash' ? Number(v.payment_amount) : 0)), 0)
                  const totalDayCard = dateVisits.reduce((sum, v) => sum + (Number(v.card_amount) || (v.payment_type === 'card' ? Number(v.payment_amount) : 0)), 0)

                  const handlePrintCombinedDay = () => {
                    setTicketModalData({
                      batch: true,
                      patients: dateVisits,
                      total_amount: totalDayAmount,
                      cash_amount: totalDayCash,
                      card_amount: totalDayCard,
                    })
                  }

                  return (
                    <div key={dateStr} className="card-2 p-3.5 space-y-3 border border-border">
                      {/* Date Header + Combined Day Receipt Button */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🗓️</span>
                          <h4 className="text-xs font-black uppercase text-gold tracking-wide">
                            {dateStr} Kundagi Tashriflar ({dateVisits.length} ta xizmat)
                          </h4>
                          <span className="badge badge-emerald text-xs font-mono font-extrabold">
                            {formatMoney(totalDayAmount)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handlePrintCombinedDay}
                          className="btn-gold py-2 px-4 text-xs font-black flex items-center gap-2 self-start sm:self-auto shadow-md"
                          title={`${dateStr} kunidagi barcha xizmatlarni bitta hammasi yozilgan birlashtirilgan chekda chop etish`}
                        >
                          <Printer className="h-4 w-4" />
                          🧾 Hammasi bittada yozilgan chekni chiqarish
                        </button>
                      </div>

                      {/* Individual Visit Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-surface-2 border-b border-border text-gold font-bold text-[11px]">
                              <th className="p-2 text-left">Xizmat Nomi</th>
                              <th className="p-2 text-left">Shifokor</th>
                              <th className="p-2 text-right">Summa</th>
                              <th className="p-2 text-center">To'lov Turi</th>
                              <th className="p-2 text-right">Chek</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {dateVisits.map((v, i) => (
                              <tr key={v.id || i} className="hover:bg-surface-hover text-body">
                                <td className="p-2 font-extrabold text-foreground">{v.service_name || 'Xizmat'}</td>
                                <td className="p-2 text-muted">{v.provider_name || '—'}</td>
                                <td className="p-2 text-right font-mono font-bold text-emerald">{formatMoney(v.payment_amount)}</td>
                                <td className="p-2 text-center">
                                  <span className="badge badge-gold uppercase text-[10px]">{v.payment_type || 'Naqd'}</span>
                                </td>
                                <td className="p-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setTicketModalData(v)}
                                    className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan border border-cyan-500/30 text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                                    title="Faqat ushbu xizmat uchun alohida chek chiqarish"
                                  >
                                    <Printer className="h-3 w-3" />
                                    Alohida chek
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* Printable Signature Footer */}
          <div className="signatures hidden print:flex justify-between pt-10 text-xs">
            <div className="sig-line">Bosh Shifokor Imzosi / Muhr</div>
            <div className="sig-line">Qabulxona Registratori Imzosi</div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="no-print pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted">
            Kartochka avtomatik saqlangan • <b>{BRAND.name}</b>
          </div>

          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <button
              type="button"
              onClick={() => setShowPayUnpaid(true)}
              className="px-4 py-2.5 rounded-xl bg-gold/20 border border-gold/40 text-gold font-black text-xs hover:bg-gold/30 flex items-center gap-1.5"
            >
              💳 Xizmatlar uchun to'lov (Chek)
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-body font-bold text-xs"
            >
              Yopish
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-gold py-2.5 px-5 text-xs font-black flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              🖨️ Kartani Chop Etish (Print)
            </button>
          </div>
        </div>
      </div>

      {showPayUnpaid && (
        <PayUnpaidServicesModal
          open={showPayUnpaid}
          patient={patient}
          onClose={() => setShowPayUnpaid(false)}
          onSuccess={() => {
            setShowPayUnpaid(false)
            fetchHistory()
          }}
        />
      )}

      {showLab && (
        <LabResultsModal patient={patient} onClose={() => setShowLab(false)} />
      )}

      {showReRegister && (
        <ReRegisterPatientModal
          patient={patient}
          onClose={() => setShowReRegister(false)}
          onSuccess={(res) => {
            setShowReRegister(false)
            if (res?.new_patient) setNewTicketPatient(res.new_patient)
            fetchHistory()
          }}
        />
      )}

      {newTicketPatient && (
        <PaymentTicketModal
          open={Boolean(newTicketPatient)}
          patient={newTicketPatient}
          onClose={() => setNewTicketPatient(null)}
        />
      )}

      {ticketModalData && (
        <PaymentTicketModal
          open={Boolean(ticketModalData)}
          patient={ticketModalData}
          onClose={() => setTicketModalData(null)}
        />
      )}
    </div>
  )
}
