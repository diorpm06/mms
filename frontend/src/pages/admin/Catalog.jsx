import { useEffect, useState, Fragment } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import { useAuthStore } from '../../store/authStore'
import ReferrerProfileModal from '../../components/ReferrerProfileModal'

const TABS = [
  { id: 'services', label: '🛠️ Xizmat turlari' },
  { id: 'referrers', label: "📢 Yo'naltiruvchilar" },
  { id: 'providers', label: "👨‍⚕️ Xizmat ko'rsatuvchilar (Shifokorlar)" },
]

const extractDept = (s) => {
  const cat = (s.category || '').trim()
  if (cat) return cat.includes(':') ? cat.split(':')[0].trim() : cat
  const name = (s.name || '').trim()
  if (name.includes('Laboratoriya') || name.includes('Qon') || name.includes('Analiz')) return 'Laboratoriya'
  if (name.includes('UZI') || name.includes('Uzi')) return 'UZI'
  if (name.includes('Fizio') || name.includes('Elektro') || name.includes('Magnito')) return 'Fizioterapiya'
  if (name.includes('Ineksiya') || name.includes('Ukol') || name.includes('Tomchi')) return 'Ineksiya'
  if (name.includes('Massaj')) return 'Massaj'
  if (name.includes('Ozon')) return 'Ozonaterapiya'
  return s.cabinet || 'Boshqa'
}

export default function AdminCatalog() {
  const [tab, setTab] = useState('services')
  const [services, setServices] = useState([])
  const [referrers, setReferrers] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedRefModalId, setSelectedRefModalId] = useState(null)
  const toast = useToastStore((s) => s.add)
  const isCEO = useAuthStore((s) => s.role) === 'ceo'

  useEffect(() => {
    setLoading(true)
    Promise.all([api('/services'), api('/referrers'), api('/providers')])
      .then(([s, r, p]) => {
        setServices(s || [])
        setReferrers(r || [])
        setProviders(p || [])
      })
      .catch((e) => toast(e.message || 'Ma\'lumot yuklanmadi', 'error'))
      .finally(() => setLoading(false))
  }, [])

  // Group services by Department
  const deptsMap = {}
  services.forEach((s) => {
    const dept = extractDept(s)
    if (!deptsMap[dept]) deptsMap[dept] = []
    deptsMap[dept].push(s)
  })

  const deptNames = Object.keys(deptsMap).sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="page-title mb-0.5">Ma'lumotnomalar katalogi</h1>
          <p className="text-muted text-xs">Klinika xizmatlari, yo'naltiruvchilar va xizmat ko'rsatuvchilar tartiblangan ro'yxati</p>
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px]">
          <input
            type="text"
            placeholder="🔎 Qidirish (Nomi, xona, mutaxassis)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field text-xs py-2 pl-8 pr-8 w-full font-semibold"
          />
          <span className="absolute left-2.5 top-2.5 text-muted text-xs">🔎</span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-muted hover:text-rose-400 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t.id
                ? 'bg-gold text-slate-950 shadow-md font-black scale-105'
                : 'bg-surface-2 text-muted hover:text-body border border-border'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted text-xs py-8 text-center">Ma'lumotlar yuklanmoqda...</p>
      ) : (
        <div className="space-y-4">
          {tab === 'services' && (
            <div className="card space-y-4">
              {/* Department Filter Chips */}
              {deptNames.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface-2/80 rounded-xl border border-border">
                  <span className="text-xs font-bold text-muted px-2">Bo'lim bo'yicha:</span>
                  {['all', ...deptNames].map((b) => {
                    const count = b === 'all' ? services.length : deptsMap[b].length
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedDept(b)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          selectedDept === b
                            ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                            : 'bg-surface-1 text-muted hover:text-body hover:bg-surface-2 border border-border/40'
                        }`}
                      >
                        {b === 'all' ? 'Barchasi' : b}{' '}
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 font-mono">
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                      <th className="p-2.5">Xizmat Nomi</th>
                      <th className="p-2.5">Joylashgan Xona</th>
                      <th className="p-2.5 text-right">Narxi</th>
                      <th className="p-2.5 text-center">Holati</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {deptNames
                      .filter((d) => selectedDept === 'all' || selectedDept === d)
                      .map((d) => {
                        const items = deptsMap[d].filter((s) =>
                          !search || (s.name || '').toLowerCase().includes(search.toLowerCase()) || (s.cabinet || '').toLowerCase().includes(search.toLowerCase())
                        )
                        if (items.length === 0) return null
                        return (
                          <Fragment key={d}>
                            {/* Department Header */}
                            <tr className="bg-surface-2/90 font-black border-t-2 border-gold/30">
                              <td colSpan={4} className="p-2.5 text-gold font-extrabold text-xs">
                                🏢 {d} ({items.length} ta xizmat)
                              </td>
                            </tr>
                            {items.map((s) => (
                              <tr key={s.id} className="hover:bg-surface-hover font-semibold">
                                <td className="p-2.5 pl-6 text-body font-bold">{s.name}</td>
                                <td className="p-2.5 text-cyan font-bold font-mono">🚪 {s.cabinet || '1-Xona'}</td>
                                <td className="p-2.5 text-right font-mono font-black text-emerald">{formatMoney(s.price)}</td>
                                <td className="p-2.5 text-center">
                                  {s.is_active ? (
                                    <span className="badge badge-success text-[10px] font-bold">Faol</span>
                                  ) : (
                                    <span className="badge badge-danger text-[10px] font-bold">Nofaol</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'referrers' && (
            <div className="card overflow-x-auto p-0 space-y-3">
              <div className="p-3 bg-surface-2 flex items-center justify-between border-b border-border">
                <span className="text-xs font-bold text-gold">📢 Yo'naltiruvchilar Tizimga Kirish (Login & Parollar):</span>
                {isCEO && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api('/referrers/generate-all-credentials', { method: 'POST' })
                        toast(res.message || '🔑 Loginlar yaratildi!')
                        const r = await api('/referrers')
                        setReferrers(r || [])
                      } catch (err) {
                        toast(err.message || 'Xatolik', 'error')
                      }
                    }}
                    className="btn-gold text-[11px] py-1 px-3 font-bold"
                  >
                    🔑 Barcha Login-Parollarni Yaratish / Yangilash
                  </button>
                )}
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                    <th className="p-3">#</th>
                    <th className="p-3">Ism va Familiya</th>
                    <th className="p-3">Telefon</th>
                    <th className="p-3 font-mono">Tizim Logini</th>
                    {isCEO && <th className="p-3 font-mono">Parol</th>}
                    <th className="p-3 text-center">Harakatlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-semibold">
                  {referrers
                    .filter((r) => !search || (r.full_name || '').toLowerCase().includes(search.toLowerCase()) || (r.phone || '').includes(search))
                    .map((r, i) => (
                      <tr key={r.id} className="hover:bg-surface-hover">
                        <td className="p-3 text-muted font-mono font-bold">#{i + 1}</td>
                        <td className="p-3 text-body font-extrabold">📢 {r.full_name}</td>
                        <td className="p-3 text-cyan font-mono">{r.phone || '—'}</td>
                        <td className="p-3 font-mono text-cyan font-bold">{r.username || <span className="text-muted italic font-normal">Yaratilmagan</span>}</td>
                        {isCEO && <td className="p-3 font-mono text-amber-300 font-bold">{r.plain_password || <span className="text-muted italic font-normal">—</span>}</td>}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedRefModalId(r.id)}
                            className="btn-outline py-1 px-2.5 text-[11px] font-bold text-cyan flex items-center gap-1 mx-auto"
                          >
                            👤 Profil & Analytics
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'providers' && (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                    <th className="p-3">#</th>
                    <th className="p-3">Shifokor Ismi</th>
                    <th className="p-3">Mutaxassislik / Bo'lim</th>
                    <th className="p-3">Telefon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-semibold">
                  {providers
                    .filter((p) => !search || (p.full_name || '').toLowerCase().includes(search.toLowerCase()) || (p.specialization || '').toLowerCase().includes(search.toLowerCase()))
                    .map((p, i) => (
                      <tr key={p.id} className="hover:bg-surface-hover">
                        <td className="p-3 text-muted font-mono font-bold">#{i + 1}</td>
                        <td className="p-3 text-body font-extrabold">👨‍⚕️ {p.full_name}</td>
                        <td className="p-3 text-gold font-bold">{p.specialization || '—'}</td>
                        <td className="p-3 text-cyan font-mono">{p.phone || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {selectedRefModalId && (
        <ReferrerProfileModal
          referrerId={selectedRefModalId}
          onClose={() => setSelectedRefModalId(null)}
        />
      )}
    </div>
  )
}
