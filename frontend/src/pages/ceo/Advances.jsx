import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, THead, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'

export default function CeoAdvances() {
  const [advances, setAdvances] = useState(null)
  const [providers, setProviders] = useState([])
  const [referrers, setReferrers] = useState([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    recipient_type: 'provider', // 'provider' | 'referrer'
    recipient_id: '',
    amount: '',
    note: '',
  })
  const toast = useToastStore((s) => s.add)

  const load = () => {
    Promise.all([
      api('/advances'),
      api('/providers?active_only=true'),
      api('/referrers'),
    ])
      .then(([adv, prov, ref]) => {
        setAdvances(adv || [])
        setProviders(prov || [])
        setReferrers(ref || [])
      })
      .catch((e) => toast(e.message, 'error'))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreateModal = () => {
    setForm({
      recipient_type: 'provider',
      recipient_id: providers[0]?.id || '',
      amount: '1000000',
      note: 'Oldindan avans berildi',
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.recipient_id || !form.amount) {
      toast("Qabul qiluvchi va summani kiriting", 'error')
      return
    }
    setLoading(true)
    try {
      await api('/advances', {
        method: 'POST',
        body: JSON.stringify({
          recipient_type: form.recipient_type,
          recipient_id: Number(form.recipient_id),
          amount: Number(form.amount),
          note: form.note,
        }),
      })
      toast("Avans berildi va ro'yxatga saqlandi ✓")
      setModal(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSettle = async (id, remaining) => {
    const amtStr = prompt(`Qoplanadigan summani kiriting (Mavjud qarz: ${formatMoney(remaining)}):`, String(remaining))
    if (!amtStr) return
    const amt = parseInt(amtStr, 10)
    if (isNaN(amt) || amt <= 0) return

    try {
      const res = await api(`/advances/${id}/settle?amount=${amt}`, { method: 'POST' })
      toast(res.message)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avanslar Tizimi (Oldindan to'lovlar)"
        subtitle="Shifokorlar va yo'naltiruvchilarga berilgan avanslar hamda 10-kunlik qoplovlar"
        icon={Icons.creditCard}
      >
        <Btn variant="gold" icon={Icons.plus} onClick={openCreateModal}>
          + Yangi Avans Berish
        </Btn>
      </PageHeader>

      {!advances ? (
        <TableSkeleton />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <THead cols={['Qabul Qiluvchi', 'Turi', 'Berilgan Summa', 'Qolgan Qarz', 'Izoh', 'Holat', 'Sana', 'Amallar']} />
            <tbody>
              {advances.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon="💵"
                      message="Hali hech kimga avans berilmagan"
                      action={
                        <Btn variant="gold" icon={Icons.plus} onClick={openCreateModal}>
                          Avans Berish
                        </Btn>
                      }
                    />
                  </td>
                </tr>
              ) : (
                advances.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="td-cell font-bold text-foreground">{a.recipient_name}</td>
                    <td className="td-cell">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          a.recipient_type === 'provider'
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {a.recipient_type === 'provider' ? '👨‍⚕️ Shifokor' : "🤝 Yo'naltiruvchi"}
                      </span>
                    </td>
                    <td className="td-cell font-bold text-slate-200">{formatMoney(a.amount)}</td>
                    <td className="td-cell font-black text-rose-400 font-mono">
                      {formatMoney(a.remaining)}
                    </td>
                    <td className="td-cell text-xs text-muted max-w-xs truncate">{a.note || '—'}</td>
                    <td className="td-cell">
                      {a.is_settled ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          ✓ Qoplandi
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                          ⌛ Qarzdorlik
                        </span>
                      )}
                    </td>
                    <td className="td-cell text-xs text-muted font-mono">
                      {new Date(a.created_at).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="td-cell">
                      {!a.is_settled && (
                        <Btn
                          variant="outline"
                          size="xs"
                          icon={Icons.check}
                          onClick={() => handleSettle(a.id, a.remaining)}
                        >
                          Qoplash
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title="Oldindan Avans Berish" size="sm">
        <div className="space-y-4">
          <div>
            <label className="form-label">Kimga beriladi? *</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  form.recipient_type === 'provider'
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_type: 'provider',
                    recipient_id: providers[0]?.id || '',
                  })
                }
              >
                👨‍⚕️ Shifokorga
              </button>
              <button
                type="button"
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  form.recipient_type === 'referrer'
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_type: 'referrer',
                    recipient_id: referrers[0]?.id || '',
                  })
                }
              >
                🤝 Yo'naltiruvchiga
              </button>
            </div>

            <select
              className="input-field font-semibold"
              value={form.recipient_id}
              onChange={(e) => setForm({ ...form, recipient_id: e.target.value })}
            >
              {form.recipient_type === 'provider'
                ? providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.specialization})
                    </option>
                  ))
                : referrers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} ({r.phone})
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="form-label">Avans summasi (so'm) *</label>
            <input
              type="number"
              className="input-field font-bold text-lg text-emerald-400"
              placeholder="1000000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <p className="text-[11px] text-muted mt-1">
              💡 Ushbu summa kelgusi 10-kunlik foiz to'lovlarida avtomatik ravishda qisqartirib boriladi.
            </p>
          </div>

          <div>
            <label className="form-label">Izoh / Maqsad</label>
            <input
              className="input-field"
              placeholder="Masalan: Shaxsiy ehtiyoj uchun oldindan avans"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setModal(false)}>
              Bekor
            </Btn>
            <Btn variant="gold" full icon={Icons.save} loading={loading} onClick={handleSave}>
              Avansni Saqlash
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
