import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  LogOut,
  RefreshCw,
  Award,
  ShieldCheck,
  FileText,
  AlertCircle
} from 'lucide-react'
import { api } from '../../utils/api'
import { useAuthStore } from '../../store/authStore'
import { BRAND } from '../../config/brand'

// Yangi bemor kelganda chalinadigan ikki notali "ding" ovozi (Web Audio,
// tashqi audio fayl kerak emas).
function playNewPatientChime() {
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext
    if (!AudioCtxClass) return
    const ctx = new AudioCtxClass()
    const now = ctx.currentTime
    ;[[880, 0], [1174.66, 0.15]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      gain.gain.setValueAtTime(0.5, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + 0.6)
    })
  } catch (_) {}
}

export default function ReferrerPortal() {
  const navigate = useNavigate()
  const { logout, accessToken } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('daily') // 'daily' | 'patients'

  // Yangi bemor bildirishnomasi — sahifa birinchi ochilganda mavjud
  // bemorlarni "yangi" deb e'lon qilmasligi kerak (TV navbat ekranida
  // aynan shu xato tufayli qayta-qayta e'lon qilib yuborilgan edi),
  // shuning uchun birinchi yuklanish faqat "boshlang'ich holat"ni yozib
  // qo'yadi, e'lon qilmaydi.
  const seenPatientIdsRef = useRef(null)

  const fetchProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api('/referrers/me/profile?days=10')
      setProfileData(res)

      const currentIds = new Set((res?.patients || []).map((p) => p.patient_id))
      if (seenPatientIdsRef.current === null) {
        seenPatientIdsRef.current = currentIds
      } else {
        const newOnes = (res?.patients || []).filter((p) => !seenPatientIdsRef.current.has(p.patient_id))
        if (newOnes.length > 0) {
          playNewPatientChime()
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            newOnes.forEach((p) => {
              try {
                new Notification(`🆕 ${BRAND.name} — Yangi bemor`, {
                  body: `${p.patient_name} — ${p.service_name} (${formatMoney(p.referrer_fee)} ulush)`,
                  tag: `referrer-patient-${p.patient_id}`,
                })
              } catch (_) {}
            })
          }
        }
        seenPatientIdsRef.current = currentIds
      }
    } catch (err) {
      setError(err.message || "Profil ma'lumotlarini yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    fetchProfile()
    // Yangi bemor tez bilinishi uchun 20 soniyada bir tekshiriladi —
    // portal ochiq turgan (yoki fonda ishlayotgan, o'rnatilgan web-app)
    // paytda ovoz + bildirishnoma shu orqali keladi.
    const t = setInterval(fetchProfile, 20000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = async () => {
    try {
      if (accessToken) await api('/auth/logout', { method: 'POST' })
    } catch (_) {}
    logout()
    navigate('/login')
  }

  const formatMoney = (val) => {
    if (!val && val !== 0) return '0 so\'m'
    return `${val.toLocaleString('ru-RU')} so'm`
  }

  if (loading && !profileData) {
    return (
      <div className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center p-6 text-body font-sans">
        <RefreshCw className="h-10 w-10 text-cyan animate-spin mb-4" />
        <p className="text-sm font-bold text-muted">Shaxsiy kabinet yuklanmoqda...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center p-6 text-body font-sans">
        <div className="card p-6 border-rose-500/40 bg-rose-500/10 text-center space-y-4 max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-black text-rose-500 uppercase">Xatolik</h3>
          <p className="text-xs text-rose-400 font-medium">{error}</p>
          <button
            onClick={fetchProfile}
            className="btn-gold py-2 px-4 text-xs font-bold w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Qayta urinish
          </button>
        </div>
      </div>
    )
  }

  const ref = profileData?.referrer || {}
  const sum = profileData?.summary || {}
  const daily = profileData?.daily_stats || []
  const patients = profileData?.patients || []

  return (
    <div className="min-h-screen bg-surface-sunken text-body font-sans p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      
      {/* ── TOP HEADER ───────────────────────────────────────────── */}
      <header className="card p-4 sm:p-5 border-cyan/40 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
            {ref.full_name ? ref.full_name.charAt(0).toUpperCase() : 'Y'}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-xl font-black text-body tracking-wide truncate">
                {ref.full_name}
              </h1>
              <span className="badge badge-success text-[10px] uppercase font-black px-2 py-0.5 shrink-0">
                🟢 Faol
              </span>
            </div>
            <p className="text-xs text-muted flex flex-wrap items-center gap-2 font-medium">
              <span>📱 Tel: {ref.phone || 'Biriktirilmagan'}</span>
              <span>•</span>
              <span className="text-cyan font-mono font-bold">ID: #{ref.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-border pt-3 sm:pt-0">
          <button
            onClick={fetchProfile}
            className="flex-1 sm:flex-initial py-2 px-3 bg-surface-2 hover:bg-surface-hover text-body rounded-xl border border-border transition-all text-xs font-bold flex items-center justify-center gap-1.5"
            title="Yangilash"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yangilash</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex-1 sm:flex-initial py-2 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Chiqish</span>
          </button>
        </div>
      </header>

      {/* ── KPI SUMMARY STATS CARDS ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* 1. 10-Day Earned */}
        <div className="card p-4 sm:p-5 border-amber-500/40 bg-amber-500/10 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[11px] font-black uppercase tracking-wider">
              📅 10-Kunlik Ulush
            </span>
            <TrendingUp className="h-5 w-5 opacity-90" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-500 font-mono">
            {formatMoney(sum.ten_day_earned)}
          </p>
          <p className="text-[11px] text-muted font-medium">
            Oxirgi 10 kun ichida ishlangan ulushingiz
          </p>
        </div>

        {/* 2. Total Patients */}
        <div className="card p-4 sm:p-5 border-cyan-500/40 bg-cyan-500/10 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-cyan-500">
            <span className="text-[11px] font-black uppercase tracking-wider">
              👥 Bemorlar Soni
            </span>
            <Users className="h-5 w-5 opacity-90" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-cyan-500 font-mono">
            {sum.ten_day_patients || 0} nafar
          </p>
          <p className="text-[11px] text-muted font-medium">
            Jami yuborilgan bemorlar: <b className="text-body">{sum.total_patients || 0} nafar</b>
          </p>
        </div>

        {/* 3. Olgan Avansi */}
        <div className="card p-4 sm:p-5 border-blue-500/40 bg-blue-500/10 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-blue-500">
            <span className="text-[11px] font-black uppercase tracking-wider">
              💳 Olgan Avansi
            </span>
            <DollarSign className="h-5 w-5 opacity-90" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-500 font-mono">
            {formatMoney(sum.initial_advance || 0)}
          </p>
          <p className="text-[11px] text-muted font-medium">
            Klinikadan olingan dastlabki avans
          </p>
        </div>

        {/* 4. Hozirgi Balans (Minus balans rangi va izohi bilan) */}
        <div className={`card p-4 sm:p-5 space-y-1.5 shadow-md ${
          (sum.net_balance ?? 0) < 0
            ? 'border-rose-500/40 bg-rose-500/10'
            : 'border-purple-500/40 bg-purple-500/10'
        }`}>
          <div className={`flex items-center justify-between ${
            (sum.net_balance ?? 0) < 0 ? 'text-rose-500' : 'text-purple-500'
          }`}>
            <span className="text-[11px] font-black uppercase tracking-wider">
              💰 Hozirgi Balans
            </span>
            <Award className="h-5 w-5 opacity-90" />
          </div>
          <p className={`text-xl sm:text-2xl font-black font-mono ${
            (sum.net_balance ?? 0) < 0 ? 'text-rose-500' : 'text-purple-500'
          }`}>
            {formatMoney(sum.net_balance ?? 0)}
          </p>
          {(sum.net_balance ?? 0) < 0 ? (
            <p className="text-[11px] text-rose-500 font-bold">
              🔻 Avans qoplanmoqda ({formatMoney(sum.net_balance ?? 0)})
            </p>
          ) : (
            <p className="text-[11px] text-muted font-medium">
              Tayyor to'lanadigan sof balans
            </p>
          )}
        </div>

      </div>

      {/* ── STAVKALAR / RATES BAR ─────────────────────────────────── */}
      <div className="card p-3.5 sm:p-4 bg-surface-2 border-border space-y-2 text-xs">
        <span className="font-black text-amber-500 uppercase flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" /> Belgilangan KPI va Komissiya Foizlaringiz:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 font-mono font-bold text-body">
          <div className="bg-surface px-2.5 py-1.5 rounded-lg border border-border flex items-center justify-between">
            <span className="text-muted text-[11px]">🧪 Lab:</span>
            <b className="text-cyan">{ref.lab_percent}%</b>
          </div>
          <div className="bg-surface px-2.5 py-1.5 rounded-lg border border-border flex items-center justify-between">
            <span className="text-muted text-[11px]">⚡ Fizio:</span>
            <b className="text-cyan">{ref.fizio_percent}%</b>
          </div>
          <div className="bg-surface px-2.5 py-1.5 rounded-lg border border-border flex items-center justify-between">
            <span className="text-muted text-[11px]">🖥️ UZI:</span>
            <b className="text-cyan">{ref.uzi_sum ? `${ref.uzi_sum.toLocaleString()} so'm` : '15 000 so\'m'}</b>
          </div>
          <div className="bg-surface px-2.5 py-1.5 rounded-lg border border-border flex items-center justify-between">
            <span className="text-muted text-[11px]">🌀 Ozon:</span>
            <b className="text-cyan">{ref.ozon_sum ? `${ref.ozon_sum.toLocaleString()} so'm` : '10 000 so\'m'}</b>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT TABS & TABLES ────────────────────────────── */}
      <div className="card p-4 sm:p-6 space-y-4 shadow-lg bg-surface">
        
        {/* Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 sm:flex-initial py-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-cyan text-white shadow-md'
                : 'bg-surface-2 text-muted hover:bg-surface-hover hover:text-body border border-border'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Kunlik Dinamika</span>
          </button>

          <button
            onClick={() => setActiveTab('patients')}
            className={`flex-1 sm:flex-initial py-2 px-3 sm:px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'patients'
                ? 'bg-cyan text-white shadow-md'
                : 'bg-surface-2 text-muted hover:bg-surface-hover hover:text-body border border-border'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Bemorlar ({patients.length})</span>
          </button>
        </div>

        {/* TAB 1: KUNLIK DINAMIKA (DAILY BREAKDOWN) */}
        {activeTab === 'daily' && (
          <div className="space-y-3 animate-fadeIn">
            <h3 className="text-[11px] font-black uppercase text-muted tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan" /> Kunlar bo'yicha yuborilgan bemorlar va ulushingiz:
            </h3>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2 text-muted font-mono uppercase text-[11px] border-b border-border">
                  <tr>
                    <th className="p-3">Sana</th>
                    <th className="p-3 text-center">Bemorlar Soni</th>
                    <th className="p-3 text-right">Sizning Ulushingiz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {daily.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted italic">
                        Ushbu davrda ma'lumot yo'q
                      </td>
                    </tr>
                  ) : (
                    daily.map((d, i) => (
                      <tr key={d.date || i} className="hover:bg-surface-hover transition-colors">
                        <td className="p-3 font-mono font-bold text-body">{d.date}</td>
                        <td className="p-3 text-center font-mono font-bold text-cyan">
                          {d.patient_count > 0 ? `${d.patient_count} nafar` : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-amber-500">
                          {d.earned_fee > 0 ? formatMoney(d.earned_fee) : '0 so\'m'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="block md:hidden space-y-2.5">
              {daily.length === 0 ? (
                <div className="p-6 text-center text-muted italic bg-surface-2 rounded-xl">
                  Ushbu davrda ma'lumot yo'q
                </div>
              ) : (
                daily.map((d, i) => (
                  <div
                    key={d.date || i}
                    className="p-3.5 bg-surface-2 border border-border rounded-xl flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div>
                      <span className="text-xs font-mono font-bold text-body block">{d.date}</span>
                      <span className="text-[11px] font-bold text-cyan">
                        {d.patient_count > 0 ? `👥 ${d.patient_count} nafar bemor` : 'Bemor yo\'q'}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-muted uppercase block">Ulushingiz:</span>
                      <b className="text-sm font-black text-amber-500">{formatMoney(d.earned_fee)}</b>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BEMORLAR RO'YXATI (PATIENTS DETAIL TABLE) */}
        {activeTab === 'patients' && (
          <div className="space-y-3 animate-fadeIn">
            <h3 className="text-[11px] font-black uppercase text-muted tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan" /> Siz yuborgan bemorlar va ularning stavkalari:
            </h3>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2 text-muted font-mono uppercase text-[11px] border-b border-border">
                  <tr>
                    <th className="p-3 text-center">#</th>
                    <th className="p-3">Sana va Vaqt</th>
                    <th className="p-3">Bemor F.I.Sh</th>
                    <th className="p-3">Xizmat Nomi</th>
                    <th className="p-3 text-center">Belgilangan KPI/Stavka</th>
                    <th className="p-3 text-right">Hisoblangan Ulush</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-semibold">
                  {patients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted italic">
                        Bemorlar ro'yxati yo'q
                      </td>
                    </tr>
                  ) : (
                    patients.map((p, pIdx) => (
                      <tr key={p.patient_id || pIdx} className="hover:bg-surface-hover transition-colors">
                        <td className="p-3 text-center font-mono text-muted">#{pIdx + 1}</td>
                        <td className="p-3 font-mono text-body">{p.date}</td>
                        <td className="p-3 font-extrabold text-body">{p.patient_name}</td>
                        <td className="p-3 text-muted">{p.service_name}</td>
                        <td className="p-3 text-center font-mono font-bold text-amber-500">
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px]">
                            {p.rate_label}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-black text-cyan">
                          {formatMoney(p.referrer_fee)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="block md:hidden space-y-2.5">
              {patients.length === 0 ? (
                <div className="p-6 text-center text-muted italic bg-surface-2 rounded-xl">
                  Bemorlar ro'yxati yo'q
                </div>
              ) : (
                patients.map((p, pIdx) => (
                  <div
                    key={p.patient_id || pIdx}
                    className="p-3.5 bg-surface-2 border border-border rounded-xl space-y-2 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
                      <div>
                        <span className="text-[10px] font-mono text-muted uppercase block">#{pIdx + 1} • {p.date}</span>
                        <h4 className="text-sm font-black text-body">{p.patient_name}</h4>
                      </div>
                      <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0">
                        {p.rate_label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                      <span className="text-muted truncate max-w-[180px]">{p.service_name}</span>
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-muted uppercase block">Ulush:</span>
                        <b className="text-xs font-black text-cyan">{formatMoney(p.referrer_fee)}</b>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
