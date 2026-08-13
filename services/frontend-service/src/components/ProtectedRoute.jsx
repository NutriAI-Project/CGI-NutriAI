import { Navigate, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'
import useAuth from '../hooks/useAuth'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin' && location.pathname !== '/dashboard' && location.pathname !== '/system-health' && location.pathname !== '/help') {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
}
