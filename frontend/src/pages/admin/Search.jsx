import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import PageHeader from '../../components/PageHeader'

export default function Search({ homePath = '/admin' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToastStore((s) => s.add)
  const newPatientPath = `${homePath}/new-patient`

  const fetchPatients = useCallback(async (term = '') => {
    const data = await api(`/patients?search=${encodeURIComponent(term)}&include_cancelled=true`)
    setResults(data)
    return data
  }, [])

  useEffect(() => {
    fetchPatients()
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [fetchPatients, toast])

  const search = async () => {
    setLoading(true)
    try {
      await fetchPatients(q)
      setSelected(null)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectPatient = async (p) => {
    setSelected(p)
    const v = await api(`/patients/${p.id}/visits`)
    setVisits(v)
  }

  return (
    <div>
      <PageHeader
        title="Mijoz qidirish"
        subtitle="Ism, familiya yoki telefon bo'yicha qidiring"
        backTo={homePath}
      />

      <div className="mb-4 flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Ism, familiya yoki telefon"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button type="button" className="btn-gold" onClick={search} disabled={loading}>
          Qidirish
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-body mb-3 text-sm font-semibold">
            {q.trim() ? 'Qidiruv natijalari' : 'Umumiy mijozlar ro\'yxati'}
            <span className="text-muted ml-2 font-normal">({results.length})</span>
          </h2>
          {loading && results.length === 0 ? (
            <p className="text-muted text-sm">Yuklanmoqda...</p>
          ) : results.length === 0 ? (
            <p className="text-muted text-sm">Mijoz topilmadi</p>
          ) : (
            <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`card w-full text-left transition ${selected?.id === p.id ? 'ring-2 ring-gold' : ''} ${p.is_cancelled ? 'row-cancelled' : ''}`}
                  onClick={() => selectPatient(p)}
                >
                  <p className="font-medium">
                    {p.first_name} {p.last_name}
                    {p.is_cancelled && ' (bekor)'}
                  </p>
                  <p className="text-sm opacity-70">{p.phone} — {p.creator_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="card h-fit">
            <h2 className="mb-4 text-lg font-bold text-gold">
              {selected.first_name} {selected.last_name}
            </h2>
            <dl className="space-y-1 text-sm">
              <div><dt className="inline opacity-70">Tug'ilgan: </dt><dd className="inline">{formatDate(selected.birth_date)}</dd></div>
              <div><dt className="inline opacity-70">Tel: </dt><dd className="inline">{selected.phone}</dd></div>
              <div><dt className="inline opacity-70">Manzil: </dt><dd className="inline">{selected.address}</dd></div>
              <div><dt className="inline opacity-70">Yo'naltiruvchi: </dt><dd className="inline">{selected.referrer_name || '—'}</dd></div>
              <div><dt className="inline opacity-70">Xizmat ko'rsatuvchi: </dt><dd className="inline">{selected.provider_name}</dd></div>
            </dl>
            <h3 className="mb-2 mt-4 font-semibold">Tashrif tarixi</h3>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {visits.map((v) => (
                <li key={v.id} className="rounded border p-2" style={{ borderColor: 'var(--border)' }}>
                  {formatDate(v.created_at)} — {v.service_name} — {formatMoney(v.payment_amount)} ({paymentLabel(v.payment_type)})
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-gold flex-1"
                disabled={selected.is_cancelled}
                onClick={() => navigate(newPatientPath, { state: { patient: selected } })}
              >
                Qayta xizmat yozish
              </button>
              {!selected.is_cancelled && (
                <button
                  type="button"
                  className="btn-danger flex-1"
                  onClick={async () => {
                    const reason = prompt('Bekor qilish sababi:')
                    if (!reason || reason.length < 3) return
                    try {
                      await api(`/patients/${selected.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })
                      toast('Bekor qilindi')
                      await fetchPatients(q)
                      setSelected(null)
                    } catch (e) {
                      toast(e.message, 'error')
                    }
                  }}
                >
                  Bekor qilish
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
