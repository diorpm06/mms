import { useEffect, useState } from 'react'
import { ClipboardList, Send, Eye, Trash2, X, RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons, PageHeader, EmptyState } from '../../components/UIKit'

const HOLAT = {
  draft: { text: 'Saqlangan — yuborilmagan', cls: 'badge-muted' },
  submitted: { text: 'Adminga yuborilgan', cls: 'badge-gold' },
  printed: { text: 'Chop etilgan', cls: 'badge-cyan' },
}

function vaqt(iso) {
  if (!iso) return '—'
  const [kun, soat] = iso.split('T')
  const [y, o, k] = (kun || '').split('-')
  return `${k}.${o}.${y} ${(soat || '').substring(0, 5)}`
}

export default function MyResults() {
  const [rows, setRows] = useState(null)
  const [tanlangan, setTanlangan] = useState([])
  const [yuborilmoqda, setYuborilmoqda] = useState(false)
  const [korish, setKorish] = useState(null)
  const [tab, setTab] = useState('draft') // draft | sent
  const toast = useToastStore((s) => s.add)

  const yukla = async () => {
    try {
      const res = await api('/report-submissions/mine')
      setRows(res || [])
      setTanlangan((res || []).filter((r) => r.status === 'draft').map((r) => r.id))
    } catch (e) {
      setRows([])
      toast(e.message, 'error')
    }
  }
  useEffect(() => { yukla() }, [])

  const qoralamalar = (rows || []).filter((r) => r.status === 'draft')
  const yuborilgan = (rows || []).filter((r) => r.status !== 'draft')
  const korinadigan = tab === 'draft' ? qoralamalar : yuborilgan

  const belgila = (id) =>
    setTanlangan((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  const yubor = async (idlar) => {
    if (!idlar.length) { toast('Kamida bitta natijani belgilang', 'error'); return }
    if (!window.confirm(`${idlar.length} ta natija adminga yuborilsinmi?\n\nYuborilgandan keyin o'zgartirib bo'lmaydi.`)) return
    setYuborilmoqda(true)
    try {
      const res = await api('/report-submissions/submit', {
        method: 'POST',
        body: JSON.stringify({ ids: idlar }),
      })
      toast(res.message || 'Yuborildi')
      setKorish(null)
      yukla()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setYuborilmoqda(false)
    }
  }

  const ochir = async (r) => {
    if (!window.confirm(`"${r.template_label}" (${r.patient_name}) natijasi o'chirilsinmi?`)) return
    try {
      await api(`/report-submissions/${r.id}`, { method: 'DELETE' })
      toast("Natija o'chirildi")
      yukla()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-10">
      <PageHeader
        title="📋 Natijalarim"
        subtitle="To'ldirilgan UZI va laboratoriya blankalari. Saqlanganlarni belgilab, adminga bir yo'la yuborasiz."
        icon={Icons.fileText}
      >
        <Btn variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={yukla}>
          Yangilash
        </Btn>
      </PageHeader>

      {/* Bo'lim tanlash */}
      <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border w-fit">
        <button
          type="button"
          onClick={() => setTab('draft')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === 'draft' ? 'bg-gold text-slate-950 shadow' : 'text-muted hover:text-body'
          }`}
        >
          Yuborilmagan ({qoralamalar.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('sent')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === 'sent' ? 'bg-cyan text-slate-950 shadow' : 'text-muted hover:text-body'
          }`}
        >
          Yuborilgan ({yuborilgan.length})
        </button>
      </div>

      {/* Yuborish paneli */}
      {tab === 'draft' && qoralamalar.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center justify-between gap-3 border-gold/40">
          <button
            type="button"
            onClick={() =>
              setTanlangan(
                tanlangan.length === qoralamalar.length ? [] : qoralamalar.map((r) => r.id)
              )
            }
            className="text-xs font-bold text-cyan hover:underline"
          >
            {tanlangan.length === qoralamalar.length ? 'Belgini olib tashlash' : 'Hammasini belgilash'}
          </button>

          <Btn
            variant="gold"
            size="sm"
            icon={<Send className="h-4 w-4" />}
            loading={yuborilmoqda}
            disabled={tanlangan.length === 0}
            onClick={() => yubor(tanlangan)}
            className="font-black"
          >
            Adminga yuborish ({tanlangan.length})
          </Btn>
        </div>
      )}

      {/* Ro'yxat */}
      {rows === null ? (
        <p className="text-xs text-muted italic text-center py-10">Yuklanmoqda...</p>
      ) : korinadigan.length === 0 ? (
        <EmptyState
          icon="📋"
          message={
            tab === 'draft'
              ? "Yuborilmagan natija yo'q. Shifokor panelidan bemorni chaqirib, blankani to'ldiring."
              : 'Hali adminga natija yuborilmagan'
          }
        />
      ) : (
        <div className="space-y-2">
          {korinadigan.map((r) => {
            const qoralama = r.status === 'draft'
            const belgilangan = tanlangan.includes(r.id)
            return (
              <div
                key={r.id}
                className={`card p-3 flex flex-wrap items-center gap-3 transition-all ${
                  qoralama && belgilangan ? 'border-gold/50 bg-gold/[0.06]' : 'border-border'
                }`}
              >
                {qoralama && (
                  <input
                    type="checkbox"
                    checked={belgilangan}
                    onChange={() => belgila(r.id)}
                    className="rounded accent-gold h-4 w-4 shrink-0"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-cyan text-[10px] font-bold">
                      {r.category === 'UZI' ? '🩻 UZI' : '🔬 Lab'}
                    </span>
                    <h4 className="font-extrabold text-sm text-body truncate">{r.template_label}</h4>
                    <span className={`badge ${HOLAT[r.status]?.cls || 'badge-muted'} text-[10px] font-bold`}>
                      {HOLAT[r.status]?.text || r.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted font-semibold mt-0.5">
                    {r.ticket_number ? `${r.ticket_number} · ` : ''}
                    {r.patient_name} · {vaqt(r.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Btn variant="ghost" size="xs" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setKorish(r)}>
                    Ko'rish
                  </Btn>
                  {qoralama && (
                    <button
                      type="button"
                      onClick={() => ochir(r)}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ko'rish oynasi */}
      {korish && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="card max-w-3xl w-full p-5 space-y-4 my-6">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
              <div className="min-w-0">
                <h3 className="text-base font-black text-gold truncate">{korish.template_label}</h3>
                <p className="text-xs text-muted font-bold mt-0.5">
                  {korish.ticket_number ? `${korish.ticket_number} · ` : ''}
                  {korish.patient_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKorish(null)}
                className="p-2 rounded-xl text-muted hover:text-body shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="mms-shablon bg-white text-black rounded-xl p-5 text-[13px] leading-relaxed overflow-x-auto"
              style={{ fontFamily: "'Times New Roman', Cambria, serif" }}
              dangerouslySetInnerHTML={{ __html: korish.content || '' }}
            />

            <div className="flex gap-2 pt-1">
              <Btn variant="ghost" full icon={<X className="h-4 w-4" />} onClick={() => setKorish(null)}>
                Yopish
              </Btn>
              {korish.status === 'draft' && (
                <Btn
                  variant="gold"
                  full
                  icon={<Send className="h-4 w-4" />}
                  loading={yuborilmoqda}
                  onClick={() => yubor([korish.id])}
                >
                  Shu natijani yuborish
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
