import { useEffect, useState } from 'react'
import { CalendarCheck, Edit3, RefreshCw, Search, Undo2 } from 'lucide-react'
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
  // Kurs kunlarini qo'lda tuzatish (masalan adashib eski kunga "Keldi"
  // bosilgan bo'lsa, "Bekor qilish" faqat bugungisiga ishlaydi)
  const [editModal, setEditModal] = useState(null)   // { key, patient_name, services: [...] }
  const [editItems, setEditItems] = useState([])
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)

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

  const tahrirlashniOch = (r) => {
    setEditModal(r)
    setEditItems((r.services || []).map((x) => ({
      service_id: x.service_id,
      service_name: x.service_name,
      quantity: x.quantity,
      used_count: x.used_count,
    })))
  }

  const tahrirniSaqla = async () => {
    if (!editModal) return
    setSaqlanmoqda(true)
    try {
      const res = await api('/courses/edit', {
        method: 'PUT',
        body: JSON.stringify({
          key: editModal.key,
          items: editItems.map((x) => ({
            service_id: x.service_id,
            quantity: Math.max(1, +x.quantity || 1),
            used_count: Math.max(0, +x.used_count || 0),
          })),
        }),
      })
      toast(res.message || 'Saqlandi ✓')
      setEditModal(null)
      yukla()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaqlanmoqda(false)
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

                  {/* Har bir xizmat o'z qatorida. Kurs uzunligi bo'yicha
                      kunlar chiziladi: shu xizmatga tegishli kunlar
                      belgilanadi, o'tganlari ✓ bilan. */}
                  <div className="space-y-1.5 mt-2">
                    {(r.services || []).map((x) => {
                      // Jadval bo'lmasa — eski tartib: 1..quantity ketma-ket
                      const jadval = (x.days && x.days.length)
                        ? x.days
                        : Array.from({ length: x.quantity }, (_, i) => i + 1)
                      const uzunlik = Math.max(
                        ...(r.services || []).map((s) =>
                          s.days && s.days.length
                            ? Math.max(...s.days)
                            : s.quantity
                        )
                      )
                      return (
                        <div key={x.service_id} className="flex flex-wrap items-center gap-1.5">
                          <span className="badge badge-cyan text-[10px] font-bold">{x.service_name}</span>
                          {Array.from({ length: uzunlik }).map((_, n) => {
                            const kun = n + 1
                            const tegishli = jadval.includes(kun)
                            const otgan = kun <= (r.otgan_kun ?? 0)
                            if (!tegishli) {
                              // Bu kuni shu muolaja berilmaydi
                              return (
                                <span
                                  key={kun}
                                  className="text-[10px] font-mono rounded px-1.5 py-0.5 border border-dashed border-border/50 text-muted/40"
                                  title={`${kun}-kuni bu muolaja yo'q`}
                                >
                                  {kun}
                                </span>
                              )
                            }
                            return (
                              <span
                                key={kun}
                                className={`text-[10px] font-mono font-bold rounded px-1.5 py-0.5 border ${
                                  otgan
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-surface-2 border-border text-muted'
                                }`}
                              >
                                {kun}-kun{otgan ? ' ✓' : ''}
                              </span>
                            )
                          })}
                        </div>
                      )
                    })}
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

                  {/* "Bekor qilish" faqat BUGUNGI xato tashrifni tuzatadi.
                      Eski (o'tgan kunlardagi) xato "Keldi" bosilishini
                      qo'lda tuzatish uchun — masalan xatolik keyinroq
                      payqalganda — shu tugma kerak. */}
                  <button
                    type="button"
                    onClick={() => tahrirlashniOch(r)}
                    className="p-2 rounded-lg text-muted hover:text-cyan hover:bg-cyan-500/10 transition-colors"
                    title="Kurs kunlarini qo'lda tuzatish (eski xato uchun)"
                  >
                    <Edit3 className="h-4 w-4" />
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

      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={`Kurs kunlarini tuzatish — ${editModal?.patient_name || ''}`}
      >
        <div className="space-y-3 pt-2">
          <p className="text-[11px] text-muted">
            Har bir xizmat uchun jami kun (sotib olingan) va ishlatilgan kun
            (bemor kelib ulgurgan kunlar) sonini to'g'irlang.
          </p>
          {editItems.map((x, i) => (
            <div key={x.service_id} className="flex items-center gap-3 p-2.5 bg-surface-2 rounded-lg border border-border">
              <span className="text-xs font-bold text-body flex-1 truncate">{x.service_name}</span>
              <div>
                <label className="text-[10px] text-muted block mb-0.5">Jami kun</label>
                <input
                  type="number" min="1"
                  className="input-field text-xs font-mono w-20 py-1"
                  value={x.quantity}
                  onChange={(e) => setEditItems((prev) => prev.map((it, ii) => ii === i ? { ...it, quantity: e.target.value } : it))}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted block mb-0.5">Ishlatilgan</label>
                <input
                  type="number" min="0"
                  className="input-field text-xs font-mono w-20 py-1"
                  value={x.used_count}
                  onChange={(e) => setEditItems((prev) => prev.map((it, ii) => ii === i ? { ...it, used_count: e.target.value } : it))}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={saqlanmoqda}
            onClick={tahrirniSaqla}
            className="btn-gold w-full py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {saqlanmoqda ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </Modal>

    </div>
  )
}

