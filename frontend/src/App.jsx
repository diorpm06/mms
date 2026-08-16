import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useTheme } from './hooks/useTheme'
import Toast from './components/Toast'
import Layout from './components/Layout'
import Login from './pages/Login'

// Route-level code splitting: every role only downloads the pages it
// actually visits, instead of one bundle containing all CEO/Admin/Doctor
// screens up front. Login/Layout/Toast stay eager since they're needed
// immediately on every visit.
const CeoDashboard = lazy(() => import('./pages/ceo/Dashboard'))
const CeoPatients = lazy(() => import('./pages/ceo/Patients'))
const CeoServices = lazy(() => import('./pages/ceo/Services'))
const AdminReportQueue = lazy(() => import('./pages/admin/ReportQueue'))
const CeoReferrers = lazy(() => import('./pages/ceo/Referrers'))
const CeoCommissions = lazy(() => import('./pages/ceo/Commissions'))
const CeoProviders = lazy(() => import('./pages/ceo/Providers'))
const CeoEmployees = lazy(() => import('./pages/ceo/Employees'))
const CeoBalance = lazy(() => import('./pages/ceo/Balance'))
const CeoAdvances = lazy(() => import('./pages/ceo/Advances'))
const CeoSavedReports = lazy(() => import('./pages/ceo/SavedReports'))
const CeoActivity = lazy(() => import('./pages/ceo/Activity'))
const CeoDuty = lazy(() => import('./pages/ceo/Duty'))
const CeoInpatients = lazy(() => import('./pages/ceo/Inpatients'))
const CeoCash = lazy(() => import('./pages/ceo/Cash'))
const ChangePassword = lazy(() => import('./pages/ceo/ChangePassword'))
const CeoBackup = lazy(() => import('./pages/ceo/Backup'))
const CeoExpenses = lazy(() => import('./pages/ceo/Expenses'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const NewPatient = lazy(() => import('./pages/admin/NewPatient'))
const Search = lazy(() => import('./pages/admin/Search'))
const TodayPatients = lazy(() => import('./pages/admin/TodayPatients'))
const AdminExpenses = lazy(() => import('./pages/admin/Expenses'))
const AdminCatalog = lazy(() => import('./pages/admin/Catalog'))
const AdminReports = lazy(() => import('./pages/admin/Reports'))
const TvQueueDisplay = lazy(() => import('./pages/TvQueueDisplay'))
const DoctorPanel = lazy(() => import('./pages/doctor/DoctorPanel'))
const Appointments = lazy(() => import('./pages/admin/Appointments'))
const Inventory = lazy(() => import('./pages/admin/Inventory'))
const Payroll = lazy(() => import('./pages/ceo/Payroll'))
const TvManagerDashboard = lazy(() => import('./pages/TvManagerDashboard'))
const UnifiedReportsHub = lazy(() => import('./pages/ceo/UnifiedReportsHub'))

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
    </div>
  )
}

function PrivateRoute({ children, roles }) {
  const { accessToken, role } = useAuthStore()
  if (!accessToken) return <Navigate to="/login" replace />
  if (roles && !roles.includes(role)) return <Navigate to="/login" replace />
  return children
}

function CeoLayout() {
  return (
    <PrivateRoute roles={['ceo']}>
      <Layout role="ceo" />
    </PrivateRoute>
  )
}

function AdminLayout() {
  return (
    <PrivateRoute roles={['admin', 'ceo']}>
      <Layout role="admin" />
    </PrivateRoute>
  )
}

function DoctorLayout() {
  return (
    <PrivateRoute roles={['doctor', 'admin', 'ceo']}>
      <Layout role="doctor" />
    </PrivateRoute>
  )
}

function useStartupAuth() {
  const { refreshToken, setAuth, logout } = useAuthStore()
  useEffect(() => {
    if (!refreshToken) return
    fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setAuth(data); else logout() })
      .catch(() => {})
  }, [])
}

function AppRoutes() {
  useTheme()
  useStartupAuth()
  return (
    <BrowserRouter>
      <Toast />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tv" element={<TvQueueDisplay />} />
        <Route path="/queue" element={<TvQueueDisplay />} />
        <Route path="/doctor" element={<DoctorLayout />}>
          <Route index element={<DoctorPanel />} />
        </Route>
        <Route path="/ceo" element={<CeoLayout />}>
          <Route index element={<CeoDashboard />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="report-queue" element={<AdminReportQueue />} />
          <Route path="new-patient" element={<NewPatient homePath="/ceo" />} />
          <Route path="search" element={<Search homePath="/ceo" />} />
          <Route path="patients" element={<CeoPatients />} />
          <Route path="services" element={<CeoServices />} />
          <Route path="referrers" element={<CeoReferrers />} />
          {/* Komissiya endi Yo'naltiruvchilar sahifasi ichida. Eski havola
              saqlangan bo'lsa ham shu yerga olib boradi. */}
          <Route path="commissions" element={<CeoReferrers />} />
          <Route path="providers" element={<CeoProviders />} />
          <Route path="employees" element={<CeoEmployees />} />
          <Route path="inpatients" element={<CeoInpatients />} />
          <Route path="duty" element={<CeoDuty />} />
          <Route path="cash" element={<CeoCash />} />
          <Route path="balance" element={<CeoBalance />} />
          <Route path="expenses" element={<CeoExpenses />} />
          <Route path="advances" element={<CeoAdvances />} />
          <Route path="saved-reports" element={<CeoSavedReports />} />
          <Route path="reports" element={<UnifiedReportsHub homePath="/ceo" />} />
          <Route path="activity" element={<CeoActivity />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="backup" element={<CeoBackup />} />
          <Route path="tv-manager" element={<TvManagerDashboard />} />
          <Route path="banners" element={<TvManagerDashboard defaultTab="banners" />} />
          <Route path="doctor" element={<DoctorPanel />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="report-queue" element={<AdminReportQueue />} />
          <Route path="new-patient" element={<NewPatient homePath="/admin" />} />
          <Route path="today" element={<TodayPatients />} />
          <Route path="patients" element={<CeoPatients />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="tv-manager" element={<TvManagerDashboard />} />
          <Route path="banners" element={<TvManagerDashboard defaultTab="banners" />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="inpatients" element={<CeoInpatients />} />
          <Route path="expenses" element={<AdminExpenses />} />
          <Route path="doctor" element={<DoctorPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default function App() {
  // Zustand persist rehydrates localStorage asynchronously (one tick after
  // first mount). Without this gate, pages' first-mount API calls fire
  // before the saved accessToken is loaded into the store, get a 401 with
  // no token to retry with, and show a premature error toast before the
  // real (successful) data arrives moments later.
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (hydrated) return
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="h-8 w-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
      </div>
    )
  }

  return <AppRoutes />
}
