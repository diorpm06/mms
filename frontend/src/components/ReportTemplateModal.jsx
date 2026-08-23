import { useEffect, useRef, useState } from 'react'
import { X, Send, ChevronRight, Pencil, Trash2, Save } from 'lucide-react'
import { api } from '../utils/api'
import { useToastStore } from '../store/toastStore'
import { useAuthStore } from '../store/authStore'
import { Btn, Icons } from './UIKit'
import { getTemplateByKey, getTemplatesByCategory, sarlavhaniTuzat } from '../utils/reportTemplates'

const STATUS_LABEL = {
  draft: { text: 'Saqlangan (yuborilmagan)', cls: 'badge-muted' },
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
const TUGILGAN_YILI_KALIT = /(туғилган|тугилган|tug'ilgan|yoshi|ёши|возраст|рождения|birth|yili)/i

function nimaUchun(oldingiMatn) {
  const oxiri = oldingiMatn.slice(-40)
  if (FIO_KALIT.test(oxiri)) return 'fio'
  if (SANA_KALIT.test(oxiri)) return 'sana'
  if (TUGILGAN_YILI_KALIT.test(oxiri)) return 'birth'
  return null
}

// Faqat F.I.Sh, sana va tug'ilgan yili avtomatik to'ldiriladi — qolgan
// "______" joylari matn ichida shundayligicha qoladi va shifokor ularning
// ustidan to'g'ridan-to'g'ri yozadi (butun blanka contentEditable, xuddi
// Word'da qanday bo'lsa shunday). Ilgari har bir "______" alohida
// tahrirlanadigan <span> qilinardi, atrofidagi matn esa umuman
// tahrirlanmasdi — shifokor xulosani yoki topilmani to'g'irlay olmasdi.
function nomAvtoToldir(container, bemorIsmi, bemorTugilganYili, qoyilgan) {
  const tugunlar = []
  const yur = (node) => {
    if (node.nodeType === Node.TEXT_NODE) tugunlar.push(node)
    else if (node.nodeType === Node.ELEMENT_NODE) Array.from(node.childNodes).forEach(yur)
  }
  yur(container)

  const GLOBAL_BLANK_RE = /_{4,}/g
  let oldingiMatn = ''

  for (const tugun of tugunlar) {
    const text = tugun.nodeValue || ''
    let oxirgiIndex = 0
    let natija = ''
    let m
    GLOBAL_BLANK_RE.lastIndex = 0
    while ((m = GLOBAL_BLANK_RE.exec(text))) {
      natija += text.slice(oxirgiIndex, m.index)
      const tur = nimaUchun(oldingiMatn + natija)

      let qiymat = null
      if (tur === 'fio' && bemorIsmi && !qoyilgan.fio) {
        qiymat = bemorIsmi
        qoyilgan.fio = true
      } else if (tur === 'sana' && !qoyilgan.sana) {
        qiymat = bugungiSana()
        qoyilgan.sana = true
      } else if (tur === 'birth' && bemorTugilganYili && !qoyilgan.birth) {
        qiymat = bemorTugilganYili
        qoyilgan.birth = true
      }

      natija += qiymat !== null ? qiymat : m[0]
      oxirgiIndex = m.index + m[0].length
    }
    natija += text.slice(oxirgiIndex)
    if (natija !== text) tugun.nodeValue = natija
    oldingiMatn += natija
  }
}

// Laboratoriya blankalarida "F.I.O | (bo'sh)" ko'rinishidagi jadval bor —
// u yerda "______" belgisi yo'q, shuning uchun alohida to'ldiriladi.
const JADVAL_FIO = /^(ф\s*\.?\s*и\s*\.?\s*о|f\s*\.?\s*i\s*\.?\s*o)\b/i
const JADVAL_SANA = /(дата|сана|sana|топширган\s*сана|topshirgan\s*sana|распечатки|исследования)/i
const JADVAL_BIRTH = /(туғилган|тугилган|tug'ilgan|yoshi|ёши|возраст)/i

function jadvalKataklariniToldir(container, bemorIsmi, bemorTugilganYili, qoyilgan) {
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
    } else if (JADVAL_BIRTH.test(sarlavha) && bemorTugilganYili && !qoyilgan.birth) {
      matn = bemorTugilganYili
      qoyilgan.birth = true
    }
    if (!matn) return
    qiymat.textContent = matn
  })
}

// view: 'history' | 'picker' | 'fill'
// Har bir bemor uchun modal qaytadan mount bo'ladi (DoctorPanel uni faqat
// templatePatient tanlanganda ko'rsatadi) — shuning uchun boshlang'ich holat
// har doim YANGI, bo'sh varaqa: tarix emas, to'g'ridan-to'g'ri shablon
// tanlash yoki to'ldirish oynasi. Tarixni ko'rish ixtiyoriy tugma orqali.
//
// DUBLIKATNI OLDINI OLISH: shu bemorning shu xizmati (serviceId) uchun
// natija allaqachon bo'lsa, "yangi" varaqa emas — o'sha yozuvning o'zi
// TAHRIRLASH holatida ochiladi. Ilgari har safar "Natija blankasini
// to'ldirish" bosilganda yangi, ikkinchi yozuv yaratib yuborardi.
export default function ReportTemplateModal({ patient, category, defaultTemplateKey, serviceId, initialReportId, onClose }) {
  const [view, setView] = useState(() => (defaultTemplateKey ? 'fill' : 'picker'))
  const [selectedKey, setSelectedKey] = useState(defaultTemplateKey || null)
  const [editingId, setEditingId] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const fillRef = useRef(null)
  const toast = useToastStore((s) => s.add)
  const userId = useAuthStore((s) => s.userId)

  const template = getTemplateByKey(selectedKey)
  const candidateTemplates = getTemplatesByCategory(category)

  const loadHistory = () =>
    api(`/report-submissions/patient/${patient.id}`)
      .then((res) => {
        setHistory(res || [])
        return res || []
      })
      .catch((e) => {
        console.error(e)
        return []
      })
      .finally(() => setLoading(false))

  useEffect(() => {
    setLoading(true)
    loadHistory().then((res) => {
      if (initialReportId) {
        const aniq = res.find((h) => h.id === initialReportId)
        if (aniq) { tahrirlashniOch(aniq); return }
      }
      if (!serviceId) return
      const mavjud = res.find((h) => h.service_id === serviceId)
      if (mavjud) tahrirlashniOch(mavjud)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient])

  useEffect(() => {
    if (view === 'fill' && template && fillRef.current && !editingId) {
      fillRef.current.innerHTML = sarlavhaniTuzat(template.bodyHtml)
      const fullName = `${patient.last_name || ''} ${patient.first_name || ''}`.trim()
      const rawBirth = patient.birth_date ? String(patient.birth_date).trim() : ''
      const birthStr = rawBirth.length >= 4 ? rawBirth.slice(0, 4) + '-yil' : rawBirth

      const qoyilgan = { fio: false, sana: false, birth: false }
      nomAvtoToldir(fillRef.current, fullName, birthStr, qoyilgan)
      jadvalKataklariniToldir(fillRef.current, fullName, birthStr, qoyilgan)
    }
  }, [view, selectedKey, editingId])

  if (!patient) return null

  const openPicker = () => {
    setEditingId(null)
    setSelectedKey(defaultTemplateKey || null)
    setView(defaultTemplateKey ? 'fill' : 'picker')
  }

  const chooseTemplate = (key) => {
    setEditingId(null)
    setSelectedKey(key)
    setView('fill')
  }

  // Mavjud (yuborilgan) natijani tahrirlash uchun ochadi — bo'sh shablon
  // emas, shifokor ilgari yozgan matnning o'zi yuklanadi.
  const tahrirlashniOch = (h) => {
    setEditingId(h.id)
    setSelectedKey(h.template_key)
    setView('fill')
    // fillRef hali DOM'ga chiqmagan bo'lishi mumkin — keyingi render'da qo'yamiz
    requestAnimationFrame(() => {
      if (fillRef.current) fillRef.current.innerHTML = sarlavhaniTuzat(h.content)
    })
  }

  const ochirish = async (h) => {
    if (!window.confirm(`"${h.template_label}" natijasi o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) return
    setDeletingId(h.id)
    try {
      await api(`/report-submissions/${h.id}`, { method: 'DELETE' })
      toast("Natija o'chirildi")
      if (editingId === h.id) {
        setEditingId(null)
        openPicker()
      }
      loadHistory()
    } catch (e) {
      toast(e.message || "O'chirishda xatolik", 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!template || !fillRef.current) return
    setSubmitting(true)
    try {
      // Butun blanka contentEditable — shifokor yozgani to'g'ridan-to'g'ri
      // shu yerda, alohida "katakcha"larni yig'ib chiqishga hojat yo'q.
      const filledHtml = fillRef.current.innerHTML
      const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
      const templateLabelWithPatient = `${template.name} — ${fullName}`

      if (editingId) {
        await api(`/report-submissions/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: filledHtml }),
        })
        toast('✓ Natija yangilandi')
      } else {
        await api('/report-submissions', {
          method: 'POST',
          body: JSON.stringify({
            patient_id: patient.id,
            service_id: serviceId || null,
            template_key: template.key,
            template_label: templateLabelWithPatient,
            category: template.category,
            content: filledHtml,
            status: 'submitted',
          }),
        })
        toast(`✓ ${templateLabelWithPatient} natijasi adminga va bemor kartasiga saqlandi!`)
      }
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
      <div className="card max-w-5xl w-full p-6 relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto space-y-5">

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
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView('picker')}
                className="text-xs text-cyan font-bold hover:underline"
              >
                ← Boshqa shablonni tanlash ({candidateTemplates.length} ta mavjud)
              </button>
              {editingId && (
                <span className="badge badge-cyan text-[10px] font-bold">Mavjud natijani tahrirlayapsiz</span>
              )}
            </div>
            <p className="text-[11px] text-muted italic">
              Asl Word blankasi — istalgan joyini bosib to'g'ridan-to'g'ri yozing,
              xuddi Word'da tahrirlagandek. Bemor ismi va bugungi sana o'zi qo'yildi,
              qolgan "______" joylarni o'zingiz to'ldirasiz.
            </p>
            <div
              ref={fillRef}
              contentEditable
              suppressContentEditableWarning
              className="mms-shablon bg-white text-black rounded-xl p-5 text-[13px] leading-relaxed overflow-x-auto outline-none focus:ring-2 focus:ring-gold/50"
              style={{ fontFamily: "'Times New Roman', Cambria, serif", minHeight: '300px' }}
            />

            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" full icon={Icons.x} type="button" onClick={onClose}>Bekor</Btn>
              <Btn
                variant="gold"
                full
                icon={editingId ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                type="submit"
                loading={submitting}
              >
                {editingId ? 'Yangilash' : 'Saqlash'}
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
                Bu bemor uchun hali natija to'ldirilmagan.
              </div>
            ) : (
              history.map((h) => {
                const meniki = !h.doctor_id || h.doctor_id === userId
                const tahrirlashMumkin = meniki && h.status !== 'printed'
                return (
                  <div key={h.id} className="card-2 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2 font-bold text-xs">
                      <span className="text-cyan font-bold flex items-center gap-2">
                        <span>{h.template_label}</span>
                        <span className={`badge ${STATUS_LABEL[h.status]?.cls || 'badge-gold'} text-[10px]`}>
                          {STATUS_LABEL[h.status]?.text || h.status}
                        </span>
                      </span>
                      <span className="text-muted font-mono text-[11px]">
                        {h.created_at ? new Date(h.created_at).toLocaleString('uz-UZ') : ''}
                      </span>
                    </div>
                    <div
                      className="mms-shablon bg-white text-black rounded-xl p-3 text-[11px] leading-relaxed max-h-64 overflow-y-auto overflow-x-auto"
                      style={{ fontFamily: "'Times New Roman', Cambria, serif" }}
                      dangerouslySetInnerHTML={{ __html: sarlavhaniTuzat(h.content) }}
                    />
                    {tahrirlashMumkin && (
                      <div className="flex gap-2 justify-end">
                        <Btn
                          variant="outline"
                          size="xs"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => tahrirlashniOch(h)}
                        >
                          Tahrirlash
                        </Btn>
                        <Btn
                          variant="outline"
                          size="xs"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          loading={deletingId === h.id}
                          onClick={() => ochirish(h)}
                          className="text-rose-400 border-rose-500/40 hover:bg-rose-500/10"
                        >
                          O'chirish
                        </Btn>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
