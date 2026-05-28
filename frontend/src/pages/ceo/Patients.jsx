import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatDate, formatMoney, paymentLabel } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import Modal from '../../components/Modal'
import { TableSkeleton } from '../../components/Skeleton'

export default function CeoPatients() {
  const [patients,  setPatients]  = useState(null)
  const [edit,      setEdit]      = useState(null)
  const [editReason, setEditReason] = useState('')
  const [cancelId,  setCancelId]  = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [visitId,   setVisitId]   = useState(null)
  const [visits,    setVisits]    = useState([])
  const toast = useToastStore((s) => s.add)

  const load = () => api('/patients?include_cancelled=true').then(setPatients)
  useEffect(() => { load() }, [])

  const saveEdit = async () => {
    if (editReason.length < 3) { toast('Sabab kamida 3 harf', 'error'); return }
    try {
      await api(`/patients/${edit.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...edit, reason: editReason }),
      })
      toast('Tahrirlandi')
      setEdit(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const doCancel = async () => {
    if (cancelReason.length < 3) { toast('Sabab kamida 3 harf', 'error'); return }
    try {
      await api(`/patients/${cancelId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      })
      toast('Bekor qilindi')
      setCancelId(null)
      setCancelReason('')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const openVisits = async (p) => {
    setVisitId(p.id)
    const data = await api(`/patients/${p.id}/visits`)
    setVisits(data || [])
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="page-title">Barcha mijozlar</h1>
        {patients && (
          <span className="badge badge-muted">
            {patients.filter((p) => !p.is_cancelled).length} aktiv
          </span>
        )}
      </div>

      {!patients ? (
        <TableSkeleton />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                {['Sana','Mijoz','Xizmat','Summa','Kim kiritdi',''].map((h) => (
                  <th key={h} className="p-3 font-semibold" style={{ color: 'var(--gold)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b transition-colors ${p.is_cancelled ? 'row-cancelled' : 'table-row'}`}
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="p-3 text-muted">{formatDate(p.created_at)}</td>
                  <td className="p-3 font-medium">{p.first_name} {p.last_name}</td>
                  <td className="p-3 text-muted">{p.service_name}</td>
                  <td className="p-3">
                    {formatMoney(p.payment_amount)}
                    <span className="text-muted ml-1">({paymentLabel(p.payment_type)})</span>
                  </td>
                  <td className="p-3 text-muted">{p.creator_name || '—'}</td>
                  <td className="p-3">
                    {p.is_cancelled ? (
                      <span className="text-xs" style={{ color: 'var(--danger)' }}>
                        Bekor: {p.cancel_reason}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost py-1 px-2 text-xs"
                          onClick={() => openVisits(p)}
                        >
                          Tashriflar
                        </button>
                        <button
                          type="button"
                          className="btn-outline py-1 px-2 text-xs"
                          onClick={() => { setEdit({ ...p }); setEditReason('') }}
                        >
                          Tahrirlash
                        </button>
                        <button
                          type="button"
                          className="btn-danger py-1 px-2 text-xs"
                          onClick={() => { setCancelId(p.id); setCancelReason('') }}
                        >
                          Bekor
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Mijozni tahrirlash">
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted mb-1 block text-xs">Ism</label>
                <input className="input-field" value={edit.first_name}
                  onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} />
              </div>
              <div>
                <label className="text-muted mb-1 block text-xs">Familiya</label>
                <input className="input-field" value={edit.last_name}
                  onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs">Telefon</label>
              <input className="input-field" value={edit.phone}
                onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs">Manzil</label>
              <input className="input-field" value={edit.address}
                onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
            </div>
            <div>
              <label className="text-muted mb-1 block text-xs">Tahrirlash sababi *</label>
              <input className="input-field" placeholder="Kamida 3 ta harf..."
                value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-outline flex-1" onClick={() => setEdit(null)}>
                Bekor
              </button>
              <button type="button" className="btn-gold flex-1" onClick={saveEdit}>
                Saqlash
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel modal */}
      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="To'lovni bekor qilish" size="sm">
        <p className="text-muted mb-4 text-sm">
          To'lov bekor qilinsa, summa balansdan qaytariladi. Bu amal qaytarib bo'lmaydi.
        </p>
        <div className="space-y-3">
          <input
            className="input-field"
            placeholder="Bekor qilish sababi *"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setCancelId(null)}>
              Orqaga
            </button>
            <button type="button" className="btn-danger flex-1 py-2" onClick={doCancel}>
              Ha, bekor qilish
            </button>
          </div>
        </div>
      </Modal>

      {/* Visits modal */}
      <Modal open={!!visitId} onClose={() => setVisitId(null)} title="Tashrif tarixi" size="lg">
        {visits.length === 0 ? (
          <p className="text-muted text-sm">Tashrif tarixi topilmadi</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                  {['Sana','Xizmat','Doktor','Summa','Holat'].map((h) => (
                    <th key={h} className="p-2 font-semibold" style={{ color: 'var(--gold)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="p-2 text-muted">{formatDate(v.created_at)}</td>
                    <td className="p-2">{v.service_name || '—'}</td>
                    <td className="p-2">{v.provider_name || '—'}</td>
                    <td className="p-2 font-semibold" style={{ color: 'var(--gold)' }}>
                      {formatMoney(v.payment_amount)}
                    </td>
                    <td className="p-2">
                      {v.is_cancelled
                        ? <span className="badge badge-danger">Bekor</span>
                        : <span className="badge badge-success">Aktiv</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
