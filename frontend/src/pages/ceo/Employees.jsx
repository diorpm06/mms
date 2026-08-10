import { useEffect, useState } from 'react'
import {
  Users, UserCheck, DollarSign, History, Edit, Plus, Grid, List,
  Briefcase, Bell, CheckCircle, Trash2, UserX, UserPlus
} from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, PageHeader, THead, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'
import CeoProviders from './Providers'

export default function CeoEmployees() {
  const [activeTab, setActiveTab] = useState('employees') // 'employees' | 'providers'
  const [layoutMode, setLayoutMode] = useState('cards') // Default: PRO Card View!
  const [items,        setItems]        = useState(null)
  const [modal,        setModal]        = useState(false)
  const [edit,         setEdit]         = useState(null)
  const [form,         setForm]         = useState({ full_name: '', position: '', monthly_salary: '' })
  const [confirmPayId, setConfirmPayId] = useState(null)
  const [paySummary,   setPaySummary]   = useState(null)
  const [historyEmp,   setHistoryEmp]   = useState(null)
  const [history,      setHistory]      = useState([])
  const [reminder,     setReminder]     = useState({ enabled: false, time: '09:00', day_of_month: 1, month: 0 })
  const toast = useToastStore((s) => s.add)

  const load = async () => {
    const [emps, rem] = await Promise.all([
      api('/employees?include_inactive=true'),
      api('/employees/salary-reminder/config')
    ])
    setItems(emps)
    setReminder({
      enabled: !!rem.enabled,
      time: rem.time || '09:00',
      day_of_month: rem.day_of_month || 1,
      month: rem.month || 0,
    })
  }
  useEffect(() => { load() }, [])

  const toggleEmployeeActive = async (e) => {
    const isAct = e.is_active !== false
    const actionName = isAct ? "ishdan bo'shatilgan qilib belgilamoqchimisiz" : "qayta ishga tiklamoqchimisiz"
    if (!window.confirm(`Haqiqatan ham "${e.full_name}" xodomini ${actionName}?`)) return
    try {
      await api(`/employees/${e.id}`, { method: 'DELETE' })
      toast(`✓ "${e.full_name}" statusi yangilandi`)
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  const hardDeleteEmployee = async (e) => {
    if (!window.confirm(`Haqiqatan ham "${e.full_name}" xodomini va maosh tarixini bazadan TO'LIQ O'CHIRMOQCHIMISIZ?`)) return
    try {
      await api(`/employees/${e.id}?hard=true`, { method: 'DELETE' })
      toast(`✓ "${e.full_name}" bazadan to'liq o'chirildi`)
      load()
    } catch (err) { toast(err.message, 'error') }
  }

  const save = async () => {
    if (!form.full_name || !form.position || !form.monthly_salary) {
      toast("Barcha maydonlarni to'ldiring", 'error'); return
    }
    try {
      const body = { ...form, monthly_salary: parseInt(form.monthly_salary, 10) }
      if (edit) await api(`/employees/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/employees', { method: 'POST', body: JSON.stringify(body) })
      toast('Saqlandi ✓')
      setModal(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const paySalary = async (id) => {
    try {
      const res = await api(`/employees/${id}/pay-salary`, { method: 'POST' })
      toast(`Maosh to'landi: ${formatMoney(res.amount)}`)
      setConfirmPayId(null)
      setPaySummary(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
      setConfirmPayId(null)
      setPaySummary(null)
    }
  }

  const openHistory = async (emp) => {
    setHistoryEmp(emp)
    const data = await api(`/employees/${emp.id}/salary-history`)
    setHistory(data || [])
  }

  const saveReminder = async () => {
    try {
      await api('/employees/salary-reminder/config', {
        method: 'POST',
        body: JSON.stringify(reminder),
      })
      toast('Maosh eslatma vaqti saqlandi ✓')
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="👥 Xodimlar va Shifokorlar Boshqaruvi (PRO)"
        subtitle="Shtat xodimlari, shifokorlar (xizmat ko'rsatuvchilar) va ularning maosh/ulushlari"
        icon={Icons.user}
      />

      {/* ── UNIFIED SUB-TABS NAV ──────────────────────────────────── */}
      <div className="card p-2 flex flex-wrap gap-2 border-gold/30">
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          className={`px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'employees'
              ? 'bg-gold text-slate-950 shadow-md scale-[1.02] font-black'
              : 'bg-surface-2 text-body hover:bg-surface-hover border border-border'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Shtat Xodimlari Ro'yxati ({items?.length || 0} nafar)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'providers'
              ? 'bg-cyan-400 text-slate-950 shadow-md scale-[1.02] font-black'
              : 'bg-surface-2 text-body hover:bg-surface-hover border border-border'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Shifokorlar (Xizmat Ko'rsatuvchilar & Ulushlar)</span>
        </button>
      </div>

      {/* TAB 2: SHIFOKORLAR (PROVIDERS) EMBEDDED */}
      {activeTab === 'providers' ? (
        <CeoProviders />
      ) : (
        /* TAB 1: SHTAT XODIMLARI RO'YXATI */
        <div className="space-y-6">
          {/* Telegram Maosh Eslatmasi */}
          <div className="card p-4 border-gold/30">
            <h2 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2 text-gold">
              <Bell className="h-4 w-4" /> Telegram Maosh Eslatmasi Sozlamalari
            </h2>
            <div className="grid gap-3 md:grid-cols-5 items-end">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminder.enabled}
                  onChange={(e) => setReminder({ ...reminder, enabled: e.target.checked })}
                  className="rounded accent-gold"
                />
                <span className="text-body">Avto Eslatma Yoqilsin</span>
              </label>
              <div>
                <label className="form-label text-xs">Yuborish Vaqti</label>
                <input className="input-field text-xs font-mono font-bold" type="time" value={reminder.time}
                  onChange={(e) => setReminder({ ...reminder, time: e.target.value })} />
              </div>
              <div>
                <label className="form-label text-xs">Har Oyning Kuni (1–31)</label>
                <input className="input-field text-xs font-mono font-bold" type="number" min={1} max={31} value={reminder.day_of_month}
                  onChange={(e) => setReminder({ ...reminder, day_of_month: +e.target.value || 1 })} />
              </div>
              <div>
                <label className="form-label text-xs">Oy</label>
                <select className="input-field text-xs font-bold" value={reminder.month}
                  onChange={(e) => setReminder({ ...reminder, month: +e.target.value })}>
                  <option value={0}>Har oy takrorlansin</option>
                  {['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'].map((m,i) => (
                    <option key={m} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <Btn variant="gold" size="sm" icon={Icons.save} onClick={saveReminder}>
                Sozlamani Saqlash
              </Btn>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <h3 className="text-xs font-black text-gold uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4" /> Klinika Shtat Xodimlari ({items?.length || 0} nafar)
            </h3>

            <div className="flex items-center gap-3">
              {/* Layout Switcher */}
              <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setLayoutMode('cards')}
                  className={`p-1.5 rounded-lg transition-all ${layoutMode === 'cards' ? 'bg-gold text-slate-950 shadow font-bold' : 'text-muted hover:text-body'}`}
                  title="PRO Kartochkalar shakli"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('table')}
                  className={`p-1.5 rounded-lg transition-all ${layoutMode === 'table' ? 'bg-gold text-slate-950 shadow font-bold' : 'text-muted hover:text-body'}`}
                  title="Jadval shakli"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              <Btn
                variant="gold"
                size="sm"
                icon={Icons.plus}
                onClick={() => { setEdit(null); setForm({ full_name: '', position: '', monthly_salary: '' }); setModal(true) }}
              >
                Yangi Xodim Qo'shish
              </Btn>
            </div>
          </div>

          {!items ? (
            <TableSkeleton />
          ) : layoutMode === 'cards' ? (
            /* ── PRO GRID CARDS VIEW FOR STAFF EMPLOYEES ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState icon="👤" message="Hali xodim qo'shilmagan" action={<Btn variant="gold" icon={Icons.plus} onClick={() => { setEdit(null); setModal(true) }}>Qo'shish</Btn>} />
                </div>
              ) : items.map((e, idx) => {
                const initials = `${(e.full_name || 'X')[0]}${(e.full_name.split(' ')[1] || 'O')[0] || ''}`.toUpperCase()
                const isAct = e.is_active !== false

                return (
                  <div
                    key={e.id}
                    className={`card p-5 border-border transition-all duration-300 hover:shadow-xl space-y-4 relative group ${
                      !isAct ? 'opacity-60 bg-black/30 border-rose-500/30' : 'hover:border-gold/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold/30 to-amber-500/10 border border-gold/40 flex items-center justify-center text-gold font-black text-base shadow-sm">
                          {initials}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base text-body group-hover:text-gold transition-colors">
                            {e.full_name}
                          </h4>
                          <p className="text-xs text-muted flex items-center gap-1 mt-0.5 font-bold">
                            <Briefcase className="h-3.5 w-3.5 text-gold" /> {e.position}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="badge badge-gold font-mono font-bold text-[11px]">
                          #{idx + 1}
                        </span>
                        {isAct ? (
                          <span className="badge badge-success text-[10px] font-bold">🟢 Faol</span>
                        ) : (
                          <span className="badge badge-danger text-[10px] font-bold">🔴 Ishdan bo'shatilgan</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface-2 p-3 rounded-xl border border-border/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold text-muted uppercase block">Belgilangan Oylik Maosh</span>
                        <span className="font-black text-emerald font-mono text-base">{formatMoney(e.monthly_salary)}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-1.5 flex-wrap">
                      {isAct && (
                        <button
                          type="button"
                          onClick={async () => {
                            setConfirmPayId(e.id)
                            try {
                              const s = await api(`/employees/${e.id}/payroll-summary`)
                              setPaySummary(s)
                            } catch (_) { setPaySummary(null) }
                          }}
                          className="btn-gold py-1.5 px-3 text-xs font-extrabold flex-1 flex items-center justify-center gap-1 shadow-md"
                        >
                          💵 Maosh Berish
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openHistory(e)}
                        className="btn-outline py-1.5 px-2 text-xs text-muted hover:text-gold"
                        title="Maosh berish tarixi"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => { setEdit(e); setForm({ ...e, monthly_salary: String(e.monthly_salary) }); setModal(true) }}
                        className="btn-outline py-1.5 px-2 text-xs text-muted hover:text-gold"
                        title="Tahrirlash"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>

                      {/* Toggle Fired / Dismissed Status */}
                      <button
                        type="button"
                        onClick={() => toggleEmployeeActive(e)}
                        className={`btn-outline py-1.5 px-2 text-xs ${
                          isAct ? 'text-amber-400 hover:bg-amber-500/20 border-amber-500/40' : 'text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/40'
                        }`}
                        title={isAct ? "Xodimni ishdan ketgan deb belgilash" : "Xodimni qayta tiklash"}
                      >
                        {isAct ? <UserX className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                      </button>

                      {/* Permanent Hard Delete */}
                      <button
                        type="button"
                        onClick={() => hardDeleteEmployee(e)}
                        className="btn-outline py-1.5 px-2 text-xs text-rose-400 hover:bg-rose-500/20 border-rose-500/40"
                        title="Bazadan to'liq o'chirish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── TABLE VIEW FOR STAFF EMPLOYEES ── */
            <div className="card overflow-x-auto p-0 border-gold/20 shadow-lg">
              <table className="w-full text-xs">
                <THead cols={['#', 'Xodim F.I.Sh', 'Lavozimi', 'Oylik Maosh', 'Status', 'Harakatlar']} />
                <tbody className="divide-y divide-border font-semibold">
                  {items.map((e, idx) => {
                    const isAct = e.is_active !== false
                    return (
                      <tr key={e.id} className={!isAct ? 'bg-rose-500/5 opacity-60' : 'hover:bg-surface-hover transition-colors'}>
                        <td className="p-3 text-muted font-mono">#{idx + 1}</td>
                        <td className="p-3 font-extrabold text-body">{e.full_name}</td>
                        <td className="p-3 text-muted font-bold">{e.position}</td>
                        <td className="p-3 font-mono font-black text-emerald text-sm">{formatMoney(e.monthly_salary)}</td>
                        <td className="p-3">
                          {isAct ? (
                            <span className="badge badge-success text-[10px] font-bold">🟢 Faol</span>
                          ) : (
                            <span className="badge badge-danger text-[10px] font-bold">🔴 Ishdan bo'shatilgan</span>
                          )}
                        </td>
                        <td className="p-3">
                          <ActionRow>
                            {isAct && (
                              <Btn
                                variant="gold"
                                size="xs"
                                icon={Icons.money}
                                title="Maosh berish"
                                onClick={async () => {
                                  setConfirmPayId(e.id)
                                  try {
                                    const s = await api(`/employees/${e.id}/payroll-summary`)
                                    setPaySummary(s)
                                  } catch (_) { setPaySummary(null) }
                                }}
                              >
                                Maosh Berish
                              </Btn>
                            )}

                            <Btn variant="ghost" size="xs" icon={Icons.history} onClick={() => openHistory(e)} title="Maosh tarixi">
                              Tarix
                            </Btn>

                            <Btn
                              variant="outline"
                              size="xs"
                              icon={Icons.edit}
                              title="Tahrirlash"
                              onClick={() => { setEdit(e); setForm({ ...e, monthly_salary: String(e.monthly_salary) }); setModal(true) }}
                            >
                              Tahrir
                            </Btn>

                            <Btn
                              variant={isAct ? "amber" : "success"}
                              size="xs"
                              onClick={() => toggleEmployeeActive(e)}
                              title={isAct ? "Ishdan bo'shatish" : "Qayta tiklash"}
                            >
                              {isAct ? "Ishdan ketgan" : "Tiklash"}
                            </Btn>

                            <Btn
                              variant="danger"
                              size="xs"
                              icon={Icons.trash}
                              onClick={() => hardDeleteEmployee(e)}
                              title="Bazadan to'liq o'chirish"
                            >
                              O'chirish
                            </Btn>
                          </ActionRow>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={edit ? 'Xodimni tahrirlash' : "Yangi xodim qo'shish"} size="sm">
        <div className="space-y-4 pt-1 text-xs">
          <div>
            <label className="form-label font-bold">To'liq ism *</label>
            <input className="input-field text-xs font-semibold" placeholder="Familiya Ism"
              value={form.full_name || ''}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="form-label font-bold">Lavozim *</label>
            <input className="input-field text-xs font-semibold" placeholder="Hamshira, Kassir, ..."
              value={form.position || ''}
              onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </div>
          <div>
            <label className="form-label font-bold">Oylik maosh (so'm) *</label>
            <input className="input-field text-xs font-mono font-bold" type="number" placeholder="0"
              value={form.monthly_salary || ''}
              onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setModal(false)}>Bekor</Btn>
            <Btn variant="gold" full icon={Icons.save} onClick={save}>✓ Saqlash</Btn>
          </div>
        </div>
      </Modal>

      {/* Confirm Pay Modal */}
      <Modal open={!!confirmPayId} onClose={() => { setConfirmPayId(null); setPaySummary(null) }} title="Maosh To'lashni Tasdiqlash" size="sm">
        <div className="space-y-4 text-xs">
          {paySummary ? (
            <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-2">
              <p className="font-bold text-body text-sm">{paySummary.employee_name}</p>
              <div className="flex justify-between font-mono">
                <span className="text-muted">Lavozim:</span>
                <span className="font-bold">{paySummary.position}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted">Oylik me'yor:</span>
                <span className="font-bold">{formatMoney(paySummary.monthly_salary)}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted">Ushbu oy to'langan:</span>
                <span className="font-bold text-rose-400">{formatMoney(paySummary.paid_this_month)}</span>
              </div>
              <div className="flex justify-between font-mono border-t border-border pt-2 text-sm">
                <span className="font-bold text-gold">To'lanadigan summa:</span>
                <span className="font-black text-emerald">{formatMoney(paySummary.net_payable)}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted font-bold">Hisob-kitob qilinmoqda...</p>
          )}

          <div className="flex gap-2 pt-1">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => { setConfirmPayId(null); setPaySummary(null) }}>Bekor</Btn>
            <Btn variant="gold" full icon={Icons.money} onClick={() => paySalary(confirmPayId)}>✓ Tasdiqlash va To'lash</Btn>
          </div>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal open={!!historyEmp} onClose={() => setHistoryEmp(null)} title={`Maosh Tarixi — ${historyEmp?.full_name}`} size="md">
        <div className="space-y-3 text-xs">
          {history.length === 0 ? (
            <EmptyState icon="📜" message="Hali maosh to'lanmagan" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <THead cols={['#', 'Sana', 'Summa', 'Status']} />
                <tbody className="divide-y divide-border font-semibold">
                  {history.map((h, i) => (
                    <tr key={h.id || i}>
                      <td className="p-2 text-muted font-mono">#{i + 1}</td>
                      <td className="p-2 text-body font-mono">{h.date || h.created_at}</td>
                      <td className="p-2 font-mono font-black text-emerald text-sm">{formatMoney(h.amount)}</td>
                      <td className="p-2"><span className="badge badge-success font-bold">✓ To'langan</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
