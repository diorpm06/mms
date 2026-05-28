import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Moon, Sun, LogOut, Menu, X } from 'lucide-react'
import { api } from '../utils/api'
import { useTheme } from '../hooks/useTheme'
import NotificationBell from './NotificationBell'
import logo from '@assets/logo.png'

const CEO_LINKS = [
  { to: '/ceo',              label: 'Dashboard',           end: true },
  { to: '/ceo/new-patient',  label: 'Yangi mijoz' },
  { to: '/ceo/search',       label: 'Qidirish' },
  { to: '/ceo/patients',     label: 'Mijozlar' },
  { to: '/ceo/services',     label: 'Xizmatlar' },
  { to: '/ceo/referrers',    label: "Yo'naltiruvchilar" },
  { to: '/ceo/providers',    label: "Xizmat ko'rsatuvchilar" },
  { to: '/ceo/employees',    label: 'Xodimlar' },
  { to: '/ceo/inpatients',   label: 'Yotganlar' },
  { to: '/ceo/duty',         label: 'Dejur' },
  { to: '/ceo/cash',         label: 'Kassa' },
  { to: '/ceo/balance',      label: 'Balans' },
  { to: '/ceo/expenses',     label: 'Harajatlar' },
  { to: '/ceo/advances',     label: 'Avanslar' },
  { to: '/ceo/reports',      label: 'Hisobotlar' },
  { to: '/ceo/activity',     label: 'Faoliyat tarixi' },
  { to: '/ceo/backup',       label: 'Backup (Sheets URL)' },
  { to: '/ceo/change-password', label: 'Parollar' },
]

const ADMIN_LINKS = [
  { to: '/admin',            label: 'Dashboard',        end: true },
  { to: '/admin/new-patient',label: 'Yangi mijoz' },
  { to: '/admin/search',     label: 'Qidirish' },
  { to: '/admin/today',      label: 'Bugungi mijozlar' },
  { to: '/admin/catalog',    label: "Ma'lumotnomalar" },
  { to: '/admin/reports',    label: 'Kunlik hisobot' },
  { to: '/admin/inpatients', label: 'Yotganlar' },
  { to: '/admin/expenses',   label: 'Harajat' },
]

export default function Layout({ role }) {
  const { toggleTheme, role: authRole, logout, accessToken } = useAuthStore()
  const [logoError, setLogoError] = useState(false)
  const { isLight } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const links = role === 'ceo' ? CEO_LINKS : ADMIN_LINKS
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navRef = useRef(null)
  const scrollKey = `sidebar-scroll-${role}`

  const handleLogout = async () => {
    try {
      if (accessToken) await api('/auth/logout', { method: 'POST' })
    } catch (_) {}
    logout()
    navigate('/login')
  }

  const isActive = (to, end) => end ? location.pathname === to : location.pathname.startsWith(to)

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const saved = Number(sessionStorage.getItem(scrollKey) || 0)
    el.scrollTop = Number.isFinite(saved) ? saved : 0
  }, [scrollKey, location.pathname])

  const saveScroll = () => {
    const el = navRef.current
    if (!el) return
    sessionStorage.setItem(scrollKey, String(el.scrollTop))
  }

  const SidebarContent = () => (
    <div className="sidebar flex h-full w-64 flex-col p-4">
      <div
        className="mb-5 flex flex-col items-center gap-2 border-b pb-4"
        style={{ borderColor: 'var(--border)' }}
      >
        {!logoError ? (
          <img
            src={logo}
            alt="Marjona Med Service"
            className="logo-img"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--border-strong)' }}
          >
            MMS
          </div>
        )}
        <p className="text-center text-sm font-bold" style={{ color: 'var(--gold)' }}>
          Marjona Med Service
        </p>
        <p className="text-muted text-xs">{authRole === 'ceo' ? 'CEO' : 'Admin'}</p>
      </div>

      <nav ref={navRef} onScroll={saveScroll} className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => { saveScroll(); setSidebarOpen(false) }}
            className={isActive(l.to, l.end) ? 'nav-active' : 'nav-link'}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div
        className="mt-2 flex gap-2 border-t pt-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-center">
          <NotificationBell />
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-outline flex-1 py-2 text-sm"
          title={isLight ? 'Qora mavzu' : 'Oq mavzu'}
        >
          {isLight ? <Moon className="mx-auto h-4 w-4" /> : <Sun className="mx-auto h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="btn-outline flex-1 py-2 text-sm"
          title="Chiqish"
        >
          <LogOut className="mx-auto h-4 w-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-full md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <header
        className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center gap-3 border-b px-4 md:hidden"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="btn-ghost p-2"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="flex-1 font-bold text-sm" style={{ color: 'var(--gold)' }}>
          Marjona Med Service
        </p>
        <NotificationBell />
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div className={`sidebar-mobile md:hidden ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar flex h-full flex-col p-4 w-64">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-bold text-sm" style={{ color: 'var(--gold)' }}>Menyu</p>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="btn-ghost p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setSidebarOpen(false)}
                className={isActive(l.to, l.end) ? 'nav-active' : 'nav-link'}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-2 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={toggleTheme} className="btn-outline flex-1 py-2 text-sm">
              {isLight ? <Moon className="mx-auto h-4 w-4" /> : <Sun className="mx-auto h-4 w-4" />}
            </button>
            <button type="button" onClick={handleLogout} className="btn-outline flex-1 py-2 text-sm">
              <LogOut className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="min-h-screen pt-14 md:ml-64 md:pt-0">
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
