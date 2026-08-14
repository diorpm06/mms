import { useEffect, useState } from 'react'
import { X, Send, ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import { useToastStore } from '../store/toastStore'
import { Btn, Icons } from './UIKit'
import { getTemplateByKey, getTemplatesByCategory } from '../utils/reportTemplates'

const STATUS_LABEL = {
  submitted: { text: 'Adminga yuborilgan', cls: 'badge-gold' },
  printed: { text: 'Chop etilgan', cls: 'badge-cyan' },
}

// view: 'history' | 'picker' | 'fill'
export default function ReportTemplateModal({ patient, category, defaultTemplateKey, serviceId, onClose }) {
  const [view, setView] = useState('history')
  const [selectedKey, setSelectedKey] = useState(defaultTemplateKey || null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToastStore((s) => s.add)

  const template = getTemplateByKey(selectedKey)
  const candidateTemplates = getTemplatesByCategory(category)

  const loadHistory = () => {
    if (!patient) return
    setLoading(true)
    api(`/report-submissions/patient/${patient.id}`)
      .then((res) => setHistory(res || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadHistory()
  }, [patient])

  useEffect(() => {
    if (template) {
      const fullName = `${patient.last_name || ''} ${patient.first_name || ''}`.trim()
      const prefilled = fullName
        ? template.bodyText.replace('Ф.И.О: ______________________', `Ф.И.О: ${fullName}`)
        : template.bodyText
      setContent(prefilled)
    }
  }, [selectedKey])

  if (!patient) return null

  const openPicker = () => {
    setSelectedKey(defaultTemplateKey || null)
    setView(defaultTemplateKey ? 'fill' : 'picker')
  }

  const chooseTemplate = (key) => {
    setSelectedKey(key)
    setView('fill')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!template) return
    setSubmitting(true)
    try {
      await api('/report-submissions', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patient.id,
          service_id: serviceId || null,
          template_key: template.key,
          template_label: template.name,
          category: template.category,
          content,
        }),
      })
      toast('✓ Shablon adminga yuborildi!')
      setView('history')
      loadHistory()
    } catch (err) {
      toast(err.message || 'Yuborishda xatolik', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="card max-w-3xl w-full p-6 relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto space-y-5">

        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan font-bold flex items-center justify-center border border-cyan-500/30 text-xl">
              {view === 'fill' && template ? (template.category === 'UZI' ? '🩻' : '🔬') : '📋'}
            </div>
            <div>
              <h3 className="text-lg font-black text-gold uppercase tracking-wide">
                {view === 'fill' && template ? template.name : 'Tekshiruv Shablonlari'}
              </h3>
              <p className="text-xs text-muted font-bold">
                Bemor: <strong className="text-cyan">{patient.first_name} {patient.last_name}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:text-foreground transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {view !== 'picker' && (
          <div className="card-2 p-3 flex justify-between items-center">
            <span className="text-xs text-muted font-bold">
              Bu bemor uchun oldingi topshiriqlar: {history.length} ta
            </span>
            <button
              type="button"
              onClick={() => (view === 'history' ? openPicker() : setView('history'))}
              className="btn-gold py-2 px-4 text-xs font-black"
            >
              {view === 'history' ? '+ Yangi to\'ldirish' : 'Tarixni ko\'rish'}
            </button>
          </div>
        )}

        {view === 'picker' && (
          <div className="space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber uppercase tracking-wider">
                Qaysi tekshiruv turi? (sohani tanlang)
              </h4>
              <button type="button" onClick={() => setView('history')} className="text-xs text-muted hover:text-body">
                Bekor
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {candidateTemplates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => chooseTemplate(t.key)}
                  className="card-2 p-3 text-left flex items-center justify-between hover:border-gold transition-all"
                >
                  <span className="text-xs font-bold text-body">
                    {t.category === 'UZI' ? '🩻' : '🔬'} {t.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'fill' && template && (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1 animate-in fade-in">
            {!defaultTemplateKey && (
              <button
                type="button"
                onClick={() => setView('picker')}
                className="text-xs text-cyan font-bold hover:underline"
              >
                ← Boshqa sohani tanlash
              </button>
            )}
            <p className="text-[11px] text-muted italic">
              Asl blanka matni pastda — faqat o'zgarishi kerak bo'lgan raqam/natijalarni tahrirlang, qolgan matnga tegmang.
            </p>
            <textarea
              className="input-field text-xs font-mono leading-relaxed"
              style={{ whiteSpace: 'pre', overflowX: 'auto' }}
              rows={22}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
            />

            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" full icon={Icons.x} type="button" onClick={onClose}>Bekor</Btn>
              <Btn variant="gold" full icon={<Send className="h-4 w-4" />} type="submit" loading={submitting}>
                Adminga yuborish
              </Btn>
            </div>
          </form>
        )}

        {view === 'history' && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-xs text-muted italic text-center py-8">Yuklanmoqda...</p>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted card-2">
                Hali shablon to'ldirilmagan. "+ Yangi to'ldirish" tugmasini bosing.
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="card-2 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2 font-bold text-xs">
                    <span className="text-cyan font-bold flex items-center gap-2">
                      <span>{h.category === 'UZI' ? '🩻' : '🔬'} {h.template_label}</span>
                      <span className={`badge ${STATUS_LABEL[h.status]?.cls || 'badge-gold'} text-[10px]`}>
                        {STATUS_LABEL[h.status]?.text || h.status}
                      </span>
                    </span>
                    <span className="text-muted font-mono text-[11px]">
                      {h.created_at ? new Date(h.created_at).toLocaleString('uz-UZ') : ''}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap bg-surface p-3 rounded-xl border border-border max-h-64 overflow-y-auto">
                    {h.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
