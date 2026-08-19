import { useEffect, useState } from 'react'
import {
  User, Phone, Stethoscope, DollarSign, CreditCard, Edit, CheckCircle,
  Award, Activity, List, Grid, ShieldAlert, ArrowDownRight, Layers
} from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney, formatWithCommas, parseDigits } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, PageHeader, THead, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'
import ActionMenu from '../../components/ActionMenu'
import EarningsDailyModal from '../../components/EarningsDailyModal'

const SOURCES = ['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa']
const STATSIONAR_STANDART = 50000
const emptyForm = {
  full_name: '', specialization: '', phone: '+998', percentage: '', fixed_salary: '',
  username: '', password: '', service_ids: [],
  is_inpatient_provider: false, inpatient_daily_rate: String(STATSIONAR_STANDART),
}

const formatDoctorServicesSummary = (serviceIds, allServices) => {
  if (!serviceIds || serviceIds.length === 0) {
    return <span className="text-muted text-xs italic font-semibold">Barcha xizmatlar (To'liq)</span>
  }
  const assigned = (allServices || []).filter((s) => serviceIds.includes(s.id))
  if (assigned.length === 0) {
    return <span className="text-muted text-xs italic font-semibold">Xizmatlar topilmadi</span>
  }

  // Count lab services assigned
  const allLabServices = (allServices || []).filter((s) => (s.category || '').toLowerCase().includes('labora'))
  const assignedLabServices = assigned.filter((s) => (s.category || '').toLowerCase().includes('labora'))

  // Main category mapping
  const mainCategories = {}
  assigned.forEach((s) => {
    const raw = s.category || "Umumiy"
    const mainCat = raw.includes(':') ? raw.split(':')[0].trim() : raw
    if (!mainCategories[mainCat]) mainCategories[mainCat] = 0
    mainCategories[mainCat]++
  })

  const mainCatNames = Object.keys(mainCategories)

  if (allLabServices.length > 0 && assignedLabServices.length >= allLabServices.length * 0.8) {
    const nonLabCount = assigned.length - assignedLabServices.length
    return (
      <span className="badge badge-info text-[11px] font-extrabold truncate max-w-[200px]" title="Barcha Laboratoriya Tahlillari">
        🧪 Barcha Laboratoriya ({assignedLabServices.length} ta tahlil){nonLabCount > 0 ? ` + ${nonLabCount} boshqa` : ''}
      </span>
    )
  }

  if (mainCatNames.length === 1) {
    const catName = mainCatNames[0]
    return (
      <span className="badge badge-info text-[11px] font-extrabold truncate max-w-[200px]" title={`${catName} (${assigned.length} ta xizmat)`}>
        🩺 {catName} ({assigned.length} ta xizmat)
      </span>
    )
  }

  return (
    <span className="badge badge-gold text-[11px] font-extrabold truncate max-w-[200px]" title={`${assigned.length} ta xizmat (${mainCatNames.join(', ')})`}>
      🩺 {assigned.length} ta xizmat ({mainCatNames.slice(0, 2).join(', ')}{mainCatNames.length > 2 ? '...' : ''})
    </span>
  )
}

/* ── Statsionar xizmat ko'rsatuvchilar bo'limi ───────────────────────────
   Bu yerda foiz emas, yotgan kun soni ko'rsatiladi: shifokor bemor yotgan
   har bir kun uchun qat'iy summa oladi. */
function InpatientProvidersPanel({ rows, onEdit, onDetail, onPayout, onAdd }) {
  if (!rows) return <TableSkeleton />

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center space-y-3 border-violet-500/30">
        <div className="text-4xl">🛏</div>
        <h3 className="font-black text-base text-body">Statsionar xizmat ko'rsatuvchi belgilanmagan</h3>
        <p className="text-xs text-muted max-w-md mx-auto font-semibold">
          Shifokorni statsionar uchun belgilash uchun "Shifokorlar" bo'limiga o'ting,
          uni tahrirlang va <span className="text-violet-300 font-bold">"Statsionar xizmat ko'rsatuvchi"</span>{' '}
          katagiga belgi qo'yib, bir kunlik haqini kiriting. Shundan keyin u statsionarga
          bemor yotqizishda tanlanadigan bo'ladi.
        </p>
        <div className="pt-1">
          <Btn variant="cyan" icon={Icons.plus} onClick={onAdd}>Yangi shifokor qo'shish</Btn>
        </div>
      </div>
    )
  }

  const jamiBugun = rows.reduce((s, r) => s + (r.today_accrued || 0), 0)
  const jamiOy = rows.reduce((s, r) => s + (r.month_accrued || 0), 0)
  const jamiBemor = rows.reduce((s, r) => s + (r.current_patients || 0), 0)

  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-3">
        <h3 className="text-sm font-black text-violet-300 uppercase tracking-wider flex items-center gap-2">
          🛏 Statsionar Xizmat Ko'rsatuvchilar ({rows.length} nafar)
        </h3>
        <p className="text-xs text-muted">
          Bemor yotgan har bir kun uchun qat'iy haq. Hisob har kuni avtomat yoziladi.
        </p>
      </div>

      {/* Yig'ma ko'rsatkichlar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 border-violet-500/30">
          <span className="text-[10px] font-extrabold text-muted uppercase block">Hozir yotgan bemorlar</span>
          <span className="font-black text-violet-300 font-mono text-xl">{jamiBemor} ta</span>
        </div>
        <div className="card p-4 border-border">
          <span className="text-[10px] font-extrabold text-muted uppercase block">Bugun yozilgan haq</span>
          <span className="font-black text-gold font-mono text-xl">{formatMoney(jamiBugun)}</span>
        </div>
        <div className="card p-4 border-border">
          <span className="text-[10px] font-extrabold text-muted uppercase block">Shu oyda jami</span>
          <span className="font-black text-emerald font-mono text-xl">{formatMoney(jamiOy)}</span>
        </div>
      </div>

      <div className="card overflow-x-auto p-0 border-violet-500/20 shadow-lg">
        <table className="w-full text-xs">
          <THead cols={[
            'Xizmat ko\'rsatuvchi', 'Kunlik haqi', 'Hozir yotgan', 'Jami kun',
            'Bugun', 'Shu oy', 'Jami yozilgan', 'Balans', 'Harakatlar',
          ]} />
          <tbody className="divide-y divide-border font-semibold">
            {rows.map((p) => (
              <tr key={p.id} className={p.is_active === false ? 'bg-rose-500/5 opacity-60' : 'hover:bg-surface-hover transition-colors whitespace-nowrap'}>
                <td className="p-3">
                  <div className="font-extrabold text-body">{p.full_name}</div>
                  <div className="text-[11px] text-violet-300 font-bold">{p.specialization || 'Shifokor'}</div>
                </td>
                <td className="p-3">
                  <span className="badge badge-gold font-mono text-[11px] font-extrabold">
                    {formatMoney(p.daily_rate)} / kun
                  </span>
                </td>
                <td className="p-3">
                  {p.current_patients > 0 ? (
                    <span className="badge badge-info text-[11px] font-extrabold">{p.current_patients} ta bemor</span>
                  ) : (
                    <span className="text-muted italic text-[11px]">yo'q</span>
                  )}
                </td>
                <td className="p-3 font-mono font-bold text-body">{p.total_days} kun</td>
                <td className="p-3 font-mono font-bold text-gold">
                  {p.today_accrued > 0 ? `+${formatMoney(p.today_accrued)}` : '—'}
                </td>
                <td className="p-3 font-mono font-bold text-cyan">{formatMoney(p.month_accrued)}</td>
                <td className="p-3 font-mono font-black text-body">{formatMoney(p.total_accrued)}</td>
                <td className="p-3 font-mono font-black text-emerald text-sm">{formatMoney(p.balance)}</td>
                <td className="p-3">
                  <ActionMenu
                    items={[
                      { label: 'Kunma-kun hisobi', icon: Icons.list, onClick: () => onDetail(p) },
                      {
                        label: 'Balansni chiqarish',
                        icon: Icons.arrowDown,
                        variant: 'success',
                        hidden: !(p.balance > 0 && p.is_active !== false),
                        onClick: () => onPayout(p.id),
                      },
                      { label: 'Kunlik haqni o\'zgartirish', icon: Icons.edit, onClick: () => onEdit(p) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function CeoProviders() {
  const [tab, setTab] = useState('doctors') // doctors | inpatient
  const [layoutMode, setLayoutMode] = useState('cards') // Default to PRO Cards View!
  const [items, setItems] = useState(null)
  const [inpEarnings, setInpEarnings] = useState(null)
  const [inpDetail, setInpDetail] = useState(null)   // {provider, rows}
  const [inpDetailOpen, setInpDetailOpen] = useState(false)
  const [allServices, setAllServices] = useState([])
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [payoutSource, setPayoutSource] = useState('Naqt kassa')
  const [advances, setAdvances] = useState({})
  // "Jami ishlagan" bosilganda ochiladigan kunma-kun oynasi
  const [kunlik, setKunlik] = useState(null)   // {kind, id, name}
  const [advanceModal, setAdvanceModal] = useState(false)
  const [selectedProviderForAdvance, setSelectedProviderForAdvance] = useState(null)
  const [advanceAmount, setAdvanceAmount] = useState('1000000')
  const [savingAdvance, setSavingAdvance] = useState(false)
  const toast = useToastStore((s) => s.add)

  const handleGiveAdvance = async () => {
    if (!selectedProviderForAdvance || !advanceAmount) return
    setSavingAdvance(true)
    try {
      await api('/advances', {
        method: 'POST',
        body: JSON.stringify({
          recipient_type: 'provider',
          recipient_id: selectedProviderForAdvance.id,
          amount: Number(advanceAmount),
          note: "Oldindan avans berildi",
        }),
      })
      toast(`${selectedProviderForAdvance.full_name} ga ${formatMoney(Number(advanceAmount))} avans berildi ✓`)
      setAdvanceModal(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSavingAdvance(false)
    }
  }

  const load = () => {
    api('/providers?active_only=false').then(setItems)
    api('/services/all').then((s) => setAllServices(s || [])).catch(() => {})
    // Berilgan avanslar — avval bu ma'lumot bu bo'limda umuman ko'rinmasdi
    api('/providers/advance-summaries').then((a) => setAdvances(a || {})).catch(() => setAdvances({}))
    api('/inpatients/provider-earnings').then((r) => setInpEarnings(r || [])).catch(() => setInpEarnings([]))
  }
  useEffect(() => { load() }, [])

  const openInpDetail = async (p) => {
    setInpDetail({ provider: p, rows: null })
    setInpDetailOpen(true)
    try {
      const rows = await api(`/inpatients/provider-earnings/${p.id}`)
      setInpDetail({ provider: p, rows: rows || [] })
    } catch (e) {
      setInpDetail({ provider: p, rows: [] })
      toast(e.message, 'error')
    }
  }

  const toggleProviderActive = async (p) => {
    const isAct = p.is_active !== false
    const actionName = isAct ? "ishdan ketgan deb belgilamoqchimisiz" : "qayta faollashtirmoqchimisiz"
    if (!window.confirm(`Haqiqatan ham "${p.full_name}" shifokorini ${actionName}?`)) return
    try {
      await api(`/providers/${p.id}`, { method: 'DELETE' })
      toast(`✓ "${p.full_name}" statusi yangilandi`)
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  const hardDeleteProvider = async (p) => {
    if (!window.confirm(`Haqiqatan ham "${p.full_name}" shifokorini va uning login akkauntini bazadan TO'LIQ O'CHIRMOQCHIMISIZ?`)) return
    try {
      await api(`/providers/${p.id}?hard=true`, { method: 'DELETE' })
      toast(`✓ "${p.full_name}" bazadan to'liq o'chirildi`)
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  const handleOpenAdd = async () => {
    try {
      const svcs = await api('/services/all')
      setAllServices(svcs || [])
    } catch (_) {}
    setEdit(null)
    setForm(emptyForm)
    setModal(true)
  }

  const handleOpenEdit = async (p) => {
    try {
      const svcs = await api('/services/all')
      setAllServices(svcs || [])
    } catch (_) {}
    setEdit(p)
    setForm({
      full_name: p.full_name,
      specialization: p.specialization,
      phone: p.phone,
      percentage: p.percentage !== undefined && p.percentage !== null ? p.percentage : '',
      fixed_salary: p.fixed_salary !== undefined && p.fixed_salary !== null ? p.fixed_salary : '',
      username: p.username || '',
      password: '',
      service_ids: p.service_ids || [],
      is_inpatient_provider: !!p.is_inpatient_provider,
      inpatient_daily_rate: String(p.inpatient_daily_rate ?? STATSIONAR_STANDART),
    })
    setModal(true)
  }

  const save = async () => {
    try {
      const body = {
        full_name: form.full_name,
        specialization: form.specialization,
        phone: form.phone,
        percentage: form.percentage !== '' && form.percentage !== null ? parseInt(form.percentage, 10) : 0,
        fixed_salary: form.fixed_salary !== '' && form.fixed_salary !== null ? parseInt(form.fixed_salary, 10) : 0,
        service_ids: form.service_ids || [],
        is_inpatient_provider: !!form.is_inpatient_provider,
        inpatient_daily_rate: form.inpatient_daily_rate !== '' && form.inpatient_daily_rate !== null
          ? parseInt(form.inpatient_daily_rate, 10) : STATSIONAR_STANDART,
      }
      if (body.is_inpatient_provider && !(body.inpatient_daily_rate > 0)) {
        toast("Statsionar kunlik haqi 0 dan katta bo'lishi kerak", 'error')
        return
      }
      if (form.username) body.username = form.username
      if (form.password) body.password = form.password
      if (edit) await api(`/providers/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/providers', { method: 'POST', body: JSON.stringify(body) })
      toast(edit ? "Yangilandi ✓" : "Yangi shifokor saqlandi ✓")
      setModal(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const payout = async (id) => {
    try {
      const res = await api(`/providers/${id}/payout`, { method: 'POST', body: JSON.stringify({ source: payoutSource }) })
      toast(`Balans chiqarildi: ${formatMoney(res.amount)}`)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  // Group services by Main Category / Bo'lim
  const categoriesMap = {}
  ;(allServices || []).forEach((s) => {
    const raw = s.category || 'Umumiy'
    const mainCat = raw.includes(':') ? raw.split(':')[0].trim() : raw
    if (!categoriesMap[mainCat]) categoriesMap[mainCat] = []
    categoriesMap[mainCat].push(s)
  })

  const toggleCategoryServices = (catSvcs) => {
    const catIds = catSvcs.map((s) => s.id)
    const current = form.service_ids || []
    const allCatSelected = catIds.every((id) => current.includes(id))

    if (allCatSelected) {
      setForm({ ...form, service_ids: current.filter((id) => !catIds.includes(id)) })
    } else {
      const merged = Array.from(new Set([...current, ...catIds]))
      setForm({ ...form, service_ids: merged })
    }
  }

  const toggleService = (sid) => {
    const current = form.service_ids || []
    if (current.includes(sid)) {
      setForm({ ...form, service_ids: current.filter((id) => id !== sid) })
    } else {
      setForm({ ...form, service_ids: [...current, sid] })
    }
  }

  const inpCount = (inpEarnings || []).length

  return (
    <div className="space-y-5">
      {/* "Jami ishlagan" bosilganda: qaysi kuni qancha kelgani */}
      <EarningsDailyModal
        open={!!kunlik}
        onClose={() => setKunlik(null)}
        kind={kunlik?.kind}
        id={kunlik?.id}
        name={kunlik?.name}
      />

      {/* Bo'lim tanlash */}
      <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border w-fit">
        <button
          type="button"
          onClick={() => setTab('doctors')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === 'doctors' ? 'bg-cyan text-slate-950 shadow' : 'text-muted hover:text-body'
          }`}
        >
          👨‍⚕️ Shifokorlar {items ? `(${items.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTab('inpatient')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === 'inpatient' ? 'bg-violet-500 text-white shadow' : 'text-muted hover:text-body'
          }`}
        >
          🛏 Statsionar xizmat ko'rsatuvchi{inpCount > 0 ? ` (${inpCount})` : ''}
        </button>
      </div>

      {tab === 'inpatient' ? (
        <InpatientProvidersPanel
          rows={inpEarnings}
          // Hisobot qatorida shifokorning barcha maydonlari yo'q —
          // tahrirlashga to'liq yozuvni uzatamiz
          onEdit={(p) => handleOpenEdit((items || []).find((x) => x.id === p.id) || p)}
          onDetail={openInpDetail}
          onPayout={payout}
          onAdd={handleOpenAdd}
        />
      ) : (
      <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-black text-cyan uppercase tracking-wider flex items-center gap-2">
            👨‍⚕️ Shifokorlar Ro'yxati ({items?.length || 0} nafar)
          </h3>
          <p className="text-xs text-muted">Mutaxassislar oyligi, KPI stavkalari va ish haqi balansi</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Layout Mode Switcher */}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border mr-2">
            <button
              type="button"
              onClick={() => setLayoutMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${layoutMode === 'cards' ? 'bg-cyan text-slate-950 shadow font-bold' : 'text-muted hover:text-body'}`}
              title="PRO Kartochkalar shakli"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('table')}
              className={`p-1.5 rounded-lg transition-all ${layoutMode === 'table' ? 'bg-cyan text-slate-950 shadow font-bold' : 'text-muted hover:text-body'}`}
              title="Jadval shakli"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <select className="input-field text-xs py-2 max-w-[140px]" value={payoutSource} onChange={(e) => setPayoutSource(e.target.value)}>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <Btn variant="cyan" size="sm" icon={Icons.plus} onClick={handleOpenAdd}>
            Shifokor Qo'shish
          </Btn>
        </div>
      </div>

      {!items ? (
        <TableSkeleton />
      ) : layoutMode === 'cards' ? (
        /* ── PRO GRID CARDS VIEW FOR DOCTORS ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.length === 0 ? (
            <div className="col-span-full">
              <EmptyState icon="🩺" message="Hali shifokor qo'shilmagan" action={<Btn variant="cyan" icon={Icons.plus} onClick={handleOpenAdd}>Qo'shish</Btn>} />
            </div>
          ) : items.map((p, idx) => {
            const initials = `${(p.full_name || 'D')[0]}${(p.full_name.split(' ')[1] || 'S')[0] || ''}`.toUpperCase()
            const isAct = p.is_active !== false

            return (
              <div
                key={p.id}
                className={`card p-5 border-border transition-all duration-300 hover:shadow-xl space-y-4 relative group ${
                  !isAct ? 'opacity-60 bg-black/30 border-rose-500/30' : 'hover:border-cyan/50'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan font-black text-base shadow-sm">
                      {initials}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-body group-hover:text-cyan transition-colors">
                        {p.full_name}
                      </h4>
                      <p className="text-xs text-cyan font-extrabold flex items-center gap-1 mt-0.5">
                        <Stethoscope className="h-3.5 w-3.5" /> {p.specialization || 'Shifokor'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="badge badge-cyan font-mono font-bold text-[11px]">
                      #{idx + 1}
                    </span>
                    {isAct ? (
                      <span className="badge badge-success text-[10px] font-bold">🟢 Faol</span>
                    ) : (
                      <span className="badge badge-danger text-[10px] font-bold">🔴 Ishdan ketgan</span>
                    )}
                  </div>
                </div>

                {/* Info Pills */}
                <div className="space-y-2 text-xs border-t border-b border-border/50 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-bold">📱 Telefon / Login:</span>
                    <span className="font-mono font-bold text-body">{p.phone} {p.username && <span className="text-cyan">(@{p.username})</span>}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted font-bold">💰 Oylik / KPI:</span>
                    {p.fixed_salary > 0 && p.percentage > 0 ? (
                      <span className="badge badge-gold font-mono text-[11px] font-extrabold">{formatMoney(p.fixed_salary)} + {p.percentage}%</span>
                    ) : p.fixed_salary > 0 ? (
                      <span className="text-blue-300 font-mono font-extrabold">{formatMoney(p.fixed_salary)}</span>
                    ) : p.percentage > 0 ? (
                      <span className="badge badge-gold font-mono text-[11px] font-extrabold">{p.percentage}% KPI</span>
                    ) : (
                      <span className="text-muted italic">Belgilanmagan</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted font-bold">🩺 Xizmatlari:</span>
                    {formatDoctorServicesSummary(p.service_ids, allServices)}
                  </div>
                </div>

                {/* Balance & Actions */}
                <div className="bg-surface-2 p-3 rounded-xl border border-border/60 space-y-2">
                 {/* Bugungi va jami ishlagani — balans bitta yig'ma raqam
                     bo'lgani uchun, qancha ishlagani alohida ko'rsatiladi */}
                 <div className="grid grid-cols-2 gap-2">
                   <div>
                     <span className="text-[10px] font-extrabold text-muted uppercase block">Bugun</span>
                     <span className="font-black text-gold font-mono text-sm">
                       {p.today_earned > 0 ? `+${formatMoney(p.today_earned)}` : '—'}
                     </span>
                   </div>
                   <div>
                     <span className="text-[10px] font-extrabold text-muted uppercase block">Jami ishlagan</span>
                     <button
                       type="button"
                       onClick={() => setKunlik({ kind: 'providers', id: p.id, name: p.full_name })}
                       className="font-black text-cyan font-mono text-sm hover:underline"
                       title="Kunma-kun ko'rish"
                     >
                       {formatMoney(p.total_earned)}
                     </button>
                   </div>
                 </div>
                 <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-muted uppercase block">Ish Haq Balansi</span>
                    <span className="font-black text-emerald font-mono text-base">{formatMoney(p.balance)}</span>
                  </div>

                  {p.balance > 0 && isAct && (
                    <button
                      type="button"
                      onClick={() => payout(p.id)}
                      className="btn-emerald py-1.5 px-3 text-xs font-bold shadow-md"
                    >
                      💵 Chiqarish
                    </button>
                  )}
                 </div>

                 {/* Berilgan avans — ilgari bu yerda umuman ko'rinmasdi */}
                 {advances[p.id]?.advances_total > 0 && (
                   <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                     <div>
                       <span className="text-[10px] font-extrabold text-muted uppercase block">Avans olgan</span>
                       <span className="font-black text-amber-400 font-mono text-sm">
                         −{formatMoney(advances[p.id].advances_total)}
                       </span>
                     </div>
                     <div>
                       <span className="text-[10px] font-extrabold text-muted uppercase block">
                         {advances[p.id].debt > 0 ? 'Qarzi' : 'Qoladi'}
                       </span>
                       <span className={`font-black font-mono text-sm ${advances[p.id].debt > 0 ? 'text-rose-400' : 'text-gold'}`}>
                         {formatMoney(advances[p.id].debt > 0 ? advances[p.id].debt : advances[p.id].remaining)}
                       </span>
                     </div>
                   </div>
                 )}
                </div>

                {/* Bottom Action Row — asosiy tugmalar ko'rinib turadi, qolgani
                    ⋮ ichida. Ilgari 4 ta tugma bir qatorda edi va tor
                    kartochkada oxirgisi tashqariga chiqib ketardi. */}
                <div className="pt-2 flex items-center gap-1.5">
                  {isAct && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProviderForAdvance(p)
                        setAdvanceAmount('1000000')
                        setAdvanceModal(true)
                      }}
                      className="btn-gold py-1.5 px-2 text-xs font-bold flex-1 min-w-0 flex items-center justify-center gap-1"
                    >
                      <CreditCard className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Avans</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(p)}
                    className="btn-outline py-1.5 px-2 text-xs font-bold text-body flex-1 min-w-0 flex items-center justify-center gap-1"
                  >
                    <Edit className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Tahrir</span>
                  </button>

                  <div className="shrink-0">
                    <ActionMenu
                      items={[
                        {
                          label: isAct ? "Ishdan ketgan deb belgilash" : 'Qayta faollashtirish',
                          icon: isAct ? Icons.cancel : Icons.check,
                          onClick: () => toggleProviderActive(p),
                        },
                        {
                          label: "Bazadan to'liq o'chirish",
                          icon: Icons.trash,
                          variant: 'danger',
                          onClick: () => hardDeleteProvider(p),
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── TABLE VIEW FOR DOCTORS ── */
        <div className="card overflow-x-auto p-0 border-cyan-500/20 shadow-lg">
          <table className="w-full text-xs">
            <THead cols={['Shifokor', 'Mutaxassislik', 'Bajaradigan Xizmatlari', 'Telefon / Login', 'Oylik / KPI Stavka', 'Status', 'Bugun', 'Jami ishlagan', 'Balans', 'Avans olgan', 'Qoladi / Qarzi', 'Harakatlar']} />
            <tbody className="divide-y divide-border font-semibold">
              {items.length === 0 ? (
                <tr><td colSpan={8} className="py-8"><EmptyState icon="🩺" message="Hali shifokor qo'shilmagan" action={<Btn variant="cyan" icon={Icons.plus} onClick={handleOpenAdd}>Qo'shish</Btn>} /></td></tr>
              ) : items.map((p) => {
                const isAct = p.is_active !== false
                return (
                  <tr key={p.id} className={!isAct ? 'bg-rose-500/5 opacity-60' : 'hover:bg-surface-hover transition-colors whitespace-nowrap'}>
                    <td className="p-3 font-extrabold text-body">{p.full_name}</td>
                    <td className="p-3 text-cyan font-bold">{p.specialization}</td>
                    <td className="p-3">
                      {formatDoctorServicesSummary(p.service_ids, allServices)}
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-body">{p.phone}</div>
                      {p.username ? (
                        <span className="font-mono text-cyan text-[11px]">@{p.username}</span>
                      ) : (
                        <span className="text-muted text-[10px] italic">Login yo'q</span>
                      )}
                    </td>
                    <td className="p-3">
                      {p.fixed_salary > 0 && p.percentage > 0 ? (
                        <span className="badge badge-gold font-mono text-[11px] font-extrabold">{formatMoney(p.fixed_salary)} + {p.percentage}% KPI</span>
                      ) : p.fixed_salary > 0 ? (
                        <span className="text-blue-300 font-mono font-bold">{formatMoney(p.fixed_salary)} (Oylik)</span>
                      ) : p.percentage > 0 ? (
                        <span className="badge badge-gold font-mono text-[11px] font-extrabold">{p.percentage}% (KPI)</span>
                      ) : (
                        <span className="text-muted text-xs italic">Belgilanmagan</span>
                      )}
                    </td>
                    <td className="p-3">
                      {isAct ? (
                        <span className="badge badge-success text-[10px] font-bold">🟢 Faol</span>
                      ) : (
                        <span className="badge badge-danger text-[10px] font-bold">🔴 Ishdan ketgan</span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-gold text-sm">
                      {p.today_earned > 0 ? `+${formatMoney(p.today_earned)}` : '—'}
                    </td>
                    {/* Jami — bosilsa qaysi kundan qancha kelgani ochiladi */}
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setKunlik({ kind: 'providers', id: p.id, name: p.full_name })}
                        className="font-mono font-black text-cyan text-sm hover:underline"
                        title="Kunma-kun ko'rish"
                      >
                        {formatMoney(p.total_earned)}
                      </button>
                    </td>
                    <td className="p-3 font-black font-mono text-emerald text-sm">{formatMoney(p.balance)}</td>
                    <td className="p-3 font-mono font-bold text-amber-400 text-sm">
                      {advances[p.id]?.advances_total > 0 ? `−${formatMoney(advances[p.id].advances_total)}` : '—'}
                    </td>
                    <td className={`p-3 font-mono font-black text-sm ${advances[p.id]?.debt > 0 ? 'text-rose-400' : 'text-gold'}`}>
                      {advances[p.id]?.debt > 0
                        ? `${formatMoney(advances[p.id].debt)} qarz`
                        : formatMoney(advances[p.id] ? advances[p.id].remaining : (p.balance || 0))}
                    </td>
                    <td className="p-3">
                      <ActionMenu
                        items={[
                          {
                            label: 'Balansni chiqarish',
                            icon: Icons.arrowDown,
                            variant: 'success',
                            hidden: !(p.balance > 0 && isAct),
                            onClick: () => payout(p.id),
                          },
                          {
                            label: 'Avans berish',
                            icon: Icons.creditCard,
                            variant: 'gold',
                            hidden: !isAct,
                            onClick: () => {
                              setSelectedProviderForAdvance(p)
                              setAdvanceAmount('1000000')
                              setAdvanceModal(true)
                            },
                          },
                          { label: 'Tahrirlash', icon: Icons.edit, onClick: () => handleOpenEdit(p) },
                          {
                            label: isAct ? "Ishdan ketgan deb belgilash" : 'Qayta tiklash',
                            icon: isAct ? Icons.cancel : Icons.check,
                            onClick: () => toggleProviderActive(p),
                          },
                          {
                            label: "Bazadan to'liq o'chirish",
                            icon: Icons.trash,
                            variant: 'danger',
                            onClick: () => hardDeleteProvider(p),
                          },
                        ]}
                      />

                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {/* Edit / Add Modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={edit ? "Shifokor ma'lumotlarini tahrirlash" : "Yangi Shifokor va Login yaratish"} size="lg">
        <div className="space-y-4 pt-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label font-bold">F.I.Sh (Shifokor Ismi) *</label>
              <input className="input-field text-xs font-semibold" placeholder="Dr. Alisher Karimov"
                value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="form-label font-bold">Mutaxassislik *</label>
              <input className="input-field text-xs font-semibold" placeholder="UZI Shifokori, Stomatolog, ..."
                value={form.specialization || ''} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label font-bold">Telefon</label>
              <input className="input-field text-xs font-mono font-bold" value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="form-label font-bold">Fix Oylik Maosh (so'm)</label>
              <input className="input-field text-xs font-mono font-bold" type="number" placeholder="0"
                value={form.fixed_salary || ''} onChange={(e) => setForm({ ...form, fixed_salary: e.target.value })} />
            </div>
            <div>
              <label className="form-label font-bold">KPI Komissiya Foizi (%)</label>
              <input className="input-field text-xs font-mono font-bold" type="number" placeholder="0"
                value={form.percentage || ''} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
            </div>
          </div>

          {/* Statsionar xizmat ko'rsatuvchi */}
          <div className={`p-3 rounded-xl border space-y-3 transition-colors ${
            form.is_inpatient_provider ? 'bg-violet-500/10 border-violet-500/40' : 'bg-surface-2 border-border'
          }`}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="rounded accent-violet-500 mt-0.5 shrink-0"
                checked={!!form.is_inpatient_provider}
                onChange={(e) => setForm({ ...form, is_inpatient_provider: e.target.checked })}
              />
              <span>
                <span className="font-bold text-violet-300 text-xs uppercase tracking-wider block">
                  🛏 Statsionar xizmat ko'rsatuvchi
                </span>
                <span className="text-[11px] text-muted font-semibold">
                  Belgilansa, statsionarga bemor yotqizishda tanlash mumkin bo'ladi va
                  bemor yotgan har bir kun uchun quyidagi summa hisobiga yoziladi.
                  Bu foizdan alohida — statsionar to'lovlaridan foiz olinmaydi.
                </span>
              </span>
            </label>

            {form.is_inpatient_provider && (
              <div className="pl-6">
                <label className="form-label font-bold">Bir kun uchun haq (so'm) *</label>
                <input
                  className="input-field text-sm font-mono font-bold text-gold max-w-[220px]"
                  type="number"
                  min={0}
                  placeholder={String(STATSIONAR_STANDART)}
                  value={form.inpatient_daily_rate}
                  onChange={(e) => setForm({ ...form, inpatient_daily_rate: e.target.value })}
                />
                <p className="text-[11px] text-muted font-semibold mt-1">
                  Bu yerda o'zgartirilsa, faqat bundan keyingi kunlarga ta'sir qiladi —
                  allaqachon yozilgan kunlar qayta hisoblanmaydi.
                </p>
              </div>
            )}
          </div>

          <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-3">
            <h4 className="font-bold text-gold text-xs uppercase tracking-wider">🔑 Shifokor Tizimga Kirishi Uchun Login & Parol</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Tizim Logini (Username)</label>
                <input className="input-field text-xs font-mono font-bold" placeholder="doctor_uzi"
                  value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Yangi Parol</label>
                <input className="input-field text-xs font-mono" type="password" placeholder="Parol kiriting"
                  value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Assigned Services */}
          <div>
            <label className="form-label font-bold mb-2 block">🩺 Shifokor Bajaradigan Xizmat Turini Tanlang:</label>
            <div className="max-h-64 overflow-y-auto space-y-4 p-3 bg-surface-2 rounded-xl border border-border">
              {Object.keys(categoriesMap).map((catName) => {
                const catSvcs = categoriesMap[catName] || []
                const catIds = catSvcs.map((s) => s.id)
                const current = form.service_ids || []
                const allSelected = catIds.length > 0 && catIds.every((id) => current.includes(id))
                const selectedCount = catIds.filter((id) => current.includes(id)).length

                return (
                  <div key={catName} className="space-y-2 border border-border/40 rounded-xl p-2.5 bg-surface-sunken">
                    <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gold text-xs uppercase tracking-wider">
                          {catName === 'Laboratoriya' ? '🧪 LABORATORIYA' : catName.toUpperCase()}
                        </span>
                        <span className="badge badge-muted text-[10px] font-bold">
                          {selectedCount}/{catSvcs.length} ta tanlandi
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCategoryServices(catSvcs)}
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition-all ${
                          allSelected
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                            : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30'
                        }`}
                      >
                        {allSelected ? '✕ Barchasini Yechish' : '✓ Barchasini Biriktirish'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {catSvcs.map((svc) => {
                        const isChecked = current.includes(svc.id)
                        return (
                          <label
                            key={svc.id}
                            className={`flex items-center gap-2 p-1.5 px-2 rounded-lg cursor-pointer border transition-all text-[11px] ${
                              isChecked
                                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 font-bold'
                                : 'bg-surface-1 hover:bg-surface-hover border-border/40 text-body font-semibold'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleService(svc.id)}
                              className="rounded accent-cyan shrink-0"
                            />
                            <span className="truncate">{svc.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setModal(false)}>Bekor Qilish</Btn>
            <Btn variant="cyan" full icon={Icons.save} onClick={save}>✓ Saqlash</Btn>
          </div>
        </div>
      </Modal>

      {/* Statsionar kunma-kun hisobi */}
      <Modal
        open={inpDetailOpen}
        onClose={() => setInpDetailOpen(false)}
        title={`Statsionar kunlik hisobi — ${inpDetail?.provider?.full_name || ''}`}
        size="lg"
      >
        <div className="space-y-3 text-xs">
          {!inpDetail?.rows ? (
            <TableSkeleton />
          ) : inpDetail.rows.length === 0 ? (
            <EmptyState icon="🛏" message="Hali kunlik haq yozilmagan" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-2 rounded-xl border border-border">
                <div>
                  <span className="text-[10px] font-extrabold text-muted uppercase block">Jami</span>
                  <span className="font-black text-emerald font-mono text-base">
                    {formatMoney(inpDetail.rows.reduce((s, r) => s + (r.amount || 0), 0))}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-muted uppercase block">Kunlar</span>
                  <span className="font-black text-body font-mono text-base">{inpDetail.rows.length} kun</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-muted uppercase block">Kunlik stavka</span>
                  <span className="font-black text-gold font-mono text-base">
                    {formatMoney(inpDetail.provider?.daily_rate || 0)}
                  </span>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <THead cols={['Sana', 'Bemor', 'Palata', 'Holati', 'Summa']} />
                  <tbody className="divide-y divide-border font-semibold">
                    {inpDetail.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                        <td className="p-2.5 font-mono font-bold text-body">{r.date}</td>
                        <td className="p-2.5 font-bold text-body">{r.patient_name}</td>
                        <td className="p-2.5 text-muted font-bold">{r.room_number}</td>
                        <td className="p-2.5">
                          {r.status === 'yotmoqda' ? (
                            <span className="badge badge-info text-[10px] font-bold">Yotibdi</span>
                          ) : (
                            <span className="badge badge-muted text-[10px] font-bold">Chiqgan</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-black text-gold text-right">
                          +{formatMoney(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted font-semibold">
                Oxirgi {inpDetail.rows.length} ta yozuv ko'rsatilmoqda.
              </p>
            </>
          )}
        </div>
      </Modal>

      {/* Advance Modal */}
      <Modal open={advanceModal} onClose={() => setAdvanceModal(false)} title={`Avans Berish — [ ${selectedProviderForAdvance?.full_name} ]`} size="sm">
        <div className="space-y-4 text-xs">
          <div>
            <label className="form-label font-bold">Avans Summasi (so'm) *</label>
            <input
              type="number"
              className="input-field text-sm font-mono font-bold text-gold"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setAdvanceModal(false)}>Bekor</Btn>
            <Btn variant="gold" full icon={Icons.save} loading={savingAdvance} onClick={handleGiveAdvance}>✓ Avans Berish</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
