import { Printer, X, FileText, Stethoscope } from 'lucide-react'
import { BRAND } from '../config/brand'
import { birthYear } from '../utils/format'

export default function MedicalReportModal({ patient, doctorName, specialization, onClose }) {
  if (!patient) return null

  const handlePrint = () => {
    window.print()
  }

  const createdDate = new Date().toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto overscroll-contain">
      {/* ── PRINT-ONLY STYLES (A4 / Blank Print) ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #medical-report-container, #medical-report-container * {
            visibility: visible !important;
          }
          #medical-report-container {
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-slate-600 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="no-print mb-4 flex items-center gap-3 p-3.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 rounded-2xl text-cyan-900 dark:text-cyan-200">
          <Stethoscope className="h-6 w-6 text-cyan-600 shrink-0" />
          <div className="text-xs">
            <strong className="block text-sm">Shifokor ko'rik xulosasi va Retsept blankasi</strong>
            Shifokor blankasini qog'ozga chop etib bemorga berishingiz mumkin.
          </div>
        </div>

        {/* ── PRINTABLE MEDICAL REPORT CONTENT AREA ────────────────── */}
        <div
          id="medical-report-container"
          className="bg-white text-slate-900 p-8 rounded-2xl border border-slate-300 shadow-sm space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-cyan-600">
            <div>
              <h1 className="text-2xl font-black tracking-wide text-cyan-700 uppercase">MARJONA MED SERVICE</h1>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">Tibbiy Klinika va Diagnostika Markazi</p>
              <p className="text-xs text-slate-700 mt-0.5">Manzil: Toshkent sh. | Tel: {BRAND.phone}</p>
            </div>
            <div className="text-right font-mono text-xs text-slate-500">
              <span className="block font-bold text-slate-800 text-sm">TIBBIY XULOSA № {patient.ticket_number || patient.id}</span>
              <span>Sana: {createdDate}</span>
            </div>
          </div>

          {/* Patient & Doctor Banner */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-700 uppercase tracking-wider font-bold block text-[10px]">BEMOR MA'LUMOTLARI</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">{patient.first_name} {patient.last_name}</p>
              <p className="text-slate-600">📞 Tel: <strong>{patient.phone}</strong></p>
              {patient.birth_date && <p className="text-slate-600">📅 Tug'ilgan yili: <strong>{birthYear(patient.birth_date)}</strong></p>}
            </div>

            <div>
              <span className="text-slate-700 uppercase tracking-wider font-bold block text-[10px]">QABUL KILGAN SHIFOKOR</span>
              <p className="text-sm font-black text-cyan-800 mt-0.5">{doctorName || patient.provider_name || 'Shifokor'}</p>
              <p className="text-slate-600">🩺 Mutaxassislik: <strong>{specialization || 'Shifokor'}</strong></p>
              <p className="text-slate-600">📋 Xizmat turi: <strong>{patient.service_name || 'Umumiy ko\'rik'}</strong></p>
            </div>
          </div>

          {/* COMPLAINTS SECTION */}
          {patient.complaints && (
            <div className="space-y-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                📌 BEMOR SHIKOYATLARI (ANAMNEZ):
              </h3>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed">
                {patient.complaints}
              </div>
            </div>
          )}

          {/* DIAGNOSIS SECTION */}
          <div className="space-y-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-800 flex items-center gap-1">
              🩺 TASHXIS (DIAGNOSIS):
            </h3>
            <div className="p-3.5 bg-cyan-50/60 rounded-xl border border-cyan-200 text-xs font-bold text-slate-900 leading-relaxed">
              {patient.diagnosis || "Klinik ko'rik natijasiga ko'ra sog'lom"}
            </div>
          </div>

          {/* PRESCRIPTION / RECOMMENDATIONS SECTION */}
          <div className="space-y-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              💊 TAVSIYALAR VA RETSEPT (TREATMENT PLAN):
            </h3>
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-slate-900 leading-relaxed font-mono whitespace-pre-line min-h-[100px]">
              {patient.prescription || "— Muayyan dori-darmonlar tayinlanmadi —"}
            </div>
          </div>

          {/* Signatures & Stamp */}
          <div className="pt-8 flex justify-between items-end text-xs text-slate-700">
            <div>
              <p className="font-bold">{BRAND.name} — Klinika Muhr O'rni:</p>
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-600 mt-2">
                [ MUHR ]
              </div>
            </div>

            <div className="text-right">
              <p className="font-bold">Shifokor imzosi:</p>
              <div className="w-48 border-b-2 border-slate-800 mt-8 mb-1" />
              <p className="font-bold text-slate-900">{doctorName || patient.provider_name || 'Shifokor'}</p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="no-print mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-all"
          >
            Yopish
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition-all transform active:scale-95"
          >
            <Printer className="h-4 w-4" />
            🖨️ Blankani chop etish (Print)
          </button>
        </div>
      </div>
    </div>
  )
}
