import { useEffect, useState } from 'react'
import { Package, AlertTriangle, Plus, ArrowDownRight, ArrowUpRight, Trash2, Search, Edit3 } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/Modal'

export default function Inventory() {
  const role = useAuthStore((s) => s.role)
  const location = useLocation()
  
  // Strictly CEO view only if URL path starts with /ceo AND role is ceo
  const isCEO = role === 'ceo' && location.pathname.startsWith('/ceo')

  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | 'logs'
  const [items, setItems] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [restockModal, setRestockModal] = useState(null)
  
  // Consume Modal State
  const [consumeModal, setConsumeModal] = useState(null)
  const [amountInput, setAmountInput] = useState('1')
  const [ticketInput, setTicketInput] = useState('')
  const [chargePatient, setChargePatient] = useState(false)
  const [paymentType, setPaymentType] = useState('naqd')
  const [customPrice, setCustomPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toast = useToastStore((s) => s.add)

  const [form, setForm] = useState({
    name: '',
    category: 'Sarflash materiali',
    quantity: '',
    unit: 'dona',
    min_quantity: '10',
    unit_price: '',
    cost_price: '',
    notes: '',
  })

  const loadItems = () => {
    setLoading(true)
    Promise.all([
      api('/inventory').catch(() => []),
      api('/inventory/logs').catch(() => []),
    ]).then(([resItems, resLogs]) => {
      setItems(resItems || [])
      setLogs(resLogs || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadItems()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast("Material nomini kiriting", 'error')
      return
    }

    try {
      await api('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          quantity: +form.quantity || 0,
          min_quantity: +form.min_quantity || 10,
          unit_price: +form.unit_price || 0,
          cost_price: +form.cost_price || 0,
        }),
      })
      toast("Yangi material saqlandi ✓")
      setCreateModal(false)
      setForm({ name: '', category: 'Sarflash materiali', quantity: '', unit: 'dona', min_quantity: '10', unit_price: '', cost_price: '', notes: '' })
      loadItems()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editModal) return

    try {
      await api(`/inventory/${editModal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editModal.name,
          category: editModal.category || 'Sarflash materiali',
          quantity: editModal.quantity !== '' && editModal.quantity !== null ? Number(editModal.quantity) : 0,
          unit: editModal.unit || 'dona',
          min_quantity: editModal.min_quantity !== '' && editModal.min_quantity !== null ? Number(editModal.min_quantity) : 10,
          unit_price: editModal.unit_price !== '' && editModal.unit_price !== null ? Number(editModal.unit_price) : 0,
          cost_price: editModal.cost_price !== '' && editModal.cost_price !== null ? Number(editModal.cost_price) : 0,
          notes: editModal.notes || null,
        }),
      })
      toast("Material yangilandi ✓")
      setEditModal(null)
      loadItems()
    } catch (err) {
      toast(err.message || "Tahrirlashda xatolik yuz berdi", 'error')
    }
  }

  const handleRestock = async (e) => {
    e.preventDefault()
    const val = +amountInput
    if (!val || val <= 0) return

    try {
      await api(`/inventory/${restockModal.id}/restock`, {
        method: 'POST',
        body: JSON.stringify({ amount: val }),
      })
      toast(`Kirim qilindi: +${val} ${restockModal.unit} ✓`)
      setRestockModal(null)
      setAmountInput('1')
      loadItems()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const openConsumeModal = (item) => {
    setConsumeModal(item)
    setAmountInput('1')
    setTicketInput('')
    setChargePatient(false)
    setPaymentType('naqd')
    setCustomPrice(item.unit_price || '')
  }

  const handleConsume = async (e) => {
    e.preventDefault()
    const val = +amountInput
    if (!val || val <= 0) {
      toast("Miqdorni kiriting", "error")
      return
    }

    setSubmitting(true)
    try {
      const res = await api(`/inventory/${consumeModal.id}/consume`, {
        method: 'POST',
        body: JSON.stringify({
          amount: val,
          ticket_number: ticketInput.trim() || null,
          charge_patient: chargePatient,
          payment_type: paymentType,
          price_per_unit: customPrice !== '' ? Number(customPrice) : consumeModal.unit_price,
        }),
      })

      const last = res.last_consumed
      if (last?.charged > 0) {
        toast(`✓ ${last.ticket || 'Bemor'} uchun ${formatMoney(last.charged)} to'lov qabul qilindi va ${val} ${consumeModal.unit} ${consumeModal.name} ombordan chiqarildi!`)
      } else {
        toast(`Chiqim qilindi: -${val} ${consumeModal.unit} ${ticketInput ? `(${ticketInput} bemorga)` : ''} ✓`)
      }

      setConsumeModal(null)
      setAmountInput('1')
      loadItems()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" materialini o'chirmoqchimisiz?`)) return
    try {
      await api(`/inventory/${id}`, { method: 'DELETE' })
      toast("O'chirildi")
      loadItems()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const lowStockItems = items.filter((i) => i.is_low_stock)

  const filteredItems = items.filter((i) => {
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter
    const matchQuery = i.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchQuery
  })

  const unitPriceToUse = customPrice !== '' ? Number(customPrice) : (consumeModal?.unit_price || 0)
  const totalChargeAmount = (Number(amountInput) || 0) * unitPriceToUse

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gold flex items-center gap-2">
            <Package className="h-6 w-6" /> Omborxona va Tibbiy Materiallar Hisobi
          </h1>
          <p className="text-xs text-muted mt-1">Dori-darmonlar, shpritslar va bemorga biriktiriluvchi sarflash materiallari boshqaruvi</p>
        </div>

        {isCEO && (
          <button
            type="button"
            onClick={() => setCreateModal(true)}
            className="btn-gold py-2.5 px-4 text-xs font-bold flex items-center gap-2 shadow-lg whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Yangi Material Qo'shish
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="card p-2 flex gap-2 border-gold/30">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'catalog'
              ? 'bg-gold text-slate-950 shadow-md font-black'
              : 'bg-slate-900/60 text-slate-300 hover:bg-white/5 border border-border'
          }`}
        >
          📦 Materiallar Qoldig'i Katalogi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'logs'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'bg-slate-900/60 text-slate-300 hover:bg-white/5 border border-border'
          }`}
        >
          📜 Ishlatilgan Materiallar va To'lovlar Tarixi
        </button>
      </div>

      {activeTab === 'catalog' && (
        <>
          {/* LOW STOCK WARNING BANNER */}
          {lowStockItems.length > 0 && (
            <div className="bg-rose-500/10 border-2 border-rose-500/30 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in">
              <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="block text-sm text-rose-400 font-bold mb-1">
                  ⚠️ Diqqat! Omborda tugab borayotgan materiallar ({lowStockItems.length} ta):
                </strong>
                <div className="flex flex-wrap gap-2 mt-1">
                  {lowStockItems.map((i) => (
                    <span key={i.id} className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                      {i.name}: {i.quantity} {i.unit} (Min: {i.min_quantity})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FILTER & SEARCH BAR */}
          <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                className="input-field pl-9 text-xs"
                placeholder="Material nomini izlang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {['all', 'Dori-darmon', 'Sarflash materiali', 'Reaktiv'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    categoryFilter === cat
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-muted/40 text-muted hover:text-foreground'
                  }`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'all' ? 'Barchasi' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* INVENTORY TABLE */}
          <div className="card overflow-x-auto p-0 border-cyan-500/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20 text-left text-gold bg-slate-950 whitespace-nowrap">
                  <th className="p-3 whitespace-nowrap">Material Nomi</th>
                  <th className="p-3 whitespace-nowrap">Kategoriya</th>
                  <th className="p-3 whitespace-nowrap">Mavjud Qoldiq</th>
                  <th className="p-3 whitespace-nowrap">Min Chegara</th>
                  <th className="p-3 whitespace-nowrap">Sotilish Narxi</th>
                  {isCEO && <th className="p-3 whitespace-nowrap">Tan Narxi</th>}
                  <th className="p-3 whitespace-nowrap">Holat</th>
                  <th className="p-3 text-right whitespace-nowrap">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isCEO ? 8 : 7} className="p-4 text-center text-muted text-xs">Yuklanmoqda...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={isCEO ? 8 : 7} className="p-4 text-center text-muted text-xs italic">Materiallar topilmadi</td></tr>
                ) : (
                  filteredItems.map((i) => (
                    <tr key={i.id} className="border-b border-border/40 hover:bg-muted/20 text-xs whitespace-nowrap">
                      <td className="p-3 font-bold text-foreground whitespace-nowrap">{i.name}</td>
                      <td className="p-3 text-muted whitespace-nowrap">{i.category}</td>
                      <td className="p-3 font-mono font-extrabold text-cyan-400 text-sm whitespace-nowrap">
                        {i.quantity} <span className="text-xs font-normal text-muted">{i.unit}</span>
                      </td>
                      <td className="p-3 font-mono text-muted whitespace-nowrap">{i.min_quantity} {i.unit}</td>
                      <td className="p-3 font-mono font-bold text-gold whitespace-nowrap">{formatMoney(i.unit_price)}</td>
                      {isCEO && (
                        <td className="p-3 font-mono font-bold text-purple-400 whitespace-nowrap">
                          {formatMoney(i.cost_price || 0)}
                        </td>
                      )}
                      <td className="p-3 whitespace-nowrap">
                        {i.is_low_stock ? (
                          <span className="badge badge-danger whitespace-nowrap px-2.5 py-1 text-[11px] font-bold">
                            ⚠️ Tugamoqda
                          </span>
                        ) : (
                          <span className="badge badge-success whitespace-nowrap px-2.5 py-1 text-[11px] font-bold">
                            ✓ Yetarli
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        {isCEO && (
                          <button
                            type="button"
                            onClick={() => { setRestockModal(i); setAmountInput('1') }}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1 shadow-sm"
                          >
                            <ArrowDownRight className="h-3.5 w-3.5" /> Kirim (+)
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openConsumeModal(i)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs inline-flex items-center gap-1 shadow-sm"
                          title="Bemorgabiriktirish yoki sarflash"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" /> Chiqim (-)
                        </button>

                        {isCEO && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditModal(i)}
                              className="p-1.5 rounded-xl text-cyan-400 hover:bg-cyan-500/10 transition-all inline-block"
                              title="Tahrirlash (Narxlarni o'zgartirish)"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(i.id, i.name)}
                              className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all inline-block"
                              title="O'chirish"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="card overflow-x-auto p-0 border-cyan-500/30">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              📜 Materiallar Ishlatilishi va Bemor To'lovlari Audit Tarixi
            </h3>
            <span className="text-xs text-muted">Jami {logs.length} ta yozuv</span>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-left">
                <th className="p-3">Sana & Vaqt</th>
                <th className="p-3">Kiritgan Xodim</th>
                <th className="p-3">Tafsilot & Bemor Chiptasi</th>
                <th className="p-3 text-right">Tushum / Holat</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-muted">Hali ishlatilgan materiallar tarixi yo'q</td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-800/60 hover:bg-slate-900/60">
                    <td className="p-3 font-mono text-muted">{l.created_at}</td>
                    <td className="p-3 font-bold text-white">
                      {l.user_name} <span className="text-[10px] text-muted uppercase">({l.user_role})</span>
                    </td>
                    <td className="p-3 text-slate-200">
                      <p className="font-semibold">{l.detail_message}</p>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {l.new_data?.charged > 0 ? (
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/30">
                          + {formatMoney(l.new_data.charged)} (Kassaga o'tdi)
                        </span>
                      ) : (
                        <span className="text-muted">Bepul sarf</span>
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
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Yangi Material Qo'shish (Ikki xil narxda)">
        <form onSubmit={handleCreate} className="space-y-3 pt-2">
          <input className="input-field" placeholder="Material nomi (masalan: Shprits 5ml) *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          
          <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="Sarflash materiali">Sarflash materiali</option>
            <option value="Dori-darmon">Dori-darmon</option>
            <option value="Reaktiv">Reaktiv</option>
          </select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">Boshlang'ich qoldiq</label>
              <input type="number" className="input-field" placeholder="100" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">O'lchov birligi</label>
              <select className="input-field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="dona">dona</option>
                <option value="flakon">flakon</option>
                <option value="quti">quti</option>
                <option value="ampula">ampula</option>
                <option value="metr">metr</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">Tavar haqiqiy narxi (Tan narxi so'mda)</label>
              <input
                type="number"
                className="input-field border-purple-500/40 text-purple-300 font-mono font-bold"
                placeholder="Masalan: 3000"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">Sotilish narxi (Kassa narxi so'mda)</label>
              <input
                type="number"
                className="input-field border-gold/40 text-gold font-mono font-bold"
                placeholder="Masalan: 5000"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" className="btn-gold w-full py-3 font-extrabold text-sm">
            Saqlash ✓
          </button>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Material Narx va Ma'lumotlarini Tahrirlash">
        {editModal && (
          <form onSubmit={handleUpdate} className="space-y-3 pt-2">
            <div>
              <label className="text-[11px] text-muted block mb-1">Material Nomi</label>
              <input
                className="input-field font-bold"
                value={editModal.name}
                onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted block mb-1">Qoldiq miqdor</label>
                <input
                  type="number"
                  className="input-field"
                  value={editModal.quantity}
                  onChange={(e) => setEditModal({ ...editModal, quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">O'lchov birligi</label>
                <input
                  className="input-field"
                  value={editModal.unit}
                  onChange={(e) => setEditModal({ ...editModal, unit: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted block mb-1">Tavar haqiqiy narxi (Tan narxi)</label>
                <input
                  type="number"
                  className="input-field border-purple-500/40 text-purple-300 font-mono font-bold"
                  value={editModal.cost_price ?? ''}
                  onChange={(e) => setEditModal({ ...editModal, cost_price: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">Sotilish narxi (Kassa narxi)</label>
                <input
                  type="number"
                  className="input-field border-gold/40 text-gold font-mono font-bold"
                  value={editModal.unit_price ?? ''}
                  onChange={(e) => setEditModal({ ...editModal, unit_price: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-gold w-full py-3 font-extrabold text-sm">
              Saqlash va Yangilash ✓
            </button>
          </form>
        )}
      </Modal>

      {/* RESTOCK MODAL */}
      <Modal open={!!restockModal} onClose={() => setRestockModal(null)} title="Omborga Kirim Qilish (+)">
        {restockModal && (
          <form onSubmit={handleRestock} className="space-y-3 pt-2">
            <p className="text-sm font-bold text-foreground">{restockModal.name}</p>
            <p className="text-xs text-muted">Hozirgi qoldiq: <b className="text-cyan-400">{restockModal.quantity} {restockModal.unit}</b></p>
            <input
              type="number"
              min={1}
              className="input-field text-sm font-bold"
              placeholder={`Necha ${restockModal.unit} kirim qilinsin?`}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              required
            />
            <button type="submit" className="btn-gold w-full py-3 font-extrabold text-sm">
              Kirimni Tasdiqlash (+)
            </button>
          </form>
        )}
      </Modal>

      {/* ADVANCED CONSUME / PATIENT BINDING MODAL */}
      <Modal open={!!consumeModal} onClose={() => setConsumeModal(null)} title="Material Chiqim qilish va Bemorga biriktirish" size="md">
        {consumeModal && (
          <form onSubmit={handleConsume} className="space-y-4 pt-1">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-muted uppercase font-bold block">Material:</span>
              <h4 className="text-base font-black text-white">{consumeModal.name}</h4>
              <p className="text-xs text-muted">
                Ombordagi qoldiq: <strong className="text-cyan-400 font-mono">{consumeModal.quantity} {consumeModal.unit}</strong> | Dona narxi: <strong className="text-gold font-mono">{formatMoney(consumeModal.unit_price)}</strong>
              </p>
            </div>

            {/* Quantity */}
            <div>
              <label className="form-label text-xs font-bold">Ishlatilgan miqdor ({consumeModal.unit}) *</label>
              <input
                type="number"
                min={1}
                max={consumeModal.quantity}
                className="input-field font-mono font-bold text-amber-400 text-lg"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
              />
            </div>

            {/* Patient Ticket Number (e.g. I-007) */}
            <div>
              <label className="form-label text-xs font-bold text-cyan-300">
                🎫 Bemor Chipta/Talon raqami (masalan: I-007)
              </label>
              <input
                type="text"
                className="input-field font-mono font-black text-cyan-300 text-sm tracking-wider uppercase"
                placeholder="Masalan: I-007 yoki A-012"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
              />
              <p className="text-[11px] text-muted mt-1">
                💡 Agarda shifokor kiritmagan bo'lsa, talon raqamini kiritsangiz ma'lumotlar bemor kartasiga biriktiriladi.
              </p>
            </div>

            {/* Charge Patient Toggle */}
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-cyan-300">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-cyan-500 rounded"
                  checked={chargePatient}
                  onChange={(e) => setChargePatient(e.target.checked)}
                />
                <span>💰 Ushbu material uchun bemordan to'lov olinsin (Kassaga tushum qilish)</span>
              </label>

              {chargePatient && (
                <div className="pt-2 space-y-2 border-t border-cyan-500/20 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted font-bold block mb-1">Dona narxi (so'm)</label>
                      <input
                        type="number"
                        className="input-field font-mono font-bold text-xs py-1 text-gold"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted font-bold block mb-1">To'lov usuli</label>
                      <select
                        className="input-field text-xs py-1 font-bold"
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value)}
                      >
                        <option value="naqd">💵 Naqd pul</option>
                        <option value="karta">💳 Karta (Terminal/Click)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-black pt-1">
                    <span className="text-cyan-400">JAMI KASSAGA TUSHUM:</span>
                    <span className="text-emerald-400 font-mono text-base">{formatMoney(totalChargeAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-gold w-full py-3 font-black text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              {submitting ? 'Saqlanmoqda...' : (chargePatient ? "💰 To'lovni Qabul Qilish va Chiqim Qilish" : "Chiqimni Tasdiqlash (-)")}
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}
