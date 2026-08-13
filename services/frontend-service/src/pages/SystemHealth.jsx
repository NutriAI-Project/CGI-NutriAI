import { useState, useEffect } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'

export default function SystemHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = async () => {
    try {
      const res = await api.get('/health/all')
      setHealth(res.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchHealth() }, [])

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  const statusColor = (s) => {
    if (s === 'healthy') return 'success'
    if (s === 'degraded') return 'warning'
    return 'danger'
  }
  const statusIcon = (s) => {
    if (s === 'healthy') return 'fa-check-circle'
    if (s === 'degraded') return 'fa-exclamation-circle'
    return 'fa-times-circle'
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div><h3 className="fw-bold mb-1"><i className="fas fa-server text-primary-green me-2"></i>System Health</h3><p className="text-muted mb-0">Real-time microservice status</p></div>
            <button className="btn btn-nutriai-outline" onClick={() => { setLoading(true); fetchHealth() }}><i className="fas fa-sync-alt me-2"></i>Refresh</button>
          </div>

          {health && (
            <>
              <div className="content-card mb-4 text-center py-4">
                <i className={`fas ${statusIcon(health.overall_status)} text-${statusColor(health.overall_status)} mb-2`} style={{ fontSize: '3rem' }}></i>
                <h4 className="fw-bold">Overall Status: <span className={`text-${statusColor(health.overall_status)}`}>{health.overall_status?.toUpperCase()}</span></h4>
              </div>

              <div className="row g-4">
                {Object.entries(health.services || {}).map(([name, svc]) => (
                  <div key={name} className="col-md-6 col-lg-4">
                    <div className="content-card h-100">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <i className={`fas ${statusIcon(svc.status)} text-${statusColor(svc.status)}`} style={{ fontSize: '1.5rem' }}></i>
                        <div>
                          <h6 className="fw-bold mb-0">{name}</h6>
                          <span className={`badge bg-${statusColor(svc.status)}`}>{svc.status}</span>
                        </div>
                      </div>
                      {svc.database && <small className="text-muted d-block">DB: {svc.database}</small>}
                      {svc.timestamp && <small className="text-muted d-block">Last check: {new Date(svc.timestamp).toLocaleTimeString()}</small>}
                      {svc.error && <small className="text-danger d-block mt-1"><i className="fas fa-exclamation-triangle me-1"></i>{svc.error}</small>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
