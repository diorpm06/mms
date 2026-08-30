import React, { useState, useEffect } from 'react'
import {
  X,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  Key,
  Copy,
  Check,
  Edit2,
  Save,
  Printer,
  ShieldCheck,
  RefreshCw,
  Award,
  FileText
} from 'lucide-react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/authStore'

export default function ReferrerProfileModal({ referrerId, onClose }) {
  const isCEO = useAuthStore((s) => s.role) === 'ceo'
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('daily') // 'daily' | 'patients'
  
  // Credentials state
  const [editingCreds, setEditingCreds] = useState(false)
  const [credForm, setCredForm] = useState({ username: '', password: '' })
  const [savingCreds, setSavingCreds] = useState(false)
  const [copiedField, setCopiedField] = useState(null)

  const fetchProfile = async () => {
    if (!referrerId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api(`/referrers/${referrerId}/profile?days=10`)
      setData(res)
      if (res?.referrer) {
        setCredForm({
          username: res.referrer.username || '',
          password: res.referrer.plain_password || ''
        })
      }
    } catch (e) {
      setError(e.message || "Yo'naltiruvchi profilini yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [referrerId])

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSaveCredentials = async (e) => {
    e.preventDefault()
    setSavingCreds(true)
    try {
      await api(`/referrers/${referrerId}/credentials`, {
        method: 'POST',
        body: credForm
      })
      alert("✓ Login va parol saqlandi!")
      setEditingCreds(false)
      fetchProfile()
    } catch (err) {
      alert(err.message || "Saqlashda xatolik")
    } finally {
      setSavingCreds(false)
    }
  }

  const formatMoney = (val) => {
    if (!val && val !== 0) return '0 so\'m'
    return `${val.toLocaleString('ru-RU')} so'm`
  }

  const handlePrint = () => {
    window.print()
  }

  if (!referrerId) return null

  const ref = data?.referrer || {}
  const sum = data?.summary || {}
  const daily = data?.daily_stats || []
  const patients = data?.patients || []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="card w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col bg-surface border border-border shadow-2xl text-body overflow-hidden">
        
        {/* ── MODAL HEADER ────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-surface-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-cyan/20 border border-cyan/40 text-cyan flex items-center justify-center font-black text-lg shrink-0">
              {ref.full_name ? ref.full_name.charAt(0).toUpperCase() : 'Y'}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-body flex items-center gap-2 truncate">
                <span className="truncate">{ref.full_name || "Yo'naltiruvchi Profili"}</span>
                <span className="badge badge-success text-[10px] uppercase font-bold px-2 py-0.5 shrink-0">
                  ID: #{referrerId}
                </span>
              </h2>
              <p className="text-xs text-muted font-medium truncate">
                📱 Tel: {ref.phone || 'Biriktirilmagan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={fetchProfile}
              className="p-2 bg-surface hover:bg-surface-hover text-body rounded-lg text-xs transition-colors border border-border"
              title="Yangilash"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 bg-surface hover:bg-surface-hover text-body rounded-lg text-xs transition-colors border border-border"
              title="Chop etish"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-surface hover:bg-rose-500/20 text-muted hover:text-rose-500 rounded-lg transition-colors border border-border"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── MODAL BODY ─────────────────────────────────────────── */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {loading && !data ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-cyan animate-spin mx-auto" />
              <p className="text-xs font-bold text-muted">Profil ma'lumotlari yuklanmoqda...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center space-y-2">
              <p className="text-sm font-bold text-rose-500">{error}</p>
            </div>
          ) : (
            <>
              {/* 1. CREDENTIALS / LOGIN-PAROL CARD ──────────────── */}
              {/* Parol faqat CEO'ga ko'rinadi — backend ham shu holatda
                  faqat CEO uchun qaytaradi/o'zgartirishga ruxsat beradi. */}
              {isCEO && (
              <div className="card p-4 bg-surface-2 border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="font-extrabold text-amber-500 uppercase flex items-center gap-1.5 text-xs">
                    <Key className="h-4 w-4 text-amber-500" /> Tizimga Kirish (Login & Parol)
                  </span>
                  {!editingCreds ? (
                    <button
                      onClick={() => setEditingCreds(true)}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                    >
                      <Edit2 className="h-3 w-3" /> Tahrirlash
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingCreds(false)}
                      className="text-muted hover:text-body text-[11px] font-bold"
                    >
                      Bekor qilish
                    </button>
                  )}
                </div>

                {!editingCreds ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Login */}
                    <div className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border font-mono">
                      <div>
                        <span className="text-[10px] text-muted uppercase block">Login:</span>
                        <b className="text-cyan text-sm">{ref.username || <span className="text-muted italic font-normal not-italic">Hali yaratilmagan</span>}</b>
                      </div>
                      {ref.username && (
                        <button
                          onClick={() => handleCopy(ref.username, 'uname')}
                          className="p-1.5 bg-surface-2 hover:bg-surface-hover text-body rounded text-[11px] flex items-center gap-1 border border-border"
                        >
                          {copiedField === 'uname' ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>

                    {/* Password */}
                    <div className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border font-mono">
                      <div>
                        <span className="text-[10px] text-muted uppercase block">Parol:</span>
                        <b className="text-amber-500 text-sm">{ref.plain_password || <span className="text-muted italic font-normal not-italic">—</span>}</b>
                      </div>
                      {ref.plain_password && (
                        <button
                          onClick={() => handleCopy(ref.plain_password, 'pwd')}
                          className="p-1.5 bg-surface-2 hover:bg-surface-hover text-body rounded text-[11px] flex items-center gap-1 border border-border"
                        >
                          {copiedField === 'pwd' ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveCredentials} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase block mb-1">Login:</label>
                      <input
                        type="text"
                        value={credForm.username}
                        onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                        className="input-field text-xs font-mono py-1.5 w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase block mb-1">Yangi Parol:</label>
                      <input
                        type="text"
                        value={credForm.password}
                        onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                        className="input-field text-xs font-mono py-1.5 w-full"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingCreds}
                      className="btn-gold py-1.5 px-3 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Save className="h-3.5 w-3.5" /> Saqlash
                    </button>
                  </form>
                )}
              </div>
              )}

              {/* 2. RATES BAR ────────────────────────────────────── */}
              <div className="card p-3 bg-surface-2 border-border space-y-1.5 text-xs">
                <span className="font-extrabold text-amber-500 uppercase flex items-center gap-1.5 text-[11px]">
                  <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" /> Belgilangan Foiz va Tariflar:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono font-bold text-body">
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

              {/* 3. SUMMARY KPI STATS & ADVANCE DEBT ───────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold text-amber-500 uppercase block">10-Kunlik Ulush</span>
                  <p className="text-sm sm:text-base font-black text-amber-500 font-mono">{formatMoney(sum.ten_day_earned)}</p>
                </div>
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold text-cyan-500 uppercase block">Jami Bemorlar</span>
                  <p className="text-sm sm:text-base font-black text-cyan-500 font-mono">{sum.total_patients || 0} nafar</p>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold text-emerald uppercase block">Keltirgan Tushumi</span>
                  <p className="text-sm sm:text-base font-black text-emerald font-mono">{formatMoney(sum.total_gross)}</p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold text-blue-500 uppercase block">Olgan Avansi</span>
                  <p className="text-sm sm:text-base font-black text-blue-500 font-mono">{formatMoney(sum.initial_advance || 0)}</p>
                </div>
                <div className={`p-3 rounded-xl space-y-1 border ${
                  (sum.net_balance ?? 0) < 0 
                    ? 'bg-rose-500/10 border-rose-500/40' 
                    : 'bg-purple-500/10 border-purple-500/30'
                }`}>
                  <span className={`text-[10px] font-extrabold uppercase block ${
                    (sum.net_balance ?? 0) < 0 ? 'text-rose-500' : 'text-purple-500'
                  }`}>
                    Hozirgi Balans
                  </span>
                  <p className={`text-sm sm:text-base font-black font-mono ${
                    (sum.net_balance ?? 0) < 0 ? 'text-rose-500' : 'text-purple-500'
                  }`}>
                    {formatMoney(sum.net_balance ?? 0)}
                  </p>
                </div>
              </div>

              {(sum.net_balance ?? 0) < 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <span className="text-rose-500 font-medium">
                    ⚠️ <b>{formatMoney(sum.initial_advance)}</b> avans berilgan. Ishlangan ulushlar avansni qoplashga yo'naltirilmoqda.
                  </span>
                  <span className="font-mono font-bold text-rose-500 text-xs shrink-0">
                    Qolgan qarz: {formatMoney(sum.net_balance ?? 0)}
                  </span>
                </div>
              )}

              {/* 4. TABS: DAILY STATS vs PATIENT DETAILS ─────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <button
                    onClick={() => setActiveTab('daily')}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-colors ${
                      activeTab === 'daily' ? 'bg-cyan text-white font-black' : 'bg-surface-2 text-muted hover:bg-surface-hover'
                    }`}
                  >
                    📈 Kunlik Dinamika (10-Kun)
                  </button>
                  <button
                    onClick={() => setActiveTab('patients')}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-colors ${
                      activeTab === 'patients' ? 'bg-cyan text-white font-black' : 'bg-surface-2 text-muted hover:bg-surface-hover'
                    }`}
                  >
                    📋 Bemorlar Ro'yxati ({patients.length})
                  </button>
                </div>

                {activeTab === 'daily' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-surface-2 text-muted font-mono uppercase text-[10px] border-b border-border">
                        <tr>
                          <th className="p-2">Sana</th>
                          <th className="p-2 text-center">Bemorlar Soni</th>
                          <th className="p-2 text-right">Kassa Tushumi</th>
                          <th className="p-2 text-right">Yo'naltiruvchi Ulushi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {daily.map((d) => (
                          <tr key={d.date} className="hover:bg-surface-hover">
                            <td className="p-2 font-mono font-bold text-body">{d.date}</td>
                            <td className="p-2 text-center font-mono font-bold text-cyan">{d.patient_count} nafar</td>
                            <td className="p-2 text-right font-mono text-muted">{formatMoney(d.gross_total)}</td>
                            <td className="p-2 text-right font-mono font-bold text-amber-500">{formatMoney(d.earned_fee)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'patients' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-surface-2 text-muted font-mono uppercase text-[10px] border-b border-border">
                        <tr>
                          <th className="p-2 text-center">#</th>
                          <th className="p-2">Sana/Vaqt</th>
                          <th className="p-2">Bemor F.I.Sh</th>
                          <th className="p-2">Xizmat Nomi</th>
                          <th className="p-2 text-right">To'lov</th>
                          <th className="p-2 text-center">KPI/Stavka</th>
                          <th className="p-2 text-right">Ulush</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-semibold">
                        {patients.map((p, idx) => (
                          <tr key={idx} className="hover:bg-surface-hover">
                            <td className="p-2 text-center font-mono text-muted">#{idx + 1}</td>
                            <td className="p-2 font-mono text-body">{p.date}</td>
                            <td className="p-2 font-bold text-body">{p.patient_name}</td>
                            <td className="p-2 text-muted">{p.service_name}</td>
                            <td className="p-2 text-right font-mono text-body">{formatMoney(p.payment_amount)}</td>
                            <td className="p-2 text-center font-mono text-amber-500">
                              <span className="bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/30">
                                {p.rate_label}
                              </span>
                            </td>
                            <td className="p-2 text-right font-mono font-black text-cyan">{formatMoney(p.referrer_fee)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── MODAL FOOTER ────────────────────────────────────────── */}
        <div className="p-4 border-t border-border bg-surface-2 flex justify-end">
          <button
            onClick={onClose}
            className="btn-outline py-1.5 px-4 text-xs font-bold"
          >
            Yopish
          </button>
        </div>

      </div>
    </div>
  )
}
