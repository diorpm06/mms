import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useTheme } from './hooks/useTheme'
import Toast from './components/Toast'
import Layout from './components/Layout'
import Login from './pages/Login'
import CeoDashboard from './pages/ceo/Dashboard'
import CeoPatients from './pages/ceo/Patients'
import CeoServices from './pages/ceo/Services'
import CeoReferrers from './pages/ceo/Referrers'
import CeoProviders from './pages/ceo/Providers'
import CeoEmployees from './pages/ceo/Employees'
import CeoBalance from './pages/ceo/Balance'
import CeoExpenses from './pages/ceo/Expenses'
import CeoAdvances from './pages/ceo/Advances'
import CeoReports from './pages/ceo/Reports'
import CeoActivity from './pages/ceo/Activity'
import CeoDuty from './pages/ceo/Duty'
import CeoInpatients from './pages/ceo/Inpatients'
import CeoCash from './pages/ceo/Cash'
import ChangePassword from './pages/ceo/ChangePassword'
import CeoBackup from './pages/ceo/Backup'
import AdminDashboard from './pages/admin/Dashboard'
import NewPatient from './pages/admin/NewPatient'
import Search from './pages/admin/Search'
import TodayPatients from './pages/admin/TodayPatients'
import AdminExpenses from './pages/admin/Expenses'
import AdminCatalog from './pages/admin/Catalog'
import AdminReports from './pages/admin/Reports'

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/ceo" element={<CeoLayout />}>
          <Route index element={<CeoDashboard />} />
          <Route path="new-patient" element={<NewPatient homePath="/ceo" />} />
          <Route path="search" element={<Search homePath="/ceo" />} />
          <Route path="patients" element={<CeoPatients />} />
          <Route path="services" element={<CeoServices />} />
          <Route path="referrers" element={<CeoReferrers />} />
          <Route path="providers" element={<CeoProviders />} />
          <Route path="employees" element={<CeoEmployees />} />
          <Route path="inpatients" element={<CeoInpatients />} />
          <Route path="duty" element={<CeoDuty />} />
          <Route path="cash" element={<CeoCash />} />
          <Route path="balance" element={<CeoBalance />} />
          <Route path="expenses" element={<CeoExpenses />} />
          <Route path="advances" element={<CeoAdvances />} />
          <Route path="reports" element={<CeoReports />} />
          <Route path="activity" element={<CeoActivity />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="backup" element={<CeoBackup />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="new-patient" element={<NewPatient homePath="/admin" />} />
          <Route path="search" element={<Search homePath="/admin" />} />
          <Route path="today" element={<TodayPatients />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="inpatients" element={<CeoInpatients />} />
          <Route path="expenses" element={<AdminExpenses />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return <AppRoutes />
}
