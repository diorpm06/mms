import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { useToastStore } from '../store/toastStore'
import { Btn, Icons } from './UIKit'

export default function ShiftControlBar({ onShiftChange }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const toast = useToastStore((s) => s.add)

  const fetchStatus = async () => {
    try {
      const data = await api('/duty/shift-status')
      setStatus(data)
    } catch (e) {
      console.error('Fetch shift status error:', e)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleCloseShift = async () => {
    setLoading(true)
    try {
      const res = await api('/duty/close-shift', { method: 'POST' })
      toast(res.message || 'Smena tugatildi va Telegram botga hisobot uzatildi ✓')
      setShowCloseModal(false)
      fetchStatus()
      if (onShiftChange) onShiftChange('TUNGI')
    } catch (e) {
      toast(e.message || 'Smenani tugatishda xatolik yuz berdi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleStartShift = async () => {
    setLoading(true)
    try {
      const res = await api('/duty/start-shift', { method: 'POST' })
      toast(res.message || 'Yangi kunduzgi smena muvaffaqiyatli boshlandi! 🚀')
      setShowStartModal(false)
      fetchStatus()
      if (onShiftChange) onShiftChange('KUNDUZGI')
    } catch (e) {
      toast(e.message || 'Smenani boshlashda xatolik yuz berdi', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!status) return null

  const isNight = status.shift_mode === 'TUNGI'

  return (
    <div className="mb-4 p-3 rounded-2xl bg-surface border border-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full animate-pulse ${
            isNight ? 'bg-amber-400 shadow-amber-400/50 shadow-md' : 'bg-emerald-500 shadow-emerald-500/50 shadow-md'
          }`}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-body">
              Smena Holati:
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                isNight
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isNight ? '🌙 Tungi Navbatchilik Rejimi' : '☀️ Kunduzgi To\'liq Smena'}
            </span>
          </div>
          <p className="text-[11px] text-muted font-medium mt-0.5">
            {isNight
              ? 'Tungi navbatchilikda registratsiyada tezkor ineksiya/massaj/ozon xizmatlari filtri tayyor.'
              : 'Barcha bo\'limlar to\'liq rejimda ishlamoqda.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isNight ? (
          <Btn
            variant="emerald"
            size="sm"
            icon={Icons.play || Icons.check}
            onClick={() => setShowStartModal(true)}
            className="shadow-lg shadow-emerald-500/20 font-bold"
          >
            🟢 Yangi Ish Kunini Boshlash
          </Btn>
        ) : (
          <Btn
            variant="rose"
            size="sm"
            icon={Icons.cancel || Icons.x}
            onClick={() => setShowCloseModal(true)}
            className="shadow-lg shadow-rose-500/20 font-bold"
          >
            🔴 Smenani Tugatish
          </Btn>
        )}
      </div>

      {/* Smenani Tugatish Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 border-b border-border pb-3">
              <span className="text-2xl">🔴</span>
              <h3 className="text-base font-extrabold text-body">
                Bugungi Smenani Tugatishni Tasdiqlaysizmi?
              </h3>
            </div>
            <div className="space-y-2 text-xs font-medium text-muted">
              <p>
                ⚠️ Smenani tugatsangiz, bugungi (
                <strong className="text-body font-bold">{status.today_date}</strong>) kunlik hisobot
                PDF formatida saqlanadi hamda <strong className="text-emerald font-bold">Telegram botga</strong> uzatiladi.
              </p>
              <p className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                🌙 Shundan so'ng tizim avtomatik <strong className="text-amber-200">Tungi Navbatchilik</strong> rejimiga o'tadi va yangi smenaga tayyorlanadi.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Btn variant="ghost" size="sm" onClick={() => setShowCloseModal(false)} disabled={loading}>
                Bekor qilish
              </Btn>
              <Btn variant="danger" size="sm" onClick={handleCloseShift} loading={loading}>
                Ha, Smenani Tugatish & Telegramga Yuborish
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Yangi Smenani Boshlash Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400 border-b border-border pb-3">
              <span className="text-2xl">🟢</span>
              <h3 className="text-base font-extrabold text-body">
                Yangi Ish Kunini Boshlashni Tasdiqlaysizmi?
              </h3>
            </div>
            <div className="space-y-2 text-xs font-medium text-muted">
              <p>
                🚀 Bugungi sana (<strong className="text-body font-bold">{status.today_date}</strong>) bo'yicha yangi kunlik smenani va to'liq ish faoliyatini boshlaysiz.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Btn variant="ghost" size="sm" onClick={() => setShowStartModal(false)} disabled={loading}>
                Bekor qilish
              </Btn>
              <Btn variant="emerald" size="sm" onClick={handleStartShift} loading={loading}>
                Ha, Yangi Smenani Boshlash
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
