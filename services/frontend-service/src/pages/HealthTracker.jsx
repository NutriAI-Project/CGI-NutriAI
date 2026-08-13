import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function HealthTracker() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [healthForm, setHealthForm] = useState({ log_date: '', weight: '', blood_sugar_fasting: '', blood_sugar_postprandial: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', notes: '' })
  const [mealForm, setMealForm] = useState({ meal_date: '', meal_type: 'breakfast', food_items: '', calories_estimate: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await api.get('/health-tracker/data')
      setData(res.data)
      setHealthForm(f => ({ ...f, log_date: res.data.today }))
      setMealForm(f => ({ ...f, meal_date: res.data.today }))
    } catch {} finally { setLoading(false) }
  }

  const handleHealthSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...healthForm,
        weight: healthForm.weight ? Number.parseFloat(healthForm.weight) : null,
        blood_sugar_fasting: healthForm.blood_sugar_fasting ? Number.parseFloat(healthForm.blood_sugar_fasting) : null,
        blood_sugar_postprandial: healthForm.blood_sugar_postprandial ? Number.parseFloat(healthForm.blood_sugar_postprandial) : null,
        blood_pressure_systolic: healthForm.blood_pressure_systolic ? Number.parseInt(healthForm.blood_pressure_systolic, 10) : null,
        blood_pressure_diastolic: healthForm.blood_pressure_diastolic ? Number.parseInt(healthForm.blood_pressure_diastolic, 10) : null,
      }
      await api.post('/health-tracker/log', payload)
      await fetchData()
    } catch (err) { alert(err.response?.data?.error || 'Failed to save.') } finally { setSaving(false) }
  }

  const handleMealSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...mealForm,
        calories_estimate: mealForm.calories_estimate ? Number.parseInt(mealForm.calories_estimate, 10) : null,
      }
      await api.post('/health-tracker/meal', payload)
      await fetchData()
    } catch (err) { alert(err.response?.data?.error || 'Failed to save.') } finally { setSaving(false) }
  }

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: false } } }

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  const cd = data?.chart_data || {}

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4"><h3 className="fw-bold"><i className="fas fa-heartbeat text-primary-green me-2"></i>Health Tracker</h3><p className="text-muted">Log and track your health metrics over time</p></div>

          <div className="row g-4 mb-4">
            {/* Health Log Form */}
            <div className="col-lg-6">
              <div className="content-card">
                <div className="card-header-custom"><h5><i className="fas fa-notes-medical text-primary-green me-2"></i>Log Health Data</h5></div>
                <form onSubmit={handleHealthSubmit}>
                  <div className="row g-3">
                    <div className="col-12"><label htmlFor="health-date" className="form-label-nutriai">Date</label><input id="health-date" type="date" className="form-control form-control-nutriai" value={healthForm.log_date} onChange={e => setHealthForm({ ...healthForm, log_date: e.target.value })} required /></div>
                    <div className="col-6"><label htmlFor="health-weight" className="form-label-nutriai">Weight (kg)</label><input id="health-weight" type="number" step="0.1" className="form-control form-control-nutriai" value={healthForm.weight} onChange={e => setHealthForm({ ...healthForm, weight: e.target.value })} /></div>
                    <div className="col-6"><label htmlFor="health-sugar-fasting" className="form-label-nutriai">Fasting Sugar</label><input id="health-sugar-fasting" type="number" className="form-control form-control-nutriai" value={healthForm.blood_sugar_fasting} onChange={e => setHealthForm({ ...healthForm, blood_sugar_fasting: e.target.value })} /></div>
                    <div className="col-6"><label htmlFor="health-sugar-postprandial" className="form-label-nutriai">Post-meal Sugar</label><input id="health-sugar-postprandial" type="number" className="form-control form-control-nutriai" value={healthForm.blood_sugar_postprandial} onChange={e => setHealthForm({ ...healthForm, blood_sugar_postprandial: e.target.value })} /></div>
                    <div className="col-6"><label htmlFor="health-bp-systolic" className="form-label-nutriai">BP Systolic</label><input id="health-bp-systolic" type="number" className="form-control form-control-nutriai" value={healthForm.blood_pressure_systolic} onChange={e => setHealthForm({ ...healthForm, blood_pressure_systolic: e.target.value })} /></div>
                    <div className="col-6"><label htmlFor="health-bp-diastolic" className="form-label-nutriai">BP Diastolic</label><input id="health-bp-diastolic" type="number" className="form-control form-control-nutriai" value={healthForm.blood_pressure_diastolic} onChange={e => setHealthForm({ ...healthForm, blood_pressure_diastolic: e.target.value })} /></div>
                    <div className="col-6"><label htmlFor="health-notes" className="form-label-nutriai">Notes</label><input id="health-notes" className="form-control form-control-nutriai" value={healthForm.notes} onChange={e => setHealthForm({ ...healthForm, notes: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn btn-nutriai-primary w-100 mt-3" disabled={saving}>{saving ? 'Saving...' : <><i className="fas fa-save me-2"></i>Save Health Log</>}</button>
                </form>
              </div>
            </div>

            {/* Meal Log Form */}
            <div className="col-lg-6">
              <div className="content-card">
                <div className="card-header-custom"><h5><i className="fas fa-utensils text-secondary-blue me-2"></i>Log Meal</h5></div>
                <form onSubmit={handleMealSubmit}>
                  <div className="row g-3">
                    <div className="col-6"><label htmlFor="meal-date" className="form-label-nutriai">Date</label><input id="meal-date" type="date" className="form-control form-control-nutriai" value={mealForm.meal_date} onChange={e => setMealForm({ ...mealForm, meal_date: e.target.value })} required /></div>
                    <div className="col-6"><label htmlFor="meal-type" className="form-label-nutriai">Meal Type</label><select id="meal-type" className="form-control form-control-nutriai" value={mealForm.meal_type} onChange={e => setMealForm({ ...mealForm, meal_type: e.target.value })}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></div>
                    <div className="col-12"><label htmlFor="meal-food-items" className="form-label-nutriai">Food Items (comma separated)</label><input id="meal-food-items" className="form-control form-control-nutriai" placeholder="e.g., Oatmeal, Banana, Green tea" value={mealForm.food_items} onChange={e => setMealForm({ ...mealForm, food_items: e.target.value })} /></div>
                    <div className="col-6"><label htmlFor="meal-calories" className="form-label-nutriai">Est. Calories</label><input id="meal-calories" type="number" className="form-control form-control-nutriai" value={mealForm.calories_estimate} onChange={e => setMealForm({ ...mealForm, calories_estimate: e.target.value })} /></div>
                    <div className="col-6"><label htmlFor="meal-notes" className="form-label-nutriai">Notes</label><input id="meal-notes" className="form-control form-control-nutriai" value={mealForm.notes} onChange={e => setMealForm({ ...mealForm, notes: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="btn btn-nutriai-secondary w-100 mt-3" disabled={saving}>{saving ? 'Saving...' : <><i className="fas fa-save me-2"></i>Save Meal Log</>}</button>
                </form>
              </div>
            </div>
          </div>

          {/* Charts */}
          {cd.labels?.length > 0 && (
            <div className="row g-4">
              <div className="col-lg-6">
                <div className="chart-container"><h6><i className="fas fa-weight text-primary-green me-1"></i> Weight Trend</h6><div style={{ height: '250px' }}>
                  <Line data={{ labels: cd.labels, datasets: [{ label: 'Weight (kg)', data: cd.weight, borderColor: '#2E7D32', backgroundColor: 'rgba(46,125,50,0.1)', fill: true, tension: 0.4 }] }} options={chartOptions} />
                </div></div>
              </div>
              <div className="col-lg-6">
                <div className="chart-container"><h6><i className="fas fa-tint text-danger me-1"></i> Blood Sugar</h6><div style={{ height: '250px' }}>
                  <Line data={{ labels: cd.labels, datasets: [{ label: 'Fasting', data: cd.blood_sugar_fasting, borderColor: '#1565C0', tension: 0.4 }, { label: 'Post-meal', data: cd.blood_sugar_postprandial, borderColor: '#F57F17', tension: 0.4 }] }} options={chartOptions} />
                </div></div>
              </div>
              <div className="col-lg-6">
                <div className="chart-container"><h6><i className="fas fa-heart text-danger me-1"></i> Blood Pressure</h6><div style={{ height: '250px' }}>
                  <Line data={{ labels: cd.labels, datasets: [{ label: 'Systolic', data: cd.bp_systolic, borderColor: '#C62828', tension: 0.4 }, { label: 'Diastolic', data: cd.bp_diastolic, borderColor: '#1565C0', tension: 0.4 }] }} options={chartOptions} />
                </div></div>
              </div>
            </div>
          )}

          {/* Recent Meal Logs */}
          {data?.meal_logs?.length > 0 && (
            <div className="content-card mt-4">
              <div className="card-header-custom"><h5><i className="fas fa-utensils text-primary-green me-2"></i>Recent Meal Logs</h5></div>
              <div className="table-responsive"><table className="table table-nutriai mb-0"><thead><tr><th>Date</th><th>Meal</th><th>Foods</th><th>Calories</th></tr></thead><tbody>
                {data.meal_logs.map(m => <tr key={m.id}><td>{m.meal_date}</td><td><span className="badge bg-primary">{m.meal_type}</span></td><td>{Array.isArray(m.food_items) ? m.food_items.join(', ') : m.food_items}</td><td>{m.calories_estimate || '-'}</td></tr>)}
              </tbody></table></div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
