import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Package, Wallet } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { PageHeader, Btn } from '../../components/UIKit'

const PAYMENT_TYPES = [
  { value: 'naqd', label: 'Naqd' },
  { value: 'karta', label: 'Karta' },
  { value: 'click', label: 'Click' },
  { value: 'qr', label: 'QR' },
]

export default function WarehousePanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState({}) // itemId -> { item, amount }
  const [paymentType, setPaymentType] = useState('naqd')
  const [selling, setSelling] = useState(false)
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 })
  const toast = useToastStore((s) => s.add)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, sales] = await Promise.all([
        api('/inventory'),
        api('/inventory/my-today-sales').catch(() => ({ count: 0, total: 0 })),
      ])
      setItems(inv || [])
      setTodaySales(sales || { count: 0, total: 0 })
    } catch (e) {
      toast(e.message || "Ma'lumot yuklashda xatolik", 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const toggleItem = (item) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[item.id]) {
        delete next[item.id]
      } else {
        next[item.id] = { item, amount: 1 }
      }
      return next
    })
  }

  const changeAmount = (itemId, amount) => {
    setSelected((prev) => {
      const entry = prev[itemId]
      if (!entry) return prev
      return { ...prev, [itemId]: { ...entry, amount: Math.max(1, Number(amount) || 1) } }
    })
  }

  const selectedList = Object.values(selected)
  const selectedTotal = selectedList.reduce((sum, { item, amount }) => sum + (item.unit_price || 0) * amount, 0)

  const filteredItems = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))

  const handleSell = async () => {
    if (!selectedList.length) return
    setSelling(true)
    try {
      for (const { item, amount } of selectedList) {
        await api(`/inventory/${item.id}/consume`, {
          method: 'POST',
          body: JSON.stringify({
            amount,
            charge_patient: true,
            payment_type: paymentType,
            notes: 'Omborchi hisobidan sotildi',
          }),
        })
      }
      toast(`✓ ${selectedList.length} ta material sotildi: ${formatMoney(selectedTotal)}`)
      setSelected({})
      load()
    } catch (e) {
      toast(e.message || 'Sotishda xatolik', 'error')
    } finally {
      setSelling(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-24">
      <PageHeader title="Omborxona" subtitle="Ishlatilgan materialni tanlang, pulni oling va tasdiqlang">
        <Btn variant="ghost" size="sm" icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />} onClick={load} disabled={loading}>
          Yangilash
        </Btn>
      </PageHeader>

      {/* Bugun sotilgan material */}
      <div className="card p-4 border-emerald-500/25 shadow-sm space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-500">
            Bugun sotilgan material
          </span>
        </div>
        <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
          {formatMoney(todaySales.total || 0)}
        </p>
        <p className="text-[11px] text-muted font-semibold">{todaySales.count || 0} ta sotuv</p>
      </div>

      {/* Qidiruv */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
        <input
          className="input-field pl-10 text-sm font-semibold py-2.5 rounded-xl"
          placeholder="Material nomini izlang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Material ro'yxati */}
      <div className="max-h-80 overflow-y-auto space-y-2 p-3 bg-surface-2 rounded-2xl border border-border">
        {loading ? (
          <p className="text-center text-muted font-bold py-6">Yuklanmoqda...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-center text-muted font-bold py-6">Materiallar topilmadi</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredItems.map((item) => {
              const isSelected = !!selected[item.id]
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between border transition-all ${
                    isSelected
                      ? 'border-gold bg-gold/15 font-bold shadow-md ring-1 ring-gold/40'
                      : 'border-border/60 bg-surface-1 hover:bg-surface hover:border-gold/30'
                  }`}
                >
                  <div className="min-w-0 pr-2 flex items-center gap-2.5">
                    <Package className="h-4 w-4 text-muted shrink-0" />
                    <div className="min-w-0">
                      <h5 className="font-extrabold text-body text-xs truncate">{item.name}</h5>
                      <p className="text-[11px] text-muted font-semibold mt-0.5">
                        Narxi: <strong className="text-gold font-mono">{formatMoney(item.unit_price)}</strong>
                        {' · '}Qoldiq: <strong className="text-emerald-400 font-mono">{item.quantity} {item.unit}</strong>
                      </p>
                    </div>
                  </div>
                  {isSelected && <span className="badge badge-gold text-[10px] shrink-0 font-extrabold">✓</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tanlangan materiallar */}
      {selectedList.length > 0 && (
        <div className="p-4 bg-surface-2 rounded-2xl border border-gold/40 space-y-3 shadow-md">
          <span className="text-xs font-extrabold text-gold uppercase tracking-wider block">
            🧾 Tanlangan Materiallar ({selectedList.length} ta)
          </span>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {selectedList.map(({ item, amount }) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-1 border border-border">
                <div className="min-w-0 pr-2">
                  <span className="font-extrabold text-body text-xs block truncate">{item.name}</span>
                  <span className="text-[11px] text-muted font-mono">Qoldiq: {item.quantity} {item.unit}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => changeAmount(item.id, amount - 1)}
                    className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-rose-500/20 text-rose-400 border border-border flex items-center justify-center text-sm font-black transition-all active:scale-95"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => changeAmount(item.id, e.target.value)}
                    className="input-field text-xs font-mono font-black text-center w-14 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => changeAmount(item.id, amount + 1)}
                    className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-emerald-500/20 text-emerald-400 border border-border flex items-center justify-center text-sm font-black transition-all active:scale-95"
                  >
                    +
                  </button>
                  <span className="text-[11px] font-bold text-gold bg-gold/10 px-2 py-1 rounded-lg border border-gold/30 shrink-0">
                    {item.unit}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleItem(item)}
                    className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-rose-500/20 text-rose-400 border border-border flex items-center justify-center shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* To'lov turi */}
          <div className="pt-3 border-t border-border/60 space-y-2">
            <span className="text-[11px] font-extrabold text-muted uppercase tracking-wider block">To'lov turi</span>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setPaymentType(pt.value)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                    paymentType === pt.value
                      ? 'bg-gold text-slate-950 border-gold shadow'
                      : 'bg-surface-1 border-border text-muted hover:text-body'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono bg-surface-sunken p-3 rounded-xl border border-emerald-500/40 shadow-inner">
            <span className="text-body font-sans font-extrabold">Jami olinadigan pul:</span>
            <span className="text-emerald-400 font-black text-base">{formatMoney(selectedTotal)}</span>
          </div>

          <button
            type="button"
            disabled={selling}
            onClick={handleSell}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selling ? 'Saqlanmoqda...' : `✓ Sotishni Tasdiqlash (${formatMoney(selectedTotal)})`}
          </button>
        </div>
      )}
    </div>
  )
}
