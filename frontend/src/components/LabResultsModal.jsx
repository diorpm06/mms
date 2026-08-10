import { useEffect, useState } from 'react'
import { X, Plus, Printer } from 'lucide-react'
import { api } from '../utils/api'
import { useToastStore } from '../store/toastStore'
import { Btn, Icons } from './UIKit'

const LAB_TEMPLATES = [
  {
    category: 'Qon tahlili',
    name: 'Umumiy Qon Tahlili (CBC)',
    fields: [
      { name: 'Gemoglobin (Hb)', norm: '120-160 g/l', unit: 'g/l' },
      { name: 'Eritrotsitlar (RBC)', norm: '3.8-5.0 x10^12/l', unit: 'x10^12/l' },
      { name: 'Leykotsitlar (WBC)', norm: '4.0-9.0 x10^9/l', unit: 'x10^9/l' },
      { name: 'EOT (ESR)', norm: '2-15 mm/soat', unit: 'mm/h' },
      { name: 'Trombotsitlar (PLT)', norm: '180-320 x10^9/l', unit: 'x10^9/l' },
    ],
  },
  {
    category: 'Biokimyo',
    name: 'Biokimyoviy Qon Tahlili',
    fields: [
      { name: 'Qondagi shakar (Glucose)', norm: '3.3-5.5 mmol/l', unit: 'mmol/l' },
      { name: 'Mochevina (Urea)', norm: '2.5-8.3 mmol/l', unit: 'mmol/l' },
      { name: 'Kreatinin (Creatinine)', norm: '44-106 umol/l', unit: 'umol/l' },
      { name: 'Umumiy Bilirubin', norm: '8.5-20.5 umol/l', unit: 'umol/l' },
      { name: 'ALT', norm: '0-40 U/l', unit: 'U/l' },
      { name: 'AST', norm: '0-40 U/l', unit: 'U/l' },
    ],
  },
  {
    category: 'Peshob tahlili',
    name: 'Umumiy Peshob Tahlili (OAM)',
    fields: [
      { name: 'Rangi (Color)', norm: 'Sariq (Yellow)', unit: '' },
      { name: 'Solishtirma og\'irligi (SG)', norm: '1015-1025', unit: '' },
      { name: 'Oksilligi (Protein)', norm: 'Topilmadi (Negative)', unit: '' },
      { name: 'Epiteliy', norm: '1-3 ko\'ruv maydonida', unit: 'k.m' },
      { name: 'Leykotsitlar', norm: '0-3 ko\'ruv maydonida', unit: 'k.m' },
    ],
  },
]

export default function LabResultsModal({ patient, onClose }) {
  const [labList, setLabList] = useState([])
  const [loading, setLoading] = useState(true)
  const [addMode, setAddMode] = useState(false)
  
  const [selectedTemplate, setSelectedTemplate] = useState(LAB_TEMPLATES[0])
  const [paramValues, setParamValues] = useState({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const [printItem, setPrintItem] = useState(null)
  const toast = useToastStore((s) => s.add)

  const loadLabResults = () => {
    if (!patient) return
    setLoading(true)
    api(`/lab-results/patient/${patient.id}`)
      .then((res) => setLabList(res || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLabResults()
  }, [patient])

  useEffect(() => {
    if (selectedTemplate) {
      const init = {}
      selectedTemplate.fields.forEach((f) => { init[f.name] = '' })
      setParamValues(init)
    }
  }, [selectedTemplate])

  if (!patient) return null

  const handleSaveResult = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api('/lab-results', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patient.id,
          test_name: selectedTemplate.name,
          category: selectedTemplate.category,
          results_json: JSON.stringify(paramValues),
          notes,
        }),
      })
      toast("✓ Laboratoriya tahlili natijasi saqlandi!")
      setAddMode(false)
      loadLabResults()
    } catch (err) {
      toast(err.message || "Saqlashda xatolik", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrintLab = (labItem) => {
    setPrintItem(labItem)
    setTimeout(() => {
      const area = document.getElementById('printable-lab-content')
      if (!area) return
      const printWindow = window.open('', '_blank', 'width=800,height=900')
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Laboratoriya Tahlil Natijasi</title>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
              .header h2 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
              .header p { margin: 4px 0 0; font-size: 12px; font-weight: bold; }
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 12px; }
              .info-box { border: 1px solid #000; padding: 8px 12px; border-radius: 6px; width: 48%; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
              th, td { border: 1px solid #000; padding: 8px 10px; text-align: left; }
              th { background: #f0f0f0; font-weight: bold; }
              .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
              .sig-line { width: 40%; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-weight: bold; }
              @media print {
                body { padding: 0; }
                @page { margin: 10mm; }
              }
            </style>
          </head>
          <body>${area.innerHTML}</body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 300)
    }, 100)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="card max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan font-bold flex items-center justify-center border border-cyan-500/30 text-xl">
              🔬
            </div>
            <div>
              <h3 className="text-lg font-black text-gold uppercase tracking-wide">
                Laboratoriya Tahlillari
              </h3>
              <p className="text-xs text-muted font-bold">
                Bemor: <strong className="text-cyan">{patient.first_name} {patient.last_name}</strong> ({patient.phone})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:text-foreground transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Actions Bar */}
        <div className="card-2 p-3 flex justify-between items-center">
          <span className="text-xs text-muted font-bold">
            Jami tahlillar: {labList.length} ta
          </span>
          <button
            type="button"
            onClick={() => setAddMode(!addMode)}
            className="btn-gold py-2 px-4 text-xs font-black flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {addMode ? 'Ro\'yxatga qaytish' : '+ Yangi Tahlil Kirgazish'}
          </button>
        </div>

        {/* ADD MODE FORM */}
        {addMode ? (
          <form onSubmit={handleSaveResult} className="space-y-4 pt-1 animate-in fade-in">
            <div>
              <label className="form-label text-xs font-bold text-cyan">🧪 Tahlil Shablonini Tanlang *</label>
              <select
                className="input-field text-xs font-bold py-2 text-cyan"
                value={selectedTemplate.name}
                onChange={(e) => {
                  const found = LAB_TEMPLATES.find((t) => t.name === e.target.value)
                  if (found) setSelectedTemplate(found)
                }}
              >
                {LAB_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>
                    [{t.category}] {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 card-2 p-4">
              <h4 className="text-xs font-black text-amber uppercase tracking-wider mb-2">
                📋 Tahlil Ko'rsatkichlari Qiymatlarini Kiriting:
              </h4>

              {selectedTemplate.fields.map((f) => (
                <div key={f.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-body">{f.name}</span>
                    {f.norm && <span className="text-[10px] text-muted block">Norma: {f.norm}</span>}
                  </div>
                  <input
                    type="text"
                    placeholder="Qiymati..."
                    className="input-field max-w-[180px] text-xs py-1.5 text-cyan font-bold"
                    value={paramValues[f.name] || ''}
                    onChange={(e) => setParamValues({ ...paramValues, [f.name]: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="form-label text-xs font-bold">Laborant / Shifokor Izohi</label>
              <input
                type="text"
                placeholder="Izoh yoki qo'shimcha ko'rsatma..."
                className="input-field text-xs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" full icon={Icons.x} type="button" onClick={() => setAddMode(false)}>Bekor</Btn>
              <Btn variant="gold" full icon={Icons.check} type="submit" loading={submitting}>Saqlash ✓</Btn>
            </div>
          </form>
        ) : (
          /* LAB RESULTS LIST */
          <div className="space-y-3">
            {loading ? (
              <p className="text-xs text-muted italic text-center py-8">Tahlillar yuklanmoqda...</p>
            ) : labList.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted card-2">
                Hali laboratoriya tahlillari kiritilmagan. Yuqoridagi "+ Yangi Tahlil Kirgazish" tugmasini bosing.
              </div>
            ) : (
              labList.map((lab) => {
                let parsed = {}
                try { parsed = JSON.parse(lab.results_json || '{}') } catch (_) {}

                return (
                  <div key={lab.id} className="card-2 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2 font-bold text-xs">
                      <span className="text-cyan font-bold flex items-center gap-2">
                        <span>🔬 {lab.test_name}</span>
                        <span className="badge badge-gold text-[10px]">{lab.category}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted font-mono text-[11px]">
                          {lab.created_at ? new Date(lab.created_at).toLocaleDateString('uz-UZ') : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePrintLab(lab)}
                          className="btn-cyan py-1 px-2.5 text-[11px]"
                        >
                          <Printer className="h-3 w-3" /> Chop etish
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(parsed).map(([key, val]) => (
                        <div key={key} className="bg-surface p-2.5 rounded-xl border border-border flex justify-between">
                          <span className="text-muted text-[11px] font-medium">{key}:</span>
                          <span className="font-bold text-cyan font-mono">{val || '—'}</span>
                        </div>
                      ))}
                    </div>

                    {lab.notes && (
                      <p className="text-[11px] text-muted italic">Izoh: {lab.notes}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Hidden Printable Lab Sheet Container */}
        {printItem && (
          <div className="hidden" id="printable-lab-content">
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#000', textTransform: 'uppercase' }}>
                MARJONA MED SERVICE
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                LABORATORIYA TAHLIL NATIJASI BLANKASI
              </p>
            </div>

            <div style={{ display: 'flex', justifyBetween: 'space-between', marginBottom: '16px', fontSize: '12px', color: '#000' }}>
              <div style={{ border: '1px solid #000', padding: '8px 12px', borderRadius: '6px', width: '48%' }}>
                <p style={{ margin: 0 }}><b>Bemor F.I.SH:</b> {patient.first_name} {patient.last_name}</p>
                <p style={{ margin: '4px 0 0' }}><b>Telefon:</b> {patient.phone || '—'}</p>
              </div>
              <div style={{ border: '1px solid #000', padding: '8px 12px', borderRadius: '6px', width: '48%', textAlign: 'right' }}>
                <p style={{ margin: 0 }}><b>Tahlil Nomi:</b> {printItem.test_name}</p>
                <p style={{ margin: '4px 0 0' }}><b>Sana:</b> {printItem.created_at ? new Date(printItem.created_at).toLocaleDateString('uz-UZ') : ''}</p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px', color: '#000' }}>
              <thead>
                <tr style={{ background: '#e5e7eb' }}>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Ko'rsatkich Nomi</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Natija / Qiymat</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(() => { try { return JSON.parse(printItem.results_json) } catch (_) { return {} } })().map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>{k}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{v || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {printItem.notes && (
              <p style={{ fontSize: '12px', fontStyle: 'italic', margin: '10px 0' }}>Izoh: {printItem.notes}</p>
            )}

            <div style={{ display: 'flex', justifyBetween: 'space-between', marginTop: '40px', fontSize: '12px', color: '#000' }}>
              <div style={{ width: '42%', borderTop: '1px solid #000', paddingTop: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                Shifokor / Laborant Imzosi
              </div>
              <div style={{ width: '42%', borderTop: '1px solid #000', paddingTop: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                Bemor Imzosi
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
