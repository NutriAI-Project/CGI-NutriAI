import { Routes, Route, Navigate } from 'react-router-dom'
import useAuth from './hooks/useAuth'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import DietPlanGenerate from './pages/DietPlanGenerate'
import DietPlanHistory from './pages/DietPlanHistory'
import HealthTracker from './pages/HealthTracker'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import Help from './pages/Help'
import SystemHealth from './pages/SystemHealth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import FlashMessage from './components/FlashMessage'
import LoadingSpinner from './components/LoadingSpinner'

export default function App() {
  const { loading, flash, user } = useAuth()

  if (loading) return <LoadingSpinner fullPage />

  return (
    <>
      {flash && <FlashMessage message={flash.message} type={flash.type} />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/dashboard" element={<ProtectedRoute>{user?.role === 'admin' ? <Admin /> : <Dashboard />}</ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/diet-plan" element={<ProtectedRoute><DietPlanGenerate /></ProtectedRoute>} />
        <Route path="/diet-plan/history" element={<ProtectedRoute><DietPlanHistory /></ProtectedRoute>} />
        <Route path="/health-tracker" element={<ProtectedRoute><HealthTracker /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute>{user?.role === 'admin' ? <Navigate to="/dashboard" replace /> : <Help />}</ProtectedRoute>} />
        <Route path="/system-health" element={<ProtectedRoute><SystemHealth /></ProtectedRoute>} />

        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
      </Routes>
    </>
  )
}
