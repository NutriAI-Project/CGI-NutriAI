import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const { user, showFlash } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [stats, setStats] = useState(null)
  const [recentPlan, setRecentPlan] = useState(null)
  const [recentDocs, setRecentDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const sso = params.get('sso')
    if (sso === 'registered') {
      showFlash('Account created successfully! Welcome to NutriAI via Microsoft.', 'success')
      navigate('/dashboard', { replace: true })
    } else if (sso === 'login') {
      showFlash('Signed in successfully with Microsoft!', 'success')
      navigate('/dashboard', { replace: true })
    }
  }, [location.search, showFlash, navigate])



  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docRes, planRes] = await Promise.allSettled([
          api.get('/documents/list'),
          api.get('/diet-plan/history'),
        ])

        const documents = docRes.status === 'fulfilled' ? docRes.value.data : []
        const plans = planRes.status === 'fulfilled' ? planRes.value.data : []

        setStats({
          total_documents: documents.length,
          total_diet_plans: plans.length,
          total_health_logs: 0,
          total_allergies: user?.allergies?.length || 0,
        })

        setRecentDocs(documents.slice(0, 5))
        if (plans.length > 0) setRecentPlan(plans[0])
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4">
            <h3 className="fw-bold">Welcome back, {user?.full_name}! 👋</h3>
            <p className="text-muted">Here's an overview of your health journey</p>
          </div>

          {/* Stats Cards */}
          <div className="row g-4 mb-4">
            {[
              { color: 'green', icon: 'fa-file-medical', value: stats?.total_documents || 0, label: 'Documents' },
              { color: 'blue', icon: 'fa-utensils', value: stats?.total_diet_plans || 0, label: 'Diet Plans' },
              { color: 'teal', icon: 'fa-heartbeat', value: stats?.total_health_logs || 0, label: 'Days Tracked' },
              { color: 'orange', icon: 'fa-allergies', value: stats?.total_allergies || 0, label: 'Allergies' },
            ].map((s) => (
              <div key={s.label} className="col-6 col-lg-3">
                <div className={`stat-card ${s.color}`}>
                  <div className="d-flex align-items-center gap-3">
                    <div className={`stat-icon ${s.color}`}><i className={`fas ${s.icon}`}></i></div>
                    <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-4">
            {/* Quick Actions */}
            <div className="col-lg-4">
              <div className="content-card h-100">
                <div className="card-header-custom"><h5><i className="fas fa-bolt text-primary-green me-2"></i>Quick Actions</h5></div>
                <div className="d-flex flex-column gap-3">
                  <Link to="/documents" className="quick-action-btn"><i className="fas fa-cloud-upload-alt green"></i><span>Upload Document</span></Link>
                  <Link to="/diet-plan" className="quick-action-btn"><i className="fas fa-magic blue"></i><span>Generate Diet Plan</span></Link>
                  <Link to="/health-tracker" className="quick-action-btn"><i className="fas fa-notes-medical teal"></i><span>Log Health Data</span></Link>
                </div>
              </div>
            </div>

            {/* Recent Diet Plan */}
            <div className="col-lg-8">
              <div className="content-card h-100">
                <div className="card-header-custom">
                  <h5><i className="fas fa-utensils text-primary-green me-2"></i>Recent Diet Plan</h5>
                  <Link to="/diet-plan/history" className="btn btn-sm btn-nutriai-outline">View All</Link>
                </div>
                {recentPlan ? (
                  <div className="p-3 rounded" style={{ background: 'var(--accent-pale-green)' }}>
                    <h6 className="fw-bold text-primary-green">{recentPlan.plan_title}</h6>
                    <p className="text-muted mb-2" style={{ fontSize: '0.9rem' }}>{recentPlan.plan_summary?.slice(0, 200)}{recentPlan.plan_summary?.length > 200 ? '...' : ''}</p>
                    <div className="d-flex gap-2 flex-wrap">
                      <span className="badge bg-success rounded-pill"><i className="fas fa-check me-1"></i>{recentPlan.foods_to_eat_count} foods to eat</span>
                      <span className="badge bg-danger rounded-pill"><i className="fas fa-times me-1"></i>{recentPlan.foods_to_avoid_count} foods to avoid</span>
                      <span className="badge bg-secondary rounded-pill"><i className="fas fa-clock me-1"></i>{new Date(recentPlan.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <i className="fas fa-utensils text-muted mb-2" style={{ fontSize: '2.5rem' }}></i>
                    <p className="text-muted mb-2">No diet plans generated yet</p>
                    <Link to="/diet-plan" className="btn btn-sm btn-nutriai-primary">Generate Your First Plan</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Documents */}
          <div className="row mt-4">
            <div className="col-12">
              <div className="content-card">
                <div className="card-header-custom">
                  <h5><i className="fas fa-file-medical text-primary-green me-2"></i>Recent Documents</h5>
                  <Link to="/documents" className="btn btn-sm btn-nutriai-outline">View All</Link>
                </div>
                {recentDocs.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-nutriai mb-0">
                      <thead><tr><th>Name</th><th>Type</th><th>Uploaded</th><th>OCR Status</th></tr></thead>
                      <tbody>
                        {recentDocs.map(doc => (
                          <tr key={doc.id}>
                            <td><i className="fas fa-file-alt text-primary-green me-2"></i>{doc.original_filename.slice(0, 40)}{doc.original_filename.length > 40 ? '...' : ''}</td>
                            <td>{doc.document_type.replaceAll('_', ' ').replaceAll(/\b\w/g, l => l.toUpperCase())}</td>
                            <td>{new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td><StatusBadge status={doc.ocr_status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <i className="fas fa-cloud-upload-alt text-muted mb-2" style={{ fontSize: '2.5rem' }}></i>
                    <p className="text-muted mb-2">No documents uploaded yet</p>
                    <Link to="/documents" className="btn btn-sm btn-nutriai-primary">Upload Your First Document</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
