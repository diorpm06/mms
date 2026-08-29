import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useTheme } from './hooks/useTheme'
import { api } from './utils/api'
import Toast from './components/Toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import { isChunkLoadError, recoverFromChunkError } from './utils/chunkErrorRecovery'

// Helper wrapper for React lazy dynamic imports: if Vercel deploys a new commit while
// a user is on an open tab, old chunk hashes disappear resulting in 404/chunk load errors.
// This wrapper automatically catches dynamic import errors and reloads the window once.
function safeLazy(importFn) {
  return lazy(() =>
    importFn().catch((err) => {
      if (isChunkLoadError(err) && recoverFromChunkError()) {
        return new Promise(() => {})
      }
      throw err
    })
  )
}

const CeoDashboard = safeLazy(() => import('./pages/ceo/Dashboard'))
const CeoPatients = safeLazy(() => import('./pages/ceo/Patients'))
const CeoServices = safeLazy(() => import('./pages/ceo/Services'))
const AdminReportQueue = safeLazy(() => import('./pages/admin/ReportQueue'))
const CeoReferrers = safeLazy(() => import('./pages/ceo/Referrers'))
const CeoCommissions = safeLazy(() => import('./pages/ceo/Referrers'))
const CeoProviders = safeLazy(() => import('./pages/ceo/Providers'))
const CeoEmployees = safeLazy(() => import('./pages/ceo/Employees'))
const CeoBalance = safeLazy(() => import('./pages/ceo/Balance'))
const CeoAdvances = safeLazy(() => import('./pages/ceo/Advances'))
const CeoSavedReports = safeLazy(() => import('./pages/ceo/SavedReports'))
const CeoActivity = safeLazy(() => import('./pages/ceo/Activity'))
const CeoDuty = safeLazy(() => import('./pages/ceo/Duty'))
const CeoInpatients = safeLazy(() => import('./pages/ceo/Inpatients'))
const CeoInpatientSettings = safeLazy(() => import('./pages/ceo/InpatientSettings'))
const CeoCash = safeLazy(() => import('./pages/ceo/Cash'))
const ChangePassword = safeLazy(() => import('./pages/ceo/ChangePassword'))
const CeoBackup = safeLazy(() => import('./pages/ceo/Backup'))
const CeoExpenses = safeLazy(() => import('./pages/ceo/Expenses'))
const AdminDashboard = safeLazy(() => import('./pages/admin/Dashboard'))
const NewPatient = safeLazy(() => import('./pages/admin/NewPatient'))
const Search = safeLazy(() => import('./pages/admin/Search'))
const TodayPatients = safeLazy(() => import('./pages/admin/TodayPatients'))
const AdminExpenses = safeLazy(() => import('./pages/admin/Expenses'))
const AdminCatalog = safeLazy(() => import('./pages/admin/Catalog'))
const AdminReports = safeLazy(() => import('./pages/admin/Reports'))
const TvQueueDisplay = safeLazy(() => import('./pages/TvQueueDisplay'))
const DoctorPanel = safeLazy(() => import('./pages/doctor/DoctorPanel'))
const DoctorResults = safeLazy(() => import('./pages/doctor/MyResults'))
const DoctorProfile = safeLazy(() => import('./pages/doctor/MyProfile'))
const Courses = safeLazy(() => import('./pages/admin/Courses'))
const Appointments = safeLazy(() => import('./pages/admin/Appointments'))
const Inventory = safeLazy(() => import('./pages/admin/Inventory'))
const Payroll = safeLazy(() => import('./pages/ceo/Payroll'))
const TvManagerDashboard = safeLazy(() => import('./pages/TvManagerDashboard'))
const UnifiedReportsHub = safeLazy(() => import('./pages/ceo/UnifiedReportsHub'))
const ReferrerPortal = safeLazy(() => import('./pages/referrer/ReferrerPortal'))

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
    </div>
  )
}

// Zustand `persist` localStorage'dan ASINXRON o'qiydi. Ilova to'liq
// o'chirilib (masalan telefonda "so'nggi ilovalar"dan olib tashlangandan
// keyin) qayta ochilganda, birinchi render paytida hali hydratsiya
// tugamagan bo'ladi — shu lahzada accessToken hali `null`, garchi
// haqiqatda localStorage'da saqlangan bo'lsa ham. Shu sababli foydalanuvchi
// tizimga kirgan bo'lsa ham "/login" ga otilib ketardi. Hydratsiya
// tugashini kutib turish shu muammoni tuzatadi.
function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())
  useEffect(() => {
    if (hydrated) return
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    if (useAuthStore.persist.hasHydrated()) setHydrated(true)
    return unsub
  }, [hydrated])
  return hydrated
}

function PrivateRoute({ children, roles }) {
  const { accessToken, role } = useAuthStore()
  const hydrated = useAuthHydrated()
  if (!hydrated) return null
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
  const { accessToken, refreshToken, setAuth } = useAuthStore()
  useEffect(() => {
    if (!refreshToken) return
    // Faqat tokenlar bor bo'lsa fonda yangilaymiz.
    // Tarmoq sekinlashsa yoki server javob berishi kechiksa — foydalanuvchini
    // saqlangan sessiyasidan chiqarib yubormaymiz.
    api('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then((data) => {
        if (data && data.access_token) setAuth(data)
      })
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
        <Route
          path="/referrer-portal"
          element={
            <PrivateRoute roles={['referrer']}>
              <ReferrerPortal />
            </PrivateRoute>
          }
        />
        <Route path="/doctor" element={<DoctorLayout />}>
          <Route index element={<DoctorPanel />} />
          <Route path="natijalar" element={<DoctorResults />} />
          <Route path="profil" element={<DoctorProfile />} />
        </Route>
        <Route path="/ceo" element={<CeoLayout />}>
          <Route index element={<CeoDashboard />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="report-queue" element={<AdminReportQueue />} />
          <Route path="new-patient" element={<NewPatient homePath="/ceo" />} />
          <Route path="courses" element={<Courses />} />
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
          <Route path="inpatients-settings" element={<CeoInpatientSettings />} />
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
          <Route path="courses" element={<Courses />} />
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
