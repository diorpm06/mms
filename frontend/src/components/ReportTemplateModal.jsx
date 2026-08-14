import { useEffect, useRef, useState } from 'react'
import { X, Send, ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import { useToastStore } from '../store/toastStore'
import { Btn, Icons } from './UIKit'
import { getTemplateByKey, getTemplatesByCategory } from '../utils/reportTemplates'

const STATUS_LABEL = {
  submitted: { text: 'Adminga yuborilgan', cls: 'badge-gold' },
  printed: { text: 'Chop etilgan', cls: 'badge-cyan' },
}

const BLANK_RE = /_{4,}/

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Konteyner ichidagi "______" matnlarini haqiqiy <input> elementlariga almashtiradi.
// Qolgan matn (formatlash bilan) butunlay qulflangan holicha qoladi.
function injectBlankInputs(container, prefillFirst) {
  const inputs = []

  function processTextNode(textNode) {
    const text = textNode.nodeValue
    const match = BLANK_RE.exec(text)
    if (!match) return null

    const before = document.createTextNode(text.slice(0, match.index))
    const after = document.createTextNode(text.slice(match.index + match[0].length))

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'mms-blank-input'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.size = Math.max(4, Math.min(match[0].length, 20))
    input.style.cssText =
      'display:inline-block;min-width:50px;border:none;border-bottom:2px solid var(--gold);' +
      'background:transparent;font:inherit;color:var(--cyan,#22d3ee);font-weight:700;padding:0 3px;outline:none;'

    if (inputs.length === 0 && prefillFirst) {
      input.value = prefillFirst
    }

    const parent = textNode.parentNode
    parent.insertBefore(before, textNode)
    parent.insertBefore(input, textNode)
    parent.insertBefore(after, textNode)
    parent.removeChild(textNode)

    inputs.push(input)
    return after
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let current = node
      while (current && BLANK_RE.test(current.nodeValue)) {
        current = processTextNode(current)
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(walk)
    }
  }

  walk(container)
  return inputs
}

// Konteynerni (to'ldirilgan qiymatlar bilan) qayta HTML matniga aylantiradi.
function serializeFilled(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.nodeValue)
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.classList && node.classList.contains('mms-blank-input')) {
      return `<strong>${escapeHtml(node.value?.trim() || '______')}</strong>`
    }
    const tag = node.tagName.toLowerCase()
    const children = Array.from(node.childNodes).map(serializeFilled).join('')
    const style = node.getAttribute('style')
    const extra = ['border', 'cellpadding'].map((a) =>
      node.hasAttribute(a) ? ` ${a}="${node.getAttribute(a)}"` : ''
    ).join('')
    return `<${tag}${style ? ` style="${style}"` : ''}${extra}>${children}</${tag}>`
  }
  return ''
}

// view: 'history' | 'picker' | 'fill'
export default function ReportTemplateModal({ patient, category, defaultTemplateKey, serviceId, onClose }) {
  const [view, setView] = useState('history')
  const [selectedKey, setSelectedKey] = useState(defaultTemplateKey || null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const fillRef = useRef(null)
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
    if (view === 'fill' && template && fillRef.current) {
      fillRef.current.innerHTML = template.bodyHtml
      const fullName = `${patient.last_name || ''} ${patient.first_name || ''}`.trim()
      injectBlankInputs(fillRef.current, fullName)
    }
  }, [view, selectedKey])

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
    if (!template || !fillRef.current) return
    setSubmitting(true)
    try {
      const filledHtml = Array.from(fillRef.current.childNodes).map(serializeFilled).join('')
      await api('/report-submissions', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patient.id,
          service_id: serviceId || null,
          template_key: template.key,
          template_label: template.name,
          category: template.category,
          content: filledHtml,
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
              Asl blanka matni — faqat tagiga chizilgan (oltin rang) joylarga bosib, natijani yozing. Qolgan matn qulflangan.
            </p>
            <div
              ref={fillRef}
              className="bg-white text-black rounded-xl p-5 text-[13px] leading-relaxed"
              style={{ fontFamily: "'Times New Roman', Cambria, serif" }}
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
                  <div
                    className="bg-white text-black rounded-xl p-3 text-[11px] leading-relaxed max-h-64 overflow-y-auto"
                    style={{ fontFamily: "'Times New Roman', Cambria, serif" }}
                    dangerouslySetInnerHTML={{ __html: h.content }}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
