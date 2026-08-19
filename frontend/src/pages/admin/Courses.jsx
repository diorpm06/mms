import { useEffect, useState } from 'react'
import { CalendarCheck, Pencil, RefreshCw, Search, Undo2 } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons, PageHeader, EmptyState } from '../../components/UIKit'
import { TableSkeleton } from '../../components/Skeleton'
import PaymentTicketModal from '../../components/PaymentTicketModal'
import Modal from '../../components/Modal'

function sana(iso) {
  if (!iso) return '—'
  const [k] = iso.split('T')
  const [y, o, kun] = (k || '').split('-')
  return `${kun}.${o}.${y}`
}

export default function Courses() {
  const [rows, setRows] = useState(null)
  const [qidiruv, setQidiruv] = useState('')
  const [ishlanmoqda, setIshlanmoqda] = useState(null)
  // "Keldi" bosilgach bemorga navbat taloni chop etib beriladi
  const [talon, setTalon] = useState(null)
  
  // Tahrirlash modali
  const [editRecord, setEditRecord] = useState(null)
  const [editItems, setEditItems] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)

  const toast = useToastStore((s) => s.add)

  const yukla = async () => {
    try {
      const res = await api('/courses')
      setRows(res || [])
    } catch (e) {
      setRows([])
      toast(e.message, 'error')
    }
  }
  useEffect(() => { yukla() }, [])

  const keldi = async (r) => {
    // Bemorning shu kunlik BARCHA xizmatlari birdan belgilanadi
    const qatorlar = (r.services || [])
      .filter((x) => x.remaining > 0)
      .map((x) => `  • ${x.service_name} — ${x.quantity} kunlik kursning ${x.used_count + 1}-kuni`)
      .join('\n')
    const savol =
      `${r.patient_name}\n\n${qatorlar}\n\n` +
      `Qayta to'lov OLINMAYDI, bemor navbatga qo'yiladi.\n\nDavom etamizmi?`
    if (!window.confirm(savol)) return
    setIshlanmoqda(r.key)
    try {
      const res = await api('/courses/use', {
        method: 'POST',
        body: JSON.stringify({ key: r.key }),
      })
      toast(res.message || 'Navbatga qo\'yildi')
      // Bemor navbat raqamini qo'lida olishi kerak — talon darrov ochiladi
      if (res.patient) setTalon(res.patient)
      yukla()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setIshlanmoqda(null)
    }
  }

  const qaytar = async (r) => {
    if (!window.confirm(`${r.patient_name} ning bugungi tashrifi bekor qilinsinmi?`)) return
    setIshlanmoqda(r.key)
    try {
      const res = await api('/courses/undo', {
        method: 'POST',
        body: JSON.stringify({ key: r.key }),
      })
      toast(res.message || 'Bekor qilindi')
      yukla()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setIshlanmoqda(null)
    }
  }

  const openEditModal = (r) => {
    setEditRecord(r)
    setEditItems(
      (r.services || []).map((x) => ({
        service_id: x.service_id,
        service_name: x.service_name,
        quantity: x.quantity || 1,
        used_count: x.used_count || 0,
      }))
    )
  }

  const handleSaveEdit = async () => {
    if (!editRecord) return
    setSavingEdit(true)
    try {
      const payload = {
        key: editRecord.key,
        items: editItems.map((x) => ({
          service_id: x.service_id,
          quantity: Math.max(1, Number(x.quantity) || 1),
          used_count: Math.max(0, Math.min(Number(x.quantity) || 1, Number(x.used_count) || 0)),
        })),
      }
      const res = await api('/courses/edit', { method: 'PUT', body: JSON.stringify(payload) })
      toast(res.message || '✓ Kurs kunlari tahrirlandi')
      setEditRecord(null)
      yukla()
    } catch (e) {
      toast(e.message || 'Tahrirlashda xatolik', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const korinadigan = (rows || []).filter((r) => {
    if (!qidiruv) return true
    const q = qidiruv.toLowerCase()
    return (
      (r.patient_name || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q) ||
      (r.services || []).some((x) => (x.service_name || '').toLowerCase().includes(q))
    )
  })

  const jamiQolgan = (rows || []).reduce((s, r) => s + (r.total_remaining || 0), 0)

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {talon && (
        <PaymentTicketModal open={!!talon} patient={talon} onClose={() => setTalon(null)} />
      )}
      <PageHeader
        title="🔁 Davolanishdagilar (oldindan to'langan kurslar)"
        subtitle="Bir necha kunga to'lab ketgan bemorlar. Kelganda «Keldi» bosing — qayta to'lov olinmaydi, navbat raqami beriladi."
        icon={Icons.calendar}
      >
        <Btn variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={yukla}>
          Yangilash
        </Btn>
      </PageHeader>

      {/* Yig'ma */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 border-gold/30">
          <span className="text-[10px] font-extrabold text-muted uppercase block">Tugallanmagan kurs</span>
          <span className="font-black text-gold font-mono text-xl">{rows?.length || 0} ta</span>
        </div>
        <div className="card p-4 border-border">
          <span className="text-[10px] font-extrabold text-muted uppercase block">Jami qolgan kun</span>
          <span className="font-black text-cyan font-mono text-xl">{jamiQolgan} kun</span>
        </div>
      </div>

      {/* Qidiruv */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input-field pl-9 text-sm"
          placeholder="Bemor ismi, telefoni yoki xizmat nomi..."
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
        />
      </div>

      {rows === null ? (
        <TableSkeleton />
      ) : korinadigan.length === 0 ? (
        <EmptyState
          icon="🔁"
          message={
            qidiruv
              ? 'Qidiruvga mos bemor topilmadi'
              : "Tugallanmagan kurs yo'q. Bemor bir necha kunlik xizmatga to'lasa, shu yerda paydo bo'ladi."
          }
        />
      ) : (
        <div className="space-y-2">
          {korinadigan.map((r) => {
            const band = ishlanmoqda === r.key
            return (
              <div key={r.key} className="card p-3.5 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-sm text-body truncate">{r.patient_name}</h4>
                  <p className="text-[11px] text-muted font-semibold mt-0.5">
                    {r.phone ? `${r.phone} · ` : ''}
                    Boshlangan: {sana(r.started_at)} ·{' '}
                    {formatMoney((r.services || []).reduce((s, x) => s + (x.total_price || 0), 0))} to'langan
                    {r.tickets && r.tickets.length > 1
                      ? ` · ${r.tickets.length} ta chekdan yig'ilgan (${r.tickets.join(', ')})`
                      : r.tickets && r.tickets.length === 1
                        ? ` · ${r.tickets[0]}`
                        : ''}
                  </p>

                  {/* Bemorning har bir xizmati o'z qatorida, kunlari bilan */}
                  <div className="space-y-1.5 mt-2">
                    {(r.services || []).map((x) => (
                      <div key={x.service_id} className="flex flex-wrap items-center gap-1.5">
                        <span className="badge badge-cyan text-[10px] font-bold">{x.service_name}</span>
                        {Array.from({ length: x.quantity }).map((_, n) => (
                          <span
                            key={n}
                            className={`text-[10px] font-mono font-bold rounded px-1.5 py-0.5 border ${
                              n < x.used_count
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                : 'bg-surface-2 border-border text-muted'
                            }`}
                          >
                            {n + 1}-kun{n < x.used_count ? ' ✓' : ''}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-muted uppercase block">Qoldi</span>
                    <span className="font-black text-gold font-mono text-lg">{r.total_remaining} kun</span>
                  </div>

                  <Btn
                    variant="gold"
                    size="sm"
                    icon={<CalendarCheck className="h-4 w-4" />}
                    loading={band}
                    onClick={() => keldi(r)}
                    className="font-black"
                  >
                    Keldi
                  </Btn>

                  <button
                    type="button"
                    onClick={() => openEditModal(r)}
                    disabled={band}
                    className="p-2 rounded-lg text-cyan hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors border border-cyan-500/30"
                    title="Kurs kunlarini va bajarilgan kunlarni tahrirlash"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => qaytar(r)}
                    disabled={band}
                    className="p-2 rounded-lg text-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                    title="Bugungi tashrifni bekor qilish (adashib bosilgan bo'lsa)"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* EDIT COURSE MODAL */}
      {editRecord && (
        <Modal
          open={!!editRecord}
          onClose={() => setEditRecord(null)}
          title={`✏️ ${editRecord.patient_name} — Kurs Kunlarini Tahrirlash`}
          size="md"
        >
          <div className="space-y-4 pt-1">
            <p className="text-xs text-muted">
              Ushbu bemorning davolanish kursi bo'yicha jami kunlar sonini va o'tilgan (bajarilgan) kunlarini har bir xizmat uchun alohida sozlang.
            </p>

            <div className="space-y-4">
              {editItems.map((x, idx) => (
                <div key={x.service_id} className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gold uppercase tracking-wide">
                      🩺 {x.service_name}
                    </span>
                    <span className="text-xs font-mono font-extrabold text-cyan">
                      Qolgan: {Math.max(0, x.quantity - x.used_count)} kun
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Quantity (Jami kunlar soni) */}
                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">
                        Jami Kurs Kunlari:
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const nextQ = Math.max(1, x.quantity - 1)
                            const nextU = Math.min(nextQ, x.used_count)
                            setEditItems((prev) => {
                              const c = [...prev]
                              c[idx] = { ...c[idx], quantity: nextQ, used_count: nextU }
                              return c
                            })
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-700 text-foreground font-bold text-sm hover:bg-slate-600"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={x.quantity}
                          onChange={(e) => {
                            const nextQ = Math.max(1, parseInt(e.target.value, 10) || 1)
                            const nextU = Math.min(nextQ, x.used_count)
                            setEditItems((prev) => {
                              const c = [...prev]
                              c[idx] = { ...c[idx], quantity: nextQ, used_count: nextU }
                              return c
                            })
                          }}
                          className="w-16 text-center font-mono font-black text-sm bg-surface-sunken border border-border rounded-lg py-1 text-gold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextQ = x.quantity + 1
                            setEditItems((prev) => {
                              const c = [...prev]
                              c[idx] = { ...c[idx], quantity: nextQ }
                              return c
                            })
                          }}
                          className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500"
                        >
                          +
                        </button>
                        <span className="text-[11px] text-muted font-bold ml-1">kun</span>
                      </div>
                    </div>

                    {/* Used Count (Bajarilgan kunlar soni) */}
                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">
                        O'tilgan (Bajarilgan) Kun:
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const nextU = Math.max(0, x.used_count - 1)
                            setEditItems((prev) => {
                              const c = [...prev]
                              c[idx] = { ...c[idx], used_count: nextU }
                              return c
                            })
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-700 text-foreground font-bold text-sm hover:bg-slate-600"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={x.quantity}
                          value={x.used_count}
                          onChange={(e) => {
                            const nextU = Math.max(0, Math.min(x.quantity, parseInt(e.target.value, 10) || 0))
                            setEditItems((prev) => {
                              const c = [...prev]
                              c[idx] = { ...c[idx], used_count: nextU }
                              return c
                            })
                          }}
                          className="w-16 text-center font-mono font-black text-sm bg-surface-sunken border border-border rounded-lg py-1 text-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextU = Math.min(x.quantity, x.used_count + 1)
                            setEditItems((prev) => {
                              const c = [...prev]
                              c[idx] = { ...c[idx], used_count: nextU }
                              return c
                            })
                          }}
                          className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500"
                        >
                          +
                        </button>
                        <span className="text-[11px] text-muted font-bold ml-1">kun</span>
                      </div>
                    </div>
                  </div>

                  {/* Day Badges Preview & Interactive Toggle */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">
                      Kunlar holati (Bosing — bajarildi / kutilmoqda):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: x.quantity }).map((_, n) => {
                        const isDone = n < x.used_count
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              // Clicking day badge sets used_count to this day
                              const newUsed = isDone ? n : n + 1
                              setEditItems((prev) => {
                                const c = [...prev]
                                c[idx] = { ...c[idx], used_count: newUsed }
                                return c
                              })
                            }}
                            className={`text-xs font-mono font-extrabold rounded-lg px-2.5 py-1 border transition-all ${
                              isDone
                                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm'
                                : 'bg-surface border-border text-muted hover:border-border-strong'
                            }`}
                            title={isDone ? `${n + 1}-kun bajarildi (Bosing: kutilmoqda qilish)` : `${n + 1}-kun kutilmoqda (Bosing: bajarildi qilish)`}
                          >
                            {n + 1}-kun{isDone ? ' ✓' : ' ⏳'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" full icon={Icons.x} onClick={() => setEditRecord(null)}>
                Bekor
              </Btn>
              <Btn variant="gold" full icon={Icons.save} loading={savingEdit} onClick={handleSaveEdit}>
                {savingEdit ? 'Saqlanmoqda...' : 'O\'zgarishlarni Saqlash ✓'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

