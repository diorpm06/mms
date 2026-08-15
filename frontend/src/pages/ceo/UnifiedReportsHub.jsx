import { useCallback, useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  TrendingUp, Wallet, Users, Receipt, RefreshCw, Printer, Download,
  Stethoscope, Building, PieChart as PieIcon, ShieldAlert, Award,
  Package, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Layers, Plus, FileText, Archive, Eye,
  ChevronDown, ChevronUp, Maximize2, Minimize2
} from 'lucide-react'
import { api, downloadBlob } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'
import { hasPositiveValues, paymentPieData, formatYAxis, moneyFormatter, truncateLabel } from '../../utils/charts'
import { exportToExcel } from '../../utils/exportUtils'
import { useTheme } from '../../hooks/useTheme'
import { useToastStore } from '../../store/toastStore'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { Btn, Icons, THead } from '../../components/UIKit'
import CeoSavedReports from './SavedReports'
import IncassationModal from '../../components/IncassationModal'

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

// date.toISOString() converts to UTC first, which shifts the calendar day
// (e.g. local midnight in UTC+5 becomes the previous day) — this formats
// using the LOCAL calendar date instead, so period boundaries stay correct.
function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const TABS = [
  { id: 'all',          label: '🌐 Barchasi Jamlanma (Bir Joyda)', icon: Layers },
  { id: 'finance',      label: '📈 Tushum & Kassa',              icon: TrendingUp },
  { id: 'expenses',     label: '💸 Chiqimlar & Harajatlar',      icon: Receipt },
  { id: 'referrers',    label: '🤝 Yo\'naltiruvchilar (10-Kun)',  icon: Users },
  { id: 'payroll',      label: '📊 Maosh Qaydnomasi',           icon: DollarSign },
  { id: 'inventory',    label: '💊 Omborxona',                   icon: Package },
  { id: 'saved_reports',label: '🗄️ Saqlangan PDFlar',           icon: Archive },
]

export default function UnifiedReportsHub({ homePath = '/ceo' }) {
  const [activeTab, setActiveTab] = useState('all') // Default: SHOW ALL IN ONE PAGE!
  const [loading, setLoading] = useState(true)

  // Section Collapsibility State (Default: all expanded)
  const [collapsedSections, setCollapsedSections] = useState({})

  const toggleSection = (sectionId) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const collapseAllSections = () => {
    setCollapsedSections({
      finance: true,
      expenses: true,
      referrers: true,
      payroll: true,
      inventory: true,
      saved_reports: true,
    })
  }

  const expandAllSections = () => {
    setCollapsedSections({})
  }

  // Date Range Filters
  const now = new Date()
  const todayStr = toLocalDateStr(now)
  const firstDayStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1))

  const [dateFrom, setDateFrom] = useState(firstDayStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [activePreset, setActivePreset] = useState('month')

  // Arbitrary month/year/week selection — quick presets above only ever
  // show the CURRENT month/year/last-7-days; these let CEO pick ANY past
  // month, year, or calendar week instead.
  const [pickMonth, setPickMonth] = useState(now.getMonth() + 1)
  const [pickYear, setPickYear] = useState(now.getFullYear())
  const [pickWeek, setPickWeek] = useState('')
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

  // Expense Modal & Inkasatsiya Modal State
  const [expenseModal, setExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ category: 'Kommunal', amount: '', note: '' })
  const [savingExpense, setSavingExpense] = useState(false)

  const [incassationModal, setIncassationModal] = useState(false)
  const [sendingTelegram, setSendingTelegram] = useState(false)

  const handleSendTelegramReport = async () => {
    try {
      setSendingTelegram(true)
      const res = await api('/reports/telegram/send-daily', { method: 'POST' })
      toast(res?.message || "✓ Telegram botga kunlik hisobot yuborildi!")
    } catch (e) {
      toast(e.message || "Telegramga yuborishda xatolik", "error")
    } finally {
      setSendingTelegram(false)
    }
  }

  // Consolidated Data States
  const [dashboardData, setDashboardData] = useState(null)
  const [reportsData, setReportsData] = useState(null)
  const [referrersReport, setReferrersReport] = useState(null)
  const [payrollData, setPayrollData] = useState(null)
  const [inventoryData, setInventoryData] = useState([])
  const [expensesData, setExpensesData] = useState([])
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const { chartAxis, chartGrid, chartGold, chartColors, tooltipStyle } = useTheme()
  const toast = useToastStore((s) => s.add)

  // Fetch all unified clinic reports in parallel for given dates.
  // /reports/ten-day's response already contains the FULL /reports/finance
  // payload plus referrer/provider payout breakdowns on top (backend builds
  // it by running get_report() internally, then adding more keys) — calling
  // both endpoints separately made the backend compute get_report() twice
  // per page load. One call now feeds both reportsData and referrersReport.
  const fetchWithDates = useCallback(async (fromStr, toStr) => {
    setLoading(true)
    try {
      const [dashRes, refRes, payRes, invRes, expRes] = await Promise.all([
        api('/reports/dashboard').catch(() => null),
        api(`/reports/ten-day?from=${fromStr}&to=${toStr}`).catch(() => null),
        api(`/payroll?year=${year}&month=${month}`).catch(() => null),
        api('/inventory').catch(() => []),
        api(`/expenses?from=${fromStr}&to=${toStr}`).catch(() => []),
      ])

      setDashboardData(dashRes)
      setReportsData(refRes)
      setReferrersReport(refRes)
      setPayrollData(payRes)
      setInventoryData(invRes || [])
      setExpensesData(expRes || [])
    } catch (e) {
      toast(e.message || "Hisobotlar yuklanishida xatolik", 'error')
    } finally {
      setLoading(false)
    }
  }, [year, month, toast])

  useEffect(() => {
    fetchWithDates(dateFrom, dateTo)
  }, [fetchWithDates, dateFrom, dateTo])

  // Quick Preset Handlers (Immediate Execution)
  const handleQuickPreset = (preset) => {
    const today = new Date()
    let f = todayStr
    let t = todayStr

    if (preset === 'today') {
      f = toLocalDateStr(today)
      t = f
    } else if (preset === 'yesterday') {
      const y = new Date()
      y.setDate(today.getDate() - 1)
      f = toLocalDateStr(y)
      t = f
    } else if (preset === 'week') {
      const wAgo = new Date()
      wAgo.setDate(today.getDate() - 7)
      f = toLocalDateStr(wAgo)
      t = toLocalDateStr(today)
    } else if (preset === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      f = toLocalDateStr(first)
      t = toLocalDateStr(today)
    } else if (preset === '10day') {
      const tenAgo = new Date()
      tenAgo.setDate(today.getDate() - 10)
      f = toLocalDateStr(tenAgo)
      t = toLocalDateStr(today)
    } else if (preset === 'year') {
      const firstYear = new Date(today.getFullYear(), 0, 1)
      f = toLocalDateStr(firstYear)
      t = toLocalDateStr(today)
    }

    setActivePreset(preset)
    setDateFrom(f)
    setDateTo(t)
    fetchWithDates(f, t)
  }

  // Any past (or future) month, chosen explicitly — not just "this month"
  const handleMonthPick = () => {
    const first = new Date(pickYear, pickMonth - 1, 1)
    const last = new Date(pickYear, pickMonth, 0)
    const f = toLocalDateStr(first)
    const t = toLocalDateStr(last)
    setActivePreset('custom')
    setDateFrom(f)
    setDateTo(t)
    fetchWithDates(f, t)
  }

  // Any past (or future) year, chosen explicitly — not just "this year"
  const handleYearPick = () => {
    const f = toLocalDateStr(new Date(pickYear, 0, 1))
    const t = toLocalDateStr(new Date(pickYear, 11, 31))
    setActivePreset('custom')
    setDateFrom(f)
    setDateTo(t)
    fetchWithDates(f, t)
  }

  // Any calendar week (Mon-Sun), chosen via the native week picker
  const handleWeekPick = (weekStr) => {
    setPickWeek(weekStr)
    if (!weekStr) return
    const [yearStr, weekNumStr] = weekStr.split('-W')
    const yr = parseInt(yearStr, 10)
    const wk = parseInt(weekNumStr, 10)
    const simple = new Date(yr, 0, 1 + (wk - 1) * 7)
    const dow = simple.getDay()
    const monday = new Date(simple)
    if (dow <= 4) monday.setDate(simple.getDate() - dow + 1)
    else monday.setDate(simple.getDate() + 8 - dow)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const f = toLocalDateStr(monday)
    const t = toLocalDateStr(sunday)
    setActivePreset('custom')
    setDateFrom(f)
    setDateTo(t)
    fetchWithDates(f, t)
  }

  // Save PDF Report to Database & Download
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      await api(`/reports/save-daily?date=${dateFrom}`, { method: 'POST' }).catch(() => null)
      const blob = await api(`/reports/export/pdf?from=${dateFrom}&to=${dateTo}`)
      downloadBlob(blob, `Hisobot_${dateFrom}_${dateTo}.pdf`)
      toast("✓ PDF Hisobot yuklab olindi!")
    } catch (e) {
      toast(e.message || "PDF yuklashda xatolik", 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Create New Expense Handler
  const handleAddExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.amount || +expenseForm.amount <= 0) {
      toast("Harajat summasini kiriting", "error")
      return
    }
    setSavingExpense(true)
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: expenseForm.category,
          amount: +expenseForm.amount,
          note: expenseForm.note,
        }),
      })
      toast("Harajat saqlandi ✓")
      setExpenseForm({ category: 'Kommunal', amount: '', note: '' })
      setExpenseModal(false)
      fetchWithDates(dateFrom, dateTo)
    } catch (err) {
      toast(err.message || "Harajat saqlashda xatolik", "error")
    } finally {
      setSavingExpense(false)
    }
  }

  // Dynamic Date Range Title Helper
  const getDateRangeTitle = () => {
    if (dateFrom === dateTo) return `KUNLIK HISOBOT (${dateFrom})`
    return `MOLIYAVIY HISOBOT (DAVR: ${dateFrom} — ${dateTo})`
  }

  // 1) Print Dynamic Summary Report (A3 Format, Selected Period)
  const handlePrintDailySummary = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=900')
    const totalRev = reportsData?.total_income || 0
    const totalExp = reportsData?.expenses || 0
    const netSum = totalRev - totalExp
    const cardSum = reportsData?.card || 0
    const clickSum = reportsData?.click || 0
    const cashSum = reportsData?.cash || (totalRev - cardSum - clickSum)
    const netCash = cashSum - totalExp

    const services = reportsData?.services_breakdown || reportsData?.services_detail || []
    const expenses = expensesData || reportsData?.expenses_list || []

    let svcRowsHtml = ''
    let svcCountSum = 0
    let svcMoneySum = 0
    const activeSvcs = services.filter(s => (s.count || 0) > 0 || (s.total || 0) > 0)

    activeSvcs.forEach((s, idx) => {
      svcCountSum += (s.count || 1)
      svcMoneySum += (s.total || 0)
      svcRowsHtml += `<tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${s.name}</td>
        <td style="text-align: center; font-weight: bold;">${s.count || 1}</td>
        <td style="text-align: right; font-weight: bold;">${formatMoney(s.total || 0)}</td>
      </tr>`
    })

    if (activeSvcs.length > 0) {
      svcRowsHtml += `<tr style="background: #f1f5f9; font-weight: bold;">
        <td></td>
        <td>JAMI XIZMATLAR</td>
        <td style="text-align: center;">${svcCountSum}</td>
        <td style="text-align: right;">${formatMoney(svcMoneySum)}</td>
      </tr>`
    }

    const inpCount = reportsData?.active_inpatients || reportsData?.discharged_today || 0
    const inpIncome = reportsData?.inpatient_income || 0

    svcRowsHtml += `<tr>
      <td style="text-align: center;">${activeSvcs.length + 1}</td>
      <td>Statsionar (Hozirda yotganlar)</td>
      <td style="text-align: center; font-weight: bold;">${inpCount}</td>
      <td style="text-align: right; font-weight: bold;">${formatMoney(inpIncome)}</td>
    </tr>`

    const grandCount = svcCountSum
    const grandSum = totalRev || (svcMoneySum + inpIncome)

    svcRowsHtml += `<tr style="background: #e2e8f0; font-weight: 900; font-size: 13px;">
      <td></td>
      <td>JAMI TUSHUM</td>
      <td style="text-align: center;">${grandCount}</td>
      <td style="text-align: right;">${formatMoney(grandSum)}</td>
    </tr>`

    let expRowsHtml = ''
    expenses.filter(ex => (ex.amount || 0) > 0).forEach((ex, idx) => {
      const cat = ex.category || 'Boshqa'
      const desc = ex.description || ex.note || ''
      const detail = (desc && desc !== cat) ? `${cat} — ${desc}` : (desc || cat)
      expRowsHtml += `<tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${detail}</td>
        <td style="text-align: right; font-weight: bold; color: #dc2626;">${formatMoney(ex.amount)}</td>
      </tr>`
    })

    let matRowsHtml = ''
    const usedMats = reportsData?.materials_used_breakdown || []
    let totalMatIncomeSum = reportsData?.total_material_income || 0
    let totalMatQtySum = reportsData?.total_material_quantity || 0

    usedMats.forEach((m, idx) => {
      matRowsHtml += `<tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${m.name}</td>
        <td style="text-align: center; font-weight: bold;">${m.quantity_used} dona</td>
        <td style="text-align: right; font-weight: bold; color: #16a34a;">${formatMoney(m.total_income)}</td>
      </tr>`
    })

    if (usedMats.length > 0) {
      matRowsHtml += `<tr style="background: #f1f5f9; font-weight: bold;">
        <td></td>
        <td>JAMI MATERIAL TUSHUMI</td>
        <td style="text-align: center;">${totalMatQtySum} dona</td>
        <td style="text-align: right; color: #16a34a;">${formatMoney(totalMatIncomeSum)}</td>
      </tr>`
    }

    const fullHtml = `<!DOCTYPE html><html><head><title>Hisobot — Marjona Med Service</title>
      <style>
        body { font-family: Segoe UI, Arial, sans-serif; padding: 25px; color: #0f172a; background: #fff; line-height: 1.5; font-size: 15px; }
        .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 14px; margin-bottom: 22px; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 1px; }
        .header p { margin: 6px 0 0; font-size: 16px; font-weight: 800; color: #334155; }
        .section-title { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-top: 24px; margin-bottom: 10px; background: #f1f5f9; padding: 8px 12px; border-left: 5px solid #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
        th { border: 1.5px solid #94a3b8; padding: 10px 12px; background: #f8fafc; font-weight: 900; font-size: 15px; text-align: left; }
        td { border: 1px solid #cbd5e1; padding: 9px 12px; font-size: 14px; }
        .kassa-box { border: 2.5px solid #0f172a; background: #f8fafc; padding: 20px; margin-top: 25px; border-radius: 10px; }
        .kassa-line { font-size: 16px; font-weight: 900; margin-bottom: 8px; display: flex; justify-content: space-between; }
        .kassa-sub { font-size: 15px; font-weight: 800; color: #1e293b; padding: 8px 0; border-top: 1.5px dashed #cbd5e1; border-bottom: 1.5px dashed #cbd5e1; margin: 10px 0; display: flex; justify-content: space-between; }
        .kassa-main { font-size: 26px; font-weight: 900; color: #16a34a; margin-top: 10px; display: flex; justify-content: space-between; }
        .signatures { display: flex; justify-content: space-between; margin-top: 55px; font-size: 15px; }
        .sig-line { width: 44%; border-top: 2px solid #000; text-align: center; padding-top: 8px; font-weight: 900; }
        @media print { body { padding: 0; } @page { size: A3; margin: 15mm; } }
      </style></head><body>
      <div class="header">
        <h1>MARJONA MED SERVIS KLINIKASI</h1>
        <p>${getDateRangeTitle()}</p>
      </div>

      <div class="section-title">1. FAOLIYAT VA STATSIONAR (XIZMATLAR & YOTIB DAVOLANISH)</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">№</th>
            <th>Xizmat / Bo'lim nomi</th>
            <th style="width: 100px; text-align: center;">Soni</th>
            <th style="width: 180px; text-align: right;">Summa (so'm)</th>
          </tr>
        </thead>
        <tbody>
          ${svcRowsHtml || '<tr><td colSpan="4" style="text-align:center; padding:15px; color:#64748b;">Aktiv xizmatlar mavjud emas</td></tr>'}
        </tbody>
      </table>

      <div class="section-title">2. XARAJATLAR</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">№</th>
            <th>Xarajat maqsadi va sababi</th>
            <th style="width: 180px; text-align: right;">Summa (so'm)</th>
          </tr>
        </thead>
        <tbody>
          ${expRowsHtml || '<tr><td colSpan="3" style="text-align:center; padding:15px; color:#64748b;">Xarajatlar mavjud emas</td></tr>'}
        </tbody>
      </table>

      <div class="section-title">3. ISHLATILGAN MATERIALLAR VA TUSHUM</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">№</th>
            <th>Material Nomi</th>
            <th style="width: 130px; text-align: center;">Ishlatilgan soni</th>
            <th style="width: 180px; text-align: right;">Tushum (so'm)</th>
          </tr>
        </thead>
        <tbody>
          ${matRowsHtml || '<tr><td colSpan="4" style="text-align:center; padding:15px; color:#64748b;">Ishlatilgan materiallar mavjud emas</td></tr>'}
        </tbody>
      </table>

      <div class="kassa-box">
        <div class="kassa-line"><span>📈 JAMI TUSHUM:</span><span>${formatMoney(totalRev)}</span></div>
        <div class="kassa-line" style="color: #dc2626;"><span>📉 JAMI XARAJAT:</span><span>-${formatMoney(totalExp)}</span></div>
        <div class="kassa-line" style="color: #0284c7; border-top: 1.5px solid #000; padding-top: 6px;"><span>💰 QOLGAN SUMMA (SOF QOLDIQ):</span><span>${formatMoney(netSum)}</span></div>
        <div class="kassa-sub">
          <span>💳 QR / Terminal: ${formatMoney(cardSum)}</span>
          <span>📱 Click/Payme: ${formatMoney(clickSum)}</span>
        </div>
        <div class="kassa-main">
          <span>💵 NAQD:</span>
          <span>${formatMoney(netCash > 0 ? netCash : 0)}</span>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-line">Administrator Imzosi: ___________________</div>
        <div class="sig-line">Rahbar Imzosi: ___________________</div>
      </div>
      </body></html>`

    printWindow.document.write(fullHtml)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  // 2) Print Finance & Income Only
  const handlePrintFinanceOnly = () => {
    handlePrintDailySummary()
  }

  // 3) Print Expenses Only
  const handlePrintExpensesOnly = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=900')
    const expItems = expensesData || []
    let rows = ''
    expItems.forEach((ex, i) => {
      rows += '<tr><td style="text-align:center;">' + (i+1) + '</td><td>' + ex.category + '</td><td>' + (ex.note || '—') + '</td><td style="text-align:right;font-weight:bold;color:red;">' + formatMoney(ex.amount) + '</td><td style="text-align:center;">' + formatDate(ex.created_at) + '</td></tr>'
    })
    const fullHtml = '<!DOCTYPE html><html><head><title>Klinika Harajatlari Hisoboti</title>' +
      '<style>body{font-family:Segoe UI,Arial;padding:20px;color:#000;} h1{text-align:center;font-size:20px;margin-bottom:5px;} p{text-align:center;font-size:12px;margin:0 0 15px;} table{width:100%;border-collapse:collapse;margin-top:15px;font-size:11px;} th,td{border:1px solid #000;padding:6px 8px;} th{background:#f2f2f2;}</style></head><body>' +
      '<h1>MARJONA MED SERVICE</h1>' +
      '<p>KLINIKA HARAJATLARI VA CHIQIMLARI RO\'YXATI (' + dateFrom + ' — ' + dateTo + ')</p>' +
      '<p style="font-weight:bold;">Jami Harajat Summasi: ' + formatMoney(totalExpensesSum) + '</p>' +
      '<table><thead><tr><th>#</th><th>Kategoriya</th><th>Izoh</th><th style="text-align:right;">Summa</th><th style="text-align:center;">Sana</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="margin-top:40px;display:flex;justify-content:space-between;font-size:12px;">' +
      '<div style="width:40%;border-top:1px solid #000;text-align:center;padding-top:4px;">Administrator Imzosi</div>' +
      '<div style="width:40%;border-top:1px solid #000;text-align:center;padding-top:4px;">Rahbar Imzosi</div></div></body></html>'
    printWindow.document.write(fullHtml)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  // 4) Master All-in-One Printable Sheet
  const handlePrintAllConsolidated = () => {
    handlePrintDailySummary()
  }

  // Export Excel Handler
  const handleExportExcel = (type = 'all') => {
    if (type === 'referrers' || activeTab === 'referrers') {
      const rows = (referrersReport?.referrers_payout || []).map((r) => ({
        "Yo'naltiruvchi F.I.Sh": r.name,
        "Telefon": r.phone || '—',
        "Bemorlar Soni": r.patient_count,
        "Jami Tushum": r.gross_total,
        "Ishlangan Ulush": r.earned_commission,
        "Avans (-)": r.advance_deducted,
        "Sof To'lanadigan": r.net_payable,
      }))
      exportToExcel(rows, `Yonalteruvchilar_Hisoboti_${dateFrom}_${dateTo}`)
    } else if (type === 'expenses' || activeTab === 'expenses') {
      const rows = (expensesData || []).map((ex) => ({
        "Kategoriya": ex.category,
        "Izoh": ex.note || '—',
        "Summa": ex.amount,
        "Sana": formatDate(ex.created_at),
      }))
      exportToExcel(rows, `Klinika_Harajatlari_${dateFrom}_${dateTo}`)
    } else if (type === 'payroll' || activeTab === 'payroll') {
      const rows = [...(payrollData?.doctors || []), ...(payrollData?.staff || [])].map((d) => ({
        "Xodim F.I.Sh": d.name,
        "Lavozim / Xona": `${d.role} (${d.cabinet})`,
        "Mijozlar Soni": d.patients_count,
        "Jami Tushum": d.total_income,
        "Ulushi / Maosh": d.doctor_share,
        "Avanslar (-)": d.advances,
        "Qo'lga Tegadigan Maosh": d.net_salary,
      }))
      exportToExcel(rows, `Maosh_Qaydnomasi_${month}_${year}`)
    } else if (type === 'inventory' || activeTab === 'inventory') {
      const rows = (reportsData?.materials_used_breakdown || []).map((m) => ({
        "Material Nomi": m.name,
        "Ishlatilgan Miqdor (dona)": m.quantity_used,
        "Sotilish Narxi (so'm)": m.unit_price || 0,
        "Tan Narxi (so'm)": m.cost_price || 0,
        "Jami Tushum": m.total_income,
        "Tan Narx Summasi": m.total_cost || 0,
        "Sof Foyda": m.profit || 0,
      }))
      exportToExcel(rows, `Materiallar_Foyda_Hisoboti_${dateFrom}_${dateTo}`)
    } else {
      toast("Excel eksport bajarildi", "info")
    }
  }

  const totalExpensesSum = (expensesData || []).reduce((acc, ex) => acc + (ex.amount || 0), 0)

  // Sub-Renderers for Individual Sections with Collapsible Accordion Support
  const renderFinanceSection = () => {
    const isCollapsed = collapsedSections['finance']
    return (
      <div className="card p-6 space-y-6 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => toggleSection('finance')}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            {isCollapsed ? <ChevronDown className="h-5 w-5 text-gold" /> : <ChevronUp className="h-5 w-5 text-gold" />}
            <h3 className="text-sm font-black text-gold uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald" /> 1. Moliyaviy Tushumlar & Kassa Balansi
            </h3>
            {isCollapsed && (
              <span className="text-xs font-mono font-bold text-emerald bg-emerald/10 py-0.5 px-2 rounded-lg">
                Sof Foyda: {formatMoney(reportsData?.net_profit || 0)}
              </span>
            )}
          </button>

          <div className="flex flex-wrap gap-2 items-center">
            <Btn variant="gold" size="xs" icon={Icons.printer} onClick={handlePrintFinanceOnly}>
              🖨️ Faqat Tushumni Chop Etish
            </Btn>
            <button type="button" onClick={() => setIncassationModal(true)} className="btn-outline py-1 px-3 text-xs font-bold">
              💵 Inkasatsiya Qilish
            </button>
            <button
              type="button"
              onClick={() => toggleSection('finance')}
              className="btn-outline py-1 px-2 text-xs font-bold text-muted hover:text-gold"
              title={isCollapsed ? "Kattalashtirish (Ochish)" : "Yig'ish (Kichiklashtirish)"}
            >
              {isCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card">
                <span className="text-xs font-bold text-muted uppercase">Jami Kelgan Tushum</span>
                <p className="text-2xl font-black text-emerald font-mono mt-1">{formatMoney(reportsData?.total_income || 0)}</p>
                {(reportsData?.total_discount || 0) > 0 && (
                  <p className="text-[11px] text-muted mt-1 leading-snug">
                    To'liq summa {formatMoney(reportsData.gross_income)}<br />
                    <span className="text-amber-400 font-bold">chegirma −{formatMoney(reportsData.total_discount)}</span>
                  </p>
                )}
              </div>
              <div className="stat-card">
                <span className="text-xs font-bold text-muted uppercase">Harajatlar (-)</span>
                <p className="text-2xl font-black text-rose-400 font-mono mt-1">{formatMoney(reportsData?.expenses || 0)}</p>
              </div>
              <div className="stat-card">
                <span className="text-xs font-bold text-muted uppercase">Yo'naltiruvchilar Hissi</span>
                <p className="text-2xl font-black text-cyan font-mono mt-1">{formatMoney(reportsData?.referrer_share || 0)}</p>
              </div>
              <div className="stat-card border-gold/40 bg-gold/5">
                <span className="text-xs font-bold text-gold uppercase">Klinika Sof Foydasi</span>
                <p className="text-2xl font-black text-gold font-mono mt-1">{formatMoney(reportsData?.net_profit || 0)}</p>
              </div>
            </div>

            {/* Revenue Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="card-2 p-4">
                <h4 className="text-xs font-bold text-gold uppercase mb-2">Naqd / Karta Taqsimoti</h4>
                {hasPositiveValues(paymentPieData(reportsData?.cash, reportsData?.card, reportsData?.payment_chart)) ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <Pie
                          data={paymentPieData(reportsData?.cash, reportsData?.card, reportsData?.payment_chart)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={65}
                          innerRadius={35}
                          paddingAngle={4}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {paymentPieData(reportsData?.cash, reportsData?.card, reportsData?.payment_chart).map((_, i) => (
                            <Cell key={i} fill={chartColors[i % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-muted text-center py-12 italic">To'lov ma'lumoti topilmadi</p>
                )}
              </div>

              <div className="card-2 p-4">
                <h4 className="text-xs font-bold text-gold uppercase mb-2">7 Kunlik Daromad Dinamikasi</h4>
                {hasPositiveValues(dashboardData?.income_chart || [], 'income') ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData?.income_chart || []} margin={{ top: 10, right: 10, bottom: 25, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                        <XAxis dataKey="date" stroke={chartAxis} tick={{ fill: chartAxis, fontSize: 10 }} />
                        <YAxis stroke={chartAxis} tick={{ fill: chartAxis, fontSize: 10 }} tickFormatter={formatYAxis} width={45} />
                        <Tooltip formatter={(v) => [moneyFormatter(v), 'Daromad']} contentStyle={tooltipStyle} />
                        <Bar dataKey="income" fill={chartGold} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-muted text-center py-12 italic">Daromad dinamikasi mavjud emas</p>
                )}
              </div>
            </div>

            {/* Berilgan chegirmalar — sababi bilan */}
            {(reportsData?.discounts || []).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  🏷️ Berilgan chegirmalar — {reportsData.discounts.length} ta, jami {formatMoney(reportsData.total_discount)}
                </h4>
                <p className="text-[11px] text-muted">
                  Xizmatlar to'liq summasi {formatMoney(reportsData.gross_income)} — chegirmadan keyin {formatMoney(reportsData.total_income)} tushdi.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <THead cols={['#', 'Bemor', 'Sababi', 'Vaqt', 'To\'lagan', 'Chegirma']} />
                    <tbody className="divide-y divide-border">
                      {reportsData.discounts.map((d, i) => (
                        <tr key={i} className="hover:bg-surface-hover font-semibold">
                          <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                          <td className="p-2.5 text-body font-bold">{d.patient_name}</td>
                          <td className="p-2.5 text-muted">{d.reason}</td>
                          <td className="p-2.5 font-mono text-muted">{d.date}</td>
                          <td className="p-2.5 text-right font-mono text-emerald">{formatMoney(d.paid)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-400">-{formatMoney(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Navbatchilikda (qog'oz jurnalidan) kiritilgan bemorlar — alohida ro'yxat, umumiy summaga allaqachon qo'shilgan */}
            {(reportsData?.paper_entry_count || 0) > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  📄 Navbatchilikda (qog'oz jurnalidan) kiritilgan bemorlar — {reportsData.paper_entry_count} ta, jami {formatMoney(reportsData.paper_entry_total)}
                </h4>
                <p className="text-[11px] text-muted">Bu bemorlar yuqoridagi umumiy tushum va mijozlar soniga allaqachon qo'shilgan holda hisoblangan.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <THead cols={['#', 'F.I.Sh', 'Xizmat', 'Sana / Vaqt', 'Summa']} />
                    <tbody className="divide-y divide-border">
                      {reportsData.paper_entry_patients.map((p, i) => (
                        <tr key={p.id} className="hover:bg-surface-hover font-semibold">
                          <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                          <td className="p-2.5 text-body font-bold">{p.full_name}</td>
                          <td className="p-2.5 text-muted">{p.service_name}</td>
                          <td className="p-2.5 font-mono text-amber-400">{p.visit_date} {p.visit_time}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald">{formatMoney(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bekor qilingan to'lovlar — alohida ro'yxat va summa */}
            {(reportsData?.cancelled_count || 0) > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  🔴 Bekor Qilingan To'lovlar — {reportsData.cancelled_count} ta, jami -{formatMoney(reportsData.cancelled_total)}
                </h4>
                <p className="text-[11px] text-muted">Bemor to'lovidan voz kechganda bekor qilingan yozuvlar (kassadan va balansdan chiqarilgan).</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <THead cols={['#', 'Bemor F.I.Sh', 'Xizmat', 'Bekor Qilish Sababi', 'Vaqt', 'Qaytarilgan Summa']} />
                    <tbody className="divide-y divide-border">
                      {reportsData.cancelled_list.map((c, i) => (
                        <tr key={c.id || i} className="hover:bg-rose-500/10 font-semibold text-rose-200">
                          <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                          <td className="p-2.5 text-body font-bold">{c.patient_name}</td>
                          <td className="p-2.5 text-muted">{c.service_name}</td>
                          <td className="p-2.5 italic text-rose-300">{c.cancel_reason}</td>
                          <td className="p-2.5 font-mono text-muted">{c.date}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-400">-{formatMoney(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderExpensesSection = () => {
    const isCollapsed = collapsedSections['expenses']
    return (
      <div className="card p-6 space-y-4 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => toggleSection('expenses')}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            {isCollapsed ? <ChevronDown className="h-5 w-5 text-rose-400" /> : <ChevronUp className="h-5 w-5 text-rose-400" />}
            <h3 className="text-sm font-black text-gold uppercase tracking-wider flex items-center gap-2">
              <Receipt className="h-4 w-4 text-rose-400" /> 2. Chiqimlar va Harajatlar ({expensesData.length} ta yozuv — {formatMoney(totalExpensesSum)})
            </h3>
          </button>

          <div className="flex flex-wrap gap-2 items-center">
            <Btn variant="gold" size="xs" icon={Icons.printer} onClick={handlePrintExpensesOnly}>
              🖨️ Faqat Harajatlarni Chop Etish
            </Btn>
            <button type="button" onClick={() => handleExportExcel('expenses')} className="btn-outline py-1 px-3 text-xs font-bold">
              Excel
            </button>
            <button type="button" onClick={() => setExpenseModal(true)} className="btn-gold py-1 px-3 text-xs font-bold flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Harajat Kiritish
            </button>
            <button
              type="button"
              onClick={() => toggleSection('expenses')}
              className="btn-outline py-1 px-2 text-xs font-bold text-muted hover:text-gold"
              title={isCollapsed ? "Kattalashtirish (Ochish)" : "Yig'ish (Kichiklashtirish)"}
            >
              {isCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="overflow-x-auto animate-fadeIn">
            <table className="w-full text-xs">
              <THead cols={['#', 'Kategoriya', 'Izoh / Sabab', 'Summa', 'Sana']} />
              <tbody className="divide-y divide-border">
                {expensesData.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-muted italic">Ushbu davrda harajat kiritilmagan</td></tr>
                ) : expensesData.map((ex, i) => (
                  <tr key={ex.id || i} className="hover:bg-surface-hover font-semibold">
                    <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                    <td className="p-2.5"><span className="badge badge-gold font-bold">{ex.category}</span></td>
                    <td className="p-2.5 text-body font-bold">{ex.note || '—'}</td>
                    <td className="p-2.5 font-mono font-black text-rose-400">{formatMoney(ex.amount)}</td>
                    <td className="p-2.5 text-muted font-mono">{formatDate(ex.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const [expandedRefId, setExpandedRefId] = useState(null)

  const handleDownloadReferrersPdf = async () => {
    try {
      const blob = await api(`/reports/export/referrers-pdf?from=${dateFrom}&to=${dateTo}`)
      downloadBlob(blob, `Yonaltiruvchilar_Mukammal_Hisobot_${dateFrom}_${dateTo}.pdf`)
      toast("✓ Yo'naltiruvchilar mukammal PDF hisoboti yuklab olindi!")
    } catch (e) {
      toast(e.message || "PDF yuklashda xatolik", 'error')
    }
  }

  const handlePrintReferrersDetailed = () => {
    const printWindow = window.open('', '_blank', 'width=1050,height=900')
    const refPayouts = referrersReport?.referrers_payout || []

    let grandPatientsCount = 0
    let grandGrossTotal = 0
    let grandFeeTotal = 0
    let grandAdvanceTotal = 0
    let grandNetTotal = 0

    let summaryRowsHtml = ''
    let refBlocksHtml = ''

    if (refPayouts.length === 0) {
      summaryRowsHtml = '<tr><td colSpan="7" style="text-align:center; padding: 15px;">Yo\'naltiruvchilar mavjud emas</td></tr>'
      refBlocksHtml = '<p style="text-align:center; padding: 20px; color: #64748b;">Ushbu davrda yo\'naltiruvchilar ma\'lumoti mavjud emas</p>'
    } else {
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
          <td style="text-align: right; color: #dc2626;">${adv > 0 ? `-${formatMoney(adv)}` : '0'}</td>
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

        dailyDepts.forEach((d, idx) => {
          rGross += d.gross_total || 0
          rFee += d.earned_fee || 0
          rSvcCount += d.service_count || 0
          const isHiddenRev = ['UZI', 'OZON'].some(k => (d.department_name || '').toUpperCase().includes(k))
          rowsHtml += `<tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="text-align: center; font-weight: bold;">${d.date || '—'}</td>
            <td><strong>${d.department_name}</strong></td>
            <td style="text-align: center; font-weight: bold;">${d.patient_count || 1} nafar</td>
            <td style="text-align: center; font-weight: bold;">${d.service_count} ta</td>
            <td style="text-align: ${isHiddenRev ? 'center' : 'right'}; font-weight: bold;">${isHiddenRev ? '—' : formatMoney(d.gross_total)}</td>
            <td style="text-align: center; font-weight: bold;">${d.rate_label}</td>
            <td style="text-align: right; font-weight: bold; color: #0284c7;">${formatMoney(d.earned_fee)}</td>
          </tr>`
        })

        refBlocksHtml += `
          <div class="referrer-page">
            <div class="header" style="margin-bottom: 8px;">
              <p style="font-size: 14px; font-weight: bold; margin: 0; color: #334155;">Davr: ${dateFrom} — ${dateTo}</p>
            </div>
            <div style="font-size: 13px; font-weight: 900; background: #f1f5f9; padding: 6px 10px; border-left: 4px solid #0f172a; margin-bottom: 6px; display: flex; justify-content: space-between;">
              <span>👨‍⚕️ ${r.name} ${r.phone ? '(' + r.phone + ')' : ''}</span>
              <span>Jami ulush: ${formatMoney(earned)}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px; text-align: center;">№</th>
                  <th style="width: 95px; text-align: center;">Sana</th>
                  <th>Bo'lim nomi</th>
                  <th style="width: 100px; text-align: center;">Bemorlar soni</th>
                  <th style="width: 100px; text-align: center;">Xizmatlar soni</th>
                  <th style="width: 120px; text-align: center;">Jami Tushum</th>
                  <th style="width: 110px; text-align: center;">Belgilangan Ulush</th>
                  <th style="width: 120px; text-align: right;">Hisoblangan Ulush</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colSpan="8" style="text-align:center; padding:6px;">Xizmatlar yo-q</td></tr>'}
                <tr style="background: #e2e8f0; font-weight: 900;">
                  <td colSpan="3">JAMI (${r.name}):</td>
                  <td style="text-align: center;">${rPatCount} nafar bemor</td>
                  <td style="text-align: center;">${rSvcCount} ta xizmat</td>
                  <td style="text-align: center;">—</td>
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
    }

    const fullHtml = `<!DOCTYPE html><html><head><title>Yo'naltiruvchilar Hisoboti — Marjona Med Service</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 15px; color: #0f172a; background: #fff; line-height: 1.35; font-size: 11.5px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
        .header h2 { margin: 3px 0 0; font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; }
        .header p { margin: 3px 0 0; font-size: 12px; font-weight: bold; color: #475569; }
        .sec-title { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-top: 15px; margin-bottom: 6px; border-bottom: 2px solid #0f172a; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; }
        th { border: 1px solid #64748b; padding: 5px 7px; background: #f8fafc; font-weight: 900; text-align: left; }
        td { border: 1px solid #cbd5e1; padding: 5px 7px; }
        .summary-box { border: 2px solid #0f172a; background: #f8fafc; padding: 12px; margin-top: 10px; margin-bottom: 16px; border-radius: 4px; }
        .sum-line { font-size: 12.5px; font-weight: 900; margin-bottom: 4px; display: flex; justify-content: space-between; }
        .signatures { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11.5px; }
        .sig-line { width: 44%; border-top: 1.5px solid #000; text-align: center; padding-top: 4px; font-weight: 900; }
        .referrer-page { page-break-inside: avoid; break-inside: avoid; margin-top: 45px; margin-bottom: 45px; padding-bottom: 16px; border-bottom: 1px dashed #cbd5e1; }
        @media print { body { padding: 0; } @page { size: A4; margin: 8mm; } }
      </style></head><body>
      <div class="header">
        <h1>MARJONA MED SERVICE</h1>
        <h2>BARCHA YO'NALTIRUVCHILARNING UMUMIY HISOB-KITOB HISOBOTI</h2>
        <p>Davr: ${dateFrom} — ${dateTo}</p>
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
      </body></html>`

    printWindow.document.write(fullHtml)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
  }

  const renderReferrersSection = () => {
    const isCollapsed = collapsedSections['referrers']
    const payouts = referrersReport?.referrers_payout || []
    const grandPatients = payouts.reduce((acc, r) => acc + (r.patient_count || 0), 0)
    const grandGross = payouts.reduce((acc, r) => acc + (r.gross_total || 0), 0)
    const grandEarned = payouts.reduce((acc, r) => acc + (r.earned_commission || 0), 0)
    const grandNet = payouts.reduce((acc, r) => acc + (r.net_payable || 0), 0)

    return (
      <div className="card p-6 space-y-4 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => toggleSection('referrers')}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            {isCollapsed ? <ChevronDown className="h-5 w-5 text-cyan" /> : <ChevronUp className="h-5 w-5 text-cyan" />}
            <h3 className="text-sm font-black text-gold uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan" /> 3. Yo'naltiruvchilar Hisob-Kitobi ({payouts.length} nafar)
            </h3>
          </button>

          <div className="flex flex-wrap gap-2 items-center">
            <Btn variant="gold" size="xs" icon={Icons.printer} onClick={handlePrintReferrersDetailed}>
              🖨️ Mukammal Hisobotni Chop Etish
            </Btn>
            <button type="button" onClick={handleDownloadReferrersPdf} className="btn-outline py-1 px-3 text-xs font-bold text-cyan hover:text-body">
              📄 PDF Mukammal Hisobot
            </button>
            <button type="button" onClick={() => handleExportExcel('referrers')} className="btn-outline py-1 px-3 text-xs font-bold">
              Excel
            </button>
            <button
              type="button"
              onClick={() => toggleSection('referrers')}
              className="btn-outline py-1 px-2 text-xs font-bold text-muted hover:text-gold"
              title={isCollapsed ? "Kattalashtirish (Ochish)" : "Yig'ish (Kichiklashtirish)"}
            >
              {isCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="space-y-4 animate-fadeIn">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <THead cols={['#', 'Yo\'naltiruvchi F.I.Sh', 'Bemorlar', 'Jami Tushum', 'Ishlangan Ulush', 'Avans (-)', 'Sof To\'lanadigan', 'Bemorlar Ro\'yxati']} />
                <tbody className="divide-y divide-border">
                  {payouts.length === 0 ? (
                    <tr><td colSpan={8} className="py-6 text-center text-muted italic">Ushbu davrda yo'naltiruvchilar ma'lumoti yo'q</td></tr>
                  ) : payouts.map((r, i) => (
                    <>
                      <tr key={r.referrer_id} className="hover:bg-surface-hover font-semibold">
                        <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                        <td className="p-2.5 text-body font-bold">{r.name} <span className="text-muted text-[10px]">({r.phone || '—'})</span></td>
                        <td className="p-2.5 text-center font-mono font-bold text-cyan">{r.patient_count} nafar</td>
                        <td className="p-2.5 text-right font-mono text-muted">{formatMoney(r.gross_total)}</td>
                        <td className="p-2.5 text-right font-mono text-gold font-bold">{formatMoney(r.earned_commission)}</td>
                        <td className="p-2.5 text-right font-mono text-rose-400">{r.advance_deducted > 0 ? `-${formatMoney(r.advance_deducted)}` : '0'}</td>
                        <td className="p-2.5 text-right font-mono text-emerald font-black">{formatMoney(r.net_payable)}</td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedRefId(expandedRefId === r.referrer_id ? null : r.referrer_id)}
                            className="btn-outline py-0.5 px-2 text-[11px] font-bold text-cyan"
                          >
                            {expandedRefId === r.referrer_id ? "Yopish ▲" : "Bemorlar ▼"}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Patient List for each Referrer */}
                      {expandedRefId === r.referrer_id && (
                        <tr key={`exp-${r.referrer_id}`} className="bg-surface-1/60">
                          <td colSpan={8} className="p-4">
                            <div className="card p-3 border-cyan/30 space-y-2">
                              <h4 className="text-xs font-black text-cyan uppercase flex items-center justify-between">
                                <span>📋 {r.name} yuborgan bemorlar ro'yxati</span>
                                <span>Jami ulush: {formatMoney(r.earned_commission)}</span>
                              </h4>
                              <table className="w-full text-[11px] border border-border">
                                <thead className="bg-surface-2 text-muted uppercase font-mono">
                                  <tr>
                                    <th className="p-1.5 border border-border text-center">#</th>
                                    <th className="p-1.5 border border-border text-center">Sana va vaqt</th>
                                    <th className="p-1.5 border border-border">Bemor F.I.Sh</th>
                                    <th className="p-1.5 border border-border">Xizmat nomi</th>
                                    <th className="p-1.5 border border-border text-right">Xizmat Narxi</th>
                                    <th className="p-1.5 border border-border text-center">Belgilangan Ulush</th>
                                    <th className="p-1.5 border border-border text-right">Hisoblangan Ulush</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {(!r.patients || r.patients.length === 0) ? (
                                    <tr><td colSpan={7} className="p-2 text-center text-muted">Bemorlar topilmadi</td></tr>
                                  ) : r.patients.map((p, pIdx) => (
                                    <tr key={pIdx} className="hover:bg-white/5">
                                      <td className="p-1.5 text-center font-mono text-muted">{pIdx + 1}</td>
                                      <td className="p-1.5 text-center font-mono">{p.date || '—'}</td>
                                      <td className="p-1.5 font-bold text-body">{p.patient_name}</td>
                                      <td className="p-1.5 text-muted">{p.service_name}</td>
                                      <td className="p-1.5 text-right font-mono font-bold">{formatMoney(p.payment_amount)}</td>
                                      <td className="p-1.5 text-center font-mono font-bold text-gold">{p.rate_label || '10%'}</td>
                                      <td className="p-1.5 text-right font-mono font-bold text-cyan">{formatMoney(p.referrer_fee)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>

                {/* Overall Grand Total Row at bottom */}
                {payouts.length > 0 && (
                  <tfoot>
                    <tr className="bg-surface-2 font-black text-xs border-t-2 border-gold">
                      <td colSpan={2} className="p-3 text-gold uppercase">UMUMIY JAMI (BARCHA YO'NALTIRUVCHILAR):</td>
                      <td className="p-3 text-center text-cyan font-mono">{grandPatients} nafar</td>
                      <td className="p-3 text-right font-mono text-muted">{formatMoney(grandGross)}</td>
                      <td className="p-3 text-right font-mono text-gold">{formatMoney(grandEarned)}</td>
                      <td className="p-3"></td>
                      <td className="p-3 text-right font-mono text-emerald font-black text-sm">{formatMoney(grandNet)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderPayrollSection = () => {
    const isCollapsed = collapsedSections['payroll']
    return (
      <div className="card p-6 space-y-4 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => toggleSection('payroll')}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            {isCollapsed ? <ChevronDown className="h-5 w-5 text-amber" /> : <ChevronUp className="h-5 w-5 text-amber" />}
            <h3 className="text-sm font-black text-gold uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber" /> 4. Shifokorlar va Xodimlar Maosh Qaydnomasi
            </h3>
          </button>

          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={() => handleExportExcel('payroll')} className="btn-outline py-1 px-3 text-xs font-bold">
              Excel
            </button>
            <button
              type="button"
              onClick={() => toggleSection('payroll')}
              className="btn-outline py-1 px-2 text-xs font-bold text-muted hover:text-gold"
              title={isCollapsed ? "Kattalashtirish (Ochish)" : "Yig'ish (Kichiklashtirish)"}
            >
              {isCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="overflow-x-auto animate-fadeIn">
            <table className="w-full text-xs">
              <THead cols={['#', 'Xodim / Shifokor F.I.Sh', 'Lavozimi / Xona', 'Mijozlar', 'Jami Tushum', 'Fiksa Maosh', 'KPI / Ulush (%)', 'Jami Ishlangan (=)', 'Avanslar (-)', 'Qo\'lga Tegadigan Maosh (=)']} />
              <tbody className="divide-y divide-border">
                {[...(payrollData?.doctors || []), ...(payrollData?.staff || [])].map((d, i) => {
                  const fixedSalary = d.fixed_salary || 0
                  const kpiEarned = d.kpi_earned ?? ((d.doctor_share || 0) - fixedSalary)
                  const totalEarned = d.doctor_share || (fixedSalary + Math.max(0, kpiEarned))
                  return (
                    <tr key={i} className="hover:bg-surface-hover font-semibold">
                      <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                      <td className="p-2.5 text-body font-bold">{d.name}</td>
                      <td className="p-2.5 text-muted">{d.role} ({d.cabinet || '—'})</td>
                      <td className="p-2.5 text-center font-mono font-bold text-cyan">{d.patients_count || 0} nafar</td>
                      <td className="p-2.5 text-right font-mono text-muted">{formatMoney(d.total_income || 0)}</td>
                      <td className="p-2.5 text-right font-mono text-blue-300 font-bold">{fixedSalary > 0 ? formatMoney(fixedSalary) : '—'}</td>
                      <td className="p-2.5 text-right font-mono text-cyan font-bold">{kpiEarned > 0 ? formatMoney(kpiEarned) : '—'}</td>
                      <td className="p-2.5 text-right font-mono text-gold font-black">{formatMoney(totalEarned)}</td>
                      <td className="p-2.5 text-right font-mono text-rose-400">{d.advances > 0 ? `-${formatMoney(d.advances)}` : '0'}</td>
                      <td className="p-2.5 text-right font-mono text-emerald font-black text-sm">{formatMoney(d.net_salary || 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const renderInventorySection = () => {
    const isCollapsed = collapsedSections['inventory']
    const usedMaterials = reportsData?.materials_used_breakdown || []
    const totalMatIncome = reportsData?.total_material_income || 0
    const totalMatCost = reportsData?.total_material_cost || 0
    const totalMatProfit = reportsData?.total_material_profit || 0
    const totalMatQty = reportsData?.total_material_quantity || 0

    return (
      <div className="card p-6 space-y-6 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => toggleSection('inventory')}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            {isCollapsed ? <ChevronDown className="h-5 w-5 text-purple-400" /> : <ChevronUp className="h-5 w-5 text-purple-400" />}
            <h3 className="text-sm font-black text-gold uppercase tracking-wider flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-400" /> 5. Omborxona & Ishlatilgan Materiallar Statistikasi va Sof Foyda
            </h3>
          </button>

          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={() => handleExportExcel('inventory')} className="btn-outline py-1 px-3 text-xs font-bold">
              Excel (Foyda & Tushum)
            </button>
            <button
              type="button"
              onClick={() => toggleSection('inventory')}
              className="btn-outline py-1 px-2 text-xs font-bold text-muted hover:text-gold"
              title={isCollapsed ? "Kattalashtirish (Ochish)" : "Yig'ish (Kichiklashtirish)"}
            >
              {isCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="space-y-6 animate-fadeIn">
            {/* KPI Summary Cards for Consumed Materials & Profit */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="stat-card border-purple-500/30 bg-purple-500/5 p-3">
                <span className="text-[11px] font-bold text-purple-400 uppercase">Jami Sarflangan Miqdor</span>
                <p className="text-xl font-black text-purple-400 font-mono mt-1">{totalMatQty} dona</p>
              </div>

              <div className="stat-card border-cyan-500/30 bg-cyan-500/5 p-3">
                <span className="text-[11px] font-bold text-cyan-400 uppercase">Jami Tushum (Kassa)</span>
                <p className="text-xl font-black text-cyan-400 font-mono mt-1">{formatMoney(totalMatIncome)}</p>
              </div>

              <div className="stat-card border-amber-500/30 bg-amber-500/5 p-3">
                <span className="text-[11px] font-bold text-amber-400 uppercase">Tan Narxi Summasi</span>
                <p className="text-xl font-black text-amber-400 font-mono mt-1">{formatMoney(totalMatCost)}</p>
              </div>

              <div className="stat-card border-emerald-500/40 bg-emerald-500/10 p-3">
                <span className="text-[11px] font-bold text-emerald uppercase">Materiallardan Sof Foyda</span>
                <p className="text-xl font-black text-emerald font-mono mt-1">+{formatMoney(totalMatProfit)}</p>
              </div>
            </div>

            {/* Table 1: Used Materials Breakdown with Cost Price & Profit in Period */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-gold uppercase tracking-wider flex items-center gap-1.5">
                💊 Ushbu Davrda Ishlatilgan Materiallar, Tan Narxi va Sof Foyda Hisob-Kitobi ({dateFrom} — {dateTo})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <THead cols={['#', 'Material Nomi', 'Ishlatilgan Miqdor', 'Sotilish Narxi', 'Tan Narxi', 'Jami Tushum', 'Tan Narx Summasi', 'Sof Foyda']} />
                  <tbody className="divide-y divide-border">
                    {usedMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-muted italic">
                          Ushbu tanlangan davrda materiallar ishlatilmagan
                        </td>
                      </tr>
                    ) : (
                      usedMaterials.map((m, i) => (
                        <tr key={i} className="hover:bg-surface-hover font-semibold">
                          <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                          <td className="p-2.5 text-body font-extrabold">{m.name}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-purple-400">{m.quantity_used} dona</td>
                          <td className="p-2.5 text-right font-mono text-gold">{formatMoney(m.unit_price || 0)}</td>
                          <td className="p-2.5 text-right font-mono text-amber-400">{formatMoney(m.cost_price || 0)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-cyan-400">{formatMoney(m.total_income)}</td>
                          <td className="p-2.5 text-right font-mono text-muted">{formatMoney(m.total_cost || 0)}</td>
                          <td className="p-2.5 text-right font-mono font-black text-emerald text-sm">
                            +{formatMoney(m.profit || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                    {usedMaterials.length > 0 && (
                      <tr className="bg-surface-2 font-black border-t-2 border-border">
                        <td className="p-2.5"></td>
                        <td className="p-2.5 text-gold uppercase">JAMI MATERIALLAR FOYDASI</td>
                        <td className="p-2.5 text-center font-mono text-purple-400">{totalMatQty} dona</td>
                        <td className="p-2.5"></td>
                        <td className="p-2.5"></td>
                        <td className="p-2.5 text-right font-mono text-cyan-400 text-sm">{formatMoney(totalMatIncome)}</td>
                        <td className="p-2.5 text-right font-mono text-amber-400 text-sm">{formatMoney(totalMatCost)}</td>
                        <td className="p-2.5 text-right font-mono text-emerald text-base font-black">+{formatMoney(totalMatProfit)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Current Inventory Stock Level */}
            <div className="space-y-2 pt-4 border-t border-border">
              <h4 className="text-xs font-extrabold text-gold uppercase tracking-wider flex items-center gap-1.5">
                📦 Omborxona Joriy Qoldiqlari Katalogi ({inventoryData.length} turdagi)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <THead cols={['#', 'Material Nomi', 'Qoldiq Miqdor', 'Birlik Narxi', 'Ombordagi Qiymati', 'Holati']} />
                  <tbody className="divide-y divide-border">
                    {inventoryData.map((item, i) => {
                      const isLow = item.qty <= item.min_qty
                      return (
                        <tr key={item.id} className="hover:bg-surface-hover font-semibold">
                          <td className="p-2.5 text-muted font-mono">#{i + 1}</td>
                          <td className="p-2.5 text-body font-bold">{item.name}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{item.qty} {item.unit}</td>
                          <td className="p-2.5 text-right font-mono text-muted">{formatMoney(item.unit_price)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald font-bold">{formatMoney(item.qty * item.unit_price)}</td>
                          <td className="p-2.5">
                            {isLow ? (
                              <span className="badge badge-danger font-bold">⚠️ Tugamoqda</span>
                            ) : (
                              <span className="badge badge-success font-bold">✓ Yetarli</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <PageHeader
        title="📊 Klinika Barcha Hisobotlari va Moliya Markazi"
        subtitle="Rahbariyat uchun klinikaning jamiki tushum, chiqim, maosh, yo'naltiruvchi va ombor hisobotlari bir joyda"
        backTo={homePath}
      />

      {/* ── PROMINENT MASTER PRINT & DATE CONTROL BAR (ONE SLEEK CARD) ── */}
      <div className="card p-4 border-gold/40 bg-gold/5 flex flex-col gap-3 shadow-lg">

        {/* Row 1: Quick Presets & Custom Date Range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gold uppercase mr-1">TEZKOR DAVR:</span>
          {[
            { id: 'today', label: '☀️ Bugun' },
            { id: 'yesterday', label: '📅 Kecha' },
            { id: 'week', label: '7 Kun' },
            { id: '10day', label: '10-Kunlik' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleQuickPreset(p.id)}
              className={`py-1.5 px-3 rounded-xl font-extrabold text-xs transition-all ${
                activePreset === p.id
                  ? 'bg-gold text-slate-950 shadow-md scale-105 ring-2 ring-gold'
                  : 'btn-outline text-body hover:bg-surface-2'
              }`}
            >
              {p.label}
            </button>
          ))}

          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              className="input-field text-xs font-bold py-1.5 max-w-[140px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => { try { e.target.showPicker?.() } catch (_) {} }}
            />
            <span className="text-muted font-bold text-xs">—</span>
            <input
              type="date"
              className="input-field text-xs font-bold py-1.5 max-w-[140px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onClick={(e) => { try { e.target.showPicker?.() } catch (_) {} }}
            />
            <button
              type="button"
              className="btn-gold py-1.5 px-3 text-xs font-bold flex items-center gap-1"
              onClick={() => fetchWithDates(dateFrom, dateTo)}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
          </div>
        </div>

        {/* Row 2: Any Month / Year / Week — not just the current one */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gold/20">
          <span className="text-xs font-bold text-gold uppercase mr-1">ANIQ DAVR:</span>
          <select
            className="input-field text-xs font-bold py-1.5 max-w-[130px]"
            value={pickMonth}
            onChange={(e) => setPickMonth(+e.target.value)}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            className="input-field text-xs font-bold py-1.5 max-w-[90px]"
            value={pickYear}
            onChange={(e) => setPickYear(+e.target.value)}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="button" onClick={handleMonthPick} className="btn-outline py-1.5 px-3 text-xs font-bold whitespace-nowrap">
            📅 Oyni ko'rsatish
          </button>
          <button type="button" onClick={handleYearPick} className="btn-outline py-1.5 px-3 text-xs font-bold whitespace-nowrap">
            🗓️ Butun yilni ko'rsatish
          </button>

          <div className="w-px h-6 bg-gold/20 hidden sm:block" />

          <span className="text-xs text-muted font-bold whitespace-nowrap">Hafta bo'yicha:</span>
          <input
            type="week"
            className="input-field text-xs font-bold py-1.5 max-w-[160px]"
            value={pickWeek}
            onChange={(e) => handleWeekPick(e.target.value)}
          />
        </div>

        {/* Row 3: Master Print & Expand/Collapse Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gold/20">
          {activeTab === 'all' && (
            <>
              <button
                type="button"
                onClick={expandAllSections}
                className="btn-outline py-2 px-3 text-xs font-bold text-emerald border-emerald/30 hover:bg-emerald/10 flex items-center gap-1"
                title="Barcha bo'limlarni birdaniga yoyib ko'rsatish"
              >
                <Maximize2 className="h-3.5 w-3.5" /> Barchasini Yoyish (Ochish)
              </button>
              <button
                type="button"
                onClick={collapseAllSections}
                className="btn-outline py-2 px-3 text-xs font-bold text-muted border-border hover:bg-surface-2 flex items-center gap-1"
                title="Barcha bo'limlarni ixcham yig'ib qo'yish"
              >
                <Minimize2 className="h-3.5 w-3.5" /> Barchasini Yig'ish
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handlePrintDailySummary}
            className="btn-gold py-2 px-3.5 text-xs font-black flex items-center gap-1.5 shadow-md scale-105"
          >
            🖨️ KUNLIK HISOBOTNI CHOP ETISH
          </button>

          <button
            type="button"
            onClick={handlePrintAllConsolidated}
            className="btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1 text-gold border-gold/40"
          >
            🖨️ BARCHASINI CHOP ETISH (1 TA BLANKA)
          </button>

          <button
            type="button"
            onClick={handleSendTelegramReport}
            disabled={sendingTelegram}
            className="btn-cyan py-2 px-3.5 text-xs font-black flex items-center gap-1.5 shadow-md"
            title="Kunlik hisobotni Telegram Bot orqali darhol uzatish"
          >
            📱 TELEGRAMGA HISOBOT YUBORISH {sendingTelegram && '...'}
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1 border-cyan/30 text-cyan hover:bg-cyan/10"
          >
            📄 PDF SAQLASH
          </button>
        </div>
      </div>

      {/* ── MAIN UNIFIED TABS SWITCHER ────────────────────────────── */}
      <div className="card p-2 flex flex-wrap gap-2 border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all flex-1 min-w-[130px] justify-center ${
                isActive
                  ? 'bg-gold text-slate-950 shadow-lg font-black scale-[1.02]'
                  : 'bg-surface-2 text-body hover:bg-surface-hover border border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── CONTINUOUS ALL-IN-ONE PAGE VIEW (When activeTab === 'all') ── */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          {renderFinanceSection()}
          {renderExpensesSection()}
          {renderReferrersSection()}
          {renderPayrollSection()}
          {renderInventorySection()}
          <CeoSavedReports />
        </div>
      )}

      {/* ── INDIVIDUAL FILTERED TAB VIEWS ─────────────────────────── */}
      {activeTab === 'finance' && renderFinanceSection()}
      {activeTab === 'expenses' && renderExpensesSection()}
      {activeTab === 'referrers' && renderReferrersSection()}
      {activeTab === 'payroll' && renderPayrollSection()}
      {activeTab === 'inventory' && renderInventorySection()}
      {activeTab === 'saved_reports' && <CeoSavedReports />}

      {/* ── EXPENSE MODAL ────────────────────────────────────────── */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Yangi Harajat Kiritish">
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted block mb-1">Kategoriya:</label>
            <select
              className="input-field text-xs font-bold"
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            >
              {['Kommunal', 'Arenda/Ijara', 'Reklama', 'Ombor/Material', 'Apreka/Dorixona', 'Boshqa'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted block mb-1">Harajat Summasi (so'm):</label>
            <input
              type="number"
              className="input-field font-mono font-bold text-sm"
              placeholder="Masalan: 500000"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted block mb-1">Izoh / Sabab:</label>
            <textarea
              className="input-field text-xs"
              rows={3}
              placeholder="Harajat haqida batafsil izoh..."
              value={expenseForm.note}
              onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-outline flex-1 text-xs" onClick={() => setExpenseModal(false)}>
              Bekor Qilish
            </button>
            <button type="submit" disabled={savingExpense} className="btn-gold flex-1 text-xs font-bold">
              {savingExpense ? 'Saqlanmoqda...' : '✓ Saqlash'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── INCASSATION MODAL ────────────────────────────────────── */}
      <IncassationModal
        open={incassationModal}
        onClose={() => {
          setIncassationModal(false)
          fetchWithDates(dateFrom, dateTo)
        }}
      />

    </div>
  )
}
