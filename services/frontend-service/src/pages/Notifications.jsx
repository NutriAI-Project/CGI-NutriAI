import { useState, useEffect } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notifications/list').then(res => setNotifications(res.data.notifications || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch {}
  }

  const iconColors = { success: { bg: '#E8F5E9', color: '#2E7D32' }, danger: { bg: '#FFEBEE', color: '#C62828' }, warning: { bg: '#FFF8E1', color: '#F57F17' }, info: { bg: '#E3F2FD', color: '#1565C0' } }

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4"><h3 className="fw-bold"><i className="fas fa-bell text-primary-green me-2"></i>Notifications</h3><p className="text-muted">Stay updated with your health journey</p></div>

          <div className="content-card">
            {notifications.length > 0 ? notifications.map(n => {
              const ic = iconColors[n.type] || iconColors.info
              return (
                <div
                  key={n.id}
                  className={`notification-item ${n.is_read ? '' : 'unread'}`}
                  onClick={n.is_read ? undefined : () => markRead(n.id)}
                  onKeyDown={n.is_read ? undefined : (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      markRead(n.id)
                    }
                  }}
                  role={n.is_read ? undefined : 'button'}
                  tabIndex={n.is_read ? undefined : 0}
                  style={{ cursor: n.is_read ? 'default' : 'pointer' }}
                >
                  <div className={`notification-icon ${n.type}`} style={{ background: ic.bg, color: ic.color }}>
                    <i className={`fas ${n.icon || 'fa-bell'}`}></i>
                  </div>
                  <div className="flex-grow-1">
                    <div className="notification-message">{n.message}</div>
                    <div className="notification-time">
                      <i className="fas fa-clock me-1"></i>
                      {new Date(n.created_at).toLocaleString()}
                      {n.email_sent && <span className="ms-2"><i className="fas fa-envelope text-success"></i> Email sent</span>}
                    </div>
                  </div>
                  {!n.is_read && <span className="badge bg-primary rounded-pill">New</span>}
                </div>
              )
            }) : (
              <div className="text-center py-5">
                <i className="fas fa-bell-slash text-muted mb-3" style={{ fontSize: '3rem' }}></i>
                <h5 className="text-muted">No notifications yet</h5>
                <p className="text-muted">You'll receive notifications for meal reminders and plan updates</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
