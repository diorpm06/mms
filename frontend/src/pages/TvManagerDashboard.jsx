import { useState, useEffect } from 'react'
import { Tv, Image, Volume2, Monitor, Play, RefreshCw, Send, Radio, VolumeX, CheckCircle, Sparkles, Layers, Sliders } from 'lucide-react'
import { api } from '../utils/api'
import { useToastStore } from '../store/toastStore'
import BannersManager from '../components/BannersManager'
import { PageHeader, Btn } from '../components/UIKit'
import { BRAND } from '../config/brand'

const MARQUEE_PRESETS = [
  `🏥 ${BRAND.name} klinikasiga xush kelibsiz! Ish vaqti ${BRAND.workHours}.`,
  "✨ Diqqat Aksiya! Eko-profil va UZI tahlillari uchun 20% chegirma e'lon qilindi!",
  "⚠️ Iltimos, navbatingiz kelganda elektron ekrandagi xona raqamiga rioya qiling.",
  `📞 Murojaat uchun telefon: ${BRAND.phone}`,
]

export default function TvManagerDashboard({ defaultTab = 'live' }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [tickerText, setTickerText] = useState(() => {
    return localStorage.getItem('tv_ticker_text') || MARQUEE_PRESETS[0]
  })
  const [savingTicker, setSavingTicker] = useState(false)
  const [queueLive, setQueueLive] = useState({ calling: [], waiting_count: 0 })
  const [volume, setVolume] = useState(100)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const toast = useToastStore((s) => s.add)

  const fetchLiveQueue = () => {
    api('/queue/live')
      .then((data) => {
        setQueueLive(data || { calling: [], waiting_count: 0 })
        if (data?.ticker_text) {
          setTickerText(data.ticker_text)
          localStorage.setItem('tv_ticker_text', data.ticker_text)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchLiveQueue()
    const timer = setInterval(fetchLiveQueue, 4000)
    return () => clearInterval(timer)
  }, [])

  const handleOpenTvWindow = () => {
    window.open('/tv', '_blank', 'width=1280,height=720,menubar=no,toolbar=no')
  }

  const handleTestVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const text = "Diqqat! B-007 raqamli bemor, 3-xonaga, Doktor qabuliga kiring!"
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'uz-UZ'
      utterance.rate = 0.9
      utterance.volume = volume / 100
      window.speechSynthesis.speak(utterance)
      toast("🔊 Ovozli sinov matni aytilmoqda...")
    } else {
      toast("Ovozli tizim ushbu brauzerda qo'llab-quvvatlanmaydi", "error")
    }
  }

  const handleSaveTicker = async (e) => {
    if (e) e.preventDefault()
    if (!tickerText || !tickerText.trim()) return
    setSavingTicker(true)
    try {
      localStorage.setItem('tv_ticker_text', tickerText)
      const res = await api('/queue/ticker', {
        method: 'POST',
        body: JSON.stringify({ ticker_text: tickerText.trim() }),
      })
      window.dispatchEvent(new Event('ticker_text_updated'))
      toast(res.message || "✓ TV Ekrani pastki yuguruvchi xabari saqlandi va barcha TV ekranlarga uzatildi! 📢")
    } catch (err) {
      toast(err.message || "Xatolik yuz berdi", "error")
    } finally {
      setSavingTicker(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      
      {/* HEADER BANNER */}
      <div className="card p-6 bg-gradient-to-r from-surface via-surface-2 to-surface border border-gold/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gold-dim border-2 border-gold/40 text-gold flex items-center justify-center text-2xl shadow-lg shadow-gold/10">
            📺
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gold tracking-tight uppercase">
                TV Navbat va Reklama Boshqaruv Markazi
              </h1>
              <span className="badge badge-success text-[10px] uppercase tracking-wider font-mono animate-pulse">
                ● BROADCAST ONLINE
              </span>
            </div>
            <p className="text-xs text-muted font-bold mt-1">
              Jonli TV ekranini boshqarish, reklama bannerlarini joylash va ovozli chaqiruv sozlamalari
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end relative z-10">
          <button
            type="button"
            onClick={fetchLiveQueue}
            className="btn-outline py-2 px-3 text-xs"
            title="Ma'lumotlarni yangilash"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenTvWindow}
            className="btn-gold py-2.5 px-5 text-xs font-black flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
          >
            <Monitor className="h-4 w-4" /> 📺 TV Monitorini Ochish (Full Screen) ↗
          </button>
        </div>
      </div>

      {/* UNIFIED NAVIGATION TAB SELECTOR */}
      <div className="card p-2 flex flex-wrap gap-2 border-gold/30">
        <button
          type="button"
          onClick={() => setActiveTab('live')}
          className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all ${
            activeTab === 'live'
              ? 'bg-gold text-slate-950 shadow-lg font-black scale-105'
              : 'bg-surface-2 text-muted hover:text-body border border-border'
          }`}
        >
          <Monitor className="h-4 w-4" />
          <span>📺 Jonli TV Monitor va Chaqiruv</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banners')}
          className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all ${
            activeTab === 'banners'
              ? 'bg-cyan text-white shadow-lg font-black scale-105'
              : 'bg-surface-2 text-muted hover:text-body border border-border'
          }`}
        >
          <Image className="h-4 w-4" />
          <span>🖼️ TV Reklama Bannerlari va Aksiyalar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audio')}
          className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all ${
            activeTab === 'audio'
              ? 'bg-emerald text-white shadow-lg font-black scale-105'
              : 'bg-surface-2 text-muted hover:text-body border border-border'
          }`}
        >
          <Volume2 className="h-4 w-4" />
          <span>🔊 Ovozli Chaqiruv & Spiker Sozlamalari</span>
        </button>
      </div>

      {/* ── TAB 1: LIVE TV SCREEN & PREVIEW ────────────────── */}
      {activeTab === 'live' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Ticker Text Control Box */}
          <div className="card p-5 space-y-4 border-cyan/40 bg-surface shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3">
              <h3 className="text-xs font-black text-cyan uppercase tracking-wider flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan animate-pulse" />
                📢 TV Ekrani Pastki Yuguruvchi Satri (Live Marquee Ticker)
              </h3>
              <span className="text-[11px] text-muted font-mono font-bold">
                Matn TV ekranining pastki qismida tinimsiz aylanib turadi
              </span>
            </div>

            <form onSubmit={handleSaveTicker} className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                type="text"
                value={tickerText}
                onChange={(e) => setTickerText(e.target.value)}
                className="input-field text-xs font-bold text-body py-2.5"
                placeholder="TV ekranda ko'rinadigan e'lon matni..."
              />
              <button
                type="submit"
                disabled={savingTicker}
                className="btn-cyan py-2.5 px-6 text-xs font-black whitespace-nowrap flex items-center gap-2"
              >
                <Send className="h-4 w-4" /> Saqlash va Uzatish
              </button>
            </form>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-muted block uppercase tracking-wider">
                ⚡ Tayyor shablonlar (Bir bosishda tanlash):
              </span>
              <div className="flex flex-wrap gap-2">
                {MARQUEE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTickerText(preset)}
                    className="px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-[11px] font-medium text-body hover:border-gold-glow transition-all text-left"
                  >
                    "{preset.slice(0, 45)}..."
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview & Calling Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live TV Screen Frame Preview */}
            <div className="lg:col-span-2 card p-5 space-y-4 border-gold/30">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-black text-gold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  📺 Jonli TV Ekran Monitori (Studio Preview)
                </span>
                <button
                  type="button"
                  onClick={handleOpenTvWindow}
                  className="btn-outline py-1 px-3 text-[11px]"
                >
                  Kattalashtirib Ochish ↗
                </button>
              </div>

              {/* High-Tech TV Monitor Visual Frame */}
              <div className="relative rounded-3xl overflow-hidden border-4 border-slate-800 bg-slate-950 aspect-video shadow-2xl flex flex-col justify-between p-5 text-white">
                
                {/* Simulated Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gold font-black text-sm uppercase tracking-wider">MARJONA MED SERVICE</span>
                  </div>
                  <span className="badge badge-info font-mono text-[10px] uppercase tracking-wider">JONLI NAVBAT</span>
                </div>

                {/* Simulated Active Call Displays */}
                <div className="grid grid-cols-2 gap-4 text-center my-auto">
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-lg">
                    <span className="text-[10px] text-cyan-300 uppercase font-black tracking-wider block">Hozir Xonada (Qabulda)</span>
                    <span className="text-3xl font-black text-emerald-400 font-mono block mt-1">
                      {queueLive.calling && queueLive.calling.length > 0 ? queueLive.calling[0].ticket_number || 'A-001' : 'Kutilmoqda...'}
                    </span>
                    <span className="text-xs text-slate-300 font-bold block mt-1">
                      {queueLive.calling && queueLive.calling.length > 0 ? `${queueLive.calling[0].service_name} • ${queueLive.calling[0].cabinet || '1-Xona'}` : '—'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-gold/40 shadow-lg">
                    <span className="text-[10px] text-gold uppercase font-black tracking-wider block">Kutayotgan Bemorlar</span>
                    <span className="text-4xl font-black text-gold font-mono block mt-1">
                      {queueLive.waiting_count || 0} nafar
                    </span>
                    <span className="text-[10px] text-muted font-bold block mt-1">Kassa & Navbat kutish zali</span>
                  </div>
                </div>

                {/* Simulated Bottom Marquee Bar */}
                <div className="bg-slate-900/90 border border-gold/30 rounded-xl p-2.5 text-xs text-gold font-bold overflow-hidden whitespace-nowrap">
                  📢 {tickerText}
                </div>
              </div>
            </div>

            {/* Live Queue Calling List */}
            <div className="card p-5 space-y-4 border-border">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-black text-gold uppercase tracking-wider">
                  📋 Bugungi Chaqirilganlar
                </h3>
                <span className="badge badge-info font-mono text-[10px]">
                  {queueLive.calling?.length || 0} aktiv
                </span>
              </div>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {(!queueLive.calling || queueLive.calling.length === 0) ? (
                  <div className="py-12 text-center text-xs text-muted card-2 border border-dashed border-border rounded-2xl">
                    <p className="font-bold text-body">Hali chaqirilgan bemor yo'q</p>
                    <p className="text-[11px] text-muted mt-1">Shifokor panelidan "Xonaga Chaqirish" bosilganda shu yerda ko'rinadi</p>
                  </div>
                ) : (
                  queueLive.calling.map((c) => (
                    <div key={c.id} className="card-2 p-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-black text-cyan text-sm block">{c.ticket_number || (c.is_paper_entry ? '—' : `A-${c.id}`)}</span>
                        <span className="text-xs font-bold text-body block">{c.first_name} {c.last_name}</span>
                        <span className="text-[10px] text-muted block">{c.service_name} • 🚪 {c.cabinet || '1-Xona'}</span>
                      </div>
                      <span className="badge badge-success text-[10px]">Chaqirildi</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ── TAB 2: TV BANNER MANAGEMENT ────────────────── */}
      {activeTab === 'banners' && (
        <div className="animate-in fade-in duration-200">
          <BannersManager />
        </div>
      )}

      {/* ── TAB 3: AUDIO & VOICE SETTINGS ────────────────── */}
      {activeTab === 'audio' && (
        <div className="card p-6 space-y-6 max-w-2xl animate-in fade-in duration-200 border-gold/30">
          <div className="border-b border-border pb-4">
            <h3 className="text-sm font-black text-gold uppercase tracking-wide flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-gold" /> Ovozli Chaqiruv (TTS Speaker) Sozlamalari
            </h3>
            <p className="text-xs text-muted mt-1 font-medium">
              Bemor xonaga chaqirilganda dinamiklar orqali o'zbek tilida baland va tushunarli e'lon qilish
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 card-2">
              <div>
                <strong className="text-sm text-body font-bold block">Ovozli Chaqiruv (Uzbek Voice)</strong>
                <span className="text-muted text-[11px]">Bemor chaqirilganda avtomatik ovoz chiqarish</span>
              </div>
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(e) => setVoiceEnabled(e.target.checked)}
                className="w-5 h-5 accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-2 p-4 card-2">
              <label className="form-label font-bold text-body">🔊 Ovoz Balandligi: {volume}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestVoice}
                className="btn-gold py-3 px-6 text-xs font-black flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
              >
                <Play className="h-4 w-4" /> 🎙️ Ovozni Tekshirish (Test Audio Speaker)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
