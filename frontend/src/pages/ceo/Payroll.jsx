import { useEffect, useState } from 'react'
import { DollarSign, Printer, Download, Users, Wallet, FileText } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { exportToExcel, exportToPdf } from '../../utils/exportUtils'
import { useToastStore } from '../../store/toastStore'

export default function Payroll() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [activeTab, setActiveTab] = useState('doctors') // 'doctors' | 'staff' | 'ten_day'
  const [tenDayData, setTenDayData] = useState(null)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 9)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const toast = useToastStore((s) => s.add)

  const loadPayroll = () => {
    setLoading(true)
    api(`/payroll?year=${year}&month=${month}`)
      .then((res) => setData(res))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  const loadTenDay = () => {
    api(`/reports/ten-day?from=${fromDate}&to=${toDate}`)
      .then(setTenDayData)
      .catch((e) => toast(e.message, 'error'))
  }

  useEffect(() => {
    loadPayroll()
  }, [year, month])

  useEffect(() => {
    if (activeTab === 'ten_day') {
      loadTenDay()
    }
  }, [activeTab, fromDate, toDate])

  const handleSaveTenDayPdf = async () => {
    try {
      await api(`/reports/save-ten-day?from=${fromDate}&to=${toDate}`, { method: 'POST' })
      toast("10-kunlik hisobot saqlandi va PDF bazaga joylandi ✓")
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const handlePrintAllDoctorsConsolidated = () => {
    if (!data) return
    const allRows = [...(data.doctors || []), ...(data.staff || [])]
    if (allRows.length === 0) {
      toast("Chop etish uchun xodimlar ma'lumoti yo'q", "error")
      return
    }

    const printWindow = window.open('', '_blank', 'width=900,height=900')
    const rowsHtml = allRows.map((r, idx) => `
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${r.name}</td>
        <td style="border: 1px solid #000; padding: 6px;">${r.role || 'Shifokor'} (${r.cabinet || '—'})</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${r.patients_count || 0} nafar</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right;">${formatMoney(r.total_income || 0)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatMoney(r.doctor_share || 0)}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; color: red;">${r.advances > 0 ? '-' + formatMoney(r.advances) : '0'}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: bold;">${formatMoney(r.net_salary || 0)}</td>
      </tr>
    `).join('')

    const totalIncomeSum = allRows.reduce((a, r) => a + (r.total_income || 0), 0)
    const totalShareSum = allRows.reduce((a, r) => a + (r.doctor_share || 0), 0)
    const totalAdvanceSum = allRows.reduce((a, r) => a + (r.advances || 0), 0)
    const totalNetSum = allRows.reduce((a, r) => a + (r.net_salary || 0), 0)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcha Shifokorlar va Xodimlar Umumiy Maosh Qaydnomasi</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
            .header h2 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 12px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
            th { border: 1px solid #000; padding: 8px; background: #f0f0f0; font-weight: bold; text-align: left; }
            td { border: 1px solid #000; padding: 6px 8px; }
            .total-row td { font-weight: 900; background: #f9f9f9; font-size: 12px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
            .sig-line { width: 40%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-weight: bold; }
            @media print { body { padding: 0; } @page { margin: 10mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>MARJONA MED SERVICE</h2>
            <p>BARCHA SHIFOKORLAR VA XODIMLARNING UMUMIY MAOSH QAYDNOMASI</p>
            <p style="font-size: 11px; margin-top: 2px;">Davr: ${year}-yil, ${month}-oy</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 30px;">#</th>
                <th>Xodim / Shifokor F.I.SH</th>
                <th>Lavozimi / Mutaxassisligi</th>
                <th style="text-align: center;">Mijozlar Soni</th>
                <th style="text-align: right;">Jami Tushum</th>
                <th style="text-align: right;">Ishlangan Ulush (Maosh)</th>
                <th style="text-align: right;">Avanslar (-)</th>
                <th style="text-align: right;">Qo'lga Tegadigan Maosh (=)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">JAMI UMUMIY SUMMA:</td>
                <td style="text-align: center;">${allRows.reduce((a, r) => a + (r.patients_count || 0), 0)} nafar</td>
                <td style="text-align: right;">${formatMoney(totalIncomeSum)}</td>
                <td style="text-align: right;">${formatMoney(totalShareSum)}</td>
                <td style="text-align: right; color: red;">-${formatMoney(totalAdvanceSum)}</td>
                <td style="text-align: right;">${formatMoney(totalNetSum)}</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-line">Bosh Shifokor / Direktor Imzosi</div>
            <div class="sig-line">Bosh Hisobchi Imzosi</div>
          </div>
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

  const handlePrint = () => {
    window.print()
  }

  const handleExcelExport = () => {
    if (!data) return
    const rows = [...(data.doctors || []), ...(data.staff || [])].map((r) => ({
      "F.I.Sh": r.name,
      "Lavozimi / Xona": `${r.role} (${r.cabinet})`,
      "Mijozlar Soni": r.patients_count,
      "Jami Tushum": r.total_income,
      "Hissi / Maoshi": r.doctor_share,
      "Avanslar (-)": r.advances,
      "Qo'lga Tegadigan Maosh (=)": r.net_salary,
    }))
    exportToExcel(rows, `Oylik_Maosh_Qaydnomasi_${month}_${year}`)
  }

  const handlePdfExport = () => {
    if (!data) return
    const rows = [...(data.doctors || []), ...(data.staff || [])]
    const columns = [
      { header: 'F.I.Sh', accessor: (r) => r.name },
      { header: 'Lavozim', accessor: (r) => r.role },
      { header: 'Mijozlar', accessor: (r) => r.patients_count },
      { header: 'Hissi', accessor: (r) => formatMoney(r.doctor_share) },
      { header: 'Avanslar (-)', accessor: (r) => formatMoney(r.advances) },
      { header: 'Yakuniy Maosh (=)', accessor: (r) => formatMoney(r.net_salary) },
    ]
    exportToPdf(`OYLIK MAOSH QAYDNOMASI (${month}/${year})`, rows, columns)
  }

  const doctors = data?.doctors || []
  const staff = data?.staff || []
  const activeRows = activeTab === 'doctors' ? doctors : staff

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* PRINT-ONLY STYLES */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #payroll-print-container, #payroll-print-container * {
            visibility: visible !important;
          }
          #payroll-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 15mm !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, sans-serif !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gold flex items-center gap-2">
            <DollarSign className="h-6 w-6" /> Oylik Maosh Kalkulyatori va Qaydnomasi
          </h1>
          <p className="text-xs text-muted mt-1">Shifokorlar (50/50 split) va xodimlarning oylik maoshini avanslar bilan hisoblash</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExcelExport}
            className="btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
          <button
            type="button"
            onClick={handlePdfExport}
            className="btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button
            type="button"
            onClick={handlePrintAllDoctorsConsolidated}
            className="btn-gold py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-lg"
          >
            <Printer className="h-4 w-4" /> 🖨️ Barcha Shifokor va Xodimlarni Birga Chop Etish (1 TA BLANKA)
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="no-print card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted">Davrni tanlang:</span>
          <select
            className="input-field text-xs font-bold max-w-[120px]"
            value={year}
            onChange={(e) => setYear(+e.target.value)}
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}-yil</option>
            ))}
          </select>

          <select
            className="input-field text-xs font-bold max-w-[140px]"
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
          >
            {[
              "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
              "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
            ].map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-right text-muted font-bold">
          Jami Maosh Fondi: <span className="text-gold text-sm font-black font-mono ml-1">{formatMoney(data?.total_payroll || 0)}</span>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card bg-gold/10 border border-gold/30 p-4">
          <span className="text-xs font-bold text-gold uppercase tracking-wider block mb-1">
            💵 Jami To'lanadigan Maosh Fondi
          </span>
          <p className="text-3xl font-black text-gold font-mono">
            {formatMoney(data?.total_payroll || 0)}
          </p>
          <span className="text-[10px] text-muted mt-1 block">Avanslar chegirib tashlangandan so'ng</span>
        </div>

        <div className="card bg-rose-500/10 border border-rose-500/30 p-4">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block mb-1">
            💳 Ushlab Qolingan Avanslar (Bu oy)
          </span>
          <p className="text-3xl font-black text-rose-400 font-mono">
            {formatMoney(data?.total_advances || 0)}
          </p>
          <span className="text-[10px] text-muted mt-1 block">Xodimlarga oldindan berilgan mablag'lar</span>
        </div>
      </div>

      {/* PRINTABLE & SCREEN TABLE CONTAINER */}
      <div id="payroll-print-container" className="card p-6 space-y-4">
        {/* Printable Header */}
        <div className="hidden print:block pb-4 border-b-2 border-border text-center">
          <h1 className="text-2xl font-black uppercase text-slate-900">MARJONA MED SERVICE</h1>
          <h2 className="text-sm font-bold uppercase text-slate-600 mt-1">
            SHIFOKORLAR VA XODIMLAR OYLIK MAOSH QAYDNOMASI ({month}/{year})
          </h2>
          <p className="text-xs text-muted mt-0.5">Sana: {new Date().toLocaleDateString('uz-UZ')}</p>
        </div>

        {/* Tab Switcher */}
        <div className="no-print flex gap-2 border-b border-border pb-3 flex-wrap">
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'doctors' ? 'bg-gold text-slate-950 font-black shadow-md' : 'bg-muted/40 text-muted'
            }`}
            onClick={() => setActiveTab('doctors')}
          >
            🩺 Shifokorlar ({doctors.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'staff' ? 'bg-gold text-slate-950 font-black shadow-md' : 'bg-muted/40 text-muted'
            }`}
            onClick={() => setActiveTab('staff')}
          >
            👥 Yordamchi Xodimlar ({staff.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ten_day' ? 'bg-purple-600 text-white font-black shadow-md' : 'bg-muted/40 text-muted'
            }`}
            onClick={() => setActiveTab('ten_day')}
          >
            📆 10-Kunlik Foiz va Avanslar Hiisoboti
          </button>
        </div>

        {activeTab === 'ten_day' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap bg-purple-500/10 p-3 rounded-xl border border-purple-500/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-300">Davr:</span>
                <input
                  type="date"
                  className="input-field text-xs font-mono py-1 px-2"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <span className="text-xs text-muted">—</span>
                <input
                  type="date"
                  className="input-field text-xs font-mono py-1 px-2"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={handleSaveTenDayPdf}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
              >
                💾 Bazaga Saqlash & PDF Yaratish
              </button>
            </div>

            {/* Shifokorlar 10-kunlik to'lovlar */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">👨‍⚕️ Shifokorlar (50/50 Chegirmali Ulush)</h4>
              <div className="overflow-x-auto border border-border/60 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-2 text-body border-b border-border/40 text-left">
                      <th className="p-2.5">Shifokor</th>
                      <th className="p-2.5">Bemorlar</th>
                      <th className="p-2.5">Tushum</th>
                      <th className="p-2.5">Hisoblangan Foiz</th>
                      <th className="p-2.5">Avans Qoplovi (-)</th>
                      <th className="p-2.5 text-right">To'lanadigan (=)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tenDayData?.providers_payout || []).map((p) => (
                      <tr key={p.provider_id} className="border-b border-border/30 hover:bg-white/[0.02]">
                        <td className="p-2.5 font-bold text-foreground">{p.name} ({p.specialization})</td>
                        <td className="p-2.5 font-bold text-cyan-400">{p.patient_count} ta</td>
                        <td className="p-2.5 font-mono text-muted">{formatMoney(p.gross_total)}</td>
                        <td className="p-2.5 font-mono font-bold text-body">{formatMoney(p.earned_share)}</td>
                        <td className="p-2.5 font-mono text-rose-400 font-bold">
                          {p.advance_deducted > 0 ? `-${formatMoney(p.advance_deducted)}` : '0'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-emerald-400 text-sm">
                          {formatMoney(p.net_payable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yo'naltiruvchilar 10-kunlik to'lovlar */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">🤝 Yo'naltiruvchilar (Xizmat Foizlari)</h4>
              <div className="overflow-x-auto border border-border/60 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-2 text-body border-b border-border/40 text-left">
                      <th className="p-2.5">Yo'naltiruvchi</th>
                      <th className="p-2.5">Bemorlar</th>
                      <th className="p-2.5">Jami Summa</th>
                      <th className="p-2.5">Hisoblangan Foiz</th>
                      <th className="p-2.5">Avans Qoplovi (-)</th>
                      <th className="p-2.5 text-right">To'lanadigan (=)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tenDayData?.referrers_payout || []).map((r) => (
                      <tr key={r.referrer_id} className="border-b border-border/30 hover:bg-white/[0.02]">
                        <td className="p-2.5 font-bold text-foreground">{r.name}</td>
                        <td className="p-2.5 font-bold text-cyan-400">{r.patient_count} ta</td>
                        <td className="p-2.5 font-mono text-muted">{formatMoney(r.gross_total)}</td>
                        <td className="p-2.5 font-mono font-bold text-body">{formatMoney(r.earned_commission)}</td>
                        <td className="p-2.5 font-mono text-rose-400 font-bold">
                          {r.advance_deducted > 0 ? `-${formatMoney(r.advance_deducted)}` : '0'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-emerald-400 text-sm">
                          {formatMoney(r.net_payable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Payroll Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/20 text-left text-gold print:text-slate-900">
                    <th className="p-3">F.I.Sh</th>
                    <th className="p-3">Lavozimi / Xona</th>
                    <th className="p-3">Stavka / Oylik Turi</th>
                    <th className="p-3">Mijozlar Soni</th>
                    <th className="p-3">Jami Tushum</th>
                    <th className="p-3">Hisoblangan Maosh</th>
                    <th className="p-3">Avans (-)</th>
                    <th className="p-3 text-right">Qo'lga Tegadigan Maosh (=)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="p-4 text-center text-muted text-xs">Yuklanmoqda...</td></tr>
                  ) : activeRows.length === 0 ? (
                    <tr><td colSpan={8} className="p-4 text-center text-muted text-xs italic">Ushbu oyda xodimlar topilmadi</td></tr>
                  ) : (
                    activeRows.map((r) => (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20 text-xs">
                        <td className="p-3 font-bold text-foreground print:text-slate-900">{r.name}</td>
                        <td className="p-3 text-muted print:text-slate-700">{r.role} ({r.cabinet || '—'})</td>
                        <td className="p-3">
                          {r.fixed_salary > 0 && r.percent > 0 ? (
                            <span className="badge badge-gold font-mono text-[10px]">{formatMoney(r.fixed_salary)} + {r.percent}% KPI</span>
                          ) : r.fixed_salary > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">{formatMoney(r.fixed_salary)} (Oylik)</span>
                          ) : r.percent > 0 ? (
                            <span className="badge badge-gold font-mono text-[10px]">{r.percent}% (KPI)</span>
                          ) : (
                            <span className="text-muted text-[11px] italic">—</span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-cyan-400 print:text-slate-900">{r.patients_count} ta</td>
                        <td className="p-3 font-mono text-muted print:text-slate-700">{formatMoney(r.total_income)}</td>
                        <td className="p-3 font-mono font-bold text-body print:text-slate-900">{formatMoney(r.doctor_share)}</td>
                        <td className="p-3 font-mono text-rose-400 print:text-red-600 font-bold">
                          {r.advances > 0 ? `-${formatMoney(r.advances)}` : '0'}
                        </td>
                        <td className="p-3 text-right font-mono text-base font-black text-gold print:text-slate-900">
                          {formatMoney(r.net_salary)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Printable Signatures */}
        <div className="hidden print:flex pt-12 justify-between text-xs text-slate-800">
          <div>
            <p className="font-bold">Bosh Buxgalter Imzosi:</p>
            <div className="w-48 border-b border-border mt-8" />
          </div>
          <div>
            <p className="font-bold">Rahbar Imzosi:</p>
            <div className="w-48 border-b border-border mt-8" />
          </div>
        </div>
      </div>
    </div>
  )
}
