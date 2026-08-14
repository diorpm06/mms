import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney, formatWithCommas, parseDigits } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, PageHeader, StatusBadge, ActionRow, EmptyState } from '../../components/UIKit'
import { REPORT_TEMPLATES } from '../../utils/reportTemplates'

const EMPTY_SVC = {
  name: '',
  price: '',
  cabinet: '1-Xona',
  requires_queue: true,
  referrer_commission_percent: '',
  referrer_commission_sum: '',
  referrer_doctor_split_percent: 50,
  referrer_clinic_split_percent: 50,
  referrer_doctor_split_sum: '',
  referrer_clinic_split_sum: '',
  allow_custom_price: false,
  template_key: '',
}

export default function CeoServices() {
  const [items, setItems] = useState(null)
  const [svcModal, setSvcModal] = useState(false)
  const [bolimModal, setBolimModal] = useState(false)
  const [editBolimModal, setEditBolimModal] = useState(false)
  const [deleteBolimTarget, setDeleteBolimTarget] = useState(null)
  const [deleteSvcTarget, setDeleteSvcTarget] = useState(null)
  const [targetBolimOldName, setTargetBolimOldName] = useState('')
  const [targetBolimNewName, setTargetBolimNewName] = useState('')
  const [targetBolimPrefix, setTargetBolimPrefix] = useState('A')
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(EMPTY_SVC)
  const [activeCat, setActiveCat] = useState('')
  const [newBolimName, setNewBolimName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Collapsible state for service departments (DEFAULT: ALL COLLAPSED)
  const [collapsedBolimlar, setCollapsedBolimlar] = useState({})

  const toggleBolim = (catName) => {
    setCollapsedBolimlar((prev) => {
      const currentState = prev[catName] !== false // true if currently collapsed
      return {
        ...prev,
        [catName]: !currentState, // false if expanding, true if collapsing
      }
    })
  }

  // Extra Bo'limlar with no services yet (persisted in localStorage)
  const [localBolimlar, setLocalBolimlar] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_local_bolimlar')
      return saved ? JSON.parse(saved) : []
    } catch (e) { return [] }
  })
  const toast = useToastStore((s) => s.add)

  useEffect(() => {
    try {
      localStorage.setItem('crm_local_bolimlar', JSON.stringify(localBolimlar))
    } catch (e) {}
  }, [localBolimlar])

  const load = () => api('/services/all').then(setItems)
  useEffect(() => { load() }, [])

  // Group active services by main category (e.g. 'Laboratoriya' for 'Laboratoriya: GORMONLAR')
  const grouped = (items || []).filter(s => s.is_active !== false).reduce((acc, s) => {
    const raw = (s.category || 'Umumiy').trim()
    const mainCat = raw.includes(':') ? raw.split(':')[0].trim() : raw
    if (!acc[mainCat]) acc[mainCat] = []
    acc[mainCat].push(s)
    return acc
  }, {})

  // All bo'limlar = from services + local (empty ones)
  const allBolimlar = [
    ...Object.keys(grouped),
    ...localBolimlar.filter((b) => !grouped[b]),
  ]

  const expandAllBolimlar = () => {
    const map = {}
    allBolimlar.forEach((b) => { map[b] = false }) // false = EXPANDED
    setCollapsedBolimlar(map)
  }
  
  const collapseAllBolimlar = () => {
    const map = {}
    allBolimlar.forEach((b) => { map[b] = true }) // true = COLLAPSED
    setCollapsedBolimlar(map)
  }

  const getCategoryPrefixLetter = (catName, svcs = []) => {
    if (svcs.length > 0 && svcs[0].queue_prefix && svcs[0].queue_prefix !== 'A') {
      return svcs[0].queue_prefix.toUpperCase()
    }
    const u = (catName || '').toUpperCase()
    if (u.includes('UZI') || u.includes('ULTRATOVUSH')) return 'U'
    if (u.includes('MASSAJ')) return 'M'
    if (u.includes('INEKSIYA') || u.includes('UKOL')) return 'I'
    if (u.includes('KONSULTAT') || u.includes('SHIFOKOR')) return 'K'
    if (u.includes('ANALIZ') || u.includes('LAB')) return 'L'
    if (u.includes('STOMATOLOG')) return 'S'
    return u[0] || 'A'
  }

  // Map prefix letters already assigned to other categories
  const usedPrefixesMap = allBolimlar.reduce((acc, cat) => {
    const svcs = grouped[cat] || []
    const letter = getCategoryPrefixLetter(cat, svcs)
    if (letter) {
      acc[letter.toUpperCase()] = cat
    }
    return acc
  }, {})

  /* ─── handlers ─── */
  const openAddService = (catName) => {
    setEdit(null)
    const isLab = String(catName || '').toLowerCase().includes('laborat') || String(catName || '').toLowerCase().includes('labaratt')
    setForm({
      ...EMPTY_SVC,
      cabinet: isLab ? '-' : '1-Xona',
      referrer_commission_percent: isLab ? '22' : '',
    })
    setActiveCat(catName)
    setSvcModal(true)
  }

  const openEditBolim = (oldName) => {
    setTargetBolimOldName(oldName)
    setTargetBolimNewName(oldName)
    setTargetBolimPrefix(getCategoryPrefixLetter(oldName, grouped[oldName] || []))
    setEditBolimModal(true)
  }

  const handleRenameBolim = async () => {
    const newName = targetBolimNewName.trim()
    if (!newName) {
      toast("Bo'lim nomini kiriting", 'error'); return
    }
    const cleanPrefix = (targetBolimPrefix || 'A').trim().toUpperCase()
    try {
      await api('/services/category-rename', {
        method: 'PUT',
        body: JSON.stringify({
          old_name: targetBolimOldName,
          new_name: newName,
          prefix_letter: cleanPrefix,
        }),
      })
      setLocalBolimlar((prev) => prev.map((b) => (b === targetBolimOldName ? newName : b)))
      toast(`✓ Bo'lim nomi "${newName}" va prefiks (${cleanPrefix}) saqlandi`)
      setEditBolimModal(false)
      load()
    } catch (e) {
      toast(e.message || "Tahrirlashda xatolik", 'error')
    }
  }

  const handleDeleteBolim = async (catName) => {
    try {
      await api(`/services/category-delete?category_name=${encodeURIComponent(catName)}`, {
        method: 'DELETE',
      })
      toast(`✓ "${catName}" bo'limi va undagi xizmatlar o'chirildi`)
      setLocalBolimlar((prev) => prev.filter((b) => b !== catName))
      setDeleteBolimTarget(null)
      load()
    } catch (e) {
      toast(e.message || "Bo'limni o'chirishda xatolik", 'error')
    }
  }

  const openEditService = (s) => {
    setEdit(s)
    const cat = s.category || 'Umumiy'
    const isLab = String(cat).toLowerCase().includes('laborat') || String(cat).toLowerCase().includes('labaratt')
    setActiveCat(cat)
    setForm({
      name: s.name,
      price: s.price ? String(s.price) : '',
      cabinet: s.cabinet || (isLab ? '-' : '1-Xona'),
      requires_queue: s.requires_queue !== false,
      referrer_commission_percent: s.referrer_commission_percent ? String(s.referrer_commission_percent) : (isLab ? '22' : ''),
      referrer_commission_sum: s.referrer_commission_sum ? String(s.referrer_commission_sum) : '',
      referrer_doctor_split_percent: s.referrer_doctor_split_percent !== undefined && s.referrer_doctor_split_percent !== null ? s.referrer_doctor_split_percent : 50,
      referrer_clinic_split_percent: s.referrer_clinic_split_percent !== undefined && s.referrer_clinic_split_percent !== null ? s.referrer_clinic_split_percent : 50,
      referrer_doctor_split_sum: s.referrer_doctor_split_sum ? String(s.referrer_doctor_split_sum) : '',
      referrer_clinic_split_sum: s.referrer_clinic_split_sum ? String(s.referrer_clinic_split_sum) : '',
      allow_custom_price: s.allow_custom_price || false,
      template_key: s.template_key || '',
    })
    setSvcModal(true)
  }

  const saveService = async () => {
    if (!form.name.trim() || form.price === '') {
      toast('Nom va narx kiriting', 'error'); return
    }
    try {
      const inheritedPrefix = getCategoryPrefixLetter(activeCat, grouped[activeCat] || [])
      const body = {
        name: form.name,
        category: activeCat,
        price: parseInt(form.price, 10) || 0,
        cabinet: form.cabinet || '1-Xona',
        requires_queue: form.requires_queue,
        queue_prefix: form.requires_queue ? inheritedPrefix : null,
        referrer_commission_percent: parseInt(form.referrer_commission_percent, 10) || 0,
        referrer_commission_sum: parseInt(form.referrer_commission_sum, 10) || 0,
        referrer_doctor_split_percent: parseInt(form.referrer_doctor_split_percent, 10) || 0,
        referrer_clinic_split_percent: parseInt(form.referrer_clinic_split_percent, 10) || 0,
        referrer_doctor_split_sum: parseInt(form.referrer_doctor_split_sum, 10) || 0,
        referrer_clinic_split_sum: parseInt(form.referrer_clinic_split_sum, 10) || 0,
        allow_custom_price: !!form.allow_custom_price,
        template_key: form.template_key || null,
      }
      if (edit) await api(`/services/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/services', { method: 'POST', body: JSON.stringify(body) })
      toast('Saqlandi ✓')
      setSvcModal(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const handleCreateBolim = () => {
    const name = newBolimName.trim()
    if (!name) { toast("Bo'lim nomini kiriting", 'error'); return }
    if (allBolimlar.some((b) => b.toLowerCase() === name.toLowerCase())) {
      toast("Bu nomli bo'lim allaqachon mavjud", 'error'); return
    }
    setLocalBolimlar((prev) => [...prev, name])
    toast(`✓ "${name}" bo'limi yaratildi`)
    setNewBolimName('')
    setBolimModal(false)
  }

  const toggleActive = async (s) => {
    try {
      await api(`/services/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...s, is_active: !s.is_active }),
      })
      toast(s.is_active ? 'Faoliyatsiz qilindi' : 'Faollashtirildi')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xizmatlar Katalogi"
        subtitle="Bo'limlar, xizmat turlari, narxlar, kabinetlar va yo'naltiruvchi komissiyalarini boshqarish"
        icon={Icons.catalog}
      >
        <div className="flex flex-wrap gap-2 items-center">
          <Btn variant="outline" size="sm" onClick={expandAllBolimlar} icon={Maximize2}>
            Barchasini Yoyish (Ochish)
          </Btn>

          <Btn variant="outline" size="sm" onClick={collapseAllBolimlar} icon={Minimize2}>
            Barchasini Yig'ish
          </Btn>

          <Btn variant="gold" size="sm" icon={Icons.plus} onClick={() => { setNewBolimName(''); setBolimModal(true) }}>
            Yangi Bo'lim Qo'shish
          </Btn>
        </div>
      </PageHeader>

      {/* SEARCH BAR */}
      {items && allBolimlar.length > 0 && (
        <div className="card p-3">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-muted text-sm">🔎</span>
            <input
              type="text"
              placeholder="Xizmat nomi yoki bo'lim bo'yicha tezkor izlash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field text-xs py-2 pl-9 pr-8 font-semibold w-full"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 text-muted hover:text-foreground text-xs font-bold bg-surface-2 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <p className="text-xs text-gold font-semibold mt-1.5 ml-1">
              🔍 Izlash bo'yicha {items.filter((s) => s.is_active && (s.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) || (s.category || '').toLowerCase().includes(searchQuery.trim().toLowerCase()))).length} ta xizmat topildi
            </p>
          )}
        </div>
      )}

      {/* ── LOADING ── */}
      {!items ? (
        <TableSkeleton />
      ) : allBolimlar.length === 0 ? (
        <EmptyState
          icon="🏥"
          message="Hali bo'lim qo'shilmagan"
          action={
            <Btn variant="gold" icon={Icons.plus} onClick={() => { setNewBolimName(''); setBolimModal(true) }}>
              Birinchi Bo'limni yarating
            </Btn>
          }
        />
      ) : (
        /* ── BO'LIMLAR LIST ── */
        <div className="space-y-4">
          {allBolimlar.map((catName) => {
            const svcs = grouped[catName] || []
            const searchClean = searchQuery.trim().toLowerCase()
            const displaySvcs = searchClean
              ? svcs.filter((s) => s.name.toLowerCase().includes(searchClean) || (s.category || '').toLowerCase().includes(searchClean))
              : svcs

            if (searchClean && displaySvcs.length === 0) return null

            const activeSvcs = displaySvcs.filter((s) => s.is_active)
            const prefixLetter = getCategoryPrefixLetter(catName, svcs)

            // IF searching: auto-expand. IF NOT searching: DEFAULT TO COLLAPSED unless user set false!
            const isCollapsed = searchClean ? false : (collapsedBolimlar[catName] !== false)

            return (
              <div key={catName} className="card p-0 overflow-hidden border-border transition-all duration-300">
                {/* Bo'lim header (Clickable Accordion) */}
                <div
                  onClick={() => toggleBolim(catName)}
                  className="flex flex-wrap items-center justify-between px-4 py-3.5 bg-gold/5 border-b border-border cursor-pointer hover:bg-gold/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronDown className="h-5 w-5 text-gold" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-gold" />
                    )}
                    <span className="text-lg">📁</span>
                    <h3 className="font-extrabold text-foreground text-base">{catName}</h3>
                    <span className="badge badge-cyan text-xs font-mono font-bold">
                      Navbat: {prefixLetter}-001…
                    </span>
                    <span className="badge badge-muted text-xs font-bold">
                      {activeSvcs.length} ta xizmat {isCollapsed ? "(Yig'ilgan)" : "(Ochiq)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Btn
                      variant="outline"
                      size="2xs"
                      icon={Icons.edit}
                      onClick={() => openEditBolim(catName)}
                      title="Bo'lim nomini tahrirlash"
                    >
                      Tahrirlash
                    </Btn>
                    <Btn
                      variant="danger"
                      size="2xs"
                      icon={Icons.trash}
                      onClick={() => setDeleteBolimTarget(catName)}
                      title="Bo'limni va undagi xizmatlarni o'chirish"
                    >
                      O'chirish
                    </Btn>
                    <Btn
                      variant="gold"
                      size="xs"
                      icon={Icons.plus}
                      onClick={() => openAddService(catName)}
                    >
                      Xizmat qo'shish
                    </Btn>
                  </div>
                </div>

                {/* Services inside Bo'lim (Collapsible) */}
                {!isCollapsed && (
                  displaySvcs.length === 0 ? (
                    <div className="py-7 text-center text-muted text-sm">
                      Hali xizmat qo'shilmagan —{' '}
                      <button
                        className="text-gold underline font-semibold hover:no-underline"
                        onClick={() => openAddService(catName)}
                      >
                        Qo'shish
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 animate-fadeIn">
                      {Object.entries(
                        displaySvcs.reduce((acc, s) => {
                          const raw = (s.category || 'Umumiy').trim()
                          const sub = raw.includes(':') ? raw.split(':')[1].trim() : 'Umumiy'
                          if (!acc[sub]) acc[sub] = []
                          acc[sub].push(s)
                          return acc
                        }, {})
                      ).map(([subCatName, subSvcs]) => (
                        <div key={subCatName} className="space-y-1">
                          {subCatName !== 'Umumiy' && (
                            <div className="px-4 py-2 bg-surface border-y border-border/40 flex items-center justify-between text-xs font-black text-gold uppercase tracking-wider">
                              <span>📁 {subCatName}</span>
                              <span className="text-[10px] text-muted font-bold">{subSvcs.length} ta xizmat</span>
                            </div>
                          )}
                          {subSvcs.map((s) => (
                            <div
                              key={s.id}
                              className={`flex items-center justify-between p-3.5 px-4 transition-colors ${
                                s.is_active ? 'hover:bg-white/[0.02]' : 'opacity-40 bg-black/20'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-foreground text-sm">{s.name}</span>
                                  <StatusBadge status={s.is_active ? 'aktiv' : 'faolsiz'} />
                                  {s.allow_custom_price && (
                                    <span className="badge badge-gold text-[10px] uppercase font-bold" title="Shifokor qabulda narxni o'zgartira oladi">
                                      ✏️ Erkin Narx
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-medium">
                                  <span>🚪 Kabinet: <strong className="text-foreground">{s.cabinet || '1-Xona'}</strong></span>
                                  <span>🎟️ Navbat: <strong className="text-foreground">{s.requires_queue ? `Barchaga (${s.queue_prefix || prefixLetter})` : 'Yo\'q'}</strong></span>
                                  <span>🤝 Yo'naltiruvchi: <strong className="text-cyan">{s.referrer_commission_percent ? `${s.referrer_commission_percent}%` : s.referrer_commission_sum ? `${formatMoney(s.referrer_commission_sum)}` : 'Yo\'q'}</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="font-mono font-black text-emerald text-base">
                                  {formatMoney(s.price)}
                                </span>
                                <ActionRow>
                                  <Btn variant="outline" size="2xs" icon={Icons.edit} onClick={() => openEditService(s)}>
                                    Tahrir
                                  </Btn>
                                  <Btn
                                    variant={s.is_active ? 'ghost' : 'gold'}
                                    size="2xs"
                                    onClick={() => {
                                      if (s.is_active) {
                                        setDeleteSvcTarget(s)
                                      } else {
                                        toggleActive(s)
                                      }
                                    }}
                                  >
                                    {s.is_active ? 'O\'chirish' : 'Yoqish'}
                                  </Btn>
                                </ActionRow>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Add Service */}
      <Modal
        open={svcModal}
        onClose={() => setSvcModal(false)}
        title={edit ? `Xizmatni tahrirlash: "${edit.name}"` : `Yangi xizmat qo'shish — [ ${activeCat} ]`}
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="form-label font-bold">Xizmat nomi *</label>
            <input
              type="text"
              placeholder="Masalan: UZI Jigar va Taloq"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label font-bold">Xizmat narxi (so'm) *</label>
              <input
                type="text"
                placeholder="100 000"
                value={form.price ? formatWithCommas(form.price) : ''}
                onChange={(e) => setForm({ ...form, price: parseDigits(e.target.value) })}
                className="input-field font-mono font-bold text-emerald text-sm"
              />
            </div>
            <div>
              <label className="form-label font-bold">Qaysi Kabinetga tegishli?</label>
              <input
                type="text"
                placeholder="1-Xona, UZI-1 va hk"
                value={form.cabinet}
                onChange={(e) => setForm({ ...form, cabinet: e.target.value })}
                className="input-field text-xs font-semibold"
              />
            </div>
          </div>

          <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-3">
            <h4 className="font-bold text-gold text-xs uppercase tracking-wider">🤝 Yo'naltiruvchi shifokor komissiyasi</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Komissiya foizi (%)</label>
                <input
                  type="number"
                  placeholder="Masalan: 10"
                  value={form.referrer_commission_percent}
                  onChange={(e) => setForm({ ...form, referrer_commission_percent: e.target.value })}
                  className="input-field text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="form-label">Komissiya belgilangan summa (so'm)</label>
                <input
                  type="text"
                  placeholder="Masalan: 20 000"
                  value={form.referrer_commission_sum ? formatWithCommas(form.referrer_commission_sum) : ''}
                  onChange={(e) => setForm({ ...form, referrer_commission_sum: parseDigits(e.target.value) })}
                  className="input-field text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="custom_price"
              checked={form.allow_custom_price}
              onChange={(e) => setForm({ ...form, allow_custom_price: e.target.checked })}
              className="w-4 h-4 accent-gold"
            />
            <label htmlFor="custom_price" className="font-bold text-body cursor-pointer">
              ✏️ Qabul jarayonida narxni erkin o'zgartirishga ruxsat berish
            </label>
          </div>

          <div>
            <label className="form-label text-xs">📋 Biriktirilgan shablon (Doctor Panelda to'ldirish uchun)</label>
            <select
              className="input-field text-xs"
              value={form.template_key || ''}
              onChange={(e) => setForm({ ...form, template_key: e.target.value })}
            >
              <option value="">— Shablon yo'q —</option>
              {['Laboratoriya', 'UZI'].map((cat) => (
                <optgroup key={cat} label={cat}>
                  {REPORT_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                    <option key={t.key} value={t.key}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setSvcModal(false)}>
              Bekor Qilish
            </Btn>
            <Btn variant="gold" full icon={Icons.save} onClick={saveService}>
              ✓ Saqlash
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Bo'lim */}
      <Modal open={bolimModal} onClose={() => setBolimModal(false)} title="Yangi Xizmat Bo'limi Yaratish" size="sm">
        <div className="space-y-4 text-xs">
          <div>
            <label className="form-label font-bold">Bo'lim Nomi *</label>
            <input
              type="text"
              placeholder="Masalan: Stomatologiya, Kardiologiya va hk"
              value={newBolimName}
              onChange={(e) => setNewBolimName(e.target.value)}
              className="input-field font-semibold text-xs"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setBolimModal(false)}>
              Bekor Qilish
            </Btn>
            <Btn variant="gold" full icon={Icons.plus} onClick={handleCreateBolim}>
              yaratish
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal: Rename Bo'lim */}
      <Modal open={editBolimModal} onClose={() => setEditBolimModal(false)} title={`Bo'limni tahrirlash: "${targetBolimOldName}"`} size="sm">
        <div className="space-y-4 text-xs">
          <div>
            <label className="form-label font-bold">Bo'lim Yangi Nomi *</label>
            <input
              type="text"
              value={targetBolimNewName}
              onChange={(e) => setTargetBolimNewName(e.target.value)}
              className="input-field font-semibold text-xs"
            />
          </div>
          <div>
            <label className="form-label font-bold">Navbat Prefiks Harfi (1 ta harf) *</label>
            <input
              type="text"
              maxLength={2}
              value={targetBolimPrefix}
              onChange={(e) => setTargetBolimPrefix(e.target.value.toUpperCase())}
              className="input-field font-mono font-bold text-center text-gold uppercase"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setEditBolimModal(false)}>
              Bekor Qilish
            </Btn>
            <Btn variant="gold" full icon={Icons.save} onClick={handleRenameBolim}>
              Saqlash
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal: Delete Bo'lim */}
      <Modal open={!!deleteBolimTarget} onClose={() => setDeleteBolimTarget(null)} title="Bo'limni o'chirish" size="sm">
        <div className="space-y-4 text-xs">
          <p className="text-rose-400 font-bold">
            ⚠️ Diqqat! "{deleteBolimTarget}" bo'limi va undagi barcha xizmatlar o'chiriladi. Ushbu amalni qaytarib bo'lmaydi.
          </p>
          <div className="flex gap-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setDeleteBolimTarget(null)}>
              Orqaga
            </Btn>
            <Btn variant="danger" full icon={Icons.trash} onClick={() => handleDeleteBolim(deleteBolimTarget)}>
              Ha, o'chirish
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal: Delete Service Confirmation */}
      <Modal open={!!deleteSvcTarget} onClose={() => setDeleteSvcTarget(null)} title="Xizmatni o'chirish" size="sm">
        <div className="space-y-4 text-xs">
          <p className="text-rose-400 font-bold">
            ⚠️ Rostdan ham "{deleteSvcTarget?.name}" xizmatini o'chirmoqchimisiz? Usbu xizmat faoliyatsiz holatga o'tkaziladi.
          </p>
          <div className="flex gap-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setDeleteSvcTarget(null)}>
              Bekor Qilish
            </Btn>
            <Btn
              variant="danger"
              full
              icon={Icons.trash}
              onClick={async () => {
                if (deleteSvcTarget) {
                  const target = deleteSvcTarget
                  setDeleteSvcTarget(null)
                  await toggleActive(target)
                }
              }}
            >
              Ha, o'chirish
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
