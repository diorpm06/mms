import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { useAuthStore } from '../../store/authStore'
import { KeyRound, Eye, EyeOff, Fingerprint } from 'lucide-react'
import { isBiometricAvailable, hasBiometricRegistered, registerBiometric, removeBiometric } from '../../utils/webauthn'

export default function ChangePassword() {
  const [users,      setUsers]      = useState([])
  const [userId,     setUserId]     = useState('')
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [bioAvail,   setBioAvail]   = useState(false)
  const [bioOn,      setBioOn]      = useState(false)
  const { fullName } = useAuthStore()
  const toast = useToastStore((s) => s.add)

  useEffect(() => {
    api('/auth/users').then(setUsers).catch(() => {})
    isBiometricAvailable().then((ok) => { setBioAvail(ok); if (ok) setBioOn(hasBiometricRegistered()) })
  }, [])

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
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = users.find((u) => u.id === +userId)

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center gap-3">
        <div
          className="rounded-xl p-2.5"
          style={{ background: 'var(--gold-dim)' }}
        >
          <KeyRound className="h-6 w-6" style={{ color: 'var(--gold)' }} />
        </div>
        <div>
          <h1 className="page-title">Parolni o'zgartirish</h1>
          <p className="text-muted text-sm">Faqat CEO amalga oshirishi mumkin</p>
        </div>
      </div>

      <div className="card space-y-5">
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
                {u.full_name} ({u.role === 'ceo' ? 'CEO' : 'Admin'})
              </option>
            ))}
          </select>
          {selectedUser && (
            <p className="text-muted mt-1 text-xs">
              Rol: <span style={{ color: 'var(--gold)' }}>{selectedUser.role === 'ceo' ? 'CEO' : 'Admin'}</span>
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

      {/* Biometric section */}
      {bioAvail && (
        <div className="card mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl p-2.5" style={{ background: 'var(--gold-dim)' }}>
              <Fingerprint className="h-5 w-5" style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Biometrik kirish</h2>
              <p className="text-muted text-xs">Face ID / Touch ID (faqat bu qurilma uchun)</p>
            </div>
          </div>
          {bioOn ? (
            <button
              type="button"
              className="btn-danger w-full py-2"
              onClick={() => { removeBiometric(); setBioOn(false); toast("Biometrik kirish o'chirildi") }}
            >
              O'chirish
            </button>
          ) : (
            <button
              type="button"
              className="btn-gold w-full py-2"
              onClick={async () => {
                try {
                  await registerBiometric(fullName || 'user', fullName || 'user')
                  setBioOn(true)
                  toast("Biometrik kirish yoqildi!")
                } catch (e) {
                  toast(e.message || "Biometrik yoqilmadi", 'error')
                }
              }}
            >
              Yoqish
            </button>
          )}
        </div>
      )}
    </div>
  )
}
