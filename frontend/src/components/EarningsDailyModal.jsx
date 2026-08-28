import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Modal from './Modal'
import { api } from '../utils/api'
import { formatMoney } from '../utils/format'

// "Jami" degan raqam bitta son bo'lib turardi — u qaysi kundan yig'ilgani
// ko'rinmasdi. Bu oyna o'sha yig'indini kunlarga, kunni esa bemorlarga
// bo'lib ko'rsatadi.

function sanaUz(iso) {
  if (!iso) return '—'
  const [y, o, k] = iso.split('-')
  return `${k}.${o}.${y}`
}

const HAFTA = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba',
  'Payshanba', 'Juma', 'Shanba']

export default function EarningsDailyModal({ open, onClose, kind, id, name }) {
  // kind: 'providers' | 'referrers'
  const [data, setData] = useState(null)
  const [xato, setXato] = useState(null)
  const [ochiq, setOchiq] = useState(null)      // ochilgan kun
  const [bemorlar, setBemorlar] = useState({})  // kun -> bemorlar ro'yxati

  useEffect(() => {
    if (!open || !id) return
    setData(null)
    setXato(null)
    setOchiq(null)
    setBemorlar({})
    api(`/${kind}/${id}/earnings-daily`)
      .then(setData)
      .catch((e) => setXato(e.message || 'Yuklanmadi'))
  }, [open, id, kind])

  const kunniOch = async (kun) => {
    if (ochiq === kun) { setOchiq(null); return }
    setOchiq(kun)
    if (bemorlar[kun]) return
    try {
      const res = await api(`/${kind}/${id}/earnings-daily/${kun}`)
      setBemorlar((b) => ({ ...b, [kun]: res || [] }))
    } catch {
      setBemorlar((b) => ({ ...b, [kun]: [] }))
    }
  }

  const bugun = new Date().toISOString().slice(0, 10)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`📊 ${name || ''} — kunma-kun hisob`}
      size="lg"
    >
      {xato ? (
        <p className="text-sm text-rose-400 font-semibold py-6 text-center">{xato}</p>
      ) : !data ? (
        <p className="text-sm text-muted py-6 text-center">Yuklanmoqda...</p>
      ) : (
        <div className="space-y-4">
          {/* Yig'ma */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="card p-3 border-gold/30">
              <span className="text-[10px] font-extrabold text-muted uppercase block">Bugun</span>
              <span className="font-black text-gold font-mono text-base">
                {formatMoney(data.today)}
              </span>
            </div>
            <div className="card p-3 border-cyan-500/30">
              <span className="text-[10px] font-extrabold text-muted uppercase block">Jami ishlagan</span>
              <span className="font-black text-cyan font-mono text-base">
                {formatMoney(data.total_earned)}
              </span>
            </div>
            <div className="card p-3 border-rose-500/30">
              <span className="text-[10px] font-extrabold text-muted uppercase block">Olingan avans</span>
              <span className="font-black text-rose-400 font-mono text-base">
                {formatMoney(data.advances_total)}
              </span>
            </div>
            <div className="card p-3 border-border">
              <span className="text-[10px] font-extrabold text-muted uppercase block">Chiqarilgan</span>
              <span className="font-black text-muted font-mono text-base">
                {formatMoney(data.paid_out)}
              </span>
            </div>
            <div className="card p-3 border-emerald/30">
              <span className="text-[10px] font-extrabold text-muted uppercase block">Balans</span>
              <span className="font-black text-emerald font-mono text-base">
                {formatMoney(data.balance)}
              </span>
            </div>
          </div>

          {/* Avanslar tarixi */}
          {data.advances?.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-surface-2 text-[10px] font-extrabold text-muted uppercase tracking-wider">
                Avanslar tarixi
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted uppercase text-[9px] font-extrabold">
                    <th className="text-left py-1 px-3">Sana</th>
                    <th className="text-left py-1">Izoh</th>
                    <th className="text-right py-1">Summa</th>
                    <th className="text-right py-1 px-3">Holati</th>
                  </tr>
                </thead>
                <tbody className="font-semibold">
                  {data.advances.map((a) => (
                    <tr key={a.id} className="border-t border-border/50">
                      <td className="py-1.5 px-3 font-mono text-muted">
                        {sanaUz((a.created_at || '').slice(0, 10))}
                      </td>
                      <td className="py-1.5 text-body">{a.note}</td>
                      <td className="py-1.5 font-mono text-right text-rose-400">
                        {formatMoney(a.amount)}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        {a.is_settled ? (
                          <span className="badge badge-success text-[9px] font-bold">yopilgan</span>
                        ) : (
                          <span className="badge badge-amber text-[9px] font-bold">ochiq</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Balans yig'ma raqam. Ishlagan puli minus chiqarilgani bilan
              mos kelmasa, buni aytib qo'yamiz — jimgina o'tib ketmasin. */}
          {data.balance !== data.expected_balance && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-[12px] font-bold text-amber-300">
                Balans mos kelmayapti
              </p>
              <p className="text-[11px] text-muted font-semibold mt-1">
                Ishlagan {formatMoney(data.total_earned)} − chiqarilgan{' '}
                {formatMoney(data.paid_out)} ={' '}
                <span className="font-mono font-bold text-body">
                  {formatMoney(data.expected_balance)}
                </span>
                , lekin balansda {formatMoney(data.balance)} turibdi.
              </p>
            </div>
          )}

          {/* Kunlar */}
          {data.days.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">
              Hali yozuv yo'q.
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 bg-surface-2 text-[10px] font-extrabold text-muted uppercase tracking-wider">
                <span className="w-4"></span>
                <span>Sana</span>
                <span className="text-right">Bemor</span>
                <span className="text-right w-28">Summa</span>
              </div>
              {data.days.map((k) => {
                const ochilgan = ochiq === k.date
                const qatorlar = bemorlar[k.date]
                return (
                  <div key={k.date} className="border-t border-border">
                    <button
                      type="button"
                      onClick={() => kunniOch(k.date)}
                      className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2.5 items-center text-left hover:bg-surface-hover transition-colors"
                    >
                      {ochilgan
                        ? <ChevronDown className="h-4 w-4 text-muted" />
                        : <ChevronRight className="h-4 w-4 text-muted" />}
                      <span className="text-[12px] font-bold text-body">
                        {sanaUz(k.date)}
                        <span className="text-muted font-semibold ml-2 text-[11px]">
                          {HAFTA[new Date(k.date).getDay()]}
                        </span>
                        {k.date === bugun && (
                          <span className="badge badge-gold text-[9px] font-bold ml-2">bugun</span>
                        )}
                      </span>
                      <span className="text-[12px] font-mono font-bold text-muted text-right">
                        {k.patients} ta
                      </span>
                      <span className="text-[13px] font-mono font-black text-cyan text-right w-28">
                        {formatMoney(k.amount)}
                      </span>
                    </button>

                    {ochilgan && (
                      <div className="bg-surface-2 px-3 py-2">
                        {!qatorlar ? (
                          <p className="text-[11px] text-muted py-2">Yuklanmoqda...</p>
                        ) : qatorlar.length === 0 ? (
                          <p className="text-[11px] text-muted py-2">Ma'lumot yo'q</p>
                        ) : (
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-muted uppercase text-[9px] font-extrabold">
                                <th className="text-left py-1">Vaqt</th>
                                <th className="text-left py-1">Bemor</th>
                                <th className="text-left py-1">Navbat</th>
                                <th className="text-right py-1">To'lov</th>
                                <th className="text-right py-1">Ulush</th>
                              </tr>
                            </thead>
                            <tbody className="font-semibold">
                              {qatorlar.map((b, i) => (
                                <tr key={i} className="border-t border-border/50">
                                  <td className="py-1 font-mono text-muted">{b.time || '—'}</td>
                                  <td className="py-1 text-body">{b.patient_name}</td>
                                  <td className="py-1 font-mono text-muted">
                                    {b.ticket_number || '—'}
                                  </td>
                                  <td className="py-1 font-mono text-right text-muted">
                                    {formatMoney(b.total_amount)}
                                  </td>
                                  <td className="py-1 font-mono text-right font-black text-cyan">
                                    {formatMoney(b.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Jami — kunlar yig'indisi */}
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2.5 border-t-2 border-border bg-surface-2 items-center">
                <span className="w-4"></span>
                <span className="text-[12px] font-extrabold text-body uppercase">Jami</span>
                <span className="text-[12px] font-mono font-bold text-muted text-right">
                  {data.days.reduce((s, k) => s + k.patients, 0)} ta
                </span>
                <span className="text-[13px] font-mono font-black text-cyan text-right w-28">
                  {formatMoney(data.total_earned)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
