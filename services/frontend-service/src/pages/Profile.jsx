import { useState, useEffect } from 'react'
import api from '../api/axios'
import useAuth from '../hooks/useAuth'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LoadingSpinner from '../components/LoadingSpinner'

const MEDICAL_CONDITIONS = [
  'Diabetes Type 1', 'Diabetes Type 2', 'Pre-Diabetes',
  'Hypertension (High Blood Pressure)', 'Hypotension (Low Blood Pressure)',
  'High Cholesterol', 'Heart Disease', 'Kidney Disease', 'Liver Disease',
  'Thyroid Disorder (Hypothyroidism)', 'Thyroid Disorder (Hyperthyroidism)',
  'PCOS / PCOD', 'Anemia', 'Obesity', 'Underweight',
  'Acid Reflux / GERD', 'Irritable Bowel Syndrome (IBS)', 'Celiac Disease',
  'Lactose Intolerance', 'Asthma', 'Arthritis', 'Osteoporosis',
  'Cancer (in treatment)', 'Pregnancy', 'Breastfeeding', 'None',
]

const DIETARY_PREFERENCES = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Non-Vegetarian', 'Eggetarian',
  'Gluten-Free', 'Dairy-Free', 'Keto', 'Low-Carb', 'Low-Sodium',
  'Diabetic-Friendly', 'Heart-Healthy', 'Halal', 'Kosher', 'Jain',
]

export default function Profile() {
  const { user: authUser, fetchUser } = useAuth()
  const [allergies, setAllergies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [selectedConditions, setSelectedConditions] = useState([])
  const [otherCondition, setOtherCondition] = useState('')
  const [selectedPreferences, setSelectedPreferences] = useState([])
  const [allergyForm, setAllergyForm] = useState({ allergen_name: '', severity: 'moderate', notes: '' })

  useEffect(() => {
    api.get('/profile').then(res => {
      const d = res.data
      setAllergies(d.allergies)
      setForm({
        full_name: d.user.full_name, age: d.user.age || '', gender: d.user.gender || '',
        weight: d.user.weight || '', height: d.user.height || '',
        blood_type: d.profile?.blood_type || '', emergency_contact: d.profile?.emergency_contact || '',
      })

      // Parse medical_conditions — supports both old array format and new object format
      const mc = d.profile?.medical_conditions
      if (mc && typeof mc === 'object' && !Array.isArray(mc)) {
        setSelectedConditions(mc.conditions || [])
        setOtherCondition(mc.other || '')
      } else if (Array.isArray(mc)) {
        setSelectedConditions(mc)
      }

      // Parse dietary_preferences
      const dp = d.profile?.dietary_preferences
      if (Array.isArray(dp)) {
        setSelectedPreferences(dp)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // --- Condition checkbox logic ---
  const toggleCondition = (condition) => {
    if (condition === 'None') {
      setSelectedConditions(prev => prev.includes('None') ? [] : ['None'])
    } else {
      setSelectedConditions(prev => {
        const without = prev.filter(c => c !== 'None')
        return without.includes(condition)
          ? without.filter(c => c !== condition)
          : [...without, condition]
      })
    }
  }

  const isNoneSelected = selectedConditions.includes('None')

  // --- Dietary preference checkbox logic ---
  const togglePreference = (pref) => {
    setSelectedPreferences(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    )
  }

  // --- Save handlers ---
  const handleProfileSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        age: form.age ? Number.parseInt(form.age, 10) : null,
        weight: form.weight ? Number.parseFloat(form.weight) : null,
        height: form.height ? Number.parseFloat(form.height) : null
      }
      await api.post('/profile/update', payload)
      await fetchUser()
      alert('Profile updated successfully!')
    } catch {} finally { setSaving(false) }
  }

  const handleMedicalSave = async () => {
    setSaving(true)
    try {
      await api.post('/profile/medical', {
        medical_conditions: {
          conditions: selectedConditions,
          other: otherCondition.trim(),
        },
        dietary_preferences: selectedPreferences,
      })
      alert('Medical info and dietary preferences saved!')
    } catch {} finally { setSaving(false) }
  }

  const handleAddAllergy = async (e) => {
    e.preventDefault()
    if (!allergyForm.allergen_name.trim()) return
    try {
      const res = await api.post('/profile/allergy', allergyForm)
      setAllergies(prev => [...prev, res.data.allergy])
      setAllergyForm({ allergen_name: '', severity: 'moderate', notes: '' })
      await fetchUser()
    } catch (err) { alert(err.response?.data?.error || 'Failed to add allergy') }
  }

  const handleDeleteAllergy = async (id) => {
    try {
      await api.delete(`/profile/allergy/${id}`)
      setAllergies(prev => prev.filter(a => a.id !== id))
      await fetchUser()
    } catch {}
  }

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4"><h3 className="fw-bold"><i className="fas fa-user-edit text-primary-green me-2"></i>My Profile</h3><p className="text-muted">Manage your personal and medical information</p></div>

          <div className="row g-4">
            {authUser?.role === 'admin' ? (
              <>
                {/* Admin Profile Layout */}
                <div className="col-lg-7">
                  {/* Personal Information */}
                  <div className="profile-section">
                    <h5 className="fw-bold mb-3"><i className="fas fa-user text-primary-green me-2"></i>Personal Information</h5>
                    <form onSubmit={handleProfileSave}>
                      <div className="row g-3">
                        <div className="col-12"><label htmlFor="profile-full-name" className="form-label-nutriai">Full Name</label><input id="profile-full-name" className="form-control form-control-nutriai" value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
                        <div className="col-md-4"><label htmlFor="profile-age" className="form-label-nutriai">Age</label><input id="profile-age" type="number" className="form-control form-control-nutriai" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /></div>
                        <div className="col-md-4"><label htmlFor="profile-gender" className="form-label-nutriai">Gender</label><select id="profile-gender" className="form-control form-control-nutriai" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                        <div className="col-md-4"><label htmlFor="profile-blood-type" className="form-label-nutriai">Blood Type</label><select id="profile-blood-type" className="form-control form-control-nutriai" value={form.blood_type} onChange={e => setForm({ ...form, blood_type: e.target.value })}><option value="">Select</option>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}</select></div>
                        <div className="col-md-6"><label htmlFor="profile-weight" className="form-label-nutriai">Weight (kg)</label><input id="profile-weight" type="number" step="0.1" className="form-control form-control-nutriai" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /></div>
                        <div className="col-md-6"><label htmlFor="profile-height" className="form-label-nutriai">Height (cm)</label><input id="profile-height" type="number" step="0.1" className="form-control form-control-nutriai" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} /></div>
                        <div className="col-12"><label htmlFor="profile-emergency-contact" className="form-label-nutriai">Emergency Contact</label><input id="profile-emergency-contact" className="form-control form-control-nutriai" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} /></div>
                      </div>
                      <button type="submit" className="btn btn-nutriai-primary w-100 mt-3" disabled={saving}><i className="fas fa-save me-2"></i>Save Changes</button>
                    </form>
                  </div>
                </div>

                <div className="col-lg-5">
                  {/* Account Info */}
                  <div className="profile-section">
                    <h5 className="fw-bold mb-3"><i className="fas fa-info-circle text-primary-green me-2"></i>Account Info</h5>
                    <div className="row g-2">
                      <div className="col-6"><small className="text-muted">Email</small><p className="fw-600 mb-2">{authUser?.email}</p></div>
                      <div className="col-6"><small className="text-muted">Username</small><p className="fw-600 mb-2">{authUser?.username}</p></div>
                      <div className="col-6"><small className="text-muted">Account Type</small><p className="fw-600 mb-2">Admin</p></div>
                      <div className="col-6"><small className="text-muted">Auth Type</small><p className="fw-600 mb-2">{authUser?.auth_type === 'entra_id' ? 'Microsoft SSO' : 'Local'}</p></div>
                      <div className="col-6"><small className="text-muted">Member Since</small><p className="fw-600 mb-0">{authUser?.created_at ? new Date(authUser.created_at).toLocaleDateString() : '-'}</p></div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ==================== LEFT COLUMN ==================== */}
                <div className="col-lg-6">
                  {/* Personal Information */}
                  <div className="profile-section">
                    <h5 className="fw-bold mb-3"><i className="fas fa-user text-primary-green me-2"></i>Personal Information</h5>
                    <form onSubmit={handleProfileSave}>
                      <div className="row g-3">
                        <div className="col-12"><label htmlFor="profile-full-name" className="form-label-nutriai">Full Name</label><input id="profile-full-name" className="form-control form-control-nutriai" value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
                        <div className="col-md-4"><label htmlFor="profile-age" className="form-label-nutriai">Age</label><input id="profile-age" type="number" className="form-control form-control-nutriai" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /></div>
                        <div className="col-md-4"><label htmlFor="profile-gender" className="form-label-nutriai">Gender</label><select id="profile-gender" className="form-control form-control-nutriai" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                        <div className="col-md-4"><label htmlFor="profile-blood-type" className="form-label-nutriai">Blood Type</label><select id="profile-blood-type" className="form-control form-control-nutriai" value={form.blood_type} onChange={e => setForm({ ...form, blood_type: e.target.value })}><option value="">Select</option>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}</select></div>
                        <div className="col-md-6"><label htmlFor="profile-weight" className="form-label-nutriai">Weight (kg)</label><input id="profile-weight" type="number" step="0.1" className="form-control form-control-nutriai" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /></div>
                        <div className="col-md-6"><label htmlFor="profile-height" className="form-label-nutriai">Height (cm)</label><input id="profile-height" type="number" step="0.1" className="form-control form-control-nutriai" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} /></div>
                        <div className="col-12"><label htmlFor="profile-emergency-contact" className="form-label-nutriai">Emergency Contact</label><input id="profile-emergency-contact" className="form-control form-control-nutriai" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} /></div>
                      </div>
                      <button type="submit" className="btn btn-nutriai-primary w-100 mt-3" disabled={saving}><i className="fas fa-save me-2"></i>Save Changes</button>
                    </form>
                  </div>

                  {/* Food Allergies */}
                  <div className="profile-section">
                    <h5 className="fw-bold mb-3"><i className="fas fa-allergies text-danger me-2"></i>Food Allergies</h5>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {allergies.length > 0 ? allergies.map(a => (
                        <span key={a.id} className={`allergy-badge ${a.severity}`}>
                          {a.allergen_name}
                          <button
                            type="button"
                            className="delete-allergy"
                            onClick={() => handleDeleteAllergy(a.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'inherit',
                              font: 'inherit',
                              lineHeight: 'inherit',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            aria-label={`Delete allergy ${a.allergen_name}`}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </span>
                      )) : <p className="text-muted">No food allergies recorded.</p>}
                    </div>

                    <h6 className="fw-600 mt-4 mb-3">Add New Allergy</h6>
                    <form onSubmit={handleAddAllergy}>
                      <div className="row g-3">
                        <div className="col-md-5"><input className="form-control form-control-nutriai" placeholder="Allergen name (e.g., Peanuts)" value={allergyForm.allergen_name} onChange={e => setAllergyForm({ ...allergyForm, allergen_name: e.target.value })} required /></div>
                        <div className="col-md-3"><select className="form-control form-control-nutriai" value={allergyForm.severity} onChange={e => setAllergyForm({ ...allergyForm, severity: e.target.value })}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div>
                        <div className="col-md-4"><button type="submit" className="btn btn-nutriai-primary w-100"><i className="fas fa-plus me-1"></i>Add</button></div>
                      </div>
                      <div className="mt-2"><input className="form-control form-control-nutriai" placeholder="Notes (optional)" value={allergyForm.notes} onChange={e => setAllergyForm({ ...allergyForm, notes: e.target.value })} /></div>
                    </form>
                  </div>

                  {/* Account Info */}
                  <div className="profile-section">
                    <h5 className="fw-bold mb-3"><i className="fas fa-info-circle text-primary-green me-2"></i>Account Info</h5>
                    <div className="row g-2">
                      <div className="col-6"><small className="text-muted">Email</small><p className="fw-600 mb-2">{authUser?.email}</p></div>
                      <div className="col-6"><small className="text-muted">Username</small><p className="fw-600 mb-2">{authUser?.username}</p></div>
                      <div className="col-6"><small className="text-muted">Account Type</small><p className="fw-600 mb-2">Patient</p></div>
                      <div className="col-6"><small className="text-muted">Auth Type</small><p className="fw-600 mb-2">{authUser?.auth_type === 'entra_id' ? 'Microsoft SSO' : 'Local'}</p></div>
                      <div className="col-6"><small className="text-muted">Member Since</small><p className="fw-600 mb-0">{authUser?.created_at ? new Date(authUser.created_at).toLocaleDateString() : '-'}</p></div>
                    </div>
                  </div>
                </div>

                {/* ==================== RIGHT COLUMN ==================== */}
                <div className="col-lg-6">
                  {/* Medical / Diagnostic Conditions */}
                  <div className="profile-section">
                    <h5 className="fw-bold mb-3"><i className="fas fa-stethoscope text-secondary-blue me-2"></i>Medical / Diagnostic Conditions</h5>
                    <p className="text-muted mb-3" style={{ fontSize: '0.88rem' }}>Select all conditions that apply to you</p>
                    <div className="row g-0">
                      {MEDICAL_CONDITIONS.map(condition => {
                        const isChecked = selectedConditions.includes(condition)
                        const isDisabled = isNoneSelected && condition !== 'None'
                        return (
                          <div key={condition} className="col-md-6">
                            <div
                              className={`checkbox-item ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}`}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                transition: 'background 0.2s',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                background: isChecked ? 'rgba(46, 125, 50, 0.08)' : 'transparent',
                                opacity: isDisabled ? 0.45 : 1,
                              }}
                            >
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`cond-${condition}`}
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={() => toggleCondition(condition)}
                                  style={{ borderColor: isChecked ? '#2E7D32' : undefined, backgroundColor: isChecked ? '#2E7D32' : undefined, transition: 'all 0.2s' }}
                                />
                                <label className="form-check-label" htmlFor={`cond-${condition}`} style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                                  {condition}
                                </label>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3">
                      <label htmlFor="profile-other-conditions" className="form-label-nutriai">Other conditions not listed above</label>
                      <input
                        id="profile-other-conditions"
                        className="form-control form-control-nutriai"
                        placeholder="e.g., Crohn's Disease, Food Sensitivities..."
                        value={otherCondition}
                        onChange={e => setOtherCondition(e.target.value)}
                        disabled={isNoneSelected}
                      />
                    </div>
                  </div>

                  {/* Dietary Preferences */}
                  <div className="profile-section">
                    <h5 className="fw-bold mb-3"><i className="fas fa-utensils text-primary-green me-2"></i>Dietary Preferences</h5>
                    <p className="text-muted mb-3" style={{ fontSize: '0.88rem' }}>Select all dietary preferences you follow</p>
                    <div className="row g-0">
                      {DIETARY_PREFERENCES.map(pref => {
                        const isChecked = selectedPreferences.includes(pref)
                        return (
                          <div key={pref} className="col-md-6 col-lg-4">
                            <div
                              className={`checkbox-item ${isChecked ? 'checked' : ''}`}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                transition: 'background 0.2s',
                                cursor: 'pointer',
                                background: isChecked ? 'rgba(46, 125, 50, 0.08)' : 'transparent',
                              }}
                            >
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`pref-${pref}`}
                                  checked={isChecked}
                                  onChange={() => togglePreference(pref)}
                                  style={{ borderColor: isChecked ? '#2E7D32' : undefined, backgroundColor: isChecked ? '#2E7D32' : undefined, transition: 'all 0.2s' }}
                                />
                                <label className="form-check-label" htmlFor={`pref-${pref}`} style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                                  {pref}
                                </label>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Save All Medical & Preferences */}
                  <button className="btn btn-nutriai-primary w-100" onClick={handleMedicalSave} disabled={saving}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="fas fa-save me-2"></i>Save Medical Info &amp; Dietary Preferences</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
