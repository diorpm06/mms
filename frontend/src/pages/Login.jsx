import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { useTheme } from '../hooks/useTheme'
import { Moon, Sun, Eye, EyeOff, Fingerprint } from 'lucide-react'
import {
  isBiometricAvailable,
  hasBiometricRegistered,
  verifyBiometric,
  registerBiometric,
} from '../utils/webauthn'
import logo from '@assets/logo.png'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [bioAvailable,   setBioAvailable]   = useState(false)
  const [bioRegistered,  setBioRegistered]  = useState(false)
  const [bioLoading,     setBioLoading]     = useState(false)
  const [showRegBio,     setShowRegBio]     = useState(false)
  const [logoError,      setLogoError]      = useState(false)

  const { setAuth, refreshToken, toggleTheme } = useAuthStore()
  const { isLight } = useTheme()
  const toast = useToastStore((s) => s.add)
  const navigate = useNavigate()

  useEffect(() => {
    isBiometricAvailable().then((ok) => {
      setBioAvailable(ok)
      setBioRegistered(ok && hasBiometricRegistered())
    })
  }, [])

  const parseResponseJson = async (res) => {
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      throw new Error("Backend bilan ulanishda xato yuz berdi. Iltimos qayta urinib ko'ring.")
    }
    return res.json()
  }

  const getRedirectPath = (role) => {
    if (role === 'ceo') return '/ceo'
    if (role === 'doctor') return '/doctor'
    return '/admin'
  }

  const doRefreshAndNavigate = async () => {
    const { refreshToken: rt, role: r } = useAuthStore.getState()
    if (!rt) return false
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) return false
    const data = await parseResponseJson(res)
    setAuth(data)
    navigate(getRedirectPath(data.role))
    return true
  }

  const handleBiometric = async () => {
    setBioLoading(true)
    try {
      await verifyBiometric()
      const ok = await doRefreshAndNavigate()
      if (!ok) toast("Seans muddati tugagan, qayta kiring", 'error')
    } catch (e) {
      toast(e.message || 'Biometrik tekshiruv bajarilmadi', 'error')
    } finally {
      setBioLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      toast('Login va parol kiriting', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await parseResponseJson(res)
      if (!res.ok) throw new Error(data.detail || 'Login xato')
      setAuth(data)
      toast('Muvaffaqiyatli kirdingiz')
      navigate(getRedirectPath(data.role))
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEnableBiometric = async () => {
    const { fullName } = useAuthStore.getState()
    try {
      await registerBiometric(fullName || username, fullName || username)
      toast("Biometrik kirish yoqildi!")
      setBioRegistered(true)
    } catch (e) {
      toast(e.message || "Biometrik yoqilmadi", 'error')
    } finally {
      const { role: r } = useAuthStore.getState()
      navigate(getRedirectPath(r))
    }
  }

  if (showRegBio) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-sm text-center">
          <div
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl"
            style={{ background: 'var(--gold-dim)', border: '1px solid var(--border-strong)' }}
          >
            <Fingerprint className="h-12 w-12" style={{ color: 'var(--gold)' }} />
          </div>
          <h2 className="page-title mb-2">Biometrik kirish</h2>
          <p className="text-muted text-sm mb-6">
            Face ID yoki Touch ID bilan tez kirish imkoniyatini yoqasizmi?
          </p>
          <div className="space-y-3">
            <button
              type="button"
              className="btn-gold w-full py-3 text-base"
              onClick={handleEnableBiometric}
            >
              Yoqish
            </button>
            <button
              type="button"
              className="btn-outline w-full py-3 text-base"
              onClick={() => {
                const { role: r } = useAuthStore.getState()
                navigate(getRedirectPath(r))
              }}
            >
              Keyinroq
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="btn-outline absolute right-5 top-5 p-2"
        title={isLight ? 'Qora mavzu' : 'Oq mavzu'}
      >
        {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: 'var(--gold-dim)', border: '1px solid var(--border-strong)' }}
          >
            {!logoError ? (
              <img src={logo} alt="logo" className="h-14 w-auto object-contain" onError={() => setLogoError(true)} />
            ) : (
              <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>MMS</span>
            )}
          </div>
          <h1 className="page-title text-2xl">Marjona Med Servis</h1>
          <p className="text-muted mt-1 text-sm">Tibbiy klinika boshqaruv tizimi</p>
        </div>

        {/* Biometric button (when registered + has stored session) */}
        {bioAvailable && (
          <button
            type="button"
            disabled={bioLoading || (!bioRegistered || !refreshToken)}
            onClick={() => {
              if (bioRegistered && refreshToken) handleBiometric()
              else toast("Avval login qiling, keyin Face ID / Touch ID yoqiladi", 'info')
            }}
            className="btn-gold mb-4 flex w-full items-center justify-center gap-3 py-3 text-base"
          >
            <Fingerprint className="h-5 w-5" />
            {bioRegistered && refreshToken
              ? (bioLoading ? 'Tekshirilmoqda...' : 'Face ID / Touch ID bilan kirish')
              : 'Face ID / Touch ID yoqish'}
          </button>
        )}

        {/* Divider when biometric is available */}
        {bioAvailable && (
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1" style={{ height: 1, background: 'var(--border)' }} />
            <span className="text-muted text-xs">yoki parol bilan</span>
            <div className="flex-1" style={{ height: 1, background: 'var(--border)' }} />
          </div>
        )}

        {/* Form card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
                Username
              </label>
              <input
                className="input-field"
                placeholder="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
                Parol
              </label>
              <div className="relative">
                <input
                  className="input-field pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-body"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-3 text-base"
            >
              {loading ? 'Kirish...' : 'Kirish'}
            </button>
          </form>
        </div>

        <p className="text-muted mt-6 text-center text-xs">
          © 2025 Marjona Med Servis
        </p>
      </div>
    </div>
  )
}
