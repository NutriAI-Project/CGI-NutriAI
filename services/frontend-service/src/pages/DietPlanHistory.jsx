import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'

export default function DietPlanHistory() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/diet-plan/history').then(res => setPlans(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4">
            <h3 className="fw-bold"><i className="fas fa-history text-primary-green me-2"></i>Diet Plan History</h3>
            <p className="text-muted">View all your previously generated diet plans</p>
          </div>

          {plans.length > 0 ? (
            <div className="row g-4">
              {plans.map(plan => (
                <div key={plan.id} className="col-md-6 col-lg-4">
                  <div className="content-card h-100">
                    <h6 className="fw-bold text-primary-green mb-2">{plan.plan_title}</h6>
                    <p className="text-muted mb-3" style={{ fontSize: '0.88rem' }}>
                      {plan.plan_summary?.slice(0, 120)}{plan.plan_summary?.length > 120 ? '...' : ''}
                    </p>
                    <div className="d-flex gap-2 flex-wrap mb-3">
                      <span className="badge bg-success rounded-pill">
                        <i className="fas fa-check me-1"></i>{plan.foods_to_eat_count} foods to eat
                      </span>
                      <span className="badge bg-danger rounded-pill">
                        <i className="fas fa-times me-1"></i>{plan.foods_to_avoid_count} foods to avoid
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">
                        <i className="fas fa-clock me-1"></i>
                        {new Date(plan.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </small>
                      <div className="d-flex gap-1">
                        <a href={`/api/diet-plan/${plan.id}/pdf`} className="btn btn-sm btn-nutriai-outline" target="_blank" rel="noreferrer">
                          <i className="fas fa-download"></i>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="content-card text-center py-5">
              <i className="fas fa-utensils text-muted mb-3" style={{ fontSize: '4rem' }}></i>
              <h5 className="text-muted">No diet plans generated yet</h5>
              <p className="text-muted mb-3">Generate your first personalized diet plan</p>
              <Link to="/diet-plan" className="btn btn-nutriai-primary">
                <i className="fas fa-magic me-2"></i>Generate Diet Plan
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
