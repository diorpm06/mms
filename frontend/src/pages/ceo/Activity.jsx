import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatDate } from '../../utils/format'
import { PageHeader, Icons } from '../../components/UIKit'

const ACTIONS = ['', 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'PAYMENT', 'CANCEL', 'EXPENSE', 'ADVANCE', 'SALARY']

export default function Activity() {
  const [logs, setLogs] = useState([])
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = () => {
    const p = new URLSearchParams()
    if (userId) p.set('user_id', userId)
    if (action) p.set('action_type', action)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    api(`/audit/logs?${p}`).then(setLogs)
  }

  useEffect(() => {
    api('/auth/users').then(setUsers).catch(() => {})
    load()
  }, [])

  return (
    <div>
      <PageHeader
        title="Faoliyat Tarixi"
        subtitle="Tizimda kim nima qilgani — kirish, tahrirlash va bekor qilishlar"
        icon={Icons.history}
      />
      <div className="card mb-4 flex flex-wrap gap-2">
        <select className="input-field max-w-[180px]" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Barcha foydalanuvchilar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
          ))}
        </select>
        <select className="input-field max-w-[160px]" value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a || 'Barcha harakatlar'}</option>
          ))}
        </select>
        <input type="date" className="input-field max-w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input-field max-w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="btn-gold" onClick={load}>Filtrlash</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left text-gold">
              <th className="p-2">Sana/Vaqt</th>
              <th className="p-2">Foydalanuvchi</th>
              <th className="p-2">Harakat</th>
              <th className="p-2">Tafsilot</th>
              <th className="p-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-white/5">
                <td className="p-2 whitespace-nowrap">{formatDate(l.created_at)} {l.created_at?.slice(11, 16)}</td>
                <td className="p-2">{l.user_name} <span className="opacity-50">({l.user_role})</span></td>
                <td className="p-2"><span className="rounded bg-gold/20 px-2 py-0.5 text-gold">{l.action_type}</span></td>
                <td className="p-2 max-w-md truncate">{l.detail || l.new_data || '—'}</td>
                <td className="p-2 opacity-60">{l.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
