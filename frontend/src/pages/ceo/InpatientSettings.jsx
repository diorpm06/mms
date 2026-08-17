import { useEffect, useMemo, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'

export default function InpatientSettings() {
  const [activeTab, setActiveTab] = useState('tariffs') // 'tariffs' | 'rooms' | 'materials'
  const [tariffs, setTariffs] = useState([])
  const [rooms, setRooms] = useState([])
  const [materials, setMaterials] = useState([])
  const [services, setServices] = useState([])

  // Service search & grouping for Tariff Modal
  const [serviceSearch, setServiceSearch] = useState('')

  // Tariff Modal
  const [tariffModal, setTariffModal] = useState(false)
  const [editingTariff, setEditingTariff] = useState(null)
  const [tariffForm, setTariffForm] = useState({ name: '', daily_rate: '', description: '', included_service_ids: [] })

  // Room Modal
  const [roomModal, setRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomForm, setRoomForm] = useState({ room_number: '', description: '', bed_count: 2 })

  // Bed Modal (Add single bed to room)
  const [bedModal, setBedModal] = useState(null) // room object
  const [bedNumberForm, setBedNumberForm] = useState('')

  // Material Modal
  const [materialModal, setMaterialModal] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [materialForm, setMaterialForm] = useState({ name: '', unit_name: 'dona', unit_price: '' })

  const toast = useToastStore((s) => s.add)

  const loadData = () => {
    api('/inpatients/tariffs').then(setTariffs).catch(() => {})
    api('/inpatients/rooms').then(setRooms).catch(() => {})
    api('/inpatients/materials').then(setMaterials).catch(() => {})
    api('/services').then(setServices).catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [activeTab])

  // Tariff Submit
  const handleTariffSubmit = async () => {
    if (!tariffForm.name || !tariffForm.daily_rate) {
      toast('Tarif nomi va kunlik narxi to\'ldirilishi shart', 'error')
      return
    }
    try {
      if (editingTariff) {
        await api(`/inpatients/tariffs/${editingTariff.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: tariffForm.name,
            daily_rate: +tariffForm.daily_rate,
            description: tariffForm.description,
            included_service_ids: tariffForm.included_service_ids,
          }),
        })
        toast('Tarif yangilandi')
      } else {
        await api('/inpatients/tariffs', {
          method: 'POST',
          body: JSON.stringify({
            name: tariffForm.name,
            daily_rate: +tariffForm.daily_rate,
            description: tariffForm.description,
            included_service_ids: tariffForm.included_service_ids,
          }),
        })
        toast('Yangi tarif yaratildi')
      }
      setTariffModal(false)
      setEditingTariff(null)
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const deleteTariff = async (id) => {
    if (!confirm('Ushbu tarifni o\'chirmoqchimisiz?')) return
    try {
      await api(`/inpatients/tariffs/${id}`, { method: 'DELETE' })
      toast('Tarif o\'chirildi')
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Room Submit
  const handleRoomSubmit = async () => {
    if (!roomForm.room_number) {
      toast('Palata nomi / raqami kiritilishi shart', 'error')
      return
    }
    try {
      if (editingRoom) {
        await api(`/inpatients/rooms/${editingRoom.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            room_number: roomForm.room_number,
            description: roomForm.description,
          }),
        })
        toast('Palata yangilandi')
      } else {
        await api('/inpatients/rooms', {
          method: 'POST',
          body: JSON.stringify({
            room_number: roomForm.room_number,
            description: roomForm.description,
            bed_count: +roomForm.bed_count || 2,
          }),
        })
        toast('Yangi palata va koykalar yaratildi')
      }
      setRoomModal(false)
      setEditingRoom(null)
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const deleteRoom = async (roomId) => {
    if (!confirm('Ushbu palatani va undagi barcha koykalarni o\'chirmoqchimisiz?')) return
    try {
      await api(`/inpatients/rooms/${roomId}`, { method: 'DELETE' })
      toast('Palata o\'chirildi')
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Add Bed to Room
  const handleAddBed = async () => {
    if (!bedModal || !bedNumberForm) return
    try {
      await api(`/inpatients/rooms/${bedModal.id}/beds`, {
        method: 'POST',
        body: JSON.stringify({ bed_number: bedNumberForm }),
      })
      toast('Koyka qo\'shildi')
      setBedModal(null)
      setBedNumberForm('')
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Delete Bed
  const deleteBed = async (roomId, bedId) => {
    if (!confirm('Ushbu koykani o\'chirmoqchimisiz?')) return
    try {
      await api(`/inpatients/rooms/${roomId}/beds/${bedId}`, { method: 'DELETE' })
      toast('Koyka o\'chirildi')
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Material Submit
  const handleMaterialSubmit = async () => {
    if (!materialForm.name || !materialForm.unit_price) {
      toast('Material nomi va narxi kiritilishi shart', 'error')
      return
    }
    try {
      if (editingMaterial) {
        await api(`/inpatients/materials/${editingMaterial.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: materialForm.name,
            unit_name: materialForm.unit_name || 'dona',
            unit_price: +materialForm.unit_price,
          }),
        })
        toast('Material yangilandi')
      } else {
        await api('/inpatients/materials', {
          method: 'POST',
          body: JSON.stringify({
            name: materialForm.name,
            unit_name: materialForm.unit_name || 'dona',
            unit_price: +materialForm.unit_price,
          }),
        })
        toast('Yangi material qo\'shildi')
      }
      setMaterialModal(false)
      setEditingMaterial(null)
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const deleteMaterial = async (id) => {
    if (!confirm('Ushbu materialni o\'chirmoqchimisiz?')) return
    try {
      await api(`/inpatients/materials/${id}`, { method: 'DELETE' })
      toast('Material o\'chirildi')
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase()
    if (!q) return services
    return services.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
    )
  }, [services, serviceSearch])

  const groupedServices = useMemo(() => {
    const groups = {}
    filteredServices.forEach((s) => {
      const cat = s.category || 'Umumiy'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(s)
    })
    return groups
  }, [filteredServices])

  const toggleServiceInTariff = (serviceId) => {
    setTariffForm((prev) => {
      const exists = prev.included_service_ids.includes(serviceId)
      return {
        ...prev,
        included_service_ids: exists
          ? prev.included_service_ids.filter((id) => id !== serviceId)
          : [...prev.included_service_ids, serviceId],
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-title">Statsionar Palatalar, Tariflar va Sozlamalar</h1>
          <p className="text-xs text-muted mt-1">Palatalarni boshqarish, koykalar qo'shish/o'chirish, tarif paketlari va dori-darmonlar katalogi</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'tariffs' && (
            <button
              type="button"
              className="btn-gold text-sm"
              onClick={() => {
                setEditingTariff(null)
                setTariffForm({ name: '', daily_rate: '', description: '', included_service_ids: [] })
                setTariffModal(true)
              }}
            >
              + Yangi Tarif
            </button>
          )}
          {activeTab === 'rooms' && (
            <button
              type="button"
              className="btn-gold text-sm"
              onClick={() => {
                setEditingRoom(null)
                setRoomForm({ room_number: '', description: '', bed_count: 2 })
                setRoomModal(true)
              }}
            >
              + Yangi Palata Qo'shish
            </button>
          )}
          {activeTab === 'materials' && (
            <button
              type="button"
              className="btn-gold text-sm"
              onClick={() => {
                setEditingMaterial(null)
                setMaterialForm({ name: '', unit_name: 'dona', unit_price: '' })
                setMaterialModal(true)
              }}
            >
              + Yangi Material / Dori
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4 overflow-x-auto">
        <button
          type="button"
          className={`pb-2.5 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'tariffs' ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-foreground'}`}
          onClick={() => setActiveTab('tariffs')}
        >
          🏨 Tarif Paketlari ({tariffs.length})
        </button>
        <button
          type="button"
          className={`pb-2.5 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'rooms' ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-foreground'}`}
          onClick={() => setActiveTab('rooms')}
        >
          🛏️ Palatalar va Koykalar ({rooms.length})
        </button>
        <button
          type="button"
          className={`pb-2.5 font-bold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'materials' ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-foreground'}`}
          onClick={() => setActiveTab('materials')}
        >
          💉 Materiallar va Dori-Darmonlar ({materials.length})
        </button>
      </div>

      {/* TARIFFS TAB */}
      {activeTab === 'tariffs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tariffs.map((t) => (
            <div key={t.id} className="card border border-gold/20 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{t.name}</h3>
                    {t.description && <p className="text-xs text-muted mt-1">{t.description}</p>}
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-gold/10 text-gold font-mono font-black text-sm border border-gold/30">
                    {formatMoney(t.daily_rate)} / kun
                  </span>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                    Tarif Ichiga Kiritilgan Bepul Xizmatlar ({t.included_services?.length || 0}):
                  </h4>
                  {t.included_services && t.included_services.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {t.included_services.map((s) => (
                        <span key={s.id} className="inline-block px-2 py-0.5 rounded bg-surface-hover text-xs text-body border border-border">
                          ✓ {s.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted italic">Bepul xizmatlar biriktirilmagan</p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs py-1 px-3"
                  onClick={() => {
                    setEditingTariff(t)
                    setTariffForm({
                      name: t.name,
                      daily_rate: t.daily_rate,
                      description: t.description || '',
                      included_service_ids: t.included_services?.map((s) => s.id) || [],
                    })
                    setTariffModal(true)
                  }}
                >
                  Tahrirlash
                </button>
                <button type="button" className="btn-ghost text-xs text-rose-400 py-1 px-3" onClick={() => deleteTariff(t.id)}>
                  O'chirish
                </button>
              </div>
            </div>
          ))}
          {tariffs.length === 0 && <p className="text-muted text-sm italic col-span-2 text-center py-8">Tariflar hali yaratilmagan</p>}
        </div>
      )}

      {/* ROOMS & BEDS TAB */}
      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((r) => (
            <div key={r.id} className="card border border-border flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-cyan-400">{r.room_number}</h3>
                    {r.description && <p className="text-xs text-muted mt-0.5">{r.description}</p>}
                  </div>
                  <button
                    type="button"
                    className="btn-outline text-xs py-1 px-2 border-gold/30 text-gold"
                    onClick={() => {
                      setBedModal(r)
                      setBedNumberForm(`${(r.beds?.length || 0) + 1}`)
                    }}
                  >
                    + Koyka Qo'shish
                  </button>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Koykalar / O'rinlar ({r.beds?.length || 0}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {r.beds && r.beds.length > 0 ? (
                      r.beds.map((b) => (
                        <div key={b.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-hover rounded-lg border border-border text-xs">
                          <span className="font-mono font-bold text-foreground">🛏️ {b.bed_number}</span>
                          <button
                            type="button"
                            className="text-rose-400 hover:text-rose-300 font-bold ml-1"
                            title="Koykani o'chirish"
                            onClick={() => deleteBed(r.id, b.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted italic">Koykalar yo'q</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-outline text-xs py-1 px-3"
                  onClick={() => {
                    setEditingRoom(r)
                    setRoomForm({ room_number: r.room_number, description: r.description || '', bed_count: r.beds?.length || 2 })
                    setRoomModal(true)
                  }}
                >
                  Tahrirlash
                </button>
                <button type="button" className="btn-ghost text-xs text-rose-400 py-1 px-3" onClick={() => deleteRoom(r.id)}>
                  Palatani O'chirish
                </button>
              </div>
            </div>
          ))}
          {rooms.length === 0 && <p className="text-muted text-sm italic col-span-3 text-center py-8">Palatalar kiritilmagan</p>}
        </div>
      )}

      {/* MATERIALS TAB */}
      {activeTab === 'materials' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-gold">
                <th className="p-3">#</th>
                <th className="p-3">Material / Dori Nomi</th>
                <th className="p-3">O'lchov Birligi</th>
                <th className="p-3 text-right">Birlik Narxi</th>
                <th className="p-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {materials.map((m, idx) => (
                <tr key={m.id} className="hover:bg-surface-hover transition-colors">
                  <td className="p-3 font-mono text-muted font-bold">#{idx + 1}</td>
                  <td className="p-3 font-bold text-foreground">{m.name}</td>
                  <td className="p-3 text-muted">{m.unit_name}</td>
                  <td className="p-3 text-right font-mono font-bold text-gold">{formatMoney(m.unit_price)}</td>
                  <td className="p-3 text-center space-x-2">
                    <button
                      type="button"
                      className="btn-outline text-xs py-1 px-2.5"
                      onClick={() => {
                        setEditingMaterial(m)
                        setMaterialForm({ name: m.name, unit_name: m.unit_name, unit_price: m.unit_price })
                        setMaterialModal(true)
                      }}
                    >
                      Tahrirlash
                    </button>
                    <button type="button" className="btn-ghost text-xs text-rose-400 py-1 px-2.5" onClick={() => deleteMaterial(m.id)}>
                      O'chirish
                    </button>
                  </td>
                </tr>
              ))}
              {materials.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted italic">
                    Materiallar hali kiritilmagan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TARIFF MODAL */}
      <Modal open={tariffModal} onClose={() => setTariffModal(false)} title={editingTariff ? 'Tarifni Tahrirlash' : 'Yangi Tarif Yaratish'}>
        <div className="space-y-3 pt-2">
          <input className="input-field" placeholder="Tarif nomi (masalan: VIP Palata) *" value={tariffForm.name} onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })} />
          <input className="input-field" type="number" placeholder="Kunlik yotish narxi (so'm) *" value={tariffForm.daily_rate} onChange={(e) => setTariffForm({ ...tariffForm, daily_rate: e.target.value })} />
          <input className="input-field" placeholder="Tavsif (ixtiyoriy)" value={tariffForm.description} onChange={(e) => setTariffForm({ ...tariffForm, description: e.target.value })} />

          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-cyan-400">
                Tarif ichiga kiritiladigan Bepul Xizmatlar:
              </label>
              <span className="text-xs font-bold text-gold">
                Tanlandi: {tariffForm.included_service_ids.length} ta
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                className="input-field text-xs pl-8 py-2 w-full"
                placeholder="🔍 Xizmat nomi yoki bo'limi bo'yicha qidirish..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
              />
              {serviceSearch && (
                <button
                  type="button"
                  onClick={() => setServiceSearch('')}
                  className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Grouped Services List */}
            <div className="max-h-60 overflow-y-auto space-y-3 border border-border rounded-xl p-3 bg-surface text-xs">
              {Object.keys(groupedServices).length > 0 ? (
                Object.entries(groupedServices).map(([category, items]) => {
                  const selectedInGroup = items.filter((s) =>
                    tariffForm.included_service_ids.includes(s.id)
                  ).length
                  const allSelectedInGroup =
                    items.length > 0 && selectedInGroup === items.length

                  const toggleGroup = () => {
                    setTariffForm((prev) => {
                      const itemIds = items.map((s) => s.id)
                      if (allSelectedInGroup) {
                        return {
                          ...prev,
                          included_service_ids: prev.included_service_ids.filter(
                            (id) => !itemIds.includes(id)
                          ),
                        }
                      } else {
                        const newIds = new Set([
                          ...prev.included_service_ids,
                          ...itemIds,
                        ])
                        return {
                          ...prev,
                          included_service_ids: Array.from(newIds),
                        }
                      }
                    })
                  }

                  return (
                    <div key={category} className="space-y-1 bg-surface-2/40 p-2 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between pb-1 border-b border-border/50">
                        <span className="font-extrabold text-gold uppercase tracking-wider text-[11px] flex items-center gap-1">
                          📁 {category} ({selectedInGroup}/{items.length})
                        </span>
                        <button
                          type="button"
                          onClick={toggleGroup}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30"
                        >
                          {allSelectedInGroup ? "Barchasini bekor qilish" : "Bo'limni tanlash"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                        {items.map((s) => {
                          const checked = tariffForm.included_service_ids.includes(s.id)
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all border ${
                                checked
                                  ? 'bg-gold/10 border-gold/40 text-foreground font-bold'
                                  : 'hover:bg-surface-hover border-transparent text-body'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleServiceInTariff(s.id)}
                                className="accent-gold rounded"
                              />
                              <span className="flex-1 truncate" title={s.name}>{s.name}</span>
                              <span className="font-mono text-muted text-[10px] whitespace-nowrap">{formatMoney(s.price)}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-center text-muted italic py-4">Xizmatlar topilmadi</p>
              )}
            </div>
          </div>

          <button type="button" className="btn-gold w-full py-3 mt-4" onClick={handleTariffSubmit}>
            Saqlash
          </button>
        </div>
      </Modal>

      {/* ROOM MODAL */}
      <Modal open={roomModal} onClose={() => setRoomModal(false)} title={editingRoom ? 'Palatani Tahrirlash' : 'Yangi Palata Qo\'shish'}>
        <div className="space-y-3 pt-2">
          <input className="input-field" placeholder="Palata raqami / nomi (masalan: Palata №1, VIP 5) *" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} />
          <input className="input-field" placeholder="Tavsif (ixtiyoriy, masalan: Konditsionerli VIP)" value={roomForm.description} onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })} />
          {!editingRoom && (
            <input className="input-field" type="number" min={1} max={20} placeholder="Boshlang'ich Koykalar soni (masalan: 2)" value={roomForm.bed_count} onChange={(e) => setRoomForm({ ...roomForm, bed_count: e.target.value })} />
          )}

          <button type="button" className="btn-gold w-full py-3 mt-4" onClick={handleRoomSubmit}>
            Saqlash
          </button>
        </div>
      </Modal>

      {/* ADD SINGLE BED MODAL */}
      <Modal open={!!bedModal} onClose={() => setBedModal(null)} title="Palataga Yangi Koyka Qo'shish">
        {bedModal && (
          <div className="space-y-3 pt-2">
            <p className="font-bold text-cyan-400">{bedModal.room_number}</p>
            <input className="input-field" placeholder="Koyka / O'rin raqami yoki nomi (masalan: 3, Koyka-C) *" value={bedNumberForm} onChange={(e) => setBedNumberForm(e.target.value)} />
            <button type="button" className="btn-gold w-full py-3 mt-4" onClick={handleAddBed}>
              Koyka Qo'shish
            </button>
          </div>
        )}
      </Modal>

      {/* MATERIAL MODAL */}
      <Modal open={materialModal} onClose={() => setMaterialModal(false)} title={editingMaterial ? 'Materialni Tahrirlash' : 'Yangi Material Qo\'shish'}>
        <div className="space-y-3 pt-2">
          <input className="input-field" placeholder="Material yoki Dori nomi *" value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} />
          <input className="input-field" placeholder="O'lchov birligi (masalan: dona, ampula, flakon) *" value={materialForm.unit_name} onChange={(e) => setMaterialForm({ ...materialForm, unit_name: e.target.value })} />
          <input className="input-field" type="number" placeholder="Bir birlik narxi (so'm) *" value={materialForm.unit_price} onChange={(e) => setMaterialForm({ ...materialForm, unit_price: e.target.value })} />

          <button type="button" className="btn-gold w-full py-3 mt-4" onClick={handleMaterialSubmit}>
            Saqlash
          </button>
        </div>
      </Modal>
    </div>
  )
}
