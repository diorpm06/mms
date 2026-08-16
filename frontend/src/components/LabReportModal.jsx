import { Printer, X, TestTube, CheckCircle2 } from 'lucide-react'

export default function LabReportModal({ patientName, testName, category, resultsJson, doctorName, createdDate, onClose }) {
  if (!resultsJson) return null

  let results = {}
  try {
    results = typeof resultsJson === 'string' ? JSON.parse(resultsJson) : resultsJson
  } catch (e) {
    results = { "Xulosa": String(resultsJson) }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto overscroll-contain">
      {/* ── PRINT-ONLY STYLES ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #lab-report-container, #lab-report-container * {
            visibility: visible !important;
          }
          #lab-report-container {
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

      <div className="bg-white text-slate-900 border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="no-print absolute top-4 right-4 p-2 rounded-xl text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ── PRINTABLE LAB REPORT AREA ────────────────── */}
        <div id="lab-report-container" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-cyan-600">
            <div>
              <h1 className="text-2xl font-black text-cyan-700 uppercase tracking-wide">MARJONA MED SERVICE</h1>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Laboratoriya va Diagnostika Markazi</p>
            </div>
            <div className="text-right text-xs font-mono text-slate-500">
              <span className="block font-bold text-slate-900">TAHLIL SHAKLI</span>
              <span>Sana: {createdDate ? new Date(createdDate).toLocaleDateString('uz-UZ') : new Date().toLocaleDateString('uz-UZ')}</span>
            </div>
          </div>

          {/* Patient Banner */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs grid grid-cols-2 gap-3">
            <div>
              <span className="text-slate-700 uppercase font-bold text-[10px]">BEMOR:</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">{patientName || 'Bemor'}</p>
            </div>
            <div>
              <span className="text-slate-700 uppercase font-bold text-[10px]">TAHLIL TURI:</span>
              <p className="text-sm font-bold text-cyan-800 mt-0.5">{testName} ({category})</p>
            </div>
          </div>

          {/* RESULTS TABLE */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
              🧪 TAHLIL NATIJALARI KO'RSATKICHLARI:
            </h3>

            <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-cyan-50 text-cyan-900 border-b border-slate-300 text-left">
                  <th className="p-2.5 border-r border-slate-300">Ko'rsatkich Nomi (Parametr)</th>
                  <th className="p-2.5">Aniqlangan Natija</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results).map(([key, val], idx) => (
                  <tr key={idx} className="border-b border-slate-200 odd:bg-slate-50 font-mono">
                    <td className="p-2.5 border-r border-slate-300 font-bold text-slate-800">{key}</td>
                    <td className="p-2.5 font-bold text-cyan-900">{String(val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-8 flex justify-between items-end text-xs text-slate-700">
            <div>
              <p className="font-bold">Laborant / Vrash muhr o'rni:</p>
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-600 mt-2">
                [ MUHR ]
              </div>
            </div>

            <div className="text-right">
              <p className="font-bold">Laborant shifokor imzosi:</p>
              <div className="w-44 border-b-2 border-slate-800 mt-8 mb-1" />
              <p className="font-bold text-slate-900">{doctorName || 'Laborant Shifokor'}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="no-print mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs"
          >
            Yopish
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition-all transform active:scale-95"
          >
            <Printer className="h-4 w-4" />
            🖨️ Tahlil Natijasini Chop Etish (Print)
          </button>
        </div>
      </div>
    </div>
  )
}
