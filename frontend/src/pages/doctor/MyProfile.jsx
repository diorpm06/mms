import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { EmptyState } from '../../components/UIKit'

/**
 * Shifokorning shaxsiy bo'limi.
 *
 * Ilgari KPI foizi, bugungi ishlangan pul va yig'ilgan balans Doctor
 * Panelning tepasida, navbat tugmalari bilan yonma-yon turardi — qabul
 * paytida bemor ekranga qarasa pul raqamlari ko'rinib qolardi. Endi ular
 * shu alohida bo'limga ko'chirildi.
 */
export default function MyProfile() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const toast = useToastStore((s) => s.add)

  const yukla = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('/queue/doctor/my-queue')
      setData(res)
    } catch (e) {
      toast(e.message || 'Ma\'lumot yuklanmadi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    yukla()
  }, [yukla])

  const stats = data?.stats
  const ism = data?.doctor_name || 'Shifokor'
  const taqsimot = stats?.kpi_breakdown || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h1 className="page-title mb-0.5">Profilim</h1>
          <p className="text-muted text-xs">
            Dr. {ism} — KPI ulushi, bugungi daromad va yig'ilgan balans
          </p>
        </div>
        <button
          type="button"
          className="px-3 py-2 rounded-xl bg-surface-2 hover:bg-white/10 border border-border text-body text-xs font-bold flex items-center gap-1.5 transition-all self-start"
          onClick={yukla}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 text-gold ${loading ? 'animate-spin' : ''}`} />
          <span>Yangilash</span>
        </button>
      </div>

      {!data && loading ? (
        <p className="text-muted text-sm">Yuklanmoqda...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-4 border-emerald-500/40 bg-emerald-500/5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 block mb-1">
                💵 Bugungi KPI pulim
              </span>
              <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(stats?.today_kpi_earned || 0)}
              </span>
            </div>

            <div className="card p-4 border-gold/40 bg-gold/5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gold block mb-1">
                🏦 Joriy balansim
              </span>
              <span className="text-2xl font-black font-mono text-gold">
                {formatMoney(stats?.current_balance || 0)}
              </span>
            </div>

            <div className="card p-4 border-purple-500/30 bg-purple-500/5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">
                📊 KPI stavkam
              </span>
              <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                {stats?.kpi_percentage || 0}%
              </span>
            </div>
          </div>

          <div className="card">
            <h3 className="font-extrabold text-sm text-body mb-1 flex flex-wrap items-center justify-between gap-2">
              <span>📋 Bugungi bemorlardan kelgan KPI pullari</span>
              <span className="text-[11px] text-muted font-bold">
                {taqsimot.length} ta tranzaksiya
              </span>
            </h3>
            <p className="text-muted text-[11px] mb-3">
              Har bir bemor to'lovidan sizga tegishli ulush.
            </p>

            {taqsimot.length === 0 ? (
              <EmptyState icon="💵" message="Bugun hali KPI hisoblangan tranzaksiyalar yo'q" />
            ) : (
              <div className="space-y-2">
                {taqsimot.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface-2 border border-border flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge badge-gold font-mono text-[10px] font-black">
                          {item.ticket_number}
                        </span>
                        <span className="font-extrabold text-xs text-body truncate">
                          {item.patient_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted font-medium mt-1">
                        🩺 {item.service_name} • Jami to'lov:{' '}
                        <strong className="text-body font-mono font-bold">
                          {formatMoney(item.total_amount)}
                        </strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        + {formatMoney(item.provider_amount)}
                      </span>
                      <p className="text-[10px] text-muted font-mono">
                        {item.created_at ? item.created_at.split('T')[1]?.substring(0, 5) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
