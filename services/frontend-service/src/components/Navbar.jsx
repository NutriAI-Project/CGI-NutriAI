import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import api from '../api/axios'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    if (user) {
      api.get('/notifications/count').then(res => {
        setNotificationCount(res.data.count || 0)
      }).catch(() => {})
    }
  }, [user, location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(path)
  }

  if (!user) {
    return (
      <nav className="navbar navbar-expand-lg navbar-dark navbar-nutriai fixed-top">
        <div className="container-fluid px-3">
          <Link className="navbar-brand" to="/"><i className="fas fa-leaf"></i> NutriAI</Link>
          <button className="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMain">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarMain">
            <ul className="navbar-nav ms-auto gap-2">
              <li className="nav-item"><Link className="btn btn-outline-light-nav" to="/login">Login</Link></li>
              <li className="nav-item"><Link className="btn btn-solid-light-nav" to="/register">Register</Link></li>
            </ul>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark navbar-nutriai fixed-top">
      <div className="container-fluid px-3">
        <Link className="navbar-brand" to="/dashboard"><i className="fas fa-leaf"></i> NutriAI</Link>
        <button className="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMain">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarMain">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} to="/dashboard">
                <i className="fas fa-th-large me-1"></i> Dashboard
              </Link>
            </li>
            {user.role !== 'admin' && (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/documents') ? 'active' : ''}`} to="/documents">
                    <i className="fas fa-file-medical me-1"></i> Documents
                  </Link>
                </li>
                <li className="nav-item dropdown">
                  <button className={`nav-link dropdown-toggle border-0 bg-transparent ${isActive('/diet-plan') ? 'active' : ''}`} type="button" data-bs-toggle="dropdown">
                    <i className="fas fa-utensils me-1"></i> Diet Plan
                  </button>
                  <ul className="dropdown-menu">
                    <li><Link className="dropdown-item" to="/diet-plan"><i className="fas fa-magic"></i> Generate</Link></li>
                    <li><Link className="dropdown-item" to="/diet-plan/history"><i className="fas fa-history"></i> History</Link></li>
                  </ul>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/health-tracker') ? 'active' : ''}`} to="/health-tracker">
                    <i className="fas fa-heartbeat me-1"></i> Health Tracker
                  </Link>
                </li>
                <li className="nav-item position-relative">
                  <Link className={`nav-link ${isActive('/notifications') ? 'active' : ''}`} to="/notifications">
                    <i className="fas fa-bell me-1"></i> Notifications
                    {notificationCount > 0 && (
                      <span className="notification-badge" id="notification-badge">{notificationCount}</span>
                    )}
                  </Link>
                </li>
              </>
            )}
          </ul>


          <ul className="navbar-nav ms-auto">
            <li className="nav-item dropdown">
              <button className="nav-link dropdown-toggle border-0 bg-transparent" type="button" data-bs-toggle="dropdown">
                <i className="fas fa-user-circle me-1"></i> {user.username}
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><Link className="dropdown-item" to="/profile"><i className="fas fa-user-edit"></i> Profile</Link></li>
                {user.role === 'admin' && (
                  <li><Link className="dropdown-item" to="/admin"><i className="fas fa-shield-alt"></i> Admin Panel</Link></li>
                )}
                {user.role !== 'admin' && (
                  <li><Link className="dropdown-item" to="/help"><i className="fas fa-question-circle"></i> Help</Link></li>
                )}
                <li><hr className="dropdown-divider" /></li>
                <li><button className="dropdown-item text-danger" onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Logout</button></li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  )
}
