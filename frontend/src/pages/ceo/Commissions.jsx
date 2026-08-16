import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney, formatWithCommas, parseDigits } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons, PageHeader, THead, EmptyState } from '../../components/UIKit'

// Komissiya turi. Ilgari qaysi bo'limga qancha berilishi kodda yozilgan edi —
// endi shu sahifadan boshqariladi.
const REJIM = {
  none: { label: 'Berilmaydi', rang: 'text-muted' },
  percent: { label: 'Foiz (%)', rang: 'text-cyan-400' },
  sum: { label: "Qat'iy summa", rang: 'text-gold' },
}

function tarifMatni(mode, value) {
  if (mode === 'percent') return `${value}%`
  if (mode === 'sum') return formatMoney(value)
  return '—'
}

// `embedded` — Yo'naltiruvchilar sahifasi ichida ichki bo'lim sifatida
// ochilganda sarlavha takrorlanmasligi uchun
export default function CeoCommissions({ embedded = false }) {
  const [data, setData] = useState({ departments: [], exceptions: [], excluded_services: [] })
  const [referrers, setReferrers] = useState([])
  const [tahrir, setTahrir] = useState(null)      // {id, name, mode, value}
  const [yangi, setYangi] = useState({ referrer_id: '', category: '', mode: 'percent', value: '' })
  const [saqlanmoqda, setSaqlanmoqda] = useState(false)
  const toast = useToastStore((s) => s.add)

  const load = () => {
    api('/commissions').then(setData).catch((e) => toast(e.message, 'error'))
    api('/referrers').then((r) => setReferrers(r || [])).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const saqlaBolim = async () => {
    if (!tahrir) return
    const qiymat = tahrir.mode === 'none' ? 0 : parseInt(parseDigits(String(tahrir.value)), 10) || 0
    if (tahrir.mode !== 'none' && qiymat <= 0) { toast('Qiymat kiriting', 'error'); return }
    setSaqlanmoqda(true)
    try {
      const r = await api(`/commissions/department/${tahrir.id}`, {
        method: 'PUT',
        body: JSON.stringify({ mode: tahrir.mode, value: qiymat }),
      })
      toast(r.message)
      setTahrir(null)
      load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaqlanmoqda(false) }
  }

  const qoshIstisno = async () => {
    const qiymat = parseInt(parseDigits(String(yangi.value)), 10) || 0
    if (!yangi.referrer_id || !yangi.category) { toast("Yo'naltiruvchi va bo'limni tanlang", 'error'); return }
    if (yangi.mode !== 'none' && qiymat <= 0) { toast('Qiymat kiriting', 'error'); return }
    setSaqlanmoqda(true)
    try {
      const r = await api('/commissions/exception', {
        method: 'POST',
        body: JSON.stringify({
          referrer_id: +yangi.referrer_id, category: yangi.category,
          mode: yangi.mode, value: qiymat,
        }),
      })
      toast(r.message)
      setYangi({ referrer_id: '', category: '', mode: 'percent', value: '' })
      load()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaqlanmoqda(false) }
  }

  const ochirIstisno = async (e) => {
    if (!window.confirm(`"${e.referrer_name}" uchun "${e.category}" istisnosi olib tashlansinmi?\n\nUndan keyin bo'limning umumiy tarifi qo'llanadi.`)) return
    try {
      const r = await api(`/commissions/exception/${e.id}`, { method: 'DELETE' })
      toast(r.message)
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  const qaytarXizmat = async (s) => {
    try {
      const r = await api(`/commissions/service/${s.id}/exclude?excluded=false`, { method: 'PUT' })
      toast(r.message)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const komissiyali = data.departments.filter((d) => d.mode !== 'none')
  const komissiyasiz = data.departments.filter((d) => d.mode === 'none')

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-5xl space-y-6'}>
      {!embedded && (
        <PageHeader
          title="Yo'naltiruvchi Komissiyasi"
          subtitle="Qaysi bo'limdan qancha berilishi — bo'lim bo'yicha tarif va ayrim shaxslar uchun istisno"
          icon={Icons.money}
        />
      )}

      {/* ── BO'LIM TARIFLARI ── */}
      <div className="card">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-black text-gold uppercase tracking-wide">Bo'lim tariflari</h3>
          <span className="text-xs text-muted font-semibold">
            {komissiyali.length} bo'limda komissiya bor, {komissiyasiz.length} tasida yo'q
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <THead cols={["Bo'lim", 'Xizmat soni', 'Komissiya turi', 'Tarif', '']} />
            <tbody className="divide-y divide-border">
              {data.departments.map((d) => {
                const t = tahrir?.id === d.id
                return (
                  <tr key={d.id} className={t ? 'bg-gold/5' : 'hover:bg-surface-hover'}>
                    <td className="p-2.5 font-bold text-body">{d.name}</td>
                    <td className="p-2.5 text-muted font-mono text-xs">{d.service_count} ta</td>

                    {t ? (
                      <>
                        <td className="p-2.5">
                          <select
                            className="input-field py-1 text-xs"
                            value={tahrir.mode}
                            onChange={(e) => setTahrir({ ...tahrir, mode: e.target.value })}
                          >
                            {Object.entries(REJIM).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5">
                          {tahrir.mode === 'none' ? (
                            <span className="text-muted text-xs">—</span>
                          ) : (
                            <input
                              className="input-field py-1 text-xs font-mono font-bold w-28"
                              inputMode="numeric"
                              placeholder={tahrir.mode === 'percent' ? '22' : '15,000'}
                              value={tahrir.mode === 'percent' ? tahrir.value : formatWithCommas(String(tahrir.value))}
                              onChange={(ev) => setTahrir({ ...tahrir, value: parseDigits(ev.target.value) })}
                            />
                          )}
                        </td>
                        <td className="p-2.5">
                          <div className="flex gap-1.5 justify-end">
                            <Btn variant="gold" size="xs" loading={saqlanmoqda} onClick={saqlaBolim}>Saqlash</Btn>
                            <Btn variant="ghost" size="xs" onClick={() => setTahrir(null)}>Bekor</Btn>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`p-2.5 text-xs font-bold ${REJIM[d.mode]?.rang || 'text-muted'}`}>
                          {REJIM[d.mode]?.label || d.mode}
                        </td>
                        <td className="p-2.5 font-mono font-black text-body">{tarifMatni(d.mode, d.value)}</td>
                        <td className="p-2.5 text-right">
                          <Btn
                            variant="outline" size="xs" icon={Icons.edit}
                            onClick={() => setTahrir({ id: d.id, name: d.name, mode: d.mode, value: String(d.value || '') })}
                          >
                            O'zgartirish
                          </Btn>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted mt-3">
          Bu tarif shu bo'limdagi barcha xizmatlarga va barcha yo'naltiruvchilarga qo'llanadi.
          Yangi bo'lim qo'shsangiz u avtomatik "Berilmaydi" holatida paydo bo'ladi.
        </p>
      </div>

      {/* ── ISTISNOLAR ── */}
      <div className="card">
        <h3 className="text-sm font-black text-gold uppercase tracking-wide mb-1">Shaxsiy istisnolar</h3>
        <p className="text-xs text-muted mb-3">
          Biror yo'naltiruvchi bilan boshqacha kelishilgan bo'lsa — faqat unga va faqat shu bo'limda.
        </p>

        <div className="p-3 rounded-2xl border border-gold/30 bg-gold/5 grid grid-cols-1 sm:grid-cols-5 gap-2 mb-4">
          <select
            className="input-field py-1.5 text-xs sm:col-span-2"
            value={yangi.referrer_id}
            onChange={(e) => setYangi({ ...yangi, referrer_id: e.target.value })}
          >
            <option value="">— Yo'naltiruvchi</option>
            {referrers.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>

          <select
            className="input-field py-1.5 text-xs"
            value={yangi.category}
            onChange={(e) => setYangi({ ...yangi, category: e.target.value })}
          >
            <option value="">— Bo'lim</option>
            {data.departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>

          <select
            className="input-field py-1.5 text-xs"
            value={yangi.mode}
            onChange={(e) => setYangi({ ...yangi, mode: e.target.value })}
          >
            {Object.entries(REJIM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <div className="flex gap-1.5">
            {yangi.mode !== 'none' && (
              <input
                className="input-field py-1.5 text-xs font-mono font-bold"
                inputMode="numeric"
                placeholder={yangi.mode === 'percent' ? '25' : '20,000'}
                value={yangi.mode === 'percent' ? yangi.value : formatWithCommas(String(yangi.value))}
                onChange={(e) => setYangi({ ...yangi, value: parseDigits(e.target.value) })}
              />
            )}
            <Btn variant="gold" size="xs" icon={Icons.plus} loading={saqlanmoqda} onClick={qoshIstisno}>
              Qo'shish
            </Btn>
          </div>
        </div>

        {data.exceptions.length === 0 ? (
          <EmptyState message="Istisno yo'q — hamma uchun bo'lim tarifi qo'llanadi" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <THead cols={["Yo'naltiruvchi", "Bo'lim", 'Tarif', '']} />
              <tbody className="divide-y divide-border">
                {data.exceptions.map((e) => {
                  const bolim = data.departments.find((d) => d.name === e.category)
                  return (
                    <tr key={e.id} className="hover:bg-surface-hover">
                      <td className="p-2.5 font-bold text-body">{e.referrer_name}</td>
                      <td className="p-2.5 text-muted">{e.category}</td>
                      <td className="p-2.5 font-mono font-black text-gold">
                        {tarifMatni(e.mode, e.value)}
                        {bolim && (
                          <span className="ml-2 text-[11px] font-sans font-semibold text-muted">
                            (bo'lim tarifi {tarifMatni(bolim.mode, bolim.value)})
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <Btn variant="outline" size="xs" icon={Icons.trash} onClick={() => ochirIstisno(e)}>
                          Olib tashlash
                        </Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CHIQARILGAN XIZMATLAR ── */}
      <div className="card">
        <h3 className="text-sm font-black text-gold uppercase tracking-wide mb-1">Komissiyadan chiqarilgan xizmatlar</h3>
        <p className="text-xs text-muted mb-3">
          Bo'limida komissiya bo'lsa ham, bu xizmatlarga berilmaydi.
        </p>
        {data.excluded_services.length === 0 ? (
          <EmptyState message="Chiqarilgan xizmat yo'q" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.excluded_services.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs">
                <span className="font-bold text-body">{s.name}</span>
                <span className="text-muted">{s.category}</span>
                <button
                  type="button"
                  onClick={() => qaytarXizmat(s)}
                  className="text-rose-400 hover:text-rose-300 font-bold"
                  title="Komissiyaga qaytarish"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
