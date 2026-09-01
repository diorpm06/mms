import { useEffect, useState, useRef } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, PageHeader, THead, ActionRow, EmptyState } from '../../components/UIKit'
import { BRAND } from '../../config/brand'
import CommissionSettings from './Commissions'
import ActionMenu from '../../components/ActionMenu'
import EarningsDailyModal from '../../components/EarningsDailyModal'
import ReferrerProfileModal from '../../components/ReferrerProfileModal'

const SOURCES = ['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa']

export default function CeoReferrers() {
  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | '10day' | 'commission'
  const [items, setItems] = useState(null)
  // "Jami ishlagan" bosilganda ochiladigan kunma-kun oynasi
  const [kunlik, setKunlik] = useState(null)   // {kind, id, name}
  const [selectedRefModalId, setSelectedRefModalId] = useState(null)
  const [topAnalytics, setTopAnalytics] = useState([])
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({
    full_name: '',
    phone: '+998',
    lab_percent: 22,
    fizio_percent: 20,
    uzi_sum: 15000,
    ozon_sum: 10000,
    other_sum: 10000,
  })
  const [payoutSource, setPayoutSource] = useState('Naqt kassa')
  
  // Advance Modal
  const [advanceModal, setAdvanceModal] = useState(false)
  const [selectedRefForAdvance, setSelectedRefForAdvance] = useState(null)
  const [advanceAmount, setAdvanceAmount] = useState('1000000')
  const [savingAdvance, setSavingAdvance] = useState(false)

  // Confirm Pending Referrer Modal State
  const [confirmModalItem, setConfirmModalItem] = useState(null)
  const [confirmForm, setConfirmForm] = useState({
    lab_percent: 22,
    fizio_percent: 20,
    uzi_sum: 15000,
    ozon_sum: 10000,
    other_sum: 10000,
  })

  const handleConfirmReferrer = async () => {
    if (!confirmModalItem) return
    try {
      await api(`/referrers/${confirmModalItem.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify(confirmForm),
      })
      toast(`"${confirmModalItem.full_name}" ulush foizlari tasdiqlandi va ro'yxatga olindi ✓`)
      setConfirmModalItem(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // 10-Day Report State
  const now = new Date()
  const [tenDayYear, setTenDayYear] = useState(now.getFullYear())
  const [tenDayMonth, setTenDayMonth] = useState(now.getMonth() + 1)
  const [tenDaySegment, setTenDaySegment] = useState('1') // '1' (1-10), '2' (11-20), '3' (21-31), 'all', 'custom'
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [tenDayReport, setTenDayReport] = useState(null)
  const [tenDayLoading, setTenDayLoading] = useState(false)
  
  // Deferred / Postponed Payouts (persisted in localStorage)
  const [deferredMap, setDeferredMap] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_deferred_referrers')
      return saved ? JSON.parse(saved) : {}
    } catch (_) { return {} }
  })

  // Printable Voucher Modal State
  const [printModal, setPrintModal] = useState(null) // { referrer, periodLabel, patients, loading }
  const toast = useToastStore((s) => s.add)

  useEffect(() => {
    try {
      localStorage.setItem('crm_deferred_referrers', JSON.stringify(deferredMap))
    } catch (_) {}
  }, [deferredMap])

  const load = () => {
    Promise.all([
      api('/referrers?active_only=false'),
      api('/reports/top-referrers').catch(() => []),
    ]).then(([refs, top]) => {
      setItems(refs || [])
      setTopAnalytics(top || [])
    })
  }

  useEffect(() => { load() }, [])

  // Calculate dates for 10-day period
  const getTenDayDates = () => {
    if (tenDaySegment === 'custom') {
      return { from: customFrom || new Date().toISOString().slice(0, 10), to: customTo || new Date().toISOString().slice(0, 10) }
    }
    const mStr = String(tenDayMonth).padStart(2, '0')
    const yStr = String(tenDayYear)
    const lastDay = new Date(tenDayYear, tenDayMonth, 0).getDate()

    if (tenDaySegment === '1') {
      return { from: `${yStr}-${mStr}-01`, to: `${yStr}-${mStr}-10` }
    } else if (tenDaySegment === '2') {
      return { from: `${yStr}-${mStr}-11`, to: `${yStr}-${mStr}-20` }
    } else if (tenDaySegment === '3') {
      return { from: `${yStr}-${mStr}-21`, to: `${yStr}-${mStr}-${lastDay}` }
    } else {
      return { from: `${yStr}-${mStr}-01`, to: `${yStr}-${mStr}-${lastDay}` }
    }
  }

  const loadTenDayReport = async () => {
    const { from, to } = getTenDayDates()
    if (!from || !to) return
    setTenDayLoading(true)
    try {
      const res = await api(`/reports/ten-day?from=${from}&to=${to}`)
      setTenDayReport(res)
    } catch (e) {
      toast(e.message || "10-kunlik hisobot yuklanmadi", "error")
    } finally {
      setTenDayLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === '10day') {
      loadTenDayReport()
    }
  }, [activeTab, tenDayYear, tenDayMonth, tenDaySegment, customFrom, customTo])

  const save = async () => {
    const body = { ...form, percentage: 0 }
    try {
      if (edit) await api(`/referrers/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      else await api('/referrers', { method: 'POST', body: JSON.stringify(body) })
      toast(edit ? "Yo'naltiruvchi tahrirlandi" : "Yangi yo'naltiruvchi qo'shildi")
      setModal(false)
      load()
    } catch (e) {
      // 409 — shu ismda allaqachon bor. Bir odam ikki qatorga bo'linib
      // ketmasligi uchun avval ogohlantiramiz, lekin haqiqatan boshqa odam
      // bo'lsa qo'shish imkoni qoladi.
      if (e.status === 409 && !edit) {
        const davom = window.confirm(
          `${e.message}\n\nBu haqiqatan boshqa odam bo'lsa "OK" bosing — baribir qo'shiladi.\n` +
          `Aks holda "Bekor" bosib, ro'yxatdan mavjudini tanlang.`
        )
        if (!davom) return
        try {
          await api('/referrers', { method: 'POST', body: JSON.stringify({ ...body, force: true }) })
          toast("Yangi yo'naltiruvchi qo'shildi")
          setModal(false)
          load()
        } catch (e2) {
          toast(e2.message, 'error')
        }
        return
      }
      toast(e.message, 'error')
    }
  }

  const handleDelete = async (r) => {
    // Yozuv butunlay o'chmaydi (backend is_active=false qiladi), shuning uchun
    // eski hisobotlar va to'lovlar tarixi buzilmaydi.
    let msg = `"${r.full_name}" ro'yxatdan olib tashlansinmi?\n\nU yangi bemor qabulida tanlanmaydigan bo'ladi. Eski hisobotlar va to'lovlar tarixi saqlanib qoladi.`
    if (r.balance > 0) {
      msg = `DIQQAT: "${r.full_name}" da chiqarilmagan ${formatMoney(r.balance)} balans bor!\n\nAvval "Chiqarish" tugmasi bilan hisob-kitob qilish tavsiya etiladi.\n\nBaribir ro'yxatdan olib tashlansinmi?`
    }
    if (!window.confirm(msg)) return
    try {
      await api(`/referrers/${r.id}`, { method: 'DELETE' })
      toast("Yo'naltiruvchi ro'yxatdan olib tashlandi")
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const payout = async (id, maxAmount) => {
    try {
      const body = { source: payoutSource }
      // 10-kunlik hisobot bo'limidan chaqirilganda, umrbod balans o'rniga
      // hisobotda ko'rsatilgan davr summasidan ORTIQ to'lanmasligi uchun
      // (umrbod balans boshqa, oldingi to'lanmagan davrlarni ham qamrab
      // olishi mumkin — ko'rsatilgan bilan haqiqatda to'langan farqli
      // bo'lib qolmasligi uchun).
      if (maxAmount !== undefined && maxAmount !== null) body.max_amount = maxAmount
      const res = await api(`/referrers/${id}/payout`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast(`Balans chiqarildi (${res.source || payoutSource}): ${formatMoney(res.amount)}`)
      load()
      if (activeTab === '10day') loadTenDayReport()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Bazada qo'lda tuzatilgan yozuvlardan keyin balans eskirib qolgan
  // bo'lishi mumkin — shuni tranzaksiyalardan qaytadan hisoblab chiqadi.
  const resyncBalance = async (id) => {
    try {
      const res = await api(`/referrers/${id}/resync-balance`, { method: 'POST' })
      toast(`Balans qayta hisoblandi: ${formatMoney(res.balance)}`)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const toggleDefer = (refId) => {
    const { from, to } = getTenDayDates()
    const key = `${refId}_${from}_${to}`
    setDeferredMap((prev) => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
        toast("Kechiktirish bekor qilindi (10-kunda to'lashga tayyor)")
      } else {
        next[key] = true
        toast("Yo'naltiruvchi to'lovi keyinroqqa surildi (Kechiktirildi)")
      }
      return next
    })
  }

  const handleGiveAdvance = async () => {
    if (!selectedRefForAdvance || !advanceAmount) return
    setSavingAdvance(true)
    try {
      await api('/advances', {
        method: 'POST',
        body: JSON.stringify({
          recipient_type: 'referrer',
          recipient_id: selectedRefForAdvance.id,
          amount: Number(advanceAmount),
          note: "Oldindan avans berildi",
        }),
      })
      toast(`${selectedRefForAdvance.full_name} ga ${formatMoney(Number(advanceAmount))} avans berildi ✓`)
      setAdvanceModal(false)
      load()
      if (activeTab === '10day') loadTenDayReport()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSavingAdvance(false)
    }
  }

  // Open Printable 10-Day Voucher Modal
  const openPrintVoucher = async (refData) => {
    const { from, to } = getTenDayDates()
    setPrintModal({
      referrer: refData,
      from,
      to,
      patients: [],
      loading: true,
    })
    try {
      const patients = await api(`/reports/referrer-patient-details?referrer_id=${refData.referrer_id}&from=${from}&to=${to}`)
      setPrintModal({
        referrer: refData,
        from,
        to,
        patients: patients || [],
        loading: false,
      })
    } catch (e) {
      setPrintModal((prev) => prev ? { ...prev, loading: false } : null)
      toast("Bemorlar ro'yxati yuklanmadi", "error")
    }
  }

  // Execute DOM Printing for 10-Day Voucher
  const handlePrintVoucher = () => {
    const printArea = document.getElementById('printable-voucher-content')
    if (!printArea) return

    const printWindow = window.open('', '_blank', 'width=800,height=900')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>10-Kunlik Yo'naltiruvchi Hisobot Hujjati</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #000; background: #fff; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
            .header h2 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 12px; font-weight: bold; }
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 12px; }
            .info-box { border: 1px solid #000; padding: 8px 12px; border-radius: 6px; width: 48%; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
            th { background: #f0f0f0; font-weight: bold; }
            .text-right { text-align: right; }
            .summary { margin-top: 16px; border: 2px solid #000; padding: 12px; border-radius: 8px; background: #fafafa; }
            .summary-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-bottom: 4px; }
            .summary-row.total { font-size: 16px; border-top: 1px solid #000; padding-top: 6px; margin-top: 6px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
            .sig-line { width: 40%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-weight: bold; }
            @media print {
              body { padding: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  const handlePrintAllReferrersConsolidated = () => {
    if (!tenDayReport || !tenDayReport.referrers_payout || tenDayReport.referrers_payout.length === 0) {
      toast("Chop etish uchun yo'naltiruvchilar ma'lumoti yo'q", "error")
      return
    }

    const { from, to } = getTenDayDates()
    const printWindow = window.open('', '_blank', 'width=1050,height=900')
    const refPayouts = tenDayReport.referrers_payout || []

    let grandPatientsCount = 0
    let grandGrossTotal = 0
    let grandFeeTotal = 0
    let grandAdvanceTotal = 0
    let grandNetTotal = 0

    let summaryRowsHtml = ''
    let refBlocksHtml = ''

    refPayouts.forEach((r, i) => {
      const patients = r.patients || []
      const pCnt = r.patient_count || patients.length
      const gross = r.gross_total || 0
      const earned = r.earned_commission || 0
      const adv = r.advance_deducted || 0
      const net = r.net_payable || 0

      grandPatientsCount += pCnt
      grandGrossTotal += gross
      grandFeeTotal += earned
      grandAdvanceTotal += adv
      grandNetTotal += net

      summaryRowsHtml += `<tr>
        <td style="text-align: center; font-weight: bold;">${i + 1}</td>
        <td><strong>${r.name}</strong> ${r.phone ? `<span style="color:#64748b; font-size:12px;">(${r.phone})</span>` : ''}</td>
        <td style="text-align: center; font-weight: bold;">${pCnt} nafar</td>
        <td style="text-align: right;">${formatMoney(gross)}</td>
        <td style="text-align: right; font-weight: bold; color: #d97706;">${formatMoney(earned)}</td>
        <td style="text-align: right; color: #dc2626;">${adv > 0 ? '-' + formatMoney(adv) : '0'}</td>
        <td style="text-align: right; font-weight: 900; color: #16a34a;">${formatMoney(net)}</td>
      </tr>`

      let rGross = 0
      let rFee = 0
      let rSvcCount = 0
      let rPatCount = r.patient_count || patients.length
      let rowsHtml = ''
      let dailyDepts = r.daily_departments || []

      if (!dailyDepts || dailyDepts.length === 0) {
        const map = {}
        patients.forEach(p => {
          const dStr = p.date ? p.date.split(' ')[0] : '—'
          const sName = p.service_name || ''
          const sCat = p.service_category || p.category || ''
          const combined = `${sCat} ${sName}`.toLowerCase()

          let dName = 'Boshqa xizmatlar'
          if (combined.includes('uzi') || combined.includes('узи')) dName = 'UZI'
          else if (['laborat', 'labar', 'tahlil', 'gormon', 'ifa', 'ekspress', 'biokimy', 'revmat', 'parazit', 'elektrolit', 'siydik', 'torch', 'gepatit', 'qon'].some(k => combined.includes(k))) dName = 'Laboratoriya'
          else if (combined.includes('fizioter')) dName = 'Fizioterapiya'
          else if (combined.includes('ineks') || combined.includes('ukol') || combined.includes('sistem')) dName = 'Ineksiya'
          else if (combined.includes('fototer')) dName = 'Fototerapiya'
          else if (combined.includes('massaj')) dName = 'Massaj'
          else if (combined.includes('ozon')) dName = 'Ozonoterapiya'
          else if (combined.includes('konsult') || combined.includes('shifokor')) dName = 'Konsultatsiya'
          else {
            const raw = (sCat || sName).trim()
            dName = raw.includes(':') ? raw.split(':')[0].trim() : raw
          }

          const key = `${dStr}_${dName}`
          if (!map[key]) {
            map[key] = {
              date: dStr,
              department_name: dName,
              patient_ids: new Set(),
              service_count: 0,
              gross_total: 0,
              rates: new Set(),
              earned_fee: 0,
            }
          }
          const pId = p.patient_id || p.patient_name || p.id
          map[key].patient_ids.add(pId)
          map[key].service_count += 1
          map[key].gross_total += p.payment_amount || 0
          map[key].earned_fee += p.referrer_fee || 0
          if (p.rate_label) map[key].rates.add(p.rate_label)
        })

        dailyDepts = Object.values(map).map(d => ({
          date: d.date,
          department_name: d.department_name,
          patient_count: d.patient_ids.size,
          service_count: d.service_count,
          gross_total: d.gross_total,
          rate_label: Array.from(d.rates).join(' / ') || '10%',
          earned_fee: d.earned_fee,
        }))
      }

      dailyDepts.forEach((d) => {
        rGross += d.gross_total || 0
        rFee += d.earned_fee || 0
        rSvcCount += d.service_count || 0
      })
      // 0 so'm hisoblangan qatorlar (masalan 0% ulushli xizmatlar) chop
      // etilgan hujjatda joy band qilib, o'qishni qiyinlashtirardi —
      // jamiga (yuqorida) hisoblanadi, lekin alohida qator sifatida
      // ko'rsatilmaydi.
      dailyDepts.filter((d) => (d.earned_fee || 0) > 0).forEach((d, idx) => {
        rowsHtml += `<tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center; font-weight: bold;">${d.date || '—'}</td>
          <td><strong>${d.department_name}</strong></td>
          <td style="text-align: center; font-weight: bold;">${d.patient_count || 1} nafar</td>
          <td style="text-align: center; font-weight: bold;">${d.service_count} ta</td>
          <td style="text-align: center; font-weight: bold;">${d.rate_label}</td>
          <td style="text-align: right; font-weight: bold; color: #0284c7;">${formatMoney(d.earned_fee)}</td>
        </tr>`
      })

      refBlocksHtml += `
        <div class="referrer-page">
          <div class="header" style="margin-bottom: 8px;">
            <p style="font-size: 14px; font-weight: bold; margin: 0; color: #334155;">Davr: ${from} — ${to}</p>
          </div>
          <div style="font-size: 13px; font-weight: 900; background: #f1f5f9; padding: 6px 10px; border-left: 4px solid #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>👨‍⚕️ ${r.name} ${r.phone ? '(' + r.phone + ')' : ''}</span>
            <span>Jami ulush: ${formatMoney(earned)}</span>
          </div>
          <div style="font-size: 11.5px; font-weight: 700; background: #fffbeb; padding: 5px 10px; margin-bottom: 8px; display: flex; justify-content: space-between; gap: 12px; border: 1px solid #fde68a; border-radius: 4px;">
            <span>Ishlagan puli: ${formatMoney(earned)}</span>
            <span style="color:#dc2626;">Olgan avansi: -${formatMoney(adv + (r.advance_remaining || 0))}</span>
            <span style="color:#16a34a; font-weight:900;">Beriladigan summa: ${formatMoney(net)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">№</th>
                <th style="width: 75px; text-align: center;">Sana</th>
                <th style="width: 180px;">Bo'lim nomi</th>
                <th style="width: 80px; text-align: center;">Bemorlar soni</th>
                <th style="width: 80px; text-align: center;">Xizmatlar soni</th>
                <th style="width: 90px; text-align: center;">Belgilangan Ulush</th>
                <th style="width: 110px; text-align: right;">Hisoblangan Ulush</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colSpan="7" style="text-align:center; padding:6px;">Xizmatlar yo-q</td></tr>'}
              <tr style="background: #e2e8f0; font-weight: 900;">
                <td colSpan="3">JAMI (${r.name}):</td>
                <td style="text-align: center;">${rPatCount} nafar bemor</td>
                <td style="text-align: center;">${rSvcCount} ta xizmat</td>
                <td></td>
                <td style="text-align: right; color: #0284c7;">${formatMoney(rFee)}</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures" style="margin-top: 35px;">
            <div class="sig-line">Bosh Shifokor / Direktor Imzosi</div>
            <div class="sig-line">Bosh Hisobchi Imzosi</div>
          </div>
        </div>
      `
    })

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Yo'naltiruvchilar Hisoboti — ${BRAND.name}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 15px; color: #0f172a; background: #fff; line-height: 1.35; font-size: 11.5px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
            .header h2 { margin: 3px 0 0; font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; }
            .header p { margin: 3px 0 0; font-size: 12px; font-weight: bold; color: #475569; }
            .sec-title { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-top: 15px; margin-bottom: 6px; border-bottom: 2px solid #0f172a; padding-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; table-layout: fixed; }
            th { border: 1px solid #64748b; padding: 5px 7px; background: #f8fafc; font-weight: 900; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
            td { border: 1px solid #cbd5e1; padding: 5px 7px; word-wrap: break-word; overflow-wrap: break-word; }
            .summary-box { border: 2px solid #0f172a; background: #f8fafc; padding: 12px; margin-top: 10px; margin-bottom: 16px; border-radius: 4px; }
            .sum-line { font-size: 12.5px; font-weight: 900; margin-bottom: 4px; display: flex; justify-content: space-between; }
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11.5px; }
            .sig-line { width: 44%; border-top: 1.5px solid #000; text-align: center; padding-top: 4px; font-weight: 900; }
            .referrer-page { page-break-inside: avoid; break-inside: avoid; margin-top: 45px; margin-bottom: 45px; padding-bottom: 16px; border-bottom: 1px dashed #cbd5e1; }
            @media print { body { padding: 0; } @page { size: A4; margin: 8mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MARJONA MED SERVICE</h1>
            <h2>BARCHA YO'NALTIRUVCHILARNING UMUMIY HISOB-KITOB HISOBOTI</h2>
            <p>Davr: ${from} — ${to}</p>
          </div>

          <!-- GRAND SUMMARY BOX AT VERY TOP OF PAGE 1 -->
          <div class="summary-box">
            <div class="sum-line"><span>🤝 UMUMIY YO'NALTIRUVCHILAR SANI:</span><span>${refPayouts.length} nafar</span></div>
            <div class="sum-line"><span>👥 JAMI YUBORILGAN XIZMATLAR SANI:</span><span>${grandPatientsCount} nafar</span></div>
            <div class="sum-line"><span>🏥 KLINIKAGA TUSHGAN JAMI TUSHUM:</span><span>${formatMoney(grandGrossTotal)}</span></div>
            <div class="sum-line"><span>💰 YO'NALTIRUVCHILARGA HISOBLANGAN JAMI ULUSH:</span><span>${formatMoney(grandFeeTotal)}</span></div>
            <div class="sum-line" style="color: #dc2626;"><span>🔻 USHLANGAN AVANSLAR SUMMASI:</span><span>-${formatMoney(grandAdvanceTotal)}</span></div>
            <hr style="border: 0; border-top: 1.5px solid #0f172a; margin: 6px 0;" />
            <div class="sum-line" style="font-size: 14px; color: #16a34a;"><span>💵 SOF TO'LANADIGAN UMUMIY SUMMA:</span><span>${formatMoney(grandNetTotal)}</span></div>
          </div>

          <div class="sec-title">🟢 1-QISM: BARCHA YO'NALTIRUVCHILAR BO'YICHA UMUMIY QISQACHA JADVAL</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>Yo'naltiruvchi F.I.Sh</th>
                <th style="width: 100px; text-align: center;">Bemorlar Soni</th>
                <th style="width: 120px; text-align: right;">Jami Tushum</th>
                <th style="width: 120px; text-align: right;">Ishlangan Ulush</th>
                <th style="width: 110px; text-align: right;">Avans Ushlanma</th>
                <th style="width: 130px; text-align: right;">Sof To'lanadigan</th>
              </tr>
            </thead>
            <tbody>
              ${summaryRowsHtml}
              <tr style="background: #e2e8f0; font-weight: 900; font-size: 11.5px;">
                <td colSpan="2" style="text-align: right;">JAMI UMUMIY SUMMA:</td>
                <td style="text-align: center;">${grandPatientsCount} nafar</td>
                <td style="text-align: right;">${formatMoney(grandGrossTotal)}</td>
                <td style="text-align: right; color: #d97706;">${formatMoney(grandFeeTotal)}</td>
                <td style="text-align: right; color: #dc2626;">${grandAdvanceTotal > 0 ? '-' + formatMoney(grandAdvanceTotal) : '0 so\'m'}</td>
                <td style="text-align: right; color: #16a34a; font-size: 12.5px;">${formatMoney(grandNetTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures" style="margin-top: 35px; margin-bottom: 50px;">
            <div class="sig-line">Bosh Shifokor / Direktor Imzosi</div>
            <div class="sig-line">Bosh Hisobchi Imzosi</div>
          </div>

          ${refBlocksHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  const totalBalance = items ? items.reduce((acc, r) => acc + (r.balance || 0), 0) : 0
  const pendingItems = items ? items.filter((r) => r.is_confirmed === false) : []

  return (
    <div className="space-y-6">
      {/* "Jami ishlagan" bosilganda: qaysi kuni qancha kelgani */}
      <EarningsDailyModal
        open={!!kunlik}
        onClose={() => setKunlik(null)}
        kind={kunlik?.kind}
        id={kunlik?.id}
        name={kunlik?.name}
      />

      <PageHeader
        title="Yo'naltiruvchilar"
        subtitle="Katalog va balanslar, 10-kunlik hisobot, komissiya tariflari"
        icon={Icons.user}
      >
        <div className="flex gap-2 items-center">
          <select className="input-field text-xs py-2" value={payoutSource} onChange={(e) => setPayoutSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Btn variant="gold" icon={Icons.plus} onClick={() => {
            setEdit(null);
            setForm({ full_name: '', phone: '+998', lab_percent: 22, fizio_percent: 20, uzi_sum: 15000, ozon_sum: 10000, other_sum: 10000 });
            setModal(true);
          }}>
            Yo'naltiruvchi Qo'shish
          </Btn>
        </div>
      </PageHeader>

      {/* ── TAB BAR ─────────────────────────────────────────────────── */}
      <div className="card p-2 flex flex-wrap gap-2 border-gold/30">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'catalog'
              ? 'bg-gold text-slate-950 shadow-md'
              : 'bg-surface text-body hover:bg-white/5 border border-border'
          }`}
        >
          <span>🤝 Yo'naltiruvchilar Katalogi va Balanslar</span>
          {pendingItems.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-pulse">
              {pendingItems.length} YANGI
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('10day')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === '10day'
              ? 'bg-cyan-500 text-slate-950 shadow-md'
              : 'bg-surface text-body hover:bg-white/5 border border-border'
          }`}
        >
          <span>📊 10-Kunlik Hisobot va To'lovlar (Statistika)</span>
        </button>

        {/* Komissiya sozlamasi ilgari alohida sahifa edi — bu ham
            yo'naltiruvchilarga tegishli bo'lgani uchun shu yerga ko'chirildi */}
        <button
          type="button"
          onClick={() => setActiveTab('commission')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'commission'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-surface text-body hover:bg-white/5 border border-border'
          }`}
        >
          <span>💠 Komissiya Sozlamasi</span>
        </button>
      </div>

      {activeTab === 'commission' && <CommissionSettings embedded />}

      {/* ── TAB 1: CATALOG & GENERAL BALANCES ───────────────────────── */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">

          {/* YANGI YO'NALTIRUVCHILAR TASDIQLASH BANNERI */}
          {pendingItems.length > 0 && (
            <div className="card p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xl shrink-0">
                  🔔
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
                    Yangi Yo'naltiruvchi Qo'shilgan ({pendingItems.length} nafar tasdiqlash kutilmoqda)
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping inline-block" />
                  </h3>
                  <p className="text-xs text-muted">
                    Bemor qabulida yangi yo'naltiruvchi kiritildi. Ularning ulush foizlari va summasini belgilab tasdiqlang.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                {pendingItems.map((r) => (
                  <div key={r.id} className="p-3 bg-surface-2 rounded-xl border border-amber-500/40 flex items-center justify-between gap-2 shadow-sm">
                    <div className="min-w-0">
                      <span className="font-extrabold text-body text-xs block truncate">{r.full_name}</span>
                      <span className="text-[10px] text-amber-400 font-bold block font-mono">Tasdiqlash kutilmoqda</span>
                    </div>
                    <Btn
                      variant="gold"
                      size="xs"
                      icon={Icons.edit}
                      onClick={() => {
                        setConfirmModalItem(r);
                        setConfirmForm({
                          lab_percent: r.lab_percent ?? 22,
                          fizio_percent: r.fizio_percent ?? 20,
                          uzi_sum: r.uzi_sum ?? 15000,
                          ozon_sum: r.ozon_sum ?? 10000,
                          other_sum: r.other_sum ?? 10000,
                        });
                      }}
                    >
                      Foiz belgilash
                    </Btn>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">Jami Yo'naltiruvchilar</span>
                <span className="text-3xl font-black font-mono" style={{ color: 'var(--text)' }}>{items?.length || 0} nafar</span>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#67e8f9' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>
            <div className="card p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">Chiqarilishi kerak bo'lgan balans</span>
                <span className="text-3xl font-black font-mono" style={{ color: 'var(--gold)' }}>{formatMoney(totalBalance)}</span>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--gold-dim)', border: '1px solid var(--border-strong)', color: 'var(--gold)' }}>
                {Icons.money}
              </div>
            </div>
            <div className="card p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">Top Yo'naltiruvchi</span>
                <span className="text-xl font-extrabold truncate max-w-[180px] block" style={{ color: 'var(--success)' }}>
                  {topAnalytics[0]?.full_name || topAnalytics[0]?.name || '—'}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--success)' }}>
                {Icons.chart}
              </div>
            </div>
          </div>

          {!items ? <TableSkeleton /> : (
            <div className="card overflow-x-auto p-0 border border-gold/20 shadow-lg">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-surface-2 border-b border-border text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="p-1.5 text-center w-8">#</th>
                    <th className="p-1.5 text-left min-w-[120px]">Yo'naltiruvchi</th>
                    <th className="p-1.5 text-left w-20">Telefon</th>
                    <th className="p-1.5 text-center w-14">Lab%</th>
                    <th className="p-1.5 text-center w-14">Fizio%</th>
                    <th className="p-1.5 text-center w-16">UZI</th>
                    <th className="p-1.5 text-center w-16">Ozon</th>
                    <th className="p-1.5 text-right w-20">Bugun</th>
                    <th className="p-1.5 text-right w-24">Jami</th>
                    <th className="p-1.5 text-right w-24">Balans</th>
                    <th className="p-1.5 text-right w-24">Avans Qarzi</th>
                    <th className="p-1.5 text-center w-10">•••</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-semibold">
                  {items.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-surface-hover transition-colors whitespace-nowrap">
                      <td className="p-1.5 text-center text-muted font-mono font-bold text-[11px]">{idx + 1}</td>
                      <td className="p-1.5 text-left font-extrabold text-body text-xs truncate max-w-[140px]" title={r.full_name}>
                        <button
                          type="button"
                          onClick={() => setSelectedRefModalId(r.id)}
                          className="hover:text-cyan font-extrabold text-left transition-colors cursor-pointer"
                          title="👤 Profil va statistikasini ko'rish"
                        >
                          {r.full_name}
                        </button>
                      </td>
                      <td className="p-1.5 text-left text-muted font-mono text-[10px]">{r.phone || '—'}</td>

                      <td className="p-1.5 text-center">
                        <span className="inline-block px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-extrabold border border-amber-500/30 text-[10px]">
                          {r.lab_percent ?? 22}%
                        </span>
                      </td>

                      <td className="p-1.5 text-center">
                        <span className="inline-block px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-extrabold border border-emerald-500/30 text-[10px]">
                          {r.fizio_percent ?? 20}%
                        </span>
                      </td>

                      <td className="p-1.5 text-center">
                        <span className="inline-block px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-extrabold border border-cyan-500/30 text-[10px]">
                          {formatMoney(r.uzi_sum ?? 15000)}
                        </span>
                      </td>

                      <td className="p-1.5 text-center">
                        <span className="inline-block px-1 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono font-extrabold border border-violet-500/30 text-[10px]">
                          {formatMoney(r.ozon_sum ?? 10000)}
                        </span>
                      </td>

                      <td className="p-1.5 text-right font-mono font-bold text-gold text-xs">
                        {r.today_earned > 0 ? `+${formatMoney(r.today_earned)}` : '—'}
                      </td>

                      {/* Jami — bosilsa qaysi kuni qancha kelgani ochiladi */}
                      <td className="p-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setKunlik({ kind: 'referrers', id: r.id, name: r.full_name })}
                          className="font-mono font-black text-cyan text-xs hover:underline"
                          title="Kunma-kun ko'rish"
                        >
                          {formatMoney(r.total_earned)}
                        </button>
                      </td>

                      <td className="p-1.5 text-right font-mono font-black accent-value text-xs">
                        {formatMoney(r.balance)}
                      </td>

                      <td className="p-2.5 text-right font-mono font-bold text-sm">
                        {r.advance_debt > 0 ? (
                          <span className="text-rose-400">{formatMoney(r.advance_debt)}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="p-2.5 text-center">
                        <ActionMenu
                          items={[
                            {
                              label: 'Profil & Analytics',
                              icon: Icons.user,
                              onClick: () => setSelectedRefModalId(r.id),
                            },
                            {
                              label: 'Balansni chiqarish',
                              icon: Icons.arrowDown,
                              variant: 'success',
                              hidden: !(r.balance > 0),
                              onClick: () => payout(r.id),
                            },
                            {
                              label: 'Avans berish',
                              icon: Icons.creditCard,
                              variant: 'gold',
                              onClick: () => {
                                setSelectedRefForAdvance(r)
                                setAdvanceAmount('1000000')
                                setAdvanceModal(true)
                              },
                            },
                            {
                              label: 'Tahrirlash',
                              icon: Icons.edit,
                              onClick: () => {
                                setEdit(r)
                                setForm({
                                  full_name: r.full_name || '',
                                  phone: r.phone || '+998',
                                  lab_percent: r.lab_percent ?? 22,
                                  fizio_percent: r.fizio_percent ?? 20,
                                  uzi_sum: r.uzi_sum ?? 15000,
                                  ozon_sum: r.ozon_sum ?? 10000,
                                })
                                setModal(true)
                              },
                            },
                            {
                              label: 'Balansni qayta hisoblash',
                              icon: Icons.refresh,
                              onClick: () => resyncBalance(r.id),
                            },
                            {
                              label: "Ro'yxatdan o'chirish",
                              icon: Icons.trash,
                              variant: 'danger',
                              onClick: () => handleDelete(r),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: 10-DAY REPORT & PAYOUTS SYSTEM ───────────────────── */}
      {activeTab === '10day' && (
        <div className="space-y-6">
          {/* Davr va Segment Tanlash Bar */}
          <div className="card p-4 space-y-3 border-cyan-500/30 bg-cyan-500/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                  🗓️ 10-Kunlik Davr va Tarixiy Period Tanlash
                </h3>
                <p className="text-[11px] text-muted">
                  Oyni hamda 1-10, 11-20 yoki 21-31 kunlik davrlarni tanlab, o'tgan oylarning hisobotini ko'rishingiz va to'lashingiz mumkin.
                </p>
              </div>

              {/* Month / Year Selectors */}
              <div className="flex gap-2 items-center">
                <select
                  className="input-field text-xs font-bold font-mono py-1.5"
                  value={tenDayYear}
                  onChange={(e) => setTenDayYear(+e.target.value)}
                >
                  {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}-yil</option>)}
                </select>

                <select
                  className="input-field text-xs font-bold py-1.5 text-cyan-300"
                  value={tenDayMonth}
                  onChange={(e) => setTenDayMonth(+e.target.value)}
                >
                  {[
                    { m: 1, name: '01 - Yanvar' },
                    { m: 2, name: '02 - Fevral' },
                    { m: 3, name: '03 - Mart' },
                    { m: 4, name: '04 - Aprel' },
                    { m: 5, name: '05 - May' },
                    { m: 6, name: '06 - Iyun' },
                    { m: 7, name: '07 - Iyul' },
                    { m: 8, name: '08 - Avgust' },
                    { m: 9, name: '09 - Sentabr' },
                    { m: 10, name: '10 - Oktabr' },
                    { m: 11, name: '11 - Noyabr' },
                    { m: 12, name: '12 - Dekabr' },
                  ].map((item) => <option key={item.m} value={item.m}>{item.name}</option>)}
                </select>
              </div>
            </div>

            {/* Segment Buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { id: '1', label: "🗓️ 1 - 10-kunlar (10-kunlik)" },
                { id: '2', label: "🗓️ 11 - 20-kunlar (20-kunlik)" },
                { id: '3', label: "🗓️ 21 - 31-kunlar (Oy oxiri)" },
                { id: 'all', label: "📅 To'liq Oylik Hisobot" },
                { id: 'custom', label: "⚙️ Maxsus Sana Qamrovi" },
              ].map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setTenDaySegment(seg.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tenDaySegment === seg.id
                      ? 'bg-cyan-400 text-slate-950 font-black shadow-md'
                      : 'bg-surface text-body hover:bg-white/5 border border-border'
                  }`}
                >
                  {seg.label}
                </button>
              ))}

              {tenDaySegment === 'custom' && (
                <div className="flex items-center gap-2 ml-auto">
                  <input type="date" className="input-field text-xs py-1" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  <span className="text-xs text-muted">—</span>
                  <input type="date" className="input-field text-xs py-1" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  <Btn variant="gold" size="xs" onClick={loadTenDayReport}>Ko'rsatish</Btn>
                </div>
              )}
            </div>
          </div>

          {/* 10-Day Summary Statistics Cards */}
          {tenDayLoading ? (
            <div className="card py-12 text-center text-muted">10-kunlik hisobot yuklanmoqda...</div>
          ) : !tenDayReport ? null : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="card p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase">🎯 Jami Bemorlar</span>
                  <span className="text-xl font-black text-cyan-400 font-mono block">
                    {tenDayReport.referrers_payout?.reduce((acc, r) => acc + r.patient_count, 0) || 0} nafar
                  </span>
                </div>

                <div className="card p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase">💰 Kelgan Tushum</span>
                  <span className="text-xl font-black text-emerald-400 font-mono block">
                    {formatMoney(tenDayReport.referrers_payout?.reduce((acc, r) => acc + r.gross_total, 0) || 0)}
                  </span>
                </div>

                <div className="card p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase">🤝 Ishlangan Ulush</span>
                  <span className="text-xl font-black text-gold font-mono block">
                    {formatMoney(tenDayReport.referrers_payout?.reduce((acc, r) => acc + r.earned_commission, 0) || 0)}
                  </span>
                </div>

                <div className="card p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase">💳 Avans Ushlanma</span>
                  <span className="text-xl font-black text-rose-400 font-mono block">
                    {formatMoney(tenDayReport.referrers_payout?.reduce((acc, r) => acc + r.advance_deducted, 0) || 0)}
                  </span>
                </div>

                <div className="card p-3.5 space-y-1 col-span-2 md:col-span-1 border-gold/40 bg-gold/5">
                  <span className="text-[10px] font-bold text-gold uppercase">💵 Sof To'lanadigan</span>
                  <span className="text-xl font-black text-gold font-mono block">
                    {formatMoney(tenDayReport.total_ref_payout || 0)}
                  </span>
                </div>
              </div>

              {/* Referrers Payout Table */}
              <div className="card p-0 overflow-x-auto">
                <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                    📋 {getTenDayDates().from} — {getTenDayDates().to} Davridagi Yo'naltiruvchilar Hisob-Kitobi
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrintAllReferrersConsolidated}
                      className="btn-gold py-2 px-3 text-xs font-bold flex items-center gap-1.5 shadow-md"
                    >
                      🖨️ Barcha Yo'naltiruvchilar Hisobotini Chop Etish (1 TA BLANKA)
                    </button>
                    <span className="text-xs text-muted font-bold">
                      ({tenDayReport.referrers_payout?.length || 0} nafar)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <THead cols={['#', 'Yo\'naltiruvchi', 'Bemorlar', 'Jami Tushum', 'Ishlangan Ulush', 'Avans Ushlanma', 'Sof To\'lanadigan', 'Holati', 'Harakatlar']} />
                    <tbody>
                      {(!tenDayReport.referrers_payout || tenDayReport.referrers_payout.length === 0) ? (
                        <tr><td colSpan={9} className="py-8 text-center text-muted text-xs">Ushbu davrda yo'naltiruvchilar orqali bemor kelmagan</td></tr>
                      ) : tenDayReport.referrers_payout.map((r, idx) => {
                        const { from, to } = getTenDayDates()
                        const key = `${r.referrer_id}_${from}_${to}`
                        const isDeferred = !!deferredMap[key]

                        return (
                          <tr key={r.referrer_id} className="hover:bg-white/[0.02] transition-colors text-xs whitespace-nowrap">
                            <td className="td-muted font-mono font-bold whitespace-nowrap">#{idx + 1}</td>
                            <td className="td-cell font-bold whitespace-nowrap">
                              <div className="whitespace-nowrap">
                                <span className="text-body font-bold">{r.name}</span>
                                {r.phone && <span className="text-[10px] text-muted block font-mono">{r.phone}</span>}
                              </div>
                            </td>
                            <td className="td-cell font-mono font-bold text-center whitespace-nowrap">{r.patient_count} nafar</td>
                            <td className="td-cell font-mono text-muted whitespace-nowrap">{formatMoney(r.gross_total)}</td>
                            <td className="td-cell font-mono font-bold text-gold whitespace-nowrap">{formatMoney(r.earned_commission)}</td>
                            <td className="td-cell font-mono text-rose-400 whitespace-nowrap">
                              {r.advance_deducted > 0 ? `-${formatMoney(r.advance_deducted)}` : '0'}
                            </td>
                            <td className="td-cell font-mono font-black text-cyan-300 text-base whitespace-nowrap">{formatMoney(r.net_payable)}</td>
                            
                            {/* Holati (Status) */}
                            <td className="td-cell whitespace-nowrap">
                              {isDeferred ? (
                                <span className="badge badge-amber text-[10px] font-bold whitespace-nowrap">⏳ Keyinroqqa surilgan</span>
                              ) : r.net_payable > 0 ? (
                                <span className="badge badge-info text-[10px] font-bold whitespace-nowrap">🟡 10-Kunda To'lash Tayyor</span>
                              ) : (
                                <span className="badge badge-success text-[10px] font-bold whitespace-nowrap">🟢 Yopilgan</span>
                              )}
                            </td>

                            {/* Harakatlar (Actions - 3 Dots Menu) */}
                            <td className="td-cell whitespace-nowrap text-center">
                              <ActionMenu
                                items={[
                                  {
                                    label: "Chiqarish (Balans to'lovi)",
                                    icon: Icons.arrowDown,
                                    variant: "success",
                                    hidden: !(r.net_payable > 0),
                                    onClick: () => payout(r.referrer_id, r.net_payable),
                                  },
                                  {
                                    label: isDeferred ? "Hozir to'lash (Tayyor)" : "Keyinroqqa surish (Kechiktirish)",
                                    icon: Icons.clock,
                                    variant: isDeferred ? "cyan" : "amber",
                                    onClick: () => toggleDefer(r.referrer_id),
                                  },
                                  {
                                    label: "Chop etish (10-kunlik Hujjat)",
                                    icon: Icons.printer,
                                    onClick: () => openPrintVoucher(r),
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
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL 1: ADD / EDIT REFERRER ────────────────────────────── */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={edit ? "Yo'naltiruvchini tahrirlash" : "Yangi Yo'naltiruvchi Qo'shish"}>
        <div className="space-y-4 pt-2">
          <div>
            <label className="form-label">Ismi-Sharifi / Muassasa nomi *</label>
            <input className="input-field" placeholder="Dr. Ergashov Vazir"
              value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Telefon raqami</label>
            <input className="input-field" placeholder="+998901234567"
              value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-3">
            <h4 className="font-bold text-gold text-xs uppercase tracking-wider">🏢 Bo'limlar bo'yicha ulush foizlari va summalari</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label text-amber-400 font-bold">🧪 Laboratoriya (%)</label>
                <input
                  type="number"
                  placeholder="22"
                  value={form.lab_percent ?? 22}
                  onChange={(e) => setForm({ ...form, lab_percent: +e.target.value })}
                  className="input-field text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="form-label text-emerald-400 font-bold">⚡ Fizioterapiya (%)</label>
                <input
                  type="number"
                  placeholder="20"
                  value={form.fizio_percent ?? 20}
                  onChange={(e) => setForm({ ...form, fizio_percent: +e.target.value })}
                  className="input-field text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="form-label text-cyan-300 font-bold">🖥️ UZI (1 ta soxa - so'm)</label>
                <input
                  type="number"
                  placeholder="15000"
                  value={form.uzi_sum ?? 15000}
                  onChange={(e) => setForm({ ...form, uzi_sum: +e.target.value })}
                  className="input-field text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="form-label text-violet-300 font-bold">🧪 Ozonaterapiya (so'm)</label>
                <input
                  type="number"
                  placeholder="10000"
                  value={form.ozon_sum ?? 10000}
                  onChange={(e) => setForm({ ...form, ozon_sum: +e.target.value })}
                  className="input-field text-xs font-mono font-bold"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted">
              ℹ️ Komissiya faqat shu 4 bo'limga beriladi. Maslaxat, Massaj, Ineksiya va boshqa barcha bo'limlarga — 0 so'm. "Uzi (qo'shimcha)" tarifiga ham komissiya ajratilmaydi.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setModal(false)}>Bekor</Btn>
            <Btn variant="gold" full icon={Icons.save} onClick={save}>Saqlash</Btn>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 2: GIVE ADVANCE FOR REFERRER ───────────────────────── */}
      <Modal open={advanceModal} onClose={() => setAdvanceModal(false)} title="Yo'naltiruvchiga Avans Berish" size="xs">
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted">
            Qabul qiluvchi: <b className="text-gold">{selectedRefForAdvance?.full_name}</b>
          </p>
          <div>
            <label className="form-label">Avans summasi (so'm) *</label>
            <input
              type="number"
              className="input-field font-bold text-emerald-400 text-lg"
              placeholder="1000000"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-muted mt-1">
              💡 Ushbu summa 10-kunlik foiz to'lovida avtomatik chegirib qolinadi.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Btn variant="ghost" full icon={Icons.x} onClick={() => setAdvanceModal(false)}>
              Bekor
            </Btn>
            <Btn variant="gold" full icon={Icons.save} loading={savingAdvance} onClick={handleGiveAdvance}>
              Avans Berish
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 3: PRINTABLE 10-DAY REFERRER VOUCHER MODAL ─────────── */}
      {printModal && (
        <Modal open={true} onClose={() => setPrintModal(null)} title="10-Kunlik Yo'naltiruvchi Hujjatini Chop Etish" size="lg">
          <div className="space-y-4 pt-1">
            <div className="flex justify-between items-center bg-surface p-3 rounded-xl border border-border">
              <span className="text-xs text-muted font-bold">
                🖨️ Printerga chiqarish tayyor. Nusxa hujjati avtomatik shakllandi.
              </span>
              <Btn variant="gold" size="sm" onClick={handlePrintVoucher}>
                🖨️ Hujjatni Chop Etish (Print)
              </Btn>
            </div>

            {/* Printable Paper Preview Container */}
            <div className="border border-border bg-white text-slate-950 p-6 rounded-xl shadow-2xl max-h-[60vh] overflow-y-auto" id="printable-voucher-content">
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#000', textTransform: 'uppercase' }}>
                  MARJONA MED SERVICE
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                  10-KUNLIK YO'NALTIRUVCHI HISOB-KITOB HUJJATI
                </p>
              </div>

              {/* Info Details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12px', color: '#000' }}>
                <div style={{ border: '1px solid #000', padding: '8px 12px', borderRadius: '6px', width: '48%' }}>
                  <p style={{ margin: 0 }}><b>Yo'naltiruvchi:</b> {printModal.referrer.name}</p>
                  <p style={{ margin: '4px 0 0' }}><b>Telefon:</b> {printModal.referrer.phone || '—'}</p>
                </div>
                <div style={{ border: '1px solid #000', padding: '8px 12px', borderRadius: '6px', width: '48%', textAlign: 'right' }}>
                  <p style={{ margin: 0 }}><b>Hisob Davri:</b> {printModal.from} — {printModal.to}</p>
                  <p style={{ margin: '4px 0 0' }}><b>Hujjat Sanasi:</b> {new Date().toLocaleDateString('uz-UZ')}</p>
                </div>
              </div>

              {/* Patient Breakdown Table */}
              <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 'bold', color: '#000' }}>
                📋 Kelgan Bemorlar Ro'yxati ({printModal.patients?.length || 0} nafar):
              </h4>

              {printModal.loading ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px' }}>Bemorlar ma'lumotlari yuklanmoqda...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px', color: '#000' }}>
                  <thead>
                    <tr style={{ background: '#e5e7eb' }}>
                      <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>#</th>
                      <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Bemor F.I.SH</th>
                      <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Sana</th>
                      <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Xizmat Nomi</th>
                      <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>To'lov</th>
                      <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>Ulush</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!printModal.patients || printModal.patients.length === 0) ? (
                      <tr><td colSpan={6} style={{ padding: '10px', textAlign: 'center' }}>Bemorlar topilmadi</td></tr>
                    ) : printModal.patients.map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{ border: '1px solid #000', padding: '5px' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>{p.patient_name}</td>
                        <td style={{ border: '1px solid #000', padding: '5px' }}>{p.created_at}</td>
                        <td style={{ border: '1px solid #000', padding: '5px' }}>{p.service_name}</td>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{p.payment_amount?.toLocaleString()} so'm</td>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>{p.referrer_fee?.toLocaleString()} so'm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Financial Summary */}
              <div style={{ border: '2px solid #000', padding: '12px', borderRadius: '8px', background: '#fafafa', color: '#000' }}>
                <div style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Jami Ishlangan Ulush:</span>
                  <span>{formatMoney(printModal.referrer.earned_commission)}</span>
                </div>
                <div style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '12px', marginBottom: '4px', color: '#dc2626' }}>
                  <span>Olgan Avansi:</span>
                  <span>-{formatMoney((printModal.referrer.advance_deducted || 0) + (printModal.referrer.advance_remaining || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '15px', fontWeight: '900', borderTop: '2px solid #000', paddingTop: '6px', marginTop: '6px' }}>
                  <span>SOF TO'LANADIGAN SUMMA:</span>
                  <span>{formatMoney(printModal.referrer.net_payable)}</span>
                </div>
              </div>

              {/* Signature Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px', fontSize: '12px', color: '#000' }}>
                <div style={{ width: '42%', borderTop: '1px solid #000', paddingTop: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                  Klinika Rahbari Imzosi
                </div>
                <div style={{ width: '42%', borderTop: '1px solid #000', paddingTop: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                  Yo'naltiruvchi Imzosi ({printModal.referrer.name})
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setPrintModal(null)}>Yopish</Btn>
              <Btn variant="gold" onClick={handlePrintVoucher}>🖨️ Chop Etish (Print)</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 4: CONFIRM NEW REFERRER & SET RATES ───────────────── */}
      <Modal open={!!confirmModalItem} onClose={() => setConfirmModalItem(null)} title="Yangi Yo'naltiruvchi Foizlarini Belgilash va Tasdiqlash">
        {confirmModalItem && (
          <div className="space-y-4 pt-1">
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 space-y-1">
              <span className="text-xs font-bold text-amber-300 block uppercase tracking-wider">Yo'naltiruvchi Ma'lumoti:</span>
              <span className="text-base font-extrabold text-body block">{confirmModalItem.full_name}</span>
              {confirmModalItem.phone && <span className="text-xs text-muted font-mono block">{confirmModalItem.phone}</span>}
            </div>

            <div className="p-3 bg-surface-2 rounded-xl border border-border space-y-3">
              <h4 className="font-bold text-gold text-xs uppercase tracking-wider">🏢 Bo'limlar bo'yicha ulush foizlari va summalari</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-amber-400 font-bold">🧪 Laboratoriya (%)</label>
                  <input
                    type="number"
                    placeholder="22"
                    value={confirmForm.lab_percent}
                    onChange={(e) => setConfirmForm({ ...confirmForm, lab_percent: +e.target.value })}
                    className="input-field text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="form-label text-emerald-400 font-bold">⚡ Fizioterapiya (%)</label>
                  <input
                    type="number"
                    placeholder="20"
                    value={confirmForm.fizio_percent}
                    onChange={(e) => setConfirmForm({ ...confirmForm, fizio_percent: +e.target.value })}
                    className="input-field text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="form-label text-cyan-300 font-bold">🖥️ UZI (1 ta soxa - so'm)</label>
                  <input
                    type="number"
                    placeholder="15000"
                    value={confirmForm.uzi_sum}
                    onChange={(e) => setConfirmForm({ ...confirmForm, uzi_sum: +e.target.value })}
                    className="input-field text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="form-label text-violet-300 font-bold">🧪 Ozonaterapiya (so'm)</label>
                  <input
                    type="number"
                    placeholder="10000"
                    value={confirmForm.ozon_sum ?? 10000}
                    onChange={(e) => setConfirmForm({ ...confirmForm, ozon_sum: +e.target.value })}
                    className="input-field text-xs font-mono font-bold"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted">
                ℹ️ Komissiya faqat shu 4 bo'limga beriladi. Maslaxat, Massaj, Ineksiya va boshqa barcha bo'limlarga — 0 so'm. "Uzi (qo'shimcha)" tarifiga ham komissiya ajratilmaydi. Saqlash tugmasi bosilgach, ushbu bildirishnoma olib tashlanadi.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" full icon={Icons.x} onClick={() => setConfirmModalItem(null)}>Bekor</Btn>
              <Btn variant="gold" full icon={Icons.check} onClick={handleConfirmReferrer}>✓ Saqlash va Tasdiqlash</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── REFERRER PROFILE MODAL ───────────────────────────────── */}
      {selectedRefModalId && (
        <ReferrerProfileModal
          referrerId={selectedRefModalId}
          onClose={() => setSelectedRefModalId(null)}
        />
      )}
    </div>
  )
}
