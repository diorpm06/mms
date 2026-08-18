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

// Bugungi sana — blankalardagi kabi kun.oy.yil
function bugungiSana() {
  const d = new Date()
  const ikki = (n) => String(n).padStart(2, '0')
  return `${ikki(d.getDate())}.${ikki(d.getMonth() + 1)}.${d.getFullYear()}`
}

// Bo'sh joydan oldingi yozuvga qarab u nima uchun ekanini aniqlaydi.
// Blankalar kirill va lotin alifbosida — ikkalasi ham tanilishi kerak
const FIO_KALIT = /(ф\s*\.?\s*и\s*\.?\s*о|f\s*\.?\s*i\s*\.?\s*sh|f\s*\.?\s*i\s*\.?\s*o|бемор|bemorni)\s*\.?\s*:?\s*$/i
const SANA_KALIT = /(дата|сана|sana|sanasi|топширган|topshirgan|tekshiruv\s+sanasi)[^:]{0,24}:?\s*$/i

function nimaUchun(oldingiMatn) {
  const oxiri = oldingiMatn.slice(-40)
  if (FIO_KALIT.test(oxiri)) return 'fio'
  if (SANA_KALIT.test(oxiri)) return 'sana'
  return null
}

// "______" larni o'sadigan katakchalarga almashtiradi.
//
// Ilgari bu yerda qat'iy kenglikdagi <input> ishlatilardi — uzun familiya
// sig'masdi va yonidagi "Дата" surilmasdi. Endi contenteditable <span>:
// u matn bilan birga kengayadi, qolgan matn esa o'z-o'zidan siljiydi.
function katakchalarniQoy(container, bemorIsmi, qoyilgan) {
  // Yorliq ("Ф.И.О:") va bo'sh joy ko'pincha boshqa-boshqa teglarda bo'ladi.
  // Shuning uchun avval barcha matn tugunlarini tartib bilan yig'ib, har bir
  // bo'sh joy uchun undan OLDINGI butun matnni bilib turamiz.
  const tugunlar = []
  const yur = (node) => {
    if (node.nodeType === Node.TEXT_NODE) tugunlar.push(node)
    else if (node.nodeType === Node.ELEMENT_NODE) Array.from(node.childNodes).forEach(yur)
  }
  yur(container)

  const kataklar = []
  let oldingiMatn = ''

  for (const tugun of tugunlar) {
    let joriy = tugun
    while (joriy && BLANK_RE.test(joriy.nodeValue)) {
      const text = joriy.nodeValue
      const match = BLANK_RE.exec(text)
      const parent = joriy.parentNode
      if (!parent) break

      const before = document.createTextNode(text.slice(0, match.index))
      const after = document.createTextNode(text.slice(match.index + match[0].length))
      const tur = nimaUchun(oldingiMatn + before.nodeValue)

      const span = document.createElement('span')
      span.className = 'mms-blank'
      span.setAttribute('data-blank', '1')
      // Har bir tur (ism / sana) faqat BIR MARTA to'ldiriladi. Ba'zi
      // blankalarda yorliq va bo'sh joy alohida qatorlarda turadi va
      // ikkala qoida ham ishlab, ism ikki joyga yozilib qolardi.
      if (tur === 'fio' && bemorIsmi && !qoyilgan.fio) {
        span.textContent = bemorIsmi
        qoyilgan.fio = true
      } else if (tur === 'sana' && !qoyilgan.sana) {
        span.textContent = bugungiSana()
        qoyilgan.sana = true
      } else {
        span.textContent = ''
      }

      parent.insertBefore(before, joriy)
      parent.insertBefore(span, joriy)
      parent.insertBefore(after, joriy)
      parent.removeChild(joriy)

      kataklar.push(span)
      oldingiMatn += before.nodeValue + (span.textContent || '')
      joriy = after
    }
    if (joriy) oldingiMatn += joriy.nodeValue || ''
  }

  return kataklar
}

// Laboratoriya blankalarida "F.I.O | (bo'sh)" ko'rinishidagi jadval bor —
// u yerda "______" belgisi yo'q, shuning uchun alohida to'ldiriladi.
const JADVAL_FIO = /^(ф\s*\.?\s*и\s*\.?\s*о|f\s*\.?\s*i\s*\.?\s*o)\b/i
const JADVAL_SANA = /(дата|сана|sana|топширган\s*сана|topshirgan\s*sana|распечатки|исследования)/i

function jadvalKataklariniToldir(container, bemorIsmi, qoyilgan) {
  container.querySelectorAll('tr').forEach((tr) => {
    const kataklar = Array.from(tr.children)
    if (kataklar.length < 2) return
    const sarlavha = (kataklar[0].textContent || '').replace(/ /g, ' ').trim()
    const qiymat = kataklar[1]
    if ((qiymat.textContent || '').replace(/ /g, ' ').trim()) return

    let matn = null
    if (JADVAL_FIO.test(sarlavha) && bemorIsmi && !qoyilgan.fio) {
      matn = bemorIsmi
      qoyilgan.fio = true
    } else if (JADVAL_SANA.test(sarlavha) && !qoyilgan.sana) {
      matn = bugungiSana()
      qoyilgan.sana = true
    }
    if (!matn) return

    const span = document.createElement('span')
    span.className = 'mms-blank'
    span.setAttribute('data-blank', '1')
    span.textContent = matn
    qiymat.appendChild(span)
  })
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
      // Ism va sana avtomat qo'yiladi — shifokor har safar qo'lda yozmasin
      const qoyilgan = { fio: false, sana: false }
      katakchalarniQoy(fillRef.current, fullName, qoyilgan)
      jadvalKataklariniToldir(fillRef.current, fullName, qoyilgan)
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
      // Hujjatni asl ko'rinishi bilan saqlaymiz. Nusxa olib ishlaymiz —
      // shifokor ekranidagi hujjatga tegmasligi uchun.
      const nusxa = fillRef.current.cloneNode(true)
      // To'ldirilgan katakchalar oddiy qalin matnga aylanadi — chop etilganda
      // sariq fon va tag chiziq chiqmasligi uchun
      nusxa.querySelectorAll('[data-blank]').forEach((el) => {
        const qiymat = (el.textContent || '').trim()
        const kuchli = document.createElement('strong')
        kuchli.textContent = qiymat || '______'
        el.replaceWith(kuchli)
      })
      const filledHtml = nusxa.innerHTML
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
              Asl Word blankasi. Istalgan joyga bosib yozing yoki o'zgartiring —
              Word'dagidek ishlaydi. Tagiga chizilgan oltin joylar bo'lsa, ular alohida katakcha.
            </p>
            {/* Hujjat asl faylidagidek ko'rsatiladi va to'liq tahrirlanadi.
                Ilgari faqat "______" joylari tahrirlanardi, qolgani qulflangan edi —
                asl blankalarda esa bunday belgilar yo'q. */}
            <div
              ref={fillRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              className="mms-shablon bg-white text-black rounded-xl p-5 text-[13px] leading-relaxed overflow-x-auto focus:outline-none focus:ring-2 focus:ring-gold/50"
              style={{ fontFamily: "'Times New Roman', Cambria, serif", minHeight: '200px' }}
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
