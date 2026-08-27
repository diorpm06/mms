import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../utils/api'
import { formatMoney, formatWithCommas, parseDigits, birthYear } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/Modal'
import InpatientReceiptModal from '../../components/InpatientReceiptModal'
import VisualRoomMap from '../../components/VisualRoomMap'
import InpatientDetailsModal from '../../components/InpatientDetailsModal'
import ActionMenu from '../../components/ActionMenu'

export default function CeoInpatients() {
  const [active, setActive] = useState([])
  const [history, setHistory] = useState([])
  const [providers, setProviders] = useState([])
  // Statsionarda faqat "statsionar xizmat ko'rsatuvchi" belgisi qo'yilganlar tanlanadi
  const [inpatientProviders, setInpatientProviders] = useState([])
  const [referrers, setReferrers] = useState([])
  const [patients, setPatients] = useState([])
  const [tariffs, setTariffs] = useState([])
  const [materials, setMaterials] = useState([])
  const [services, setServices] = useState([])
  const [patientSearch, setPatientSearch] = useState('')

  // Patient admission mode: default to 'new' (Yangi bemor)
  const [admitPatientMode, setAdmitPatientMode] = useState('new')
  const [newPatientForm, setNewPatientForm] = useState({
    full_name: '',
    phone: '',
    passport_data: '',
    birth_date: '',
    gender: 'erkak',
    address: '',
  })

  // Initial payment mode: 'later' (Nasiya / Chiqishda) or 'advance' (Avans to'lash)
  const [initialPaymentMode, setInitialPaymentMode] = useState('later')

  // Modals
  const [admitModal, setAdmitModal] = useState(false)
  const [dischargeModal, setDischargeModal] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [itemModal, setItemModal] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [extendModal, setExtendModal] = useState(null)
  const [extendDaysCount, setExtendDaysCount] = useState(1)
  const [viewPatientModal, setViewPatientModal] = useState(null)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [editInpatientModal, setEditInpatientModal] = useState(null)
  const [editInpatientForm, setEditInpatientForm] = useState({
    first_name: '', last_name: '', phone: '', birth_date: '', address: '',
    room_number: '', bed_number: '', tariff_id: '', doctor_id: '', referrer_id: '',
    daily_rate: '', diagnosis: '', planned_days: '',
  })
  const [savingInpatientEdit, setSavingInpatientEdit] = useState(false)

  // Forms
  const [admitForm, setAdmitForm] = useState({
    patient_id: '',
    room_number: '',
    bed_number: '',
    tariff_id: '',
    doctor_id: '',
    referrer_id: '',
    diagnosis: '',
    daily_rate: '',
    planned_days: '',
    initial_payment_amount: '',
    initial_payment_type: 'cash',
  })

  const [dischargeForm, setDischargeForm] = useState({
    discharged_at: new Date().toISOString().slice(0, 10),
    payment_type: 'cash',
    days_count: 1,
    amount: '',
  })

  const [payForm, setPayForm] = useState({
    amount: '',
    payment_type: 'cash',
    payment_stage: 'interim', // advance | interim | discharge
    days_count: 1,
  })

  const [itemForm, setItemForm] = useState({
    item_type: 'service', // service | material | qolda (ro'yxatsiz)
    service_id: '',
    material_id: '',
    name: '',
    quantity: 1,
    unit_price: '',
    is_included_in_tariff: false,
    is_no_charge: false,
  })

  // Initial extra services/materials during admission
  const [admitExtraItems, setAdmitExtraItems] = useState([])
  const [admitItemForm, setAdmitItemForm] = useState({
    item_type: 'service',
    service_id: '',
    material_id: '',
    quantity: 1,
    unit_price: '',
    is_included_in_tariff: false,
  })
  // Xizmatlarni qidirib, bir nechtasini bir vaqtda tanlash uchun
  const [admitServiceSearch, setAdmitServiceSearch] = useState('')
  const [admitSelectedServiceIds, setAdmitSelectedServiceIds] = useState({})
  const [itemServiceSearch, setItemServiceSearch] = useState('')
  const [itemSelectedServiceIds, setItemSelectedServiceIds] = useState({})

  const toast = useToastStore((s) => s.add)
  const role = useAuthStore((s) => s.role)
  const isCeo = role === 'ceo'

  const [rooms, setRooms] = useState([])

  const loadData = () => {
    api('/inpatients?status=yotmoqda').then(setActive).catch(() => {})
    api('/inpatients/history').then(setHistory).catch(() => {})
    api('/inpatients/tariffs').then(setTariffs).catch(() => {})
    api('/inpatients/rooms').then(setRooms).catch(() => {})
    api('/inpatients/materials').then(setMaterials).catch(() => {})
    api('/services').then(setServices).catch(() => {})
  }

  useEffect(() => {
    loadData()
    api('/providers').then(setProviders).catch(() => {})
    api('/inpatients/service-providers').then((r) => setInpatientProviders(r || [])).catch(() => setInpatientProviders([]))
    api('/referrers').then(setReferrers).catch(() => {})
    api('/patients?include_cancelled=false').then(setPatients).catch(() => {})
  }, [])

  // Auto-fill tariff daily rate
  const handleTariffSelect = (tariffId) => {
    const sel = tariffs.find((t) => t.id === +tariffId)
    setAdmitForm((f) => ({
      ...f,
      tariff_id: tariffId,
      daily_rate: sel ? sel.daily_rate : f.daily_rate,
    }))
  }

  // Helper to open admission modal with clean or pre-filled room/bed
  const handleOpenAdmitModal = (room = '', bed = '') => {
    setAdmitForm({
      patient_id: '',
      room_number: room ? String(room) : '',
      bed_number: bed ? String(bed) : '',
      tariff_id: '',
      doctor_id: '',
      referrer_id: '',
      diagnosis: '',
      daily_rate: '',
      planned_days: '',
      initial_payment_amount: '',
      initial_payment_type: 'cash',
    })
    setNewPatientForm({ full_name: '', birth_date: '', address: '', phone: '' })
    setAdmitPatientMode('new')
    setAdmitExtraItems([])
    setAdmitItemForm({
      item_type: 'service', service_id: '', material_id: '', quantity: 1, unit_price: '', is_included_in_tariff: false
    })
    setAdmitModal(true)
  }

  // Handler to attach extra service/material inside AdmitModal before submitting
  const handleAddAdmitExtraItem = () => {
    if (admitItemForm.item_type === 'service' && !admitItemForm.service_id) {
      toast('Xizmatni tanlang', 'error')
      return
    }
    if (admitItemForm.item_type === 'material' && !admitItemForm.material_id) {
      toast('Materialni tanlang', 'error')
      return
    }

    let itemName = ''
    let price = 0

    if (admitItemForm.item_type === 'service') {
      const s = services.find((x) => x.id === +admitItemForm.service_id)
      if (s) {
        itemName = s.name
        price = admitItemForm.unit_price ? +admitItemForm.unit_price : s.price
      }
    } else {
      const m = materials.find((x) => x.id === +admitItemForm.material_id)
      if (m) {
        itemName = m.name
        price = admitItemForm.unit_price ? +admitItemForm.unit_price : m.unit_price
      }
    }

    const newItem = {
      item_type: admitItemForm.item_type,
      service_id: admitItemForm.service_id ? +admitItemForm.service_id : null,
      material_id: admitItemForm.material_id ? +admitItemForm.material_id : null,
      name: itemName,
      quantity: +admitItemForm.quantity || 1,
      unit_price: admitItemForm.is_included_in_tariff ? 0 : price,
      is_included_in_tariff: admitItemForm.is_included_in_tariff,
    }

    setAdmitExtraItems((prev) => [...prev, newItem])
    setAdmitItemForm({
      item_type: 'service', service_id: '', material_id: '', quantity: 1, unit_price: '', is_included_in_tariff: false
    })
    toast("Qo'shimcha element biriktirildi")
  }

  // Qidiruvda belgilangan bir nechta xizmatni bir vaqtda biriktirish
  const handleAddSelectedAdmitServices = () => {
    const ids = Object.keys(admitSelectedServiceIds).filter((id) => admitSelectedServiceIds[id])
    if (!ids.length) {
      toast('Kamida bitta xizmatni tanlang', 'error')
      return
    }
    const newItems = ids.map((id) => {
      const s = services.find((x) => x.id === +id)
      return {
        item_type: 'service',
        service_id: +id,
        material_id: null,
        name: s ? s.name : '',
        quantity: 1,
        unit_price: admitItemForm.is_included_in_tariff ? 0 : (s ? s.price : 0),
        is_included_in_tariff: admitItemForm.is_included_in_tariff,
      }
    })
    setAdmitExtraItems((prev) => [...prev, ...newItems])
    setAdmitSelectedServiceIds({})
    setAdmitServiceSearch('')
    toast(`${newItems.length} ta xizmat biriktirildi`)
  }

  // Submit Admission
  const handleAdmit = async () => {
    let targetPatientId = null
    let targetFullName = null

    if (admitPatientMode === 'existing' && admitForm.patient_id) {
      targetPatientId = +admitForm.patient_id
    } else if (admitPatientMode === 'existing' && patientSearch.trim()) {
      targetFullName = patientSearch.trim()
    } else if (newPatientForm.full_name.trim()) {
      targetFullName = newPatientForm.full_name.trim()
    } else if (patientSearch.trim()) {
      targetFullName = patientSearch.trim()
    } else {
      toast('Bemor F.I.O (Ismi va Familiyasi) kiritilishi shart (*)', 'error')
      return
    }

    if (!admitForm.tariff_id) {
      toast('Statsionar tarif paketini tanlash shart (*)', 'error')
      return
    }
    if (!admitForm.room_number || !admitForm.bed_number || !admitForm.daily_rate) {
      toast('Palata, koyka va kunlik narx to\'ldirilishi shart (*)', 'error')
      return
    }

    const initialAmount = admitForm.initial_payment_amount ? +admitForm.initial_payment_amount : 0

    const payload = {
      room_number: admitForm.room_number,
      bed_number: admitForm.bed_number,
      tariff_id: admitForm.tariff_id ? +admitForm.tariff_id : null,
      doctor_id: admitForm.doctor_id ? +admitForm.doctor_id : null,
      referrer_id: admitForm.referrer_id ? +admitForm.referrer_id : null,
      daily_rate: +admitForm.daily_rate,
      diagnosis: admitForm.diagnosis || null,
      planned_days: admitForm.planned_days ? +admitForm.planned_days : null,
      initial_payment_amount: initialAmount,
      initial_payment_type: initialAmount > 0 ? admitForm.initial_payment_type : 'later',
      cash_amount: admitForm.initial_payment_type === 'split' && admitForm.cash_amount ? +admitForm.cash_amount : undefined,
      card_amount: admitForm.initial_payment_type === 'split' && admitForm.card_amount ? +admitForm.card_amount : undefined,
      click_amount: admitForm.initial_payment_type === 'split' && admitForm.click_amount ? +admitForm.click_amount : undefined,
      qr_amount: admitForm.initial_payment_type === 'split' && admitForm.qr_amount ? +admitForm.qr_amount : undefined,
    }

    if (targetPatientId) {
      payload.patient_id = targetPatientId
    } else {
      payload.full_name = targetFullName
      payload.birth_date = newPatientForm.birth_date.trim() || '1990'
      payload.address = newPatientForm.address.trim() || "Ko'rsatilmagan"
      payload.phone = newPatientForm.phone.trim() || undefined
    }

    try {
      const res = await api('/inpatients', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      // Attach any extra items selected during admission
      if (admitExtraItems.length > 0) {
        await Promise.all(
          admitExtraItems.map((item) =>
            api(`/inpatients/${res.id}/items`, {
              method: 'POST',
              body: JSON.stringify(item),
            })
          )
        )
      }

      toast('Bemor yotqizildi va qabul qilindi')
      setAdmitModal(false)
      setAdmitForm({
        patient_id: '', room_number: '', bed_number: '', tariff_id: '', doctor_id: '',
        referrer_id: '', diagnosis: '', daily_rate: '', planned_days: '', initial_payment_amount: '', initial_payment_type: 'cash',
        cash_amount: '', card_amount: '', click_amount: '', qr_amount: ''
      })
      setNewPatientForm({ full_name: '', birth_date: '', address: '', phone: '' })
      setAdmitExtraItems([])

      loadData()

      // ONLY open receipt modal if an initial advance payment was actually made upfront
      if (initialAmount > 0) {
        const fullInpatient = await api(`/inpatients/${res.id}`)
        setSelectedReceipt(fullInpatient)
      }
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Submit Extra Item (Service or Material)
  const handleAddItem = async () => {
    if (!itemModal) return
    const qolda = itemForm.item_type === 'qolda'
    if (qolda) {
      if (!(itemForm.name || '').trim()) {
        toast('Nomini yozing', 'error')
        return
      }
      if (!itemForm.is_included_in_tariff && !(+itemForm.unit_price > 0)) {
        toast('Narxini kiriting', 'error')
        return
      }
    }
    try {
      await api(`/inpatients/${itemModal.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          // Qo'lda kiritilgani baribir "material" turida saqlanadi,
          // faqat ro'yxatga bog'lanmaydi.
          item_type: qolda ? 'material' : itemForm.item_type,
          service_id: (!qolda && itemForm.service_id) ? +itemForm.service_id : undefined,
          material_id: (!qolda && itemForm.material_id) ? +itemForm.material_id : undefined,
          name: qolda ? itemForm.name.trim() : undefined,
          quantity: +itemForm.quantity || 1,
          unit_price: itemForm.unit_price !== '' ? +itemForm.unit_price : undefined,
          is_included_in_tariff: itemForm.is_included_in_tariff,
          is_no_charge: itemForm.is_no_charge,
        }),
      })
      toast('Qo\'shimcha xizmat/material biriktirildi')
      setItemModal(null)
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Qidiruvda belgilangan bir nechta xizmatni mavjud bemorga ketma-ket
  // biriktirish (backend bitta xizmatni qabul qiladi)
  const handleAddSelectedItemServices = async () => {
    if (!itemModal) return
    const ids = Object.keys(itemSelectedServiceIds).filter((id) => itemSelectedServiceIds[id])
    if (!ids.length) {
      toast('Kamida bitta xizmatni tanlang', 'error')
      return
    }
    try {
      for (const id of ids) {
        await api(`/inpatients/${itemModal.id}/items`, {
          method: 'POST',
          body: JSON.stringify({
            item_type: 'service',
            service_id: +id,
            quantity: 1,
            is_included_in_tariff: itemForm.is_included_in_tariff,
            is_no_charge: itemForm.is_no_charge,
          }),
        })
      }
      toast(`${ids.length} ta xizmat biriktirildi`)
      setItemSelectedServiceIds({})
      setItemServiceSearch('')
      setItemModal(null)
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Remove Item
  const handleRemoveItem = async (inpatientId, itemId) => {
    if (!confirm('Ushbu elementni o\'chirmoqchimisiz?')) return
    try {
      await api(`/inpatients/${inpatientId}/items/${itemId}`, { method: 'DELETE' })
      toast('O\'chirildi')
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Edit Item (name / quantity / price)
  const handleUpdateItem = async (inpatientId) => {
    if (!editingItem) return
    if (!(editingItem.name || '').trim()) {
      toast('Nomini yozing', 'error')
      return
    }
    try {
      await api(`/inpatients/${inpatientId}/items/${editingItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editingItem.name.trim(),
          quantity: +editingItem.quantity || 1,
          unit_price: +editingItem.unit_price || 0,
          is_included_in_tariff: editingItem.is_included_in_tariff,
          is_no_charge: editingItem.is_no_charge,
        }),
      })
      toast('Yangilandi')
      setEditingItem(null)
      setItemModal(null)
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Submit Payment (Advance / Interim / Discharge)
  const handlePayment = async () => {
    if (!payModal || !payForm.amount) return
    const targetId = payModal.id

    const yubor = (allowOverpay) => api(`/inpatients/${targetId}/payment`, {
      method: 'POST',
      body: JSON.stringify({
        amount: +payForm.amount,
        payment_type: payForm.payment_type,
        payment_stage: payForm.payment_stage,
        days_count: +payForm.days_count || 1,
        cash_amount: payForm.payment_type === 'split' && payForm.cash_amount ? +payForm.cash_amount : undefined,
        card_amount: payForm.payment_type === 'split' && payForm.card_amount ? +payForm.card_amount : undefined,
        click_amount: payForm.payment_type === 'split' && payForm.click_amount ? +payForm.click_amount : undefined,
        qr_amount: payForm.payment_type === 'split' && payForm.qr_amount ? +payForm.qr_amount : undefined,
        ...(allowOverpay ? { allow_overpay: true } : {}),
      }),
    })

    const yakunla = async () => {
      toast('To\'lov kiritildi')
      setPayModal(null)
      loadData()
      // Fetch full inpatient details for printable receipt
      const fullInpatient = await api(`/inpatients/${targetId}`)
      setSelectedReceipt(fullInpatient)
    }

    try {
      await yubor(false)
      await yakunla()
    } catch (e) {
      // Server hisobdan ortiq to'lovni to'xtatadi. Bu ataylab (oldindan
      // ko'proq to'lash) bo'lishi mumkin — shuning uchun tasdiqlash so'raymiz.
      if (e.status === 400 && /ortiq/i.test(e.message || '')) {
        if (!window.confirm(`${e.message}\n\nBaribir qabul qilinsinmi?`)) return
        try {
          await yubor(true)
          await yakunla()
        } catch (e2) {
          toast(e2.message, 'error')
        }
        return
      }
      toast(e.message, 'error')
    }
  }

  // Submit Discharge (Выписка)
  const handleDischarge = async () => {
    if (!dischargeModal) return
    const targetId = dischargeModal.id
    try {
      const res = await api(`/inpatients/${targetId}/discharge`, {
        method: 'POST',
        body: JSON.stringify({
          discharged_at: dischargeForm.discharged_at,
          payment_type: dischargeForm.payment_type,
          days_count: +dischargeForm.days_count || undefined,
          amount: dischargeForm.amount !== '' ? +dischargeForm.amount : 0,
          cash_amount: dischargeForm.payment_type === 'split' && dischargeForm.cash_amount ? +dischargeForm.cash_amount : undefined,
          card_amount: dischargeForm.payment_type === 'split' && dischargeForm.card_amount ? +dischargeForm.card_amount : undefined,
          click_amount: dischargeForm.payment_type === 'split' && dischargeForm.click_amount ? +dischargeForm.click_amount : undefined,
          qr_amount: dischargeForm.payment_type === 'split' && dischargeForm.qr_amount ? +dischargeForm.qr_amount : undefined,
        }),
      })
      // Rejadan oldin chiqib ketsa, oldindan olingan ortiqcha pul
      // qaytariladi va kassadan harajat sifatida chiqadi. Kassir buni
      // ko'rishi shart — aks holda pulni bermay qolib ketishi mumkin.
      if (res.refunded > 0) {
        toast(
          `Chiqarildi. DIQQAT: bemorga ${formatMoney(res.refunded)} qaytarilishi kerak ` +
          `(rejadan oldin chiqdi). Summa bugungi harajatga yozildi.`,
        )
        window.alert(
          `↩️ BEMORGA QAYTARILADI: ${formatMoney(res.refunded)}\n\n` +
          `Bemor rejadan oldin chiqdi. Faqat ${res.days} kun uchun hisoblandi ` +
          `(${formatMoney(res.grand_total)}).\n` +
          `Oldindan to'langan: ${formatMoney(res.paid_before)}\n\n` +
          `Ortiqcha summa kassadan chiqarildi va bugungi harajatlarga yozildi.`
        )
      } else {
        toast(`Chiqarildi (Выписка): ${formatMoney(res.amount)}`)
      }
      setDischargeModal(null)
      loadData()

      // Fetch full inpatient details for final receipt with complete payment timeline
      const fullInpatient = await api(`/inpatients/${targetId}`)
      setSelectedReceipt(fullInpatient)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Extend Inpatient Stay Duration (+ Days)
  const handleExtendStay = async () => {
    if (!extendModal || !extendDaysCount || +extendDaysCount <= 0) return
    try {
      await api(`/inpatients/${extendModal.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ additional_days: +extendDaysCount }),
      })
      toast(`Bemorning statsionar muddati +${extendDaysCount} kunga uzaytirildi!`)
      setExtendModal(null)
      loadData()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Open Edit Inpatient Modal
  const openEditInpatient = (inp) => {
    setEditInpatientForm({
      first_name: inp.first_name || '',
      last_name: inp.last_name || '',
      phone: inp.phone || '',
      birth_date: birthYear(inp.birth_date),
      address: inp.address || '',
      room_number: inp.room_number || '',
      bed_number: inp.bed_number || '',
      tariff_id: inp.tariff_id ? String(inp.tariff_id) : '',
      doctor_id: inp.doctor_id ? String(inp.doctor_id) : '',
      referrer_id: inp.referrer_id ? String(inp.referrer_id) : '',
      daily_rate: inp.daily_rate ? String(inp.daily_rate) : '',
      diagnosis: inp.diagnosis || '',
      planned_days: inp.planned_days ? String(inp.planned_days) : '',
    })
    setEditInpatientModal(inp)
  }

  // Save Edit Inpatient
  const handleSaveInpatientEdit = async () => {
    if (!editInpatientModal) return
    if (!editInpatientForm.first_name.trim()) {
      toast('Bemor ismi kiritilishi shart', 'error')
      return
    }
    if (!editInpatientForm.room_number.trim() || !editInpatientForm.bed_number.trim()) {
      toast('Palata va koyka kiritilishi shart', 'error')
      return
    }
    setSavingInpatientEdit(true)
    try {
      const bDateStr = /^\d{4}$/.test(editInpatientForm.birth_date.trim())
        ? `${editInpatientForm.birth_date.trim()}-01-01`
        : editInpatientForm.birth_date.trim() || null

      await api(`/inpatients/${editInpatientModal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: editInpatientForm.first_name.trim(),
          last_name: editInpatientForm.last_name.trim() || '.',
          phone: editInpatientForm.phone.trim() || undefined,
          birth_date: bDateStr,
          address: editInpatientForm.address.trim() || undefined,
          room_number: editInpatientForm.room_number.trim(),
          bed_number: editInpatientForm.bed_number.trim(),
          tariff_id: editInpatientForm.tariff_id ? +editInpatientForm.tariff_id : 0,
          doctor_id: editInpatientForm.doctor_id ? +editInpatientForm.doctor_id : 0,
          referrer_id: editInpatientForm.referrer_id ? +editInpatientForm.referrer_id : 0,
          daily_rate: editInpatientForm.daily_rate ? +editInpatientForm.daily_rate : undefined,
          diagnosis: editInpatientForm.diagnosis.trim() || null,
          planned_days: editInpatientForm.planned_days ? +editInpatientForm.planned_days : undefined,
        }),
      })
      toast("Statsionar bemor ma'lumotlari yangilandi ✓")
      setEditInpatientModal(null)
      loadData()
    } catch (e) {
      toast(e.message || 'Saqlashda xatolik', 'error')
    } finally {
      setSavingInpatientEdit(false)
    }
  }


  // Live patient search from API when receptionist types in search box
  useEffect(() => {
    if (admitPatientMode === 'existing' && patientSearch.trim().length >= 2) {
      api(`/patients?search=${encodeURIComponent(patientSearch.trim())}&include_cancelled=false`)
        .then((res) => {
          if (Array.isArray(res)) {
            setPatients(res)
          }
        })
        .catch(() => {})
    }
  }, [patientSearch, admitPatientMode])

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase()
    if (!q) return patients.slice(0, 100)
    return patients
      .filter((p) => {
        const full = `${p.first_name || ''} ${p.last_name || ''} ${p.full_name || ''} ${p.phone || ''} ${p.address || ''}`.toLowerCase()
        return full.includes(q)
      })
      .slice(0, 100)
  }, [patients, patientSearch])

  const selectedPatient = patients.find((p) => p.id === +admitForm.patient_id)

  return (
    <div className="space-y-6">
      {/* THERMAL DISCHARGE RECEIPT MODAL */}
      {selectedReceipt && (
        <InpatientReceiptModal
          inpatient={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-title">Statsionar Yotgan Bemorlar</h1>
          <p className="text-xs text-muted mt-1">Palatalar, tarif paketlari, qo'shimcha xizmatlar va moslashuvchan to'lovlarni boshqarish</p>
        </div>
        <div className="flex gap-2">
          {isCeo && (
            <Link to="/ceo/inpatients-settings" className="btn-outline text-sm flex items-center gap-1">
              ⚙️ Tariflar va Sozlamalar
            </Link>
          )}
          <button type="button" className="btn-gold text-sm" onClick={() => handleOpenAdmitModal()}>
            + Qabul qilish
          </button>
        </div>
      </div>

      {/* VISUAL ROOM & BED MAP */}
      <VisualRoomMap
        rooms={rooms}
        activeInpatients={active}
        onAdmitRoom={(room, bed) => handleOpenAdmitModal(room, bed)}
        onAddItem={(inp) => {
          setItemForm({ item_type: 'service', service_id: '', material_id: '', quantity: 1, unit_price: '', is_included_in_tariff: false, is_no_charge: false })
          setItemModal(inp)
        }}
        onPay={(inp) => {
          setPayForm({
            amount: '',
            payment_type: 'cash',
            payment_stage: 'interim',
            days_count: 1,
            cash_amount: '', card_amount: '', click_amount: '', qr_amount: ''
          })
          setPayModal(inp)
        }}
        onViewPatient={(inp) => setViewPatientModal(inp)}
        onDischarge={(inp) => {
          const rem = inp.balance_due !== undefined ? inp.balance_due : Math.max(0, (inp.total_amount || 0) - (inp.paid_total || 0))
          setDischargeForm({
            discharged_at: new Date().toISOString().slice(0, 10),
            payment_type: 'cash',
            days_count: inp.planned_days || inp.days || 1,
            amount: rem > 0 ? String(rem) : '0',
            cash_amount: '', card_amount: '', click_amount: '', qr_amount: ''
          })
          setDischargeModal(inp)
        }}
        onPrintReceipt={(inp) => {
          setSelectedReceipt({
            ...inp,
            status: 'yotmoqda',
          })
        }}
      />

      {/* ACTIVE INPATIENTS TABLE */}
      <div className="card overflow-x-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gold">Aktiv yotgan bemorlar ({active.length})</h2>
          {active.length > 0 && (
            <span className="text-xs text-muted">
              💡 Bemorga qo'shimcha tahlil yoki dori qo'shish uchun <b>+ Xizmat/Dori</b> tugmasini bosing
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left text-amber-700 dark:text-gold font-bold">
              <th className="p-3">Bemor Ismi</th>
              <th className="p-3">Palata / Koyka</th>
              <th className="p-3">Tarif / Kunlik Narx</th>
              <th className="p-3">Muddat</th>
              <th className="p-3">Jami Hisob</th>
              <th className="p-3">To'lov Holati</th>
              <th className="p-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {active.map((i) => (
              <tr key={i.id} className="hover:bg-surface-hover transition-colors">
                <td className="p-3 font-bold text-foreground">
                  <button
                    type="button"
                    onClick={() => setViewPatientModal(i)}
                    className="hover:underline text-cyan-600 dark:text-cyan-400 text-left font-extrabold"
                    title="Bemor kartasini ko'rish"
                  >
                    {i.first_name} {i.last_name}
                  </button>
                  <div className="text-xs text-muted font-normal">
                    {i.doctor_name ? (i.doctor_name.toLowerCase().startsWith('dr.') ? i.doctor_name : `Dr. ${i.doctor_name}`) : ''}
                  </div>
                </td>
                <td className="p-3 font-mono font-bold text-cyan-600 dark:text-cyan-400">{i.room_number}/{i.bed_number}</td>
                <td className="p-3">
                  <div className="font-bold">{i.tariff_name || 'Standart'}</div>
                  <div className="text-xs text-muted font-mono">{formatMoney(i.daily_rate)}/kun</div>
                </td>
                <td className="p-3 font-bold">{i.days || i.days_count || 1}{i.planned_days ? ` / ${i.planned_days}` : ''} kun</td>
                <td className="p-3 font-mono font-bold text-foreground">
                  {formatMoney(i.total_amount)}
                  {i.extra_items_total > 0 && (
                    <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-normal">+{formatMoney(i.extra_items_total)} qo'shimcha</div>
                  )}
                </td>
                <td className="p-3">
                  {i.paid_total === 0 ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 inline-block">
                      ⏳ Chiqishda (Nasiya)
                    </span>
                  ) : i.balance_due > 0 ? (
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 block">{formatMoney(i.paid_total)} (Bosh to'lov)</span>
                      <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 block">Qoldiq: {formatMoney(i.balance_due)}</span>
                    </div>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/40 inline-block">
                      ✅ To'liq to'langan
                    </span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <ActionMenu
                    title="Amallar"
                    items={[
                      {
                        label: '👁️ Bemor kartochkasi',
                        variant: 'gold',
                        onClick: () => setViewPatientModal(i),
                      },
                      {
                        label: '✏️ Ma\'lumotlarni tahrirlash',
                        variant: 'gold',
                        onClick: () => openEditInpatient(i),
                      },
                      {
                        label: '🧪 + Xizmat/Dori qo\'shish',
                        variant: 'default',
                        onClick: () => {
                          setItemForm({ item_type: 'service', service_id: '', material_id: '', quantity: 1, unit_price: '', is_included_in_tariff: false, is_no_charge: false })
                          setItemModal(i)
                        },
                      },
                      {
                        label: '📅 Kun uzaytirish (+Kun qo\'shish)',
                        variant: 'amber',
                        onClick: () => {
                          setExtendDaysCount(1)
                          setExtendModal(i)
                        },
                      },
                      {
                        label: '💳 To\'lov kiritish',
                        variant: 'success',
                        onClick: () => {
                          setPayForm({ amount: '', payment_type: 'cash', payment_stage: 'interim', days_count: 1, cash_amount: '', card_amount: '', click_amount: '', qr_amount: '' })
                          setPayModal(i)
                        },
                      },
                      {
                        label: '🧾 Chek chiqarish',
                        variant: 'gold',
                        onClick: () => setSelectedReceipt({ ...i, status: 'yotmoqda' }),
                      },
                      {
                        label: '🚪 Chiqarish (Выписка)',
                        variant: 'gold',
                        onClick: () => {
                          const rem = i.balance_due !== undefined ? i.balance_due : Math.max(0, (i.total_amount || 0) - (i.paid_total || 0))
                          setDischargeForm({
                            discharged_at: new Date().toISOString().slice(0, 10),
                            payment_type: 'cash',
                            days_count: i.planned_days || i.days || 1,
                            amount: rem > 0 ? String(rem) : '0',
                            cash_amount: '', card_amount: '', click_amount: '', qr_amount: ''
                          })
                          setDischargeModal(i)
                        },
                      },
                      {
                        label: '❌ Yotishni bekor qilish',
                        variant: 'danger',
                        onClick: () => handleCancelInpatient(i.id),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {active.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted italic">
                  Hozirda palatalarda aktiv yotgan bemorlar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DISCHARGED HISTORY TABLE */}
      {history.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 font-semibold text-muted">Chiqarilgan Bemorlar Tarixi ({history.length})</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-muted">
                <th className="p-3">Ism-Sharifi</th>
                <th className="p-3">Palata</th>
                <th className="p-3">Tarif</th>
                <th className="p-3">Jami Hisob</th>
                <th className="p-3 text-right">Chek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((i) => (
                <tr key={i.id} className="hover:bg-surface-hover">
                  <td className="p-3 font-medium">{i.first_name} {i.last_name}</td>
                  <td className="p-3 font-mono text-muted">{i.room_number}/{i.bed_number}</td>
                  <td className="p-3 text-xs text-muted">{i.tariff_name || 'Standart'}</td>
                  <td className="p-3 font-mono font-bold text-gold">{formatMoney(i.total_amount)}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt({ ...i, status: 'chiqdi' })}
                      className="btn-outline text-xs py-1 px-2.5"
                    >
                      🧾 Chek
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: ADMIT INPATIENT */}
      <Modal open={admitModal} onClose={() => { setAdmitModal(false); setAdmitSelectedServiceIds({}); setAdmitServiceSearch('') }} title="Yotgan bemorni qabul qilish">
        <div className="space-y-3 pt-2">
          {/* Mode Switcher: Existing vs New */}
          <div className="flex rounded-xl bg-surface-2 p-1 border border-border/80 gap-1">
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                admitPatientMode === 'existing'
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                  : 'bg-surface-sunken text-muted hover:text-body'
              }`}
              onClick={() => setAdmitPatientMode('existing')}
            >
              <span>🔍 Bazadagi Bemorni Tanlash</span>
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                admitPatientMode === 'new'
                  ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/50'
                  : 'bg-surface-sunken text-muted hover:text-body'
              }`}
              onClick={() => setAdmitPatientMode('new')}
            >
              <span>➕ Yangi Bemor Ro'yxatga Olish</span>
            </button>
          </div>

          {/* Mode 1: Existing Patient */}
          {admitPatientMode === 'existing' ? (
            <div className="space-y-2">
              <input
                className="input-field"
                placeholder="Bazada bemor qidirish (ism/tel)"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              <select
                className="input-field"
                value={admitForm.patient_id}
                onChange={(e) => setAdmitForm({ ...admitForm, patient_id: e.target.value })}
              >
                <option value="">Bazada bemorni tanlang *</option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || `${p.first_name} ${p.last_name}`} — {p.phone || "Tel yo'q"} ({p.address || "Manzil yo'q"})
                  </option>
                ))}
              </select>
              {selectedPatient && (
                <div className="p-2 bg-cyan-950/30 border border-cyan-500/40 rounded-xl text-xs space-y-0.5 animate-in fade-in">
                  <p className="text-cyan-300 font-bold">
                    📍 {selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`}
                  </p>
                  <p className="text-muted text-[11px]">
                    📞 {selectedPatient.phone || "Tel yo'q"} | 🏠 {selectedPatient.address || "Manzil yo'q"} | 🎂 {selectedPatient.birth_date || "Sana yo'q"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: New Patient */
            <div className="space-y-2 bg-surface-2/40 p-2.5 rounded-xl border border-border/60">
              <input
                className="input-field"
                placeholder="Bemor F.I.O (Ismi va Familiyasi) *"
                value={newPatientForm.full_name}
                onChange={(e) => setNewPatientForm({ ...newPatientForm, full_name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-field"
                  type="text"
                  placeholder="Tug'ilgan yili (masalan: 1995) *"
                  value={newPatientForm.birth_date}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, birth_date: e.target.value })}
                />
                <input
                  className="input-field"
                  placeholder="Manzili (shahar / tuman) *"
                  value={newPatientForm.address}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, address: e.target.value })}
                />
              </div>

              <input
                className="input-field"
                placeholder="Telefon raqami (ixtiyoriy)"
                value={newPatientForm.phone}
                onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value })}
              />
            </div>
          )}

          {/* Tarif selection (REQUIRED) */}
          <select className="input-field border-cyan-500/50 font-bold" value={admitForm.tariff_id} onChange={(e) => handleTariffSelect(e.target.value)}>
            <option value="">Statsionar Tarif Paketi Tanlang *</option>
            {tariffs.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.daily_rate)}/kun</option>
            ))}
          </select>

          {/* Room & Bed selection */}
          {admitForm.room_number && admitForm.bed_number ? (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 block">Tanlangan Palata va Koyka:</span>
                  <span className="text-sm font-extrabold text-gold font-mono">
                    {admitForm.room_number} — Koyka {admitForm.bed_number}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/30"
                onClick={() => setAdmitForm({ ...admitForm, room_number: '', bed_number: '' })}
              >
                O'zgartirish
              </button>
            </div>
          ) : rooms && rooms.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <select
                className="input-field"
                value={admitForm.room_number}
                onChange={(e) => {
                  setAdmitForm({ ...admitForm, room_number: e.target.value, bed_number: '' })
                }}
              >
                <option value="">Palatani tanlang *</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.room_number}>{r.room_number} ({r.beds?.length || 0} koyka)</option>
                ))}
              </select>

              <select
                className="input-field"
                value={admitForm.bed_number}
                onChange={(e) => setAdmitForm({ ...admitForm, bed_number: e.target.value })}
              >
                <option value="">Koykani tanlang *</option>
                {(() => {
                  const selRoom = rooms.find((r) => r.room_number === admitForm.room_number)
                  if (!selRoom || !selRoom.beds) return null
                  return selRoom.beds.map((b) => (
                    <option key={b.id} value={b.bed_number}>Koyka {b.bed_number}</option>
                  ))
                })()}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Palata xona *" value={admitForm.room_number} onChange={(e) => setAdmitForm({ ...admitForm, room_number: e.target.value })} />
              <input className="input-field" placeholder="Koyka / Karavot *" value={admitForm.bed_number} onChange={(e) => setAdmitForm({ ...admitForm, bed_number: e.target.value })} />
            </div>
          )}

          <div>
            <select className="input-field" value={admitForm.doctor_id} onChange={(e) => setAdmitForm({ ...admitForm, doctor_id: e.target.value })}>
              <option value="">— Mas'ul shifokor biriktirilmagan (Yo'q) —</option>
              {inpatientProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {formatMoney(p.daily_rate)}/kun
                </option>
              ))}
            </select>
            {inpatientProviders.length === 0 ? (
              <p className="text-[11px] text-amber-400 font-semibold mt-1">
                Statsionar xizmat ko'rsatuvchi belgilanmagan. Shifokorlar bo'limidagi
                "Statsionar" qismidan qo'shing.
              </p>
            ) : admitForm.doctor_id ? (
              <p className="text-[11px] text-muted font-semibold mt-1">
                Bemor yotgan har bir kun uchun shifokorga{' '}
                <span className="text-gold font-bold">
                  {formatMoney(inpatientProviders.find((p) => String(p.id) === String(admitForm.doctor_id))?.daily_rate || 0)}
                </span>{' '}
                yoziladi.
              </p>
            ) : null}
          </div>

          {/* Daily Rate & Planned Days */}
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field" type="number" placeholder="Kunlik yotish narxi *" value={admitForm.daily_rate} onChange={(e) => setAdmitForm({ ...admitForm, daily_rate: e.target.value })} />
            <input className="input-field" type="number" min={1} placeholder="Reja muddat (kun)" value={admitForm.planned_days} onChange={(e) => setAdmitForm({ ...admitForm, planned_days: e.target.value })} />
          </div>

          <input className="input-field" placeholder="Tashxis / izoh (ixtiyoriy)" value={admitForm.diagnosis} onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })} />

          {/* OPTIONAL EXTRA SERVICES / MATERIALS AT ADMISSION */}
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-cyan-400">
                🧪 Qo'shimcha Xizmatlar / Dori-darmonlar (Qabul paytida biriktirish):
              </label>
              {admitExtraItems.length > 0 && (
                <span className="text-xs font-bold text-gold">
                  {admitExtraItems.length} ta biriktirildi
                </span>
              )}
            </div>

            <div className="p-2.5 bg-surface-2/40 rounded-xl border border-border/60 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={admitItemForm.item_type === 'service' ? 'btn-gold flex-1 text-xs py-1' : 'btn-outline flex-1 text-xs py-1'}
                  onClick={() => setAdmitItemForm({ ...admitItemForm, item_type: 'service', service_id: '', material_id: '' })}
                >
                  🩺 Tahlil / Xizmat
                </button>
                <button
                  type="button"
                  className={admitItemForm.item_type === 'material' ? 'btn-gold flex-1 text-xs py-1' : 'btn-outline flex-1 text-xs py-1'}
                  onClick={() => setAdmitItemForm({ ...admitItemForm, item_type: 'material', service_id: '', material_id: '' })}
                >
                  💉 Dori / Material
                </button>
              </div>

              {admitItemForm.item_type === 'service' ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    className="input-field text-xs"
                    placeholder="🔍 Xizmat nomini qidiring..."
                    value={admitServiceSearch}
                    onChange={(e) => setAdmitServiceSearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto space-y-0.5 p-1.5 bg-surface rounded-lg border border-border/60">
                    {services
                      .filter((s) => s.name.toLowerCase().includes(admitServiceSearch.toLowerCase()))
                      .map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-surface-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-gold rounded shrink-0"
                            checked={!!admitSelectedServiceIds[s.id]}
                            onChange={(e) => setAdmitSelectedServiceIds((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                          />
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="text-muted font-mono shrink-0">{formatMoney(s.price)}</span>
                        </label>
                      ))}
                    {services.filter((s) => s.name.toLowerCase().includes(admitServiceSearch.toLowerCase())).length === 0 && (
                      <p className="text-center text-muted text-[11px] py-2">Xizmat topilmadi</p>
                    )}
                  </div>
                </div>
              ) : (
                <select
                  className="input-field text-xs"
                  value={admitItemForm.material_id}
                  onChange={(e) => setAdmitItemForm({ ...admitItemForm, material_id: e.target.value })}
                >
                  <option value="">— Materialni tanlang —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.unit_name}) — {formatMoney(m.unit_price)}</option>
                  ))}
                </select>
              )}

              {admitItemForm.item_type === 'service' ? (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={admitItemForm.is_included_in_tariff}
                      onChange={(e) => setAdmitItemForm({ ...admitItemForm, is_included_in_tariff: e.target.checked })}
                      className="accent-gold rounded"
                    />
                    <span>Tarif ichida (0 so'm)</span>
                  </label>
                  <button
                    type="button"
                    className="btn-outline text-xs py-1 px-3 border-cyan-500/40 text-cyan-300 font-bold shrink-0"
                    onClick={handleAddSelectedAdmitServices}
                  >
                    + Tanlanganlarni Biriktirish ({Object.values(admitSelectedServiceIds).filter(Boolean).length})
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    className="input-field text-xs w-20"
                    placeholder="Soni"
                    value={admitItemForm.quantity}
                    onChange={(e) => setAdmitItemForm({ ...admitItemForm, quantity: e.target.value })}
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={admitItemForm.is_included_in_tariff}
                      onChange={(e) => setAdmitItemForm({ ...admitItemForm, is_included_in_tariff: e.target.checked })}
                      className="accent-gold rounded"
                    />
                    <span>Tarif ichida (0 so'm)</span>
                  </label>
                  <button
                    type="button"
                    className="btn-outline text-xs py-1 px-3 border-cyan-500/40 text-cyan-300 font-bold shrink-0"
                    onClick={handleAddAdmitExtraItem}
                  >
                    + Biriktirish
                  </button>
                </div>
              )}

              {/* Added extra items list */}
              {admitExtraItems.length > 0 && (
                <div className="space-y-1 pt-1">
                  {admitExtraItems.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-surface rounded border border-border/80">
                      <div>
                        <span className="font-bold text-foreground">{it.name}</span>
                        <span className="text-muted ml-1.5">{it.quantity}x — {formatMoney(it.unit_price * it.quantity)}</span>
                        {it.is_included_in_tariff && <span className="text-cyan-400 font-bold ml-1.5">(Tarifda)</span>}
                      </div>
                      <button
                        type="button"
                        className="text-rose-400 font-bold text-xs hover:text-rose-300 px-1"
                        onClick={() => setAdmitExtraItems(admitExtraItems.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PROMINENT GRAND TOTAL & ITEMIZED BREAKDOWN SUMMARY CARD */}
          {(() => {
            const roomEst = admitForm.daily_rate ? (+admitForm.daily_rate * (+admitForm.planned_days || 1)) : 0
            const admitExtraItemsTotal = admitExtraItems.reduce((sum, it) => sum + (it.is_included_in_tariff ? 0 : (it.unit_price * it.quantity)), 0)
            const grandTotalEst = roomEst + admitExtraItemsTotal

            if (grandTotalEst <= 0) return null

            return (
              <div className="p-3.5 bg-gradient-to-br from-amber-950/40 via-surface-2 to-cyan-950/40 border-2 border-gold/50 rounded-2xl space-y-2 shadow-lg animate-in fade-in">
                <div className="flex justify-between items-center pb-2 border-b border-border/80 text-xs">
                  <span className="font-extrabold text-foreground tracking-wide uppercase">🧾 Yotish va Xizmatlar Hisobi:</span>
                  <span className="text-[11px] text-cyan-400 font-bold">Rejalashtirilgan ({admitForm.planned_days || 1} kun)</span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-muted">
                    <span>🏠 Tarif / Palata yotish narxi ({admitForm.planned_days || 1} kun × {formatMoney(admitForm.daily_rate || 0)}):</span>
                    <span className="font-bold text-foreground">{formatMoney(roomEst)}</span>
                  </div>

                  {admitExtraItems.length > 0 && (
                    <div className="pt-1.5 pb-1 space-y-1 border-t border-cyan-500/30">
                      <div className="flex justify-between text-cyan-300 font-bold">
                        <span>🧪 Qo'shimcha xizmat va dori-darmonlar ({admitExtraItems.length} ta):</span>
                        <span>+{formatMoney(admitExtraItemsTotal)}</span>
                      </div>
                      <div className="pl-3 space-y-0.5 text-[11px] text-cyan-200/90 font-mono">
                        {admitExtraItems.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span>
                              • {it.name} {it.quantity > 1 ? `(${it.quantity}x)` : ''}
                              {it.is_included_in_tariff ? ' [Tarifda 0 so\'m]' : ''}
                            </span>
                            <span className="font-bold">
                              {it.is_included_in_tariff ? '0 so\'m' : formatMoney(it.unit_price * it.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-gold/40 text-sm font-extrabold">
                    <span className="text-gold uppercase font-extrabold">📊 UMUMIY SUMMA:</span>
                    <span className="text-xl text-gold font-mono font-black">{formatMoney(grandTotalEst)}</span>
                  </div>

                  {+admitForm.initial_payment_amount > 0 && (
                    <div className="pt-2 border-t border-cyan-500/30 space-y-1">
                      <div className="flex justify-between text-emerald-400 font-bold text-xs">
                        <span>💳 Bosh To'lov:</span>
                        <span>- {formatMoney(+admitForm.initial_payment_amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-extrabold text-rose-400">
                        <span>⏳ QOLGAN QOLDIQ (NASIYA / QARZ):</span>
                        <span className="text-sm font-mono font-black">
                          {formatMoney(Math.max(0, grandTotalEst - (+admitForm.initial_payment_amount || 0)))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* STREAMLINED INITIAL PAYMENT SECTION */}
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-cyan-400">
                💳 Bosh To'lov Summasi (0 so'm bo'lsa Nasiya):
              </label>
              {(() => {
                const roomEst = admitForm.daily_rate ? (+admitForm.daily_rate * (+admitForm.planned_days || 1)) : 0
                const admitExtraItemsTotal = admitExtraItems.reduce((sum, it) => sum + (it.is_included_in_tariff ? 0 : (it.unit_price * it.quantity)), 0)
                const grandTotalEst = roomEst + admitExtraItemsTotal

                if (grandTotalEst <= 0) return null

                return (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdmitForm({ ...admitForm, initial_payment_amount: String(grandTotalEst) })}
                      className="text-[10px] text-cyan-400 underline hover:text-cyan-300 font-bold"
                    >
                      100% summani qo'yish
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdmitForm({ ...admitForm, initial_payment_amount: String(Math.round(grandTotalEst / 2)) })}
                      className="text-[10px] text-emerald-400 underline hover:text-emerald-300 font-bold"
                    >
                      50% bosh to'lov
                    </button>
                  </div>
                )
              })()}
            </div>

            <input
              className="input-field font-mono font-bold"
              type="number"
              min={0}
              placeholder="Dastlabki to'lov summasi (masalan: 500,000 yoki 0 = Keyinroq)"
              value={admitForm.initial_payment_amount}
              onChange={(e) => setAdmitForm({ ...admitForm, initial_payment_amount: e.target.value })}
            />
            {+admitForm.initial_payment_amount > 0 && (() => {
              const roomEst = admitForm.daily_rate ? (+admitForm.daily_rate * (+admitForm.planned_days || 1)) : 0
              const admitExtraItemsTotal = admitExtraItems.reduce((sum, it) => sum + (it.is_included_in_tariff ? 0 : (it.unit_price * it.quantity)), 0)
              const grandTotalEst = roomEst + admitExtraItemsTotal
              const paid = +admitForm.initial_payment_amount || 0
              const rem = grandTotalEst - paid

              return (
                <div className="flex justify-between items-center text-xs font-bold font-mono pt-0.5">
                  <span className="text-cyan-400">✨ To'lanayotgan: {formatMoney(paid)}</span>
                  <span className={rem > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>
                    ⏳ Qolgan qoldiq: {rem > 0 ? `${formatMoney(rem)} (Nasiya)` : "0 (To'liq)"}
                  </span>
                </div>
              )
            })()}

            {+admitForm.initial_payment_amount > 0 && (
              <div className="space-y-1.5 animate-in fade-in">
                <label className="text-[11px] text-emerald-400 font-bold block">To'lov Turini Tanlang:</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'cash',  label: '💵 Naqd' },
                    { id: 'card',  label: '💳 Karta' },
                    { id: 'click', label: '📱 Click/Payme' },
                    { id: 'split', label: '🔀 Aralash' },
                    { id: 'qr',    label: '🔳 QR Kod' },
                  ].map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        admitForm.initial_payment_type === pt.id
                          ? 'bg-gold text-slate-950 border-gold shadow'
                          : 'bg-surface border-border text-muted hover:text-foreground'
                      }`}
                      onClick={() => setAdmitForm({ ...admitForm, initial_payment_type: pt.id })}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>

                {admitForm.initial_payment_type === 'split' && (
                  <div className="p-3 bg-surface-2/60 border border-gold/40 rounded-xl space-y-2 animate-in fade-in mt-2">
                    <span className="text-xs font-bold text-gold block">🔀 Aralash To'lov Taqsimoti:</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] text-muted block mb-1">💵 Naqd summasi:</label>
                        <input
                          type="number"
                          min={0}
                          className="input-field font-mono"
                          placeholder="0 so'm"
                          value={admitForm.cash_amount || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            const sum = (+val || 0) + (+admitForm.card_amount || 0) + (+admitForm.click_amount || 0) + (+admitForm.qr_amount || 0)
                            setAdmitForm({ ...admitForm, cash_amount: val, initial_payment_amount: sum > 0 ? String(sum) : admitForm.initial_payment_amount })
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted block mb-1">💳 Karta summasi:</label>
                        <input
                          type="number"
                          min={0}
                          className="input-field font-mono"
                          placeholder="0 so'm"
                          value={admitForm.card_amount || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            const sum = (+admitForm.cash_amount || 0) + (+val || 0) + (+admitForm.click_amount || 0) + (+admitForm.qr_amount || 0)
                            setAdmitForm({ ...admitForm, card_amount: val, initial_payment_amount: sum > 0 ? String(sum) : admitForm.initial_payment_amount })
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted block mb-1">📱 Click/Payme summasi:</label>
                        <input
                          type="number"
                          min={0}
                          className="input-field font-mono"
                          placeholder="0 so'm"
                          value={admitForm.click_amount || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            const sum = (+admitForm.cash_amount || 0) + (+admitForm.card_amount || 0) + (+val || 0) + (+admitForm.qr_amount || 0)
                            setAdmitForm({ ...admitForm, click_amount: val, initial_payment_amount: sum > 0 ? String(sum) : admitForm.initial_payment_amount })
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted block mb-1">🔳 QR Kod summasi:</label>
                        <input
                          type="number"
                          min={0}
                          className="input-field font-mono"
                          placeholder="0 so'm"
                          value={admitForm.qr_amount || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            const sum = (+admitForm.cash_amount || 0) + (+admitForm.card_amount || 0) + (+admitForm.click_amount || 0) + (+val || 0)
                            setAdmitForm({ ...admitForm, qr_amount: val, initial_payment_amount: sum > 0 ? String(sum) : admitForm.initial_payment_amount })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button type="button" className="btn-gold w-full py-3 mt-4" onClick={handleAdmit}>Bemor Qabul Qilish</button>
        </div>
      </Modal>

      {/* MODAL 2: ATTACH EXTRA SERVICE OR MATERIAL */}
      <Modal open={!!itemModal} onClose={() => { setItemModal(null); setEditingItem(null); setItemSelectedServiceIds({}); setItemServiceSearch('') }} title="Qo'shimcha Xizmat yoki Material Biriktirish">
        {itemModal && (
          <div className="space-y-3 pt-2">
            <p className="font-bold text-foreground">{itemModal.first_name} {itemModal.last_name} — Palata {itemModal.room_number}/{itemModal.bed_number}</p>
            
            <div className="flex gap-2">
              <button
                type="button"
                className={itemForm.item_type === 'service' ? 'btn-gold flex-1 text-xs' : 'btn-outline flex-1 text-xs'}
                onClick={() => setItemForm({ ...itemForm, item_type: 'service', service_id: '', material_id: '' })}
              >
                🩺 Tahlil / Xizmat
              </button>
              <button
                type="button"
                className={itemForm.item_type === 'material' ? 'btn-gold flex-1 text-xs' : 'btn-outline flex-1 text-xs'}
                onClick={() => setItemForm({ ...itemForm, item_type: 'material', service_id: '', material_id: '' })}
              >
                💉 Dori / Material
              </button>
              {/* Ro'yxatda yo'q narsani admin o'zi yozib, narxini ham
                  o'zi qo'yadi. Ilgari faqat tayyor ro'yxatdan tanlash
                  mumkin edi — ro'yxatda bo'lmagan dori yoki xizmat
                  hisobga umuman kirmasdi. */}
              <button
                type="button"
                className={itemForm.item_type === 'qolda' ? 'btn-gold flex-1 text-xs' : 'btn-outline flex-1 text-xs'}
                onClick={() => setItemForm({
                  ...itemForm, item_type: 'qolda',
                  service_id: '', material_id: '', name: '', unit_price: '',
                })}
              >
                ✍️ Qo'lda kiritish
              </button>
            </div>

            {itemForm.item_type === 'qolda' && (
              <div className="space-y-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40">
                <div>
                  <label className="text-[11px] text-muted block mb-1 font-bold">
                    Nomi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="input-field text-xs"
                    placeholder="Masalan: Bint, Shprits 5ml, Maxsus muolaja..."
                    value={itemForm.name || ''}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1 font-bold">
                    Birlik narxi (so'm) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="input-field text-xs font-mono font-bold"
                    placeholder="15,000"
                    value={formatWithCommas(itemForm.unit_price)}
                    onChange={(e) => setItemForm({
                      ...itemForm, unit_price: parseDigits(e.target.value),
                    })}
                  />
                </div>
                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                  💡 Bu yozuv ro'yxatga saqlanmaydi — faqat shu bemor hisobiga qo'shiladi.
                </p>
              </div>
            )}

            {itemForm.item_type === 'service' && (
              <div className="space-y-1.5">
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder="🔍 Xizmat nomini qidiring..."
                  value={itemServiceSearch}
                  onChange={(e) => setItemServiceSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto space-y-0.5 p-1.5 bg-surface rounded-lg border border-border/60">
                  {services
                    .filter((s) => s.name.toLowerCase().includes(itemServiceSearch.toLowerCase()))
                    .map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-surface-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-gold rounded shrink-0"
                          checked={!!itemSelectedServiceIds[s.id]}
                          onChange={(e) => setItemSelectedServiceIds((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                        />
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-muted font-mono shrink-0">{formatMoney(s.price)}</span>
                      </label>
                    ))}
                  {services.filter((s) => s.name.toLowerCase().includes(itemServiceSearch.toLowerCase())).length === 0 && (
                    <p className="text-center text-muted text-[11px] py-2">Xizmat topilmadi</p>
                  )}
                </div>
              </div>
            )}

            {itemForm.item_type === 'material' && (
              <select
                className="input-field"
                value={itemForm.material_id}
                onChange={(e) => {
                  const mid = e.target.value
                  const found = materials.find((m) => String(m.id) === String(mid))
                  setItemForm({
                    ...itemForm,
                    material_id: mid,
                    unit_price: found ? String(found.unit_price) : '',
                  })
                }}
              >
                <option value="">Katalogdan materialni tanlang *</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit_name}) — {formatMoney(m.unit_price)}
                  </option>
                ))}
              </select>
            )}

            {itemForm.item_type !== 'service' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  placeholder="Soni *"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                />
                <input
                  className="input-field bg-surface-2 opacity-90 cursor-not-allowed font-mono font-bold text-gold"
                  type="number"
                  placeholder="Narxi (katalogdan)"
                  value={itemForm.unit_price}
                  readOnly
                  title="Narx katalogdan avtomatik belgilanadi"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer pt-1">
              <input type="checkbox" checked={itemForm.is_included_in_tariff} onChange={(e) => setItemForm({ ...itemForm, is_included_in_tariff: e.target.checked })} className="accent-gold rounded" />
              <span>Tarif ichiga kiritilgan (bepul / 0 so'm)</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer" title="Narxi chekda ko'rinadi, lekin bemor hisobi/qoldig'iga qo'shilmaydi">
              <input type="checkbox" checked={itemForm.is_no_charge} onChange={(e) => setItemForm({ ...itemForm, is_no_charge: e.target.checked })} className="accent-cyan-400 rounded" />
              <span>Balansga qo'shilmaydi (faqat chekda ko'rinadi)</span>
            </label>

            {itemForm.item_type === 'service' ? (
              <button type="button" className="btn-gold w-full py-3 mt-2" onClick={handleAddSelectedItemServices}>
                Tanlanganlarni Qo'shish ({Object.values(itemSelectedServiceIds).filter(Boolean).length})
              </button>
            ) : (
              <button type="button" className="btn-gold w-full py-3 mt-2" onClick={handleAddItem}>
                Qo'shish
              </button>
            )}

            {/* Attached items list */}
            {itemModal.items && itemModal.items.length > 0 && (
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-bold text-gold mb-2">Biriktirilgan elementlar ({itemModal.items.length}):</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {itemModal.items.map((it) => (
                    editingItem && editingItem.id === it.id ? (
                      <div key={it.id} className="p-2 bg-surface rounded border border-gold space-y-1.5">
                        <input
                          className="input-field text-xs py-1"
                          value={editingItem.name}
                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                          placeholder="Nomi"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            className="input-field text-xs py-1"
                            type="number"
                            min={1}
                            value={editingItem.quantity}
                            onChange={(e) => setEditingItem({ ...editingItem, quantity: e.target.value })}
                            placeholder="Soni"
                          />
                          <input
                            className="input-field text-xs py-1"
                            type="number"
                            min={0}
                            value={editingItem.unit_price}
                            onChange={(e) => setEditingItem({ ...editingItem, unit_price: e.target.value })}
                            placeholder="Narxi"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer" title="Narxi chekda ko'rinadi, lekin bemor hisobi/qoldig'iga qo'shilmaydi">
                          <input type="checkbox" checked={editingItem.is_no_charge} onChange={(e) => setEditingItem({ ...editingItem, is_no_charge: e.target.checked })} className="accent-cyan-400 rounded" />
                          <span>Balansga qo'shilmaydi (faqat chekda ko'rinadi)</span>
                        </label>
                        <div className="flex justify-end gap-2 pt-0.5">
                          <button type="button" className="text-muted font-bold text-xs" onClick={() => setEditingItem(null)}>Bekor</button>
                          <button type="button" className="text-emerald-400 font-bold text-xs" onClick={() => handleUpdateItem(itemModal.id)}>Saqlash</button>
                        </div>
                      </div>
                    ) : (
                      <div key={it.id} className="flex justify-between items-center text-xs p-2 bg-surface rounded border border-border">
                        <div>
                          <span className="font-bold">{it.name}</span>
                          <span className="text-muted ml-2">{it.quantity}x — {formatMoney(it.total_price)}</span>
                          {it.is_included_in_tariff && <span className="text-cyan-400 font-bold ml-2">(Tarifda)</span>}
                          {it.is_no_charge && <span className="text-purple-400 font-bold ml-2">(Balansga qo'shilmaydi)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-gold font-bold"
                            onClick={() => setEditingItem({
                              id: it.id,
                              name: it.name,
                              quantity: it.quantity,
                              unit_price: it.unit_price,
                              is_included_in_tariff: it.is_included_in_tariff,
                              is_no_charge: it.is_no_charge,
                            })}
                          >✎</button>
                          <button type="button" className="text-rose-400 font-bold" onClick={() => handleRemoveItem(itemModal.id, it.id)}>✕</button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 3: FLEXIBLE PAYMENT (START PAYMENT / INTERIM / DISCHARGE) */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Bemor To'lovi (Bosh To'lov / Oraliq)">
        {payModal && (
          <div className="space-y-3 pt-2">
            <p className="font-bold text-foreground">{payModal.first_name} {payModal.last_name}</p>
            <div className="text-xs space-y-1 bg-surface p-2.5 rounded border border-border">
              <div className="flex justify-between"><span>Jami Hisob:</span> <b className="font-mono text-gold">{formatMoney(payModal.total_amount)}</b></div>
              <div className="flex justify-between"><span>To'langan:</span> <b className="font-mono text-emerald-400">{formatMoney(payModal.paid_total)}</b></div>
              <div className="flex justify-between"><span>Qoldiq:</span> <b className="font-mono text-rose-400">{formatMoney(payModal.balance_due)}</b></div>
            </div>

            <div className="flex gap-2">
              {[
                { key: 'advance', label: '🟢 Bosh To\'lov' },
                { key: 'interim', label: '🟡 Oraliq To\'lov' },
                { key: 'discharge', label: '🔴 Chiqish To\'lovi' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  className={payForm.payment_stage === st.key ? 'btn-gold flex-1 text-xs py-2' : 'btn-outline flex-1 text-xs py-2'}
                  onClick={() => setPayForm({ ...payForm, payment_stage: st.key })}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <input
              className="input-field font-mono font-bold"
              type="number"
              placeholder="To'lanadigan summa (so'm) *"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            />
            {+payForm.amount > 0 && (() => {
              const currentBal = payModal.balance_due !== undefined ? payModal.balance_due : Math.max(0, (payModal.total_amount || 0) - (payModal.paid_total || 0))
              const newBal = Math.max(0, currentBal - (+payForm.amount || 0))

              return (
                <div className="flex justify-between items-center text-xs font-bold font-mono pt-0.5">
                  <span className="text-cyan-400">✨ To'lanayotgan: {formatMoney(+payForm.amount)}</span>
                  <span className={newBal > 0 ? "text-rose-400 font-black" : "text-emerald-400 font-black"}>
                    ⏳ Qoladigan qoldiq: {newBal > 0 ? `${formatMoney(newBal)} (Qarz)` : "0 so'm (To'liq yopiladi)"}
                  </span>
                </div>
              )
            })()}

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'cash',  label: '💵 Naqd' },
                { id: 'card',  label: '💳 Karta' },
                { id: 'click', label: '📱 Click/Payme' },
                { id: 'split', label: '🔀 Aralash' },
                { id: 'later', label: '⏳ Keyinroq' },
                { id: 'qr',    label: '🔳 QR Kod' },
              ].map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    payForm.payment_type === pt.id
                      ? 'bg-gold text-slate-950 border-gold shadow'
                      : 'bg-surface border-border text-muted hover:text-foreground'
                  }`}
                  onClick={() => setPayForm({ ...payForm, payment_type: pt.id })}
                >
                  {pt.label}
                </button>
              ))}
            </div>

            {payForm.payment_type === 'split' && (
              <div className="p-3 bg-surface-2/60 border border-gold/40 rounded-xl space-y-2 animate-in fade-in">
                <span className="text-xs font-bold text-gold block">🔀 Aralash To'lov Taqsimoti:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-muted block mb-1">💵 Naqd summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={payForm.cash_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+val || 0) + (+payForm.card_amount || 0) + (+payForm.click_amount || 0) + (+payForm.qr_amount || 0)
                        setPayForm({ ...payForm, cash_amount: val, amount: sum > 0 ? String(sum) : payForm.amount })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted block mb-1">💳 Karta summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={payForm.card_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+payForm.cash_amount || 0) + (+val || 0) + (+payForm.click_amount || 0) + (+payForm.qr_amount || 0)
                        setPayForm({ ...payForm, card_amount: val, amount: sum > 0 ? String(sum) : payForm.amount })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted block mb-1">📱 Click/Payme summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={payForm.click_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+payForm.cash_amount || 0) + (+payForm.card_amount || 0) + (+val || 0) + (+payForm.qr_amount || 0)
                        setPayForm({ ...payForm, click_amount: val, amount: sum > 0 ? String(sum) : payForm.amount })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted block mb-1">🔳 QR Kod summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={payForm.qr_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+payForm.cash_amount || 0) + (+payForm.card_amount || 0) + (+payForm.click_amount || 0) + (+val || 0)
                        setPayForm({ ...payForm, qr_amount: val, amount: sum > 0 ? String(sum) : payForm.amount })
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <button type="button" className="btn-gold w-full py-3 mt-2" onClick={handlePayment}>
              To'lovni Kiritish 💳
            </button>
          </div>
        )}
      </Modal>

      {/* MODAL 4: DISCHARGE & FINAL RECEIPT */}
      <Modal open={!!dischargeModal} onClose={() => setDischargeModal(null)} title="Bemorni Chiqarish (Выписка)">
        {dischargeModal && (
          <div className="space-y-3 pt-2">
            <p className="font-bold text-foreground">{dischargeModal.first_name} {dischargeModal.last_name}</p>
            <div className="text-xs space-y-1 bg-surface p-2.5 rounded border border-border">
              <div className="flex justify-between"><span>Yotgan kuni:</span> <b>{dischargeModal.days} kun</b></div>
              <div className="flex justify-between"><span>Jami Hisob:</span> <b className="font-mono text-gold">{formatMoney(dischargeModal.total_amount)}</b></div>
              <div className="flex justify-between"><span>Oldindan to'langan:</span> <b className="font-mono text-emerald-400">{formatMoney(dischargeModal.paid_total)}</b></div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                <span>Yakuniy to'lanadigan qoldiq:</span>
                <span className="font-mono text-rose-400">{formatMoney(dischargeModal.balance_due)}</span>
              </div>
            </div>

            <input type="date" className="input-field" value={dischargeForm.discharged_at} onChange={(e) => setDischargeForm({ ...dischargeForm, discharged_at: e.target.value })} />
            <input type="number" min={1} className="input-field" value={dischargeForm.days_count} onChange={(e) => setDischargeForm({ ...dischargeForm, days_count: e.target.value })} placeholder="Kunlar soni" />
            <input type="number" min={0} className="input-field font-mono font-bold" value={dischargeForm.amount} onChange={(e) => setDischargeForm({ ...dischargeForm, amount: e.target.value })} placeholder="Yakuniy to'lov summasi" />
            {+dischargeForm.amount > 0 && (
              <span className="text-xs font-bold text-cyan-400 font-mono block pt-0.5">
                ✨ {formatMoney(+dischargeForm.amount)}
              </span>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'cash',  label: '💵 Naqd' },
                { id: 'card',  label: '💳 Karta' },
                { id: 'click', label: '📱 Click/Payme' },
                { id: 'split', label: '🔀 Aralash' },
                { id: 'later', label: '⏳ Keyinroq' },
                { id: 'qr',    label: '🔳 QR Kod' },
              ].map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    dischargeForm.payment_type === pt.id
                      ? 'bg-gold text-slate-950 border-gold shadow'
                      : 'bg-surface border-border text-muted hover:text-foreground'
                  }`}
                  onClick={() => setDischargeForm({ ...dischargeForm, payment_type: pt.id })}
                >
                  {pt.label}
                </button>
              ))}
            </div>

            {dischargeForm.payment_type === 'split' && (
              <div className="p-3 bg-surface-2/60 border border-gold/40 rounded-xl space-y-2 animate-in fade-in">
                <span className="text-xs font-bold text-gold block">🔀 Aralash To'lov Taqsimoti:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] text-muted block mb-1">💵 Naqd summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={dischargeForm.cash_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+val || 0) + (+dischargeForm.card_amount || 0) + (+dischargeForm.click_amount || 0) + (+dischargeForm.qr_amount || 0)
                        setDischargeForm({ ...dischargeForm, cash_amount: val, amount: sum > 0 ? String(sum) : dischargeForm.amount })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted block mb-1">💳 Karta summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={dischargeForm.card_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+dischargeForm.cash_amount || 0) + (+val || 0) + (+dischargeForm.click_amount || 0) + (+dischargeForm.qr_amount || 0)
                        setDischargeForm({ ...dischargeForm, card_amount: val, amount: sum > 0 ? String(sum) : dischargeForm.amount })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted block mb-1">📱 Click/Payme summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={dischargeForm.click_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+dischargeForm.cash_amount || 0) + (+dischargeForm.card_amount || 0) + (+val || 0) + (+dischargeForm.qr_amount || 0)
                        setDischargeForm({ ...dischargeForm, click_amount: val, amount: sum > 0 ? String(sum) : dischargeForm.amount })
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted block mb-1">🔳 QR Kod summasi:</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono"
                      placeholder="0 so'm"
                      value={dischargeForm.qr_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        const sum = (+dischargeForm.cash_amount || 0) + (+dischargeForm.card_amount || 0) + (+dischargeForm.click_amount || 0) + (+val || 0)
                        setDischargeForm({ ...dischargeForm, qr_amount: val, amount: sum > 0 ? String(sum) : dischargeForm.amount })
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <button type="button" className="btn-gold w-full py-3 mt-2" onClick={handleDischarge}>
              Chiqarish va Chekni Chop Etish 🖨️
            </button>
          </div>
        )}
      </Modal>

      {/* MODAL 5: PATIENT DETAILS & SERVICES BREAKDOWN VIEW */}
      {viewPatientModal && (
        <InpatientDetailsModal
          inpatient={viewPatientModal}
          onClose={() => setViewPatientModal(null)}
          onAddItem={() => {
            const p = viewPatientModal
            setViewPatientModal(null)
            setItemForm({ item_type: 'service', service_id: '', material_id: '', quantity: 1, unit_price: '', is_included_in_tariff: false, is_no_charge: false })
            setItemModal(p)
          }}
          onPay={() => {
            const p = viewPatientModal
            setViewPatientModal(null)
            setPayForm({ amount: '', payment_type: 'cash', payment_stage: 'interim', days_count: 1, cash_amount: '', card_amount: '', click_amount: '', qr_amount: '' })
            setPayModal(p)
          }}
          onExtend={() => {
            const p = viewPatientModal
            setViewPatientModal(null)
            setExtendDaysCount(1)
            setExtendModal(p)
          }}
        />
      )}

      {/* MODAL 6: EXTEND STAY (KUN UZAYTIRISH / KUN QO'SHISH) */}
      <Modal open={!!extendModal} onClose={() => setExtendModal(null)} title="📅 Statsionar Muddatini Uzaytirish (Kun Qo'shish)">
        {extendModal && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-2xl space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-gold text-sm">{extendModal.first_name} {extendModal.last_name}</span>
                <span className="badge badge-gold font-mono">{extendModal.room_number}/{extendModal.bed_number}</span>
              </div>
              <p className="text-muted text-xs">
                Hozirgi muddat: <strong className="text-foreground">{extendModal.days || 1} kun</strong> (Reja: <strong className="text-cyan-300">{extendModal.planned_days || extendModal.days || 1} kun</strong>)
              </p>
              <p className="text-muted text-xs">
                Kunlik koyka narxi: <strong className="text-gold font-mono">{formatMoney(extendModal.daily_rate)} / kun</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="form-label font-bold text-foreground">
                Qancha kun qo'shmoqchisiz? (+ kun) *
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="180"
                  className="input-field text-lg font-mono font-black text-amber-400 w-32 text-center"
                  value={extendDaysCount}
                  onChange={(e) => setExtendDaysCount(Math.max(1, +e.target.value || 1))}
                  autoFocus
                />
                <div className="flex gap-1.5">
                  {[1, 2, 3, 5, 7].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setExtendDaysCount(num)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        extendDaysCount === num
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black scale-105'
                          : 'bg-surface-2 border-border text-muted hover:text-body'
                      }`}
                    >
                      +{num} kun
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculations Preview */}
            <div className="p-3.5 bg-surface-2/60 border border-border rounded-2xl space-y-1.5 font-mono">
              <div className="flex justify-between text-muted">
                <span>Eski reja muddat:</span>
                <span>{extendModal.planned_days || extendModal.days || 1} kun</span>
              </div>
              <div className="flex justify-between text-amber-300 font-bold">
                <span>Yangi reja muddat:</span>
                <span>{(extendModal.planned_days || extendModal.days || 1) + (+extendDaysCount || 0)} kun</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border/60 text-foreground font-black text-sm">
                <span>Qo'shimcha Palata Narxi:</span>
                <span className="text-emerald-400">+{formatMoney(extendModal.daily_rate * (+extendDaysCount || 0))}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="btn-outline flex-1 py-2.5"
                onClick={() => setExtendModal(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="btn-gold flex-1 py-2.5 font-black text-xs uppercase"
                onClick={handleExtendStay}
              >
                ✓ Muddatni Uzaytirish (+{extendDaysCount} kun)
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── EDIT INPATIENT MODAL ────────────────────────────────────── */}
      <Modal
        open={Boolean(editInpatientModal)}
        onClose={() => setEditInpatientModal(null)}
        title="✏️ Statsionar Bemor Ma'lumotlarini Tahrirlash"
      >
        {editInpatientModal && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
              <p className="font-extrabold text-cyan-300">
                👤 {editInpatientModal.first_name} {editInpatientModal.last_name} #{editInpatientModal.id}
              </p>
              <p className="text-[11px] text-muted">
                Palata: {editInpatientModal.room_number}/{editInpatientModal.bed_number} • Qabul kilingan: {new Date(editInpatientModal.admitted_at).toLocaleDateString('uz-UZ')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Ismi (*)</label>
                <input
                  type="text"
                  className="input-field"
                  value={editInpatientForm.first_name}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, first_name: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Familiyasi</label>
                <input
                  type="text"
                  className="input-field"
                  value={editInpatientForm.last_name}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="input-label">Telefon</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  value={editInpatientForm.phone}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Tug'ilgan Yili</label>
                <input
                  type="text"
                  placeholder="Masalan: 1985"
                  className="input-field font-mono"
                  value={editInpatientForm.birth_date}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, birth_date: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Manzil / Shahar</label>
                <input
                  type="text"
                  className="input-field"
                  value={editInpatientForm.address}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, address: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div>
                <label className="input-label">Palata Raqami (*)</label>
                <input
                  type="text"
                  className="input-field font-mono font-bold"
                  value={editInpatientForm.room_number}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, room_number: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Koyka Raqami (*)</label>
                <input
                  type="text"
                  className="input-field font-mono font-bold"
                  value={editInpatientForm.bed_number}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, bed_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Tarif Paketi</label>
                <select
                  className="input-field"
                  value={editInpatientForm.tariff_id}
                  onChange={(e) => {
                    const tid = e.target.value
                    const t = tariffs.find((x) => x.id === +tid)
                    setEditInpatientForm({
                      ...editInpatientForm,
                      tariff_id: tid,
                      daily_rate: t ? String(t.daily_rate) : editInpatientForm.daily_rate,
                    })
                  }}
                >
                  <option value="">-- Tarif Tanlanmagan --</option>
                  {tariffs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({formatMoney(t.daily_rate)}/kun)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Kunlik Narx (so'm)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold text-gold"
                  value={editInpatientForm.daily_rate}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, daily_rate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Biriktirilgan Statsionar Shifokori</label>
                <select
                  className="input-field"
                  value={editInpatientForm.doctor_id}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, doctor_id: e.target.value })}
                >
                  <option value="">-- Shifokor Tanlanmagan --</option>
                  {inpatientProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.specialization || 'Shifokor'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Yo'naltiruvchi (Referrer)</label>
                <select
                  className="input-field"
                  value={editInpatientForm.referrer_id}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, referrer_id: e.target.value })}
                >
                  <option value="">-- To'g'ridan-to'g'ri (Yo'naltiruvchisiz) --</option>
                  {referrers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="input-label">Tashxis & Ma'lumot</label>
                <input
                  type="text"
                  placeholder="Masalan: Gipertoniya II daraja..."
                  className="input-field"
                  value={editInpatientForm.diagnosis}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, diagnosis: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Reja kunlar</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  className="input-field font-mono font-bold"
                  value={editInpatientForm.planned_days}
                  onChange={(e) => setEditInpatientForm({ ...editInpatientForm, planned_days: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-border">
              <button
                type="button"
                className="btn-outline flex-1 py-2.5"
                onClick={() => setEditInpatientModal(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={savingInpatientEdit}
                className="btn-gold flex-1 py-2.5 font-black text-xs uppercase"
                onClick={handleSaveInpatientEdit}
              >
                {savingInpatientEdit ? 'Saqlanmoqda...' : '✓ O\'zgarishlarni Saqlash'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
