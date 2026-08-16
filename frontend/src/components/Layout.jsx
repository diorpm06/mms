import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Moon, Sun, LogOut, Menu, X, MessageSquare } from 'lucide-react'
import { api } from '../utils/api'
import { useTheme } from '../hooks/useTheme'
import NotificationBell from './NotificationBell'
import InternalChatModal from './InternalChatModal'
import PaymentReminderWidget from './PaymentReminderWidget'
import logo from '@assets/logo.png'
import { BRAND } from '../config/brand'

const CEO_LINKS = [
  { to: '/ceo',                 label: 'Dashboard',             icon: '📌', end: true },
  { to: '/ceo/new-patient',     label: 'Yangi Mijoz Qabul',     icon: '➕' },
  { to: '/ceo/patients',        label: 'Barcha Bemorlar va Qidiruv', icon: '👤' },
  { to: '/ceo/reports',         label: 'Hisobotlar va Moliya Markazi', icon: '📊' },
  { to: '/ceo/expenses',        label: 'Harajatlar (Xarajatlar)',icon: '💸' },
  { to: '/ceo/employees',       label: 'Xodimlar va Shifokorlar',icon: '👨‍⚕️' },
  { to: '/ceo/services',        label: 'Xizmatlar Katalogi',    icon: '🩺' },
  { to: '/ceo/referrers',       label: "Yo'naltiruvchilar (10-Kunlik)", icon: '🤝' },
  { to: '/ceo/inventory',       label: 'Omborxona',             icon: '💊' },
  { to: '/ceo/report-queue',    label: 'Shablonlar (Chop etish)', icon: '📋' },
  { to: '/ceo/doctor',          label: 'Doctor Paneli',         icon: '🩺' },
  { to: '/ceo/tv-manager',      label: 'TV Navbat Ekrani',      icon: '📺' },
  { to: '/ceo/inpatients',      label: 'Statsionar (Yotganlar)',icon: '🛏️' },
  { to: '/ceo/activity',        label: 'Tizim Faoliyati Tarixi',icon: '📜' },
  { to: '/ceo/backup',          label: 'Sheets Backup Sync',    icon: '🔄' },
  { to: '/ceo/change-password', label: 'Parollar va Xavfsizlik',icon: '🔐' },
]

const ADMIN_LINKS = [
  { to: '/admin',               label: 'Dashboard',             icon: '📌', end: true },
  { to: '/admin/new-patient',   label: 'Yangi Mijoz Qabul',     icon: '➕' },
  { to: '/admin/today',         label: 'Bugungi Bemorlar',     icon: '📋' },
  { to: '/admin/expenses',      label: 'Harajat Kiritish',     icon: '💸' },
  { to: '/admin/patients',      label: 'Barcha Bemorlar va Qidiruv', icon: '👤' },
  { to: '/admin/reports',       label: 'Kunlik Hisobot',        icon: '📊' },
  { to: '/admin/appointments',  label: 'Kalendar & Navbat',    icon: '📅' },
  { to: '/admin/doctor',        label: 'Doctor Paneli',         icon: '🩺' },
  { to: '/admin/tv-manager',    label: 'TV Navbat Ekrani',      icon: '📺' },
  { to: '/admin/inventory',     label: 'Omborxona (Material)', icon: '💊' },
  { to: '/admin/report-queue',  label: 'Shablonlar (Chop etish)', icon: '📋' },
  { to: '/admin/inpatients',    label: 'Statsionar (Yotganlar)',icon: '🛏️' },
  { to: '/admin/catalog',       label: "Ma'lumotnomalar",       icon: '📚' },
]

const DOCTOR_LINKS = [
  { to: '/doctor',              label: 'Doctor Paneli',         icon: '🩺', end: true },
]


export default function Layout({ role }) {
  const { toggleTheme, role: authRole, logout, accessToken } = useAuthStore()
  const [logoError, setLogoError] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const { isLight } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Prioritize layout route role over store authRole so doctor layout strictly shows DOCTOR_LINKS
  const effectiveRole = role || authRole
  const links = effectiveRole === 'doctor' ? DOCTOR_LINKS : effectiveRole === 'admin' ? ADMIN_LINKS : CEO_LINKS
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navRef = useRef(null)
  const scrollKey = `sidebar-scroll-${effectiveRole}`

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
            alt={BRAND.name}
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
        <p className="text-center text-sm font-black tracking-wide" style={{ color: 'var(--gold)' }}>
          {BRAND.name}
        </p>
        <p className="text-muted text-xs font-semibold">
          {effectiveRole === 'doctor' ? '🩺 Shifokor' : effectiveRole === 'admin' ? '👤 Administrator (Admin)' : '👑 Rahbar (Boshqaruv)'}
        </p>
      </div>

      <nav ref={navRef} onScroll={saveScroll} className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {links.map((l) => (
          l.external ? (
            <a
              key={l.to}
              href={l.to}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-2"
            >
              <span>{l.icon}</span>
              <span>{l.label} ↗</span>
            </a>
          ) : (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => { saveScroll(); setSidebarOpen(false) }}
              className={`${isActive(l.to, l.end) ? 'nav-active font-bold' : 'nav-link'} flex items-center gap-2.5`}
            >
              <span className="text-base">{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          )
        ))}
      </nav>

      <div
        className="mt-2 flex gap-1.5 border-t pt-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setChatOpen(!chatOpen)}
          className="btn-gold flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 shadow-md"
          title="Klinika Chat"
        >
          <MessageSquare className="h-4 w-4" /> Chat
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-outline flex h-9 w-9 items-center justify-center rounded-xl p-0"
          title={isLight ? 'Qorong me rejim' : 'Yorug rejim'}
        >
          {isLight ? <Moon className="h-4 w-4 text-amber-400" /> : <Sun className="h-4 w-4 text-amber-400" />}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="btn-danger flex h-9 w-9 items-center justify-center rounded-xl p-0"
          title="Tizimdan chiqish"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app font-sans text-body transition-colors duration-200">
      {/* Desktop Sidebar (Independent Left Scroll Area) */}
      <aside className="hidden md:flex md:w-64 flex-shrink-0 h-screen overflow-hidden border-r border-border/40">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex w-64 max-w-xs flex-1 flex-col z-10 h-full overflow-hidden">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area (Independent Right Scroll Area) */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="flex h-14 items-center justify-between border-b px-4 md:hidden flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-ghost p-1 text-gold"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <span className="font-extrabold text-sm text-gold">{BRAND.name}</span>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button type="button" onClick={handleLogout} className="text-rose-400 p-1">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Desktop Top Header Bar for Notifications */}
        <header className="hidden md:flex h-12 items-center justify-between px-6 border-b border-border/40 bg-surface-1/40 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-muted">
            <span>🏥 {BRAND.system}</span>
            <span>•</span>
            <span className="text-gold font-mono uppercase tracking-wider">{effectiveRole === 'ceo' ? 'Rahbar' : effectiveRole} Paneli</span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        {/* Dynamic Route Page Body (INDEPENDENT RIGHT SCROLL) */}
        {/* min-w-0 shart: usti overflow-hidden bo'lgani uchun, kengroq jadval
            bu bo'lmasa kesilib qolardi va unga yetib ham bo'lmasdi. */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto min-h-0 min-w-0">
          {/* Keng ekranda kontent cheksiz cho'zilmasin — o'qish uchun qulay
              kenglikda markazda tursin. Ilgari har sahifa o'zicha max-w
              qo'yardi (biri 3xl, biri 4xl, ko'pchiligi umuman yo'q). */}
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Internal Clinic Staff Chat Modal */}
      <InternalChatModal open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Floating Bottom-Left Unpaid Payment Reminder Widget */}
      <PaymentReminderWidget />
    </div>
  )
}
