import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'

export default function TodayPatients() {
  const [patients, setPatients] = useState([])

  useEffect(() => {
    api('/patients/today').then(setPatients)
    const t = setInterval(() => api('/patients/today').then(setPatients), 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gold">Bugungi mijozlar</h1>
      <p className="mb-6 text-sm opacity-70">CEO va Admin kiritgan barcha mijozlar (avtomatik yangilanadi)</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left text-gold">
              <th className="p-2">Vaqt</th><th className="p-2">Mijoz</th><th className="p-2">Xizmat</th>
              <th className="p-2">Summa</th><th className="p-2">Kirituvchi</th><th className="p-2">Holat</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center opacity-50">Bugun hali mijoz yo'q</td></tr>
            ) : patients.map((p) => (
              <tr key={p.id} className={p.is_cancelled ? 'row-cancelled' : 'border-b border-white/5'}>
                <td className="p-2">{p.created_at?.slice(11, 16)}</td>
                <td className="p-2 font-medium">{p.first_name} {p.last_name}</td>
                <td className="p-2">{p.service_name}</td>
                <td className="p-2 text-gold">{formatMoney(p.payment_amount)} ({paymentLabel(p.payment_type)})</td>
                <td className="p-2">{p.creator_name}</td>
                <td className="p-2">{p.is_cancelled ? <span className="text-red-400">Bekor</span> : <span className="text-green-400">Aktiv</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
