import { useEffect, useState, useRef } from 'react'
import { Hash, DoorClosed, User, Clock } from 'lucide-react'

let globalAudioCtx = null

function getAudioContext() {
  try {
    if (!globalAudioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext
      if (AudioCtxClass) {
        globalAudioCtx = new AudioCtxClass()
      }
    }
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {})
    }
  } catch (e) {
    console.warn('AudioContext creation error:', e)
  }
  return globalAudioCtx
}

// Soft Chime Sound when a NEW ticket enters waiting queue
function playNewTicketChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, now)
    gain.gain.setValueAtTime(0.4, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.7)
  } catch (e) {
    console.warn('New ticket chime error:', e)
  }
}

// Silent WAV data URI to keep media session active on TV Cast / Chromecast
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let castAudioPlayer = null

function ensureCastAudioPlayer() {
  if (!castAudioPlayer) {
    castAudioPlayer = new Audio()
    castAudioPlayer.id = 'tv-cast-audio-player'
    castAudioPlayer.preload = 'auto'
  }
  return castAudioPlayer
}

function startSilentBackgroundAudio() {
  try {
    const player = ensureCastAudioPlayer()
    if (player.paused) {
      player.src = SILENT_WAV
      player.loop = true
      player.play().catch(() => {})
    }
  } catch (e) {
    console.warn('Silent bg audio error:', e)
  }
}

// Force Play Alert Audio with Cast-compatible Audio player
function forcePlayAlertAudio(onComplete) {
  try {
    // Play DOM Audio player for TV / Chromecast stream — faqat ovozli
    // e'lon (ding-dong qo'ng'iroq olib tashlandi, so'ralgan edi).
    const player = ensureCastAudioPlayer()
    player.loop = false
    player.src = '/sound/alert.mp3?v=' + Date.now()
    player.volume = 1.0

    let finished = false
    const done = () => {
      if (!finished) {
        finished = true
        startSilentBackgroundAudio()
        if (onComplete) onComplete()
      }
    }

    player.onended = () => {
      setTimeout(done, 1500)
    }
    player.onerror = () => setTimeout(done, 7000)

    const p = player.play()
    if (p !== undefined) {
      p.catch((err) => {
        console.warn('DOM Audio play catch:', err)
        setTimeout(done, 7000)
      })
    }

    setTimeout(done, 7000)
  } catch (e) {
    console.warn('forcePlayAlertAudio error:', e)
    if (onComplete) onComplete()
  }
}

function formatShortName(firstName, lastName) {
  if (!firstName) return '—'
  const f = firstName.trim()
  const l = (lastName || '').trim()
  if (l) {
    return `${f} ${l.charAt(0)}.`
  }
  return f
}

// Default promos if no uploaded custom banners exist
const DEFAULT_SLIDES = [
  {
    id: 'def1',
    badge: '🏥 "MARJONA MED SERVIS" KLINIKASI',
    title: '🔬 TO\'LIQ KO\'RIKDAN O\'TISH AKSIYASI!',
    highlight: '20% CHEGIRMA!',
    desc: 'Eko-profil, UTT (UZI), Terapevt va Laboratoriya ko\'rigi.',
    buttonText: 'Batafsil qabulxonada',
  },
  {
    id: 'def2',
    badge: '⚡ SHOSHILINCH TIBBIY YORDAM',
    title: '🧪 ZAMONAVIY LABORATORIYA VA DIAGNOSTIKA',
    highlight: 'TEZKOR GINEKOLOGIYA & UZI',
    desc: 'Barcha turdagi qon va peshob analizlari 1 soatda tayyor.',
    buttonText: 'Aloqa: +998 55 604-44-24',
  },
  {
    id: 'def3',
    badge: '❤️ SALOMATLIGINGIZ — BIZNING G\'AMXO\'RLIGIMIZ',
    title: '👩‍⚕️ MALAKALI SHIFOKORLAR QABULI',
    highlight: 'XUSHMOOMALA XIZMAT',
    desc: 'Kardiolog, Terapevt, Ginekolog, UTT mutaxassislari.',
    buttonText: 'Qabulxonaga murojaat qiling',
  },
]

export default function TvQueueDisplay() {
  const [data, setData] = useState({ calling: [], waiting: [], finished: [], stats: { total: 0 } })
  const [banners, setBanners] = useState([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [slideAnimKey, setSlideAnimKey] = useState(0)
  const [time, setTime] = useState(new Date())
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeCallModal, setActiveCallModal] = useState(null)
  const [tickerText, setTickerText] = useState(() => {
    return (
      localStorage.getItem('tv_ticker_text') ||
      '🏥 "MARJONA MED SERVIS" KLINIKASIGA XUSH KELIBSIZ! • SALOMATLIGINGIZ — BIZNING G\'AMXO\'RLIGIMIZ! • ALOQA TELEFON: +998 55 604-44-24 • MANZIL: HAZORASP SENTR • ISH VAQTI: Har kuni 08:00 dan 18:00 gacha'
    )
  })

  // Listen for ticker_text_updated or storage events
  useEffect(() => {
    const updateTicker = () => {
      const saved = localStorage.getItem('tv_ticker_text')
      if (saved) setTickerText(saved)
    }
    window.addEventListener('storage', updateTicker)
    window.addEventListener('ticker_text_updated', updateTicker)
    return () => {
      window.removeEventListener('storage', updateTicker)
      window.removeEventListener('ticker_text_updated', updateTicker)
    }
  }, [])

  const isAudioEnabledRef = useRef(isAudioEnabled)
  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled
  }, [isAudioEnabled])

  const previousCallingTimes = useRef(new Map())
  const previousWaitingIds = useRef(new Set())
  const isFirstRender = useRef(true)
  const popupTimerRef = useRef(null)

  // Scroll Refs for Queue Table
  const tableContainerRef = useRef(null)
  const activeRowRef = useRef(null)

  // Audio / Call FIFO Queue Refs
  const callQueueRef = useRef([])
  const isProcessingCallRef = useRef(false)
  // Ovoz javob qaytarmay qolsa navbatni majburan davom ettiruvchi taymer
  const qorovulRef = useRef(null)
  // Har bir chaqiruv "id:updated_at" imzosi bilan MANGU eslab qolinadi —
  // navbatdagi dublikat tekshiruvidan farqli, bu ro'yxatdan hech qachon
  // o'chmaydi, shuning uchun qanday sabab bilan bo'lmasin (ikkita poll
  // bir-biriga yaqin tushib qolishi, tarmoq kechikishi va h.k.) BIR XIL
  // chaqiruv ikkinchi marta navbatga qo'shilib, ustma-ust e'lon qilinmaydi.
  const announcedSignaturesRef = useRef(new Set())

  // Process calls sequentially from FIFO queue
  const processCallQueue = () => {
    // DIQQAT: qulf tekshiruvi BIRINCHI bo'lishi kerak. Ilgari avval
    // "navbat bo'shmi" tekshirilardi va bo'sh bo'lsa qulf ochib
    // yuborilardi — ovoz hali chalinayotgan paytda ham. Bu ikki
    // chaqiruvning ustma-ust tushishiga yo'l ochardi.
    if (isProcessingCallRef.current) return
    if (callQueueRef.current.length === 0) return

    const nextCall = callQueueRef.current.shift()
    isProcessingCallRef.current = true
    setActiveCallModal(nextCall)

    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)

    let tugadi = false
    const finishCall = () => {
      if (tugadi) return          // ikki marta chaqirilmasin
      tugadi = true
      if (qorovulRef.current) {
        clearTimeout(qorovulRef.current)
        qorovulRef.current = null
      }
      setActiveCallModal(null)
      setTimeout(() => {
        isProcessingCallRef.current = false
        processCallQueue()
      }, 400)
    }

    // Qorovul taymer: ovoz tizimi javob qaytarmasa (brauzer bloklasa,
    // ovoz fayli yuklanmasa yoki nutq sintezi osilib qolsa) qulf mangu
    // yopiq qolib, TV ekran boshqa hech kimni chaqirmay qo'yardi.
    // 12 soniyadan keyin majburan davom etamiz.
    if (qorovulRef.current) clearTimeout(qorovulRef.current)
    qorovulRef.current = setTimeout(finishCall, 12000)

    if (isAudioEnabledRef.current) {
      forcePlayAlertAudio(() => {
        finishCall()
      })
    } else {
      popupTimerRef.current = setTimeout(finishCall, 3500)
    }
  }

  // Force Light/Clean container styles
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')
    root.classList.add('light')
  }, [])

  // Pre-load SpeechSynthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
    }
  }, [])

  // Fetch custom uploaded banners
  useEffect(() => {
    fetch('/api/banners')
      .then((res) => (res.ok ? res.json() : []))
      .then((bList) => {
        if (Array.isArray(bList) && bList.length > 0) {
          setBanners(bList)
        }
      })
      .catch(() => {})
  }, [])

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Banner carousel sliding right-to-left every 10 SECONDS (10000ms)
  useEffect(() => {
    const slideCount = banners.length > 0 ? banners.length : DEFAULT_SLIDES.length
    const slideTimer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slideCount)
      setSlideAnimKey((prev) => prev + 1)
    }, 10000)

    return () => clearInterval(slideTimer)
  }, [banners])

  // Global click & keydown listener to unlock Web Audio & Cast Audio autoplay
  useEffect(() => {
    const unlockAudio = () => {
      getAudioContext()
      startSilentBackgroundAudio()
      setAudioUnlocked(true)
    }
    window.addEventListener('click', unlockAudio)
    window.addEventListener('keydown', unlockAudio)
    window.addEventListener('touchstart', unlockAudio)
    return () => {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
  }, [])

  const handleUnlockAudio = () => {
    getAudioContext()
    startSilentBackgroundAudio()
    setAudioUnlocked(true)
  }

  const handleTestAudio = (e) => {
    e.stopPropagation()
    handleUnlockAudio()
    const testItem = {
      ticket_number: 'U-001',
      cabinet: '1-Xona (Test)',
      service_name: 'GINEKOLOGIYA & UZI',
      first_name: 'Test',
      last_name: 'Bemor'
    }
    setActiveCallModal(testItem)
    forcePlayAlertAudio(() => {
      setActiveCallModal(null)
    })
  }

  // Poll queue data every 3 seconds
  useEffect(() => {
    let isMounted = true

    const fetchQueue = async () => {
      try {
        const res = await fetch('/api/queue/live')
        if (!res.ok) return
        const result = await res.json()
        if (!isMounted) return

        const safeData = {
          calling: result?.calling || [],
          waiting: result?.waiting || [],
          finished: result?.finished || [],
          stats: result?.stats || { total: 0 },
        }

        setData(safeData)

        if (result?.ticker_text) {
          setTickerText(result.ticker_text)
          localStorage.setItem('tv_ticker_text', result.ticker_text)
        }

        const currentWaitingIds = new Set((safeData.waiting).map((w) => w.id))

        // Detect newly called or re-called patients. Birinchi yuklanishda
        // (yoki TV sahifasi qayta yuklanganda) "calling" ro'yxatida allaqachon
        // turgan bemorlar hali ham bor bo'lishi mumkin — ular ilgari
        // chaqirilgan, endi yangidan emas. Ilgari `previousCallingTimes`
        // bo'sh boshlangani uchun ularning barchasi "yangi chaqiruv" deb
        // hisoblanib, TV har safar sahifa yangilanganda (tarmoq uzilishi,
        // qayta ulanish va h.k.) ularni QAYTA e'lon qilardi.
        const newlyCalled = isFirstRender.current
          ? []
          : safeData.calling.filter((c) => {
              const prevTime = previousCallingTimes.current.get(c.id)
              return prevTime === undefined || String(prevTime) !== String(c.updated_at)
            })

        if (newlyCalled.length > 0) {
          newlyCalled.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
          for (const item of newlyCalled) {
            const signature = `${item.id}:${item.updated_at}`
            if (announcedSignaturesRef.current.has(signature)) continue
            announcedSignaturesRef.current.add(signature)
            // Xotira cheksiz o'smasin — eskilarini tozalab boramiz.
            if (announcedSignaturesRef.current.size > 500) {
              announcedSignaturesRef.current.delete(announcedSignaturesRef.current.values().next().value)
            }
            callQueueRef.current.push(item)
          }
          processCallQueue()
        }

        if (!isFirstRender.current) {
          const newlyWaiting = safeData.waiting.filter((w) => !previousWaitingIds.current.has(w.id))
          if (newlyWaiting.length > 0 && isAudioEnabledRef.current) {
            playNewTicketChime()
          }
        }

        const nextCallingTimes = new Map()
        safeData.calling.forEach((c) => nextCallingTimes.set(c.id, String(c.updated_at)))
        previousCallingTimes.current = nextCallingTimes

        previousWaitingIds.current = currentWaitingIds
        isFirstRender.current = false
      } catch (err) {
        console.error('Queue poll error:', err)
      }
    }

    fetchQueue()
    // 1.5 soniya juda tez edi: ikkita TV ekran daqiqasiga 80 marta
    // so'rov yuborardi. Navbat shuncha tez o'zgarmaydi — 3 soniya
    // yetarli va serverga tushadigan yuk ikki barobar kamayadi.
    const interval = setInterval(fetchQueue, 3000)
    return () => {
      isMounted = false
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
      if (qorovulRef.current) clearTimeout(qorovulRef.current)
      clearInterval(interval)
    }
  }, [isAudioEnabled])

  // Auto-scroll table to current active calling ticket
  useEffect(() => {
    if (activeRowRef.current && tableContainerRef.current) {
      activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [data.calling])

  const toggleFullscreen = (e) => {
    e.stopPropagation()
    handleUnlockAudio()
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
      }
    }
  }

  const callingList = data?.calling || []
  const waitingList = data?.waiting || []

  // Combine calling and waiting list for table display
  const combinedQueueList = [
    ...callingList.map((c) => ({ ...c, status: 'calling' })),
    ...waitingList.map((w) => ({ ...w, status: 'waiting' })),
  ]

  // Table Pagination & Auto-Swipe State (Max 6 rows per page)
  const [tablePageIndex, setTablePageIndex] = useState(0)
  const ITEMS_PER_PAGE = 6

  const totalPages = Math.max(1, Math.ceil(combinedQueueList.length / ITEMS_PER_PAGE))

  // Auto rotate table pages every 7 seconds if totalPages > 1
  useEffect(() => {
    if (totalPages <= 1) {
      setTablePageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setTablePageIndex((prev) => (prev + 1) % totalPages)
    }, 7000)

    return () => clearInterval(interval)
  }, [totalPages])

  // Ensure tablePageIndex is within valid bounds
  useEffect(() => {
    if (tablePageIndex >= totalPages) {
      setTablePageIndex(Math.max(0, totalPages - 1))
    }
  }, [totalPages, tablePageIndex])

  // Slice visible items for current page
  const visibleQueueList = combinedQueueList.slice(
    tablePageIndex * ITEMS_PER_PAGE,
    (tablePageIndex + 1) * ITEMS_PER_PAGE
  )

  // Clean Uzbek Date format (e.g. PAYSHANBA, 6-AVGUST 2026)
  const daysUz = ['YASHANBA', 'DUSHANBA', 'SESHANBA', 'CHORSHANBA', 'PAYSHANBA', 'JUMA', 'SHANBA']
  const monthsUz = ['JANVAR', 'FEVRAL', 'MART', 'APREL', 'MAY', 'IYUN', 'IYUL', 'AVGUST', 'SENTABR', 'OKTABR', 'NOYABR', 'DEKABR']
  
  const dayName = daysUz[time.getDay()]
  const dayNum = time.getDate()
  const monthName = monthsUz[time.getMonth()]
  const yearNum = time.getFullYear()
  const dateDisplayStr = `${dayName}, ${dayNum}-${monthName} ${yearNum}`

  return (
    <div
      onClick={handleUnlockAudio}
      className="min-h-screen w-screen bg-[#060E26] p-4 md:p-6 font-sans select-none overflow-hidden relative text-slate-900 flex flex-col justify-between"
    >
      {/* AUDIO UNLOCK WARNING BANNER */}
      {!audioUnlocked && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 px-6 py-2 rounded-full font-black text-xs flex items-center gap-3 shadow-2xl z-50 animate-bounce">
          <span>⚠️ OVOZNI FAOLLASHTIRISH UCHUN EKRANGA 1 MARTA BOSING</span>
          <button
            onClick={handleTestAudio}
            className="px-3 py-1 bg-slate-950 text-amber-400 rounded-full text-xs font-bold hover:bg-slate-800 transition-all"
          >
            🔊 Ovozni sinash
          </button>
        </div>
      )}

      {/* ── GIANT DOCTOR CALL OVERLAY MODAL (IMAGE 1 EXACT DESIGN MATCH) ── */}
      {activeCallModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#F8FAFC] border-2 border-slate-200 rounded-[2.5rem] p-6 md:p-8 max-w-xl w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] transform transition-all relative text-slate-900">
            
            {/* Top Bar: Left Logo & Title | Right Doctor Avatar Info */}
            <div className="flex items-center justify-between pb-6 mb-4 border-b border-slate-200/80">
              {/* Left Logo */}
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="MARJONA MED SERVIS"
                  className="h-12 md:h-14 w-auto object-contain shrink-0"
                />
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900 leading-none">
                    Med Servis
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                    MARJONA MED
                  </span>
                </div>
              </div>

              {/* Right Doctor Avatar Info */}
              <div className="flex items-center gap-3 text-right">
                <div>
                  <h4 className="text-base md:text-lg font-extrabold text-slate-900 leading-tight">
                    {activeCallModal.provider_name
                      ? (activeCallModal.provider_name.startsWith('Dr.') ? activeCallModal.provider_name : `Dr. ${activeCallModal.provider_name}`)
                      : 'Dr. Navbatchi'}
                  </h4>
                  <p className="text-xs md:text-sm font-semibold text-slate-500 leading-tight">
                    ({activeCallModal.provider_specialization || activeCallModal.service_name || 'Kardiolog'})
                  </p>
                </div>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-slate-200 bg-sky-100 flex items-center justify-center text-slate-700 font-bold shrink-0 overflow-hidden shadow-sm">
                  <svg className="w-8 h-8 text-sky-600 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2a5 5 0 100 10 5 5 0 000-10zM4 19a7 7 0 0116 0v1H4v-1z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Inner Green Border Ticket Card */}
            <div className="bg-white rounded-3xl border-2 border-emerald-500 shadow-xl overflow-hidden">
              
              {/* Green Header Badge */}
              <div className="bg-[#10B981] text-white p-4 md:p-5 text-center relative flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-2 font-black text-lg md:text-2xl uppercase tracking-wider">
                  <svg className="w-6 h-6 md:w-7 md:h-7 fill-current animate-bounce" viewBox="0 0 24 24">
                    <path d="M12 22a2.98 2.98 0 002.818-2H9.182A2.98 2.98 0 0012 22zm7-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C8.63 5.36 7 7.92 7 11v5l-2 2v1h14v-1l-2-2z"/>
                  </svg>
                  <span>HOZIRGI NAVBAT</span>
                </div>
                <p className="text-xs md:text-sm font-bold opacity-90 mt-1">
                  Shifokor sizni kutyapti
                </p>
              </div>

              {/* Big Bold Ticket Number */}
              <div className="py-6 md:py-8 text-center bg-white">
                <span className="text-6xl sm:text-7xl md:text-8xl font-black font-mono tracking-widest text-[#0B1D45] drop-shadow-sm leading-none block">
                  {(activeCallModal.ticket_number || 'A-001').includes(' - ')
                    ? activeCallModal.ticket_number
                    : activeCallModal.ticket_number.replace('-', ' - ')}
                </span>
                
                <p className="text-base md:text-lg font-extrabold text-slate-700 mt-4">
                  Navbat turi: <span className="text-slate-900 font-black">{activeCallModal.service_name || 'Umumiy'}</span>
                </p>
              </div>
            </div>

            {/* Bottom Room Box */}
            <div className="bg-slate-100/90 border border-slate-200/80 rounded-2xl p-4 md:p-5 flex items-center justify-center gap-4 mt-4 shadow-inner">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-6 h-6 md:w-7 md:h-7 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
                  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h6"/>
                </svg>
              </div>
              <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Xona: <span className="text-slate-950 font-black">{activeCallModal.cabinet || '1-Xona'}</span>
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ── TV DISPLAY MAIN GRID ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 items-stretch overflow-hidden min-h-0">
        
        {/* ── LEFT COLUMN (65% WIDTH / 7 COLS): LOGO & QUEUE TABLE ────── */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-4 md:p-5 shadow-2xl flex flex-col justify-between border-2 border-slate-200 overflow-hidden h-full">
          
          {/* Clinic Branding Header with Official Oval Logo Image & Page Indicator */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-4">
              {/* Official Logo Image */}
              <div className="h-14 md:h-16 shrink-0 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="MARJONA MED SERVIS"
                  className="h-full w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>

              {/* Clinic Executive Title */}
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#0B1D45] leading-none uppercase">
                  MARJONA <span className="text-[#E11D48]">MED SERVIS</span>
                </h1>
                <p className="text-[10px] md:text-xs font-bold text-slate-500 tracking-widest uppercase mt-1">
                  SIZNING SALOMATLIGINGIZ - BIZNING G'AMXO'RLIGIMIZ
                </p>
              </div>
            </div>

            {/* Page Pagination Indicator Badge */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 bg-[#0B1D45] text-white px-3 py-1.5 rounded-full shadow-md animate-in fade-in">
                <span className="text-xs font-mono font-black text-amber-300">
                  {tablePageIndex + 1} / {totalPages} SAHIFA
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block rounded-full transition-all duration-300 ${
                        i === tablePageIndex
                          ? 'w-3.5 h-2 bg-amber-400'
                          : 'w-1.5 h-1.5 bg-slate-500/60'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Queue Table */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div
              ref={tableContainerRef}
              className="overflow-y-auto rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col bg-white custom-scrollbar touch-pan-y"
            >
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-10 shadow-sm">
                  <tr className="bg-[#0B1D45] text-white text-xs md:text-sm font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-3 w-[18%] text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Hash className="h-4 w-4 text-cyan-300 shrink-0" />
                        <span>Raqam</span>
                      </span>
                    </th>
                    <th className="py-3 px-3 w-[24%] text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <DoorClosed className="h-4 w-4 text-amber-300 shrink-0" />
                        <span>Xona/Xizmat</span>
                      </span>
                    </th>
                    <th className="py-3 px-3 w-[24%] text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-4 w-4 text-rose-300 shrink-0" />
                        <span>Bemor / Mijoz</span>
                      </span>
                    </th>
                    <th className="py-3 px-3 w-[34%] text-right whitespace-nowrap">
                      <span className="inline-flex items-center justify-end gap-1.5 w-full">
                        <Clock className="h-4 w-4 text-emerald-300 shrink-0" />
                        <span>Holati</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody key={tablePageIndex} className="divide-y divide-slate-100 text-sm md:text-base font-semibold transition-all duration-500 animate-in fade-in">
                  {visibleQueueList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-24 text-center text-slate-400 font-bold text-lg">
                        Hozircha faol navbatlar yo'q
                      </td>
                    </tr>
                  ) : (
                    visibleQueueList.map((item, index) => {
                      const isCalling = item.status === 'calling'
                      const firstCallingId = callingList[0]?.id
                      const isFirstCalling = isCalling && item.id === firstCallingId

                      return (
                        <tr
                          key={item.id || index}
                          ref={isFirstCalling ? activeRowRef : null}
                          className={`transition-all ${
                            isCalling 
                              ? 'bg-emerald-50/80 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                              : index % 2 === 0 ? 'bg-white text-slate-900' : 'bg-slate-50 text-slate-900'
                          }`}
                        >
                          {/* Ticket Number Badge */}
                          <td className="py-3 px-3">
                            <span className={`inline-block px-3 py-1 rounded-xl font-black text-base md:text-xl font-mono tracking-wider shadow-sm border ${
                              isCalling 
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md animate-pulse' 
                                : 'bg-slate-100 text-[#0B1D45] border-slate-200'
                            }`}>
                              {item.ticket_number}
                            </span>
                          </td>

                          {/* Room / Cabinet / Service */}
                          <td className="py-3 px-3 font-bold truncate text-slate-800">
                            {item.cabinet || item.service_name || '1-xona'}
                          </td>

                          {/* Patient Name */}
                          <td className="py-3 px-3 font-extrabold truncate text-slate-900">
                            {formatShortName(item.first_name, item.last_name)}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 text-right">
                            {isCalling ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs md:text-sm font-black bg-emerald-600 text-white shadow-md border border-emerald-500 animate-pulse">
                                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
                                <span className="flex flex-col items-center justify-center leading-tight text-[10px] md:text-[11px] font-black tracking-wider uppercase">
                                  <span>XIZMAT</span>
                                  <span>KO'RSATILMOQDA</span>
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                                KUTILMOQDA
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (35% WIDTH / 5 COLS): 3 STACKED CARDS ──────── */}
        <div className="lg:col-span-5 flex flex-col gap-3 justify-between h-full overflow-hidden min-h-0">

          {/* 1. REAL-TIME CLOCK & DATE CARD (COMPACT HEIGHT) */}
          <div className="bg-white rounded-3xl p-3 shadow-2xl border-2 border-slate-200 text-center flex flex-col items-center justify-center shrink-0 h-[84px]">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl md:text-4xl">🕒</span>
              <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-[#0B1D45]">
                {time.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] md:text-xs font-black tracking-widest text-[#0B1D45] uppercase">
              {dateDisplayStr}
            </div>
          </div>

          {/* 2. ADVERTISEMENT / BANNER CAROUSEL CARD (BALANCED SIZE) */}
          <div className="bg-[#0B1D45] rounded-3xl shadow-2xl border-2 border-slate-200 flex-1 relative overflow-hidden min-h-[280px] md:min-h-[330px]">
            
            {/* Custom Uploaded Banner Image/Video Slider OR Default Promo Banner */}
            {banners.length > 0 ? (
              (() => {
                const banner = banners[currentSlideIndex % banners.length]
                const rawUrl = banner.image_url || ''
                const bannerUrl = rawUrl.startsWith('http') ? rawUrl : (rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`)
                // Bazadan uzatilgan havolada kengaytma yo'q, shuning uchun avval
                // content_type ga qaraymiz, keyin havola kengaytmasiga.
                const isVideo = banner.content_type
                  ? banner.content_type.startsWith('video/')
                  : /\.(mp4|webm|ogg|mov)$/i.test(bannerUrl)

                return (
                  <div key={slideAnimKey} className="w-full h-full absolute inset-0 transition-all duration-700 animate-in slide-in-from-right duration-500">
                    {isVideo ? (
                      <video
                        src={bannerUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover rounded-3xl"
                      />
                    ) : (
                      <img
                        src={bannerUrl}
                        alt={banners[currentSlideIndex % banners.length].title || 'Reklama'}
                        className="w-full h-full object-cover rounded-3xl"
                      />
                    )}
                  </div>
                )
              })()
            ) : (
              /* Clean Promo Slide Display (Balanced Medium Banner) */
              <div key={slideAnimKey} className="absolute inset-0 p-5 md:p-6 flex flex-col justify-between transition-all duration-700 animate-in slide-in-from-right duration-500 overflow-hidden bg-gradient-to-br from-[#0B1D45] via-[#102A63] to-[#071330] text-white">
                <div className="space-y-2 md:space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full inline-block backdrop-blur-sm border border-amber-400/20">
                    {DEFAULT_SLIDES[currentSlideIndex % DEFAULT_SLIDES.length].badge}
                  </span>

                  <h3 className="text-xl md:text-2xl lg:text-3xl font-black leading-tight uppercase text-white drop-shadow-md">
                    {DEFAULT_SLIDES[currentSlideIndex % DEFAULT_SLIDES.length].title}
                  </h3>
                  
                  <p className="text-xl md:text-2xl lg:text-3xl font-black text-rose-400 tracking-tight drop-shadow-md">
                    {DEFAULT_SLIDES[currentSlideIndex % DEFAULT_SLIDES.length].highlight}
                  </p>

                  <p className="text-sm md:text-base font-semibold text-slate-200 pt-1 leading-snug">
                    {DEFAULT_SLIDES[currentSlideIndex % DEFAULT_SLIDES.length].desc}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/15">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="MARJONA" className="h-8 md:h-10 w-auto object-contain bg-white/10 p-1 rounded-xl border border-white/10" />
                    <span className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">MARJONA MED SERVIS</span>
                  </div>
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                    {DEFAULT_SLIDES[currentSlideIndex % DEFAULT_SLIDES.length].buttonText}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. SOCIAL NETWORKS, PHONE & LOCATION CARD (2x2 GRID LAYOUT) */}
          <div className="bg-white rounded-3xl p-2.5 md:p-3 shadow-2xl border-2 border-slate-200 shrink-0 flex flex-col justify-between">
            <h4 className="text-xs font-black text-[#0B1D45] uppercase tracking-widest text-center border-b border-slate-100 pb-1.5 shrink-0">
              IJTIMOIY TARMOQLAR, ALOQA VA JOYLASHUV
            </h4>

            {/* 2x2 GRID LAYOUT (2 PER ROW: 1 2 / 3 4) */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-2">
              {/* 1. Instagram */}
              <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 border border-pink-100 shadow-sm">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-[#0B1D45] uppercase tracking-wider block font-bold leading-tight">Instagram</span>
                  <span className="text-xs font-black text-[#0B1D45] block leading-tight truncate">@marjona.med.servis</span>
                </div>
              </div>

              {/* 2. Telegram */}
              <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 text-sky-700 border border-sky-100 shadow-sm">
                <div className="w-7 h-7 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-[#0B1D45] uppercase tracking-wider block font-bold leading-tight">Telegram</span>
                  <span className="text-xs font-black text-[#0B1D45] block leading-tight truncate">@marjona_med_service</span>
                </div>
              </div>

              {/* 3. Phone Number */}
              <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border border-emerald-100 shadow-sm">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.02-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-[#0B1D45] uppercase tracking-wider block font-bold leading-tight">Aloqa Telefon</span>
                  <span className="text-xs font-black text-[#0B1D45] block leading-tight truncate">+998 55 604-44-24</span>
                </div>
              </div>

              {/* 4. Location / Manzil (Hazorasp Sentr) */}
              <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border border-amber-200/80 shadow-sm">
                <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-[#0B1D45] uppercase tracking-wider block font-bold leading-tight">Joylashuv / Manzil</span>
                  <span className="text-xs font-black text-[#0B1D45] block leading-tight truncate">Hazorasp Sentr</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ── LIVE SCROLLING TICKER MARQUEE BAR (YURUVCHI YOZUV) ────── */}
      <div className="mt-3 bg-gradient-to-r from-[#0B1D45] via-[#102A63] to-[#0B1D45] border-2 border-amber-400/80 rounded-2xl py-2 px-4 text-amber-300 font-extrabold text-sm md:text-base flex items-center gap-3 overflow-hidden shadow-2xl shrink-0">
        <div className="bg-amber-400 text-slate-950 font-black text-xs uppercase px-3 py-1 rounded-xl shrink-0 flex items-center gap-1.5 shadow-md">
          <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
          <span>📢 E'LON</span>
        </div>
        <div className="overflow-hidden whitespace-nowrap flex-1 relative">
          <div className="animate-marquee-scroll font-mono tracking-wide text-amber-300 font-black text-sm md:text-lg">
            {tickerText}
          </div>
        </div>
      </div>

      {/* ── BOTTOM TV CONTROL BAR ──────────────────────────────────── */}
      <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-300 border-t border-slate-800/60">
        <div className="flex items-center gap-2 font-bold text-slate-400">
          <span>📢 MARJONA MED SERVIS ELECTRONIC QUEUE SYSTEM</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestAudio}
            className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-black hover:bg-amber-300 transition-all text-xs"
          >
            🔊 Ovozni sinash
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsAudioEnabled(!isAudioEnabled)
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition-all text-xs"
          >
            {isAudioEnabled ? '🔊 Ovoz Yoniq' : "🔇 Ovoz O'chirilgan"}
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg bg-[#E11D48] text-white font-bold hover:bg-rose-600 transition-all text-xs"
          >
            {isFullscreen ? '📉 Chiqish' : '🖥️ TV Rejim'}
          </button>
        </div>
      </div>
    </div>
  )
}
