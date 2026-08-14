import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { KeyRound, Eye, EyeOff } from 'lucide-react'

const ROLE_LABEL = { ceo: 'Rahbar', admin: 'Admin', doctor: 'Shifokor' }

export default function ChangePassword() {
  const [users,      setUsers]      = useState([])
  const [userId,     setUserId]     = useState('')
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const toast = useToastStore((s) => s.add)

  const loadUsers = () => api('/auth/users-credentials').then(setUsers).catch(() => {})
  useEffect(() => { loadUsers() }, [])

  const submit = async () => {
    if (!userId) { toast("Foydalanuvchi tanlang", 'error'); return }
    if (!username || username.length < 3) { toast("Login kamida 3 ta belgi", 'error'); return }
    if (password.length < 6) { toast("Parol kamida 6 ta belgi", 'error'); return }
    if (password !== confirm) { toast("Parollar mos kelmaydi", 'error'); return }
    setLoading(true)
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ user_id: +userId, new_username: username.trim(), new_password: password }),
      })
      toast("Login va parol muvaffaqiyatli o'zgartirildi")
      setPassword('')
      setConfirm('')
      setUserId('')
      setUsername('')
      loadUsers()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = users.find((u) => u.id === +userId)

  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-2 flex items-center gap-3">
        <div
          className="rounded-xl p-2.5"
          style={{ background: 'var(--gold-dim)' }}
        >
          <KeyRound className="h-6 w-6" style={{ color: 'var(--gold)' }} />
        </div>
        <div>
          <h1 className="page-title">Parolni o'zgartirish</h1>
          <p className="text-muted text-sm">Faqat Rahbar amalga oshirishi mumkin</p>
        </div>
      </div>

      {/* Hodimlarning joriy login/paroli — doim ko'rinib turadi */}
      <div className="card space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gold">Hodimlarning joriy login va paroli</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-gold font-bold text-left bg-surface-2">
                <th className="p-2.5">F.I.Sh</th>
                <th className="p-2.5">Rol</th>
                <th className="p-2.5">Login</th>
                <th className="p-2.5">Parol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-hover font-semibold">
                  <td className="p-2.5 text-body font-bold">{u.full_name}</td>
                  <td className="p-2.5 text-muted">{ROLE_LABEL[u.role] || u.role}</td>
                  <td className="p-2.5 font-mono">{u.username}</td>
                  <td className="p-2.5 font-mono text-gold">{u.plain_password || '— (eski, hali o\'zgartirilmagan)'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-muted italic">Yuklanmoqda...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-5 max-w-md">
        {/* User selector */}
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Foydalanuvchi *
          </label>
          <select
            className="input-field"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">— Tanlang</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({ROLE_LABEL[u.role] || u.role})
              </option>
            ))}
          </select>
          {selectedUser && (
            <p className="text-muted mt-1 text-xs">
              Rol: <span style={{ color: 'var(--gold)' }}>{ROLE_LABEL[selectedUser.role] || selectedUser.role}</span>
            </p>
          )}
        </div>

        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Yangi login *
          </label>
          <input
            className="input-field"
            placeholder="Masalan: admin2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        {/* New password */}
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Yangi parol *
          </label>
          <div className="relative">
            <input
              className="input-field pr-10"
              type={showPw ? 'text' : 'password'}
              placeholder="Kamida 6 ta belgi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Parolni tasdiqlash *
          </label>
          <input
            className="input-field"
            type={showPw ? 'text' : 'password'}
            placeholder="Parolni qayta kiriting"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm && password !== confirm && (
            <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
              Parollar mos kelmaydi
            </p>
          )}
          {confirm && password === confirm && confirm.length >= 6 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--success)' }}>
              Parollar mos keladi
            </p>
          )}
        </div>

        {/* Strength indicator */}
        {password.length > 0 && (
          <div>
            <div className="flex gap-1">
              {[1,2,3,4].map((n) => (
                <div
                  key={n}
                  className="h-1.5 flex-1 rounded-full transition-all"
                  style={{
                    background: password.length >= n * 2.5
                      ? n <= 1 ? 'var(--danger)'
                        : n === 2 ? '#f97316'
                        : n === 3 ? '#eab308'
                        : 'var(--success)'
                      : 'var(--border)',
                  }}
                />
              ))}
            </div>
            <p className="text-muted mt-1 text-xs">
              {password.length < 6 ? 'Juda qisqa' : password.length < 8 ? "O'rtacha" : password.length < 12 ? 'Yaxshi' : 'Juda kuchli'}
            </p>
          </div>
        )}

        <button
          type="button"
          className="btn-gold w-full py-2.5 text-base"
          disabled={loading || !userId || !username || username.length < 3 || password.length < 6 || password !== confirm}
          onClick={submit}
        >
          {loading ? "Saqlanmoqda..." : "Parolni o'zgartirish"}
        </button>
      </div>

    </div>
  )
}
