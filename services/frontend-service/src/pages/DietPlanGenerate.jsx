import { useState, useEffect } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'

const getRiskBadgeColor = (riskLevel) => {
  if (riskLevel === 'high') return 'danger'
  if (riskLevel === 'medium') return 'warning'
  return 'secondary'
}

export default function DietPlanGenerate() {
  const [documents, setDocuments] = useState([])
  const [allergies, setAllergies] = useState([])
  const [selectedDocs, setSelectedDocs] = useState([])
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsRes, allergyRes] = await Promise.all([
          api.get('/diet-plan/documents'),
          api.get('/profile'),
        ])
        setDocuments(docsRes.data.documents || [])
        setAllergies(allergyRes.data.allergies || [])
      } catch {
        setError('Failed to fetch initial data.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggleDoc = (id) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const handleGenerate = async () => {
    if (selectedDocs.length === 0) { setError('Please select at least one document.'); return }
    setGenerating(true); setError(''); setResult(null)
    try {
      const res = await api.post('/diet-plan/generate', { document_ids: selectedDocs, additional_notes: notes || null })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate diet plan.')
    } finally { setGenerating(false) }
  }

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4"><h3 className="fw-bold"><i className="fas fa-magic text-primary-green me-2"></i>Generate Diet Plan</h3>
            <p className="text-muted">Select your medical documents and let AI create a personalized diet plan</p></div>

          <div className="row g-4">
            {/* Left: Selection */}
            <div className="col-lg-5">
              <div className="content-card mb-4">
                <div className="card-header-custom"><h5><i className="fas fa-file-medical text-primary-green me-2"></i>Select Documents</h5></div>
                {documents.length > 0 ? documents.map(doc => (
                  <div key={doc.id} className="form-check py-2 px-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <input className="form-check-input" type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleDoc(doc.id)} id={`doc-${doc.id}`} />
                    <label className="form-check-label" htmlFor={`doc-${doc.id}`} style={{ cursor: 'pointer' }}>
                      <div className="fw-600">{doc.original_filename}</div>
                      <small className="text-muted">{doc.document_type.replaceAll('_', ' ')} • {new Date(doc.uploaded_at).toLocaleDateString()}</small>
                    </label>
                  </div>
                )) : <p className="text-muted p-3">No completed documents. Upload and wait for OCR to complete.</p>}
              </div>

              {allergies.length > 0 && (
                <div className="content-card mb-4">
                  <div className="card-header-custom"><h5><i className="fas fa-allergies text-danger me-2"></i>Your Allergies</h5></div>
                  <div className="p-3 d-flex flex-wrap gap-2">
                    {allergies.map(a => (
                      <span key={a.id} className={`allergy-badge ${a.severity}`}>{a.allergen_name} ({a.severity})</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="content-card mb-4">
                <div className="card-header-custom"><h5><i className="fas fa-sticky-note text-primary-green me-2"></i>Additional Notes</h5></div>
                <textarea className="form-control form-control-nutriai" rows="3" placeholder="Any specific dietary preferences or notes..." value={notes} onChange={e => setNotes(e.target.value)}></textarea>
              </div>

              {error && <div className="alert alert-danger"><i className="fas fa-exclamation-circle me-2"></i>{error}</div>}
              <button className="btn btn-nutriai-primary w-100" onClick={handleGenerate} disabled={generating}>
                {generating ? <><span className="spinner-border spinner-border-sm me-2"></span>Generating with AI...</> : <><i className="fas fa-magic me-2"></i>Generate Diet Plan</>}
              </button>
            </div>

            {/* Right: Result */}
            <div className="col-lg-7">
              {generating && (
                <div className="content-card text-center py-5">
                  <div className="spinner-border text-success mb-3" style={{ width: '3rem', height: '3rem' }}><span className="visually-hidden">Loading...</span></div>
                  <h5 className="fw-bold">Analyzing Your Documents...</h5>
                  <p className="text-muted">The AI engine is reviewing your medical data and creating a personalized plan</p>
                </div>
              )}

              {result && (
                <div className="content-card animate-in">
                  <div className="card-header-custom"><h5><i className="fas fa-check-circle text-success me-2"></i>{result.plan_title}</h5></div>
                  {result.plan_summary && <p className="text-muted mb-3">{result.plan_summary}</p>}

                  {result.weekly_meal_plan && (
                    <div className="mb-4">
                      <h6 className="fw-bold text-secondary-blue mb-3"><i className="fas fa-calendar-week me-2"></i>Weekly Meal Plan</h6>
                      <div className="accordion meal-plan-accordion" id="mealPlanAccordion">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, index) => {
                          const dayPlan = result.weekly_meal_plan[day];
                          if (!dayPlan) return null;
                          return (
                            <div className="accordion-item" key={day}>
                              <h2 className="accordion-header">
                                <button className={`accordion-button ${index === 0 ? '' : 'collapsed'}`} type="button" data-bs-toggle="collapse" data-bs-target={`#day-${day}`}>
                                  <i className="fas fa-calendar-day me-2"></i>{day.charAt(0).toUpperCase() + day.slice(1)}
                                </button>
                              </h2>
                              <div id={`day-${day}`} className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`} data-bs-parent="#mealPlanAccordion">
                                <div className="accordion-body">
                                  <p className="mb-2"><strong>🌅 Breakfast:</strong> {dayPlan.breakfast || ''}</p>
                                  <p className="mb-2"><strong>☀️ Lunch:</strong> {dayPlan.lunch || ''}</p>
                                  <p className="mb-2"><strong>🌙 Dinner:</strong> {dayPlan.dinner || ''}</p>
                                  <p className="mb-0"><strong>🍎 Snacks:</strong> {dayPlan.snacks || ''}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {result.foods_to_eat?.length > 0 && (
                    <div className="mb-4">
                      <h6 className="fw-bold text-success"><i className="fas fa-check me-2"></i>Foods to Eat</h6>
                      <div className="table-responsive"><table className="table table-nutriai"><thead><tr><th>Food</th><th>Reason</th><th>Portion</th><th>Timing</th></tr></thead><tbody>
                        {result.foods_to_eat.map((f) => <tr key={f.food_name}><td className="fw-600">{f.food_name}</td><td>{f.reason}</td><td>{f.portion_size}</td><td>{f.timing}</td></tr>)}
                      </tbody></table></div>
                    </div>
                  )}

                  {result.foods_to_avoid?.length > 0 && (
                    <div className="mb-4">
                      <h6 className="fw-bold text-danger"><i className="fas fa-times me-2"></i>Foods to Avoid</h6>
                      <div className="table-responsive"><table className="table table-nutriai"><thead><tr><th>Food</th><th>Reason</th><th>Risk</th></tr></thead><tbody>
                        {result.foods_to_avoid.map((f) => <tr key={f.food_name}><td className="fw-600">{f.food_name}</td><td>{f.reason}</td><td><span className={`badge bg-${getRiskBadgeColor(f.risk_level)}`}>{f.risk_level}</span></td></tr>)}
                      </tbody></table></div>
                    </div>
                  )}

                  {result.nutritional_guidelines && (
                    <div className="mb-4">
                      <h6 className="fw-bold text-primary-green"><i className="fas fa-chart-pie me-2"></i>Nutritional Guidelines</h6>
                      <div className="row g-2">{[
                        { label: 'Calories', val: result.nutritional_guidelines.daily_calories, unit: 'kcal' },
                        { label: 'Protein', val: result.nutritional_guidelines.protein_grams, unit: 'g' },
                        { label: 'Carbs', val: result.nutritional_guidelines.carbs_grams, unit: 'g' },
                        { label: 'Fats', val: result.nutritional_guidelines.fats_grams, unit: 'g' },
                        { label: 'Fiber', val: result.nutritional_guidelines.fiber_grams, unit: 'g' },
                        { label: 'Water', val: result.nutritional_guidelines.water_liters, unit: 'L' },
                      ].map((n) => n.val && (
                        <div key={n.label} className="col-4 col-md-2"><div className="text-center p-2 rounded" style={{ background: 'var(--accent-pale-green)' }}><div className="fw-bold text-primary-green">{n.val}{n.unit}</div><small className="text-muted">{n.label}</small></div></div>
                      ))}</div>
                    </div>
                  )}

                  {result.allergy_notes?.length > 0 && (
                    <div className="mb-3 p-3 rounded" style={{ background: '#FFF8E1' }}>
                      <h6 className="fw-bold text-warning"><i className="fas fa-exclamation-triangle me-2"></i>Allergy Notes</h6>
                      {result.allergy_notes.map((n) => <p key={n} className="mb-1" style={{ fontSize: '0.9rem' }}>• {n}</p>)}
                    </div>
                  )}

                  <a href={`/api/diet-plan/${result.plan_id}/pdf`} className="btn btn-nutriai-secondary" target="_blank" rel="noreferrer">
                    <i className="fas fa-download me-2"></i>Download PDF
                  </a>
                </div>
              )}

              {!generating && !result && (
                <div className="content-card text-center py-5">
                  <i className="fas fa-utensils text-muted mb-3" style={{ fontSize: '4rem' }}></i>
                  <h5 className="text-muted">Your personalized diet plan will appear here</h5>
                  <p className="text-muted">Select documents and click "Generate Diet Plan" to start</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
