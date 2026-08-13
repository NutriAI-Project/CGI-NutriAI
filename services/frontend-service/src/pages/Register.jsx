import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const SSO_ERROR_MESSAGES = {
  sso_denied: 'Microsoft registration was cancelled or denied.',
  missing_code: 'Microsoft registration failed: missing authorization code.',
  token_failed: 'Microsoft registration failed: could not obtain token.',
  user_failed: 'Microsoft registration failed: could not create your account.',
  sso_failed: 'Microsoft registration encountered an unexpected error. Please try again.',
}

export default function Register() {
  const { register, microsoftLogin, showFlash } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm_password: '', full_name: '', age: '', gender: '', weight: '', height: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const errorCode = params.get('error')
    if (errorCode) {
      setErrors([SSO_ERROR_MESSAGES[errorCode] || 'Microsoft sign-in failed. Please try again.'])
    }
  }, [location.search])



  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrors([])
    try {
      const payload = {
        ...form,
        age: form.age ? Number.parseInt(form.age, 10) : null,
        weight: form.weight ? Number.parseFloat(form.weight) : null,
        height: form.height ? Number.parseFloat(form.height) : null
      }
      await register(payload)
      showFlash('Registration successful! Welcome to NutriAI.', 'success')
      navigate('/dashboard')
    } catch (err) {
      setErrors(err.response?.data?.errors || ['Registration failed. Please try again.'])
    } finally {
      setLoading(false)
    }
  }

  const handleMicrosoft = async () => {
    try {
      const authUrl = await microsoftLogin()
      if (authUrl) globalThis.location.href = authUrl
    } catch {
      setErrors(['Failed to initiate Microsoft registration.'])
    }
  }

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-5">
          <div className="auth-card" style={{ maxWidth: '560px' }}>
            <div className="text-center mb-4">
              <i className="fas fa-leaf text-primary-green" style={{ fontSize: '2.5rem' }}></i>
              <h3 className="fw-bold mt-2">Create Account</h3>
              <p className="text-muted">Join NutriAI for personalized nutrition</p>
            </div>

            {errors.length > 0 && (
              <div className="alert alert-danger">{errors.map((e) => <div key={e}><i className="fas fa-exclamation-circle me-2"></i>{e}</div>)}</div>
            )}

            <button className="btn-microsoft" onClick={handleMicrosoft}>
              <svg width="20" height="20" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
              Register with Microsoft
            </button>

            <div className="auth-divider"><span>OR</span></div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12">
                  <label htmlFor="register-full-name" className="form-label-nutriai">Full Name *</label>
                  <input id="register-full-name" className="form-control form-control-nutriai" value={form.full_name} onChange={e => update('full_name', e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label htmlFor="register-email" className="form-label-nutriai">Email Address *</label>
                  <input id="register-email" type="email" className="form-control form-control-nutriai" value={form.email} onChange={e => update('email', e.target.value)} required />
                </div>
                <div className="col-md-6">
                  <label htmlFor="register-username" className="form-label-nutriai">Username *</label>
                  <input id="register-username" className="form-control form-control-nutriai" value={form.username} onChange={e => update('username', e.target.value)} required minLength={3} />
                </div>
                <div className="col-md-6">
                  <label htmlFor="register-password" className="form-label-nutriai">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input id="register-password" type={showPassword ? 'text' : 'password'} className="form-control form-control-nutriai" value={form.password} onChange={e => update('password', e.target.value)} required minLength={6}
                      style={{ paddingRight: '2.5rem' }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}>
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <label htmlFor="register-confirm-password" className="form-label-nutriai">Confirm Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input id="register-confirm-password" type={showConfirmPassword ? 'text' : 'password'} className="form-control form-control-nutriai" value={form.confirm_password} onChange={e => update('confirm_password', e.target.value)} required
                      style={{ paddingRight: '2.5rem' }} />
                    <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}>
                      <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>
                <div className="col-md-4">
                  <label htmlFor="register-age" className="form-label-nutriai">Age</label>
                  <input id="register-age" type="number" className="form-control form-control-nutriai" value={form.age} onChange={e => update('age', e.target.value)} min={1} max={150} />
                </div>
                <div className="col-md-4">
                  <label htmlFor="register-gender" className="form-label-nutriai">Gender</label>
                  <select id="register-gender" className="form-control form-control-nutriai" value={form.gender} onChange={e => update('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label htmlFor="register-weight" className="form-label-nutriai">Weight (kg)</label>
                  <input id="register-weight" type="number" step="0.1" className="form-control form-control-nutriai" value={form.weight} onChange={e => update('weight', e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-nutriai-primary w-100 mt-4" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating Account...</> : <><i className="fas fa-user-plus me-2"></i>Create Account</>}
              </button>
            </form>

            <p className="text-center mt-4 mb-0" style={{ fontSize: '0.9rem' }}>
              Already have an account? <Link to="/login" className="text-primary-green fw-600">Sign In</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
