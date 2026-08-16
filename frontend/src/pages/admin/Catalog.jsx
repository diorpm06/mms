import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'

const TABS = [
  { id: 'services', label: 'Xizmat turlari' },
  { id: 'referrers', label: "Yo'naltiruvchilar" },
  { id: 'providers', label: "Xizmat ko'rsatuvchilar" },
]

export default function AdminCatalog() {
  const [tab, setTab] = useState('services')
  const [services, setServices] = useState([])
  const [referrers, setReferrers] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToastStore((s) => s.add)

  useEffect(() => {
    setLoading(true)
    Promise.all([api('/services'), api('/referrers'), api('/providers')])
      .then(([s, r, p]) => {
        setServices(s)
        setReferrers(r)
        setProviders(p)
      })
      .catch((e) => toast(e.message || 'Ma\'lumot yuklanmadi', 'error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="page-title mb-2">Ma'lumotnomalar</h1>
      <p className="text-muted mb-6 text-sm">Xizmatlar, yo'naltiruvchilar va xizmat ko'rsatuvchilar ro'yxati (faqat ko'rish)</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'btn-gold' : 'btn-outline'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Yuklanmoqda...</p>
      ) : (
        <div className="card overflow-x-auto">
          {tab === 'services' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head border-b">
                  <th className="p-2 text-left">Nomi</th>
                  <th className="p-2 text-left">Joylashgan Xona</th>
                  <th className="p-2 text-left">Narxi</th>
                  <th className="p-2 text-left">Holati</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr><td colSpan={4} className="text-muted p-6 text-center">Xizmatlar yo'q</td></tr>
                ) : services.map((s) => (
                  <tr key={s.id} className="table-row border-b">
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2 text-cyan-400 font-semibold">🚪 {s.cabinet || '1-Xona'}</td>
                    <td className="accent-value p-2 font-bold">{formatMoney(s.price)}</td>
                    <td className="p-2">{s.is_active ? 'Faol' : 'Nofaol'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'referrers' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-head border-b">
                    <th className="p-2 text-left">Ism</th>
                    <th className="p-2 text-left">Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {referrers.length === 0 ? (
                    <tr><td colSpan={2} className="text-muted p-6 text-center">Yo'naltiruvchilar yo'q</td></tr>
                  ) : referrers.map((r) => (
                    <tr key={r.id} className="table-row border-b">
                      <td className="p-2">{r.full_name}</td>
                      <td className="p-2">{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'providers' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-head border-b">
                    <th className="p-2 text-left">Ism</th>
                    <th className="p-2 text-left">Mutaxassislik</th>
                    <th className="p-2 text-left">Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.length === 0 ? (
                    <tr><td colSpan={3} className="text-muted p-6 text-center">Xizmat ko'rsatuvchilar yo'q</td></tr>
                  ) : providers.map((p) => (
                    <tr key={p.id} className="table-row border-b">
                      <td className="p-2">{p.full_name}</td>
                      <td className="p-2">{p.specialization}</td>
                      <td className="p-2">{p.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
