import { Navigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import useAuth from '../hooks/useAuth'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

AdminRoute.propTypes = {
  children: PropTypes.node.isRequired,
}
