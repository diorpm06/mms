import { useEffect, useState } from 'react'
import { CalendarCheck, RefreshCw, Search, Undo2 } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons, PageHeader, EmptyState } from '../../components/UIKit'
import { TableSkeleton } from '../../components/Skeleton'

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
    const savol =
      `${r.patient_name} — ${r.service_name}\n\n` +
      `Bu ${r.quantity} kunlik kursning ${r.used_count + 1}-kuni.\n` +
      `Qayta to'lov OLINMAYDI, bemor navbatga qo'yiladi.\n\nDavom etamizmi?`
    if (!window.confirm(savol)) return
    setIshlanmoqda(r.key)
    try {
      const res = await api('/courses/use', {
        method: 'POST',
        body: JSON.stringify({ key: r.key }),
      })
      toast(res.message || 'Navbatga qo\'yildi')
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

  const korinadigan = (rows || []).filter((r) => {
    if (!qidiruv) return true
    const q = qidiruv.toLowerCase()
    return (
      (r.patient_name || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q) ||
      (r.service_name || '').toLowerCase().includes(q)
    )
  })

  const jamiQolgan = (rows || []).reduce((s, r) => s + r.remaining, 0)

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-extrabold text-sm text-body truncate">{r.patient_name}</h4>
                    <span className="badge badge-cyan text-[10px] font-bold">{r.service_name}</span>
                  </div>
                  <p className="text-[11px] text-muted font-semibold mt-0.5">
                    {r.phone ? `${r.phone} · ` : ''}
                    Boshlangan: {sana(r.started_at)} · {formatMoney(r.total_price)} to'langan
                    {r.tickets && r.tickets.length > 1
                      ? ` · ${r.tickets.length} ta chekdan yig'ilgan (${r.tickets.join(', ')})`
                      : r.tickets && r.tickets.length === 1
                        ? ` · ${r.tickets[0]}`
                        : ''}
                  </p>

                  {/* Kunlar chizig'i */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Array.from({ length: r.quantity }).map((_, n) => (
                      <span
                        key={n}
                        className={`text-[10px] font-mono font-bold rounded px-1.5 py-0.5 border ${
                          n < r.used_count
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-surface-2 border-border text-muted'
                        }`}
                      >
                        {n + 1}-kun{n < r.used_count ? ' ✓' : ''}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-muted uppercase block">Qoldi</span>
                    <span className="font-black text-gold font-mono text-lg">{r.remaining} kun</span>
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
    </div>
  )
}
