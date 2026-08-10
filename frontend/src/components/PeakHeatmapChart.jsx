import { Clock, TrendingUp, Users } from 'lucide-react'

export default function PeakHeatmapChart({ heatmap, busiestHour, avgDailyRevenue, projectedNext30Days }) {
  if (!heatmap) return null

  const hours = Array.from({ length: 11 }, (_, i) => i + 8) // 8:00 to 18:00
  const days = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]

  const getIntensityClass = (count) => {
    if (!count) return 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600'
    if (count <= 2) return 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/50'
    if (count <= 5) return 'bg-cyan-500 text-white font-bold shadow-sm'
    return 'bg-amber-500 text-slate-950 font-black shadow-md animate-pulse'
  }

  return (
    <div className="space-y-6">
      {/* Forecast Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 p-4">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">
            📈 Kelgusi 30-Kunlik Prognoz
          </span>
          <p className="text-2xl font-black text-cyan-300 font-mono">
            {Number(projectedNext30Days || 0).toLocaleString()} so'm
          </p>
          <span className="text-[10px] text-muted mt-1 block">O'rtacha kunlik ko'rsatkichlar asosida</span>
        </div>

        <div className="card bg-gradient-to-br from-amber-900/30 to-yellow-900/30 border border-amber-500/30 p-4">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
            🔥 Eng Gavjum Soat
          </span>
          <p className="text-2xl font-black text-amber-300 font-mono">
            {busiestHour || '10:00 - 11:00'}
          </p>
          <span className="text-[10px] text-muted mt-1 block">Mijozlar eng ko'p keladigan vaqt</span>
        </div>

        <div className="card bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 p-4">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">
            💵 O'rtacha Kunlik Tushum
          </span>
          <p className="text-2xl font-black text-emerald-300 font-mono">
            {Number(avgDailyRevenue || 0).toLocaleString()} so'm
          </p>
          <span className="text-[10px] text-muted mt-1 block">Oxirgi 30 kunlik ko'rsatkich</span>
        </div>
      </div>

      {/* Heatmap Grid Card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-500" />
              Klinika Haftalik Gavjumlik Xaritasi (Peak Hours Heatmap)
            </h3>
            <p className="text-xs text-muted mt-0.5">Soatlar va kunlar bo'yicha mijozlar oqimi intensivligi</p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-700 inline-block" /> Bo'sh</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" /> O'rtacha</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Juda Gavjum</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs font-bold text-muted text-left w-28">Kun / Vaqt</th>
                {hours.map((h) => (
                  <th key={h} className="p-2 text-[11px] font-mono font-bold text-muted">
                    {h}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day} className="border-t border-border/40">
                  <td className="p-2 text-xs font-bold text-foreground text-left whitespace-nowrap">{day}</td>
                  {hours.map((h) => {
                    const count = heatmap[day]?.[h] || 0
                    return (
                      <td key={h} className="p-1">
                        <div
                          className={`h-8 rounded-lg flex items-center justify-center text-xs transition-all ${getIntensityClass(count)}`}
                          title={`${day} soat ${h}:00 da: ${count} ta bemor`}
                        >
                          {count > 0 ? count : '·'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
