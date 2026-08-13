import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const SSO_ERROR_MESSAGES = {
  sso_denied: 'Microsoft sign-in was cancelled or denied.',
  missing_code: 'Microsoft sign-in failed: missing authorization code.',
  token_failed: 'Microsoft sign-in failed: could not obtain token.',
  user_failed: 'Microsoft sign-in failed: could not retrieve your account.',
  sso_failed: 'Microsoft sign-in encountered an unexpected error. Please try again.',
}

export default function Login() {
  const { login, microsoftLogin, showFlash } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const errorCode = params.get('error')
    if (errorCode) {
      setError(SSO_ERROR_MESSAGES[errorCode] || 'Microsoft sign-in failed. Please try again.')
    }
  }, [location.search])


  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(form.email, form.password)
      showFlash('Login successful! Welcome back.', 'success')
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMicrosoft = async () => {
    try {
      const authUrl = await microsoftLogin()
      if (authUrl) globalThis.location.href = authUrl
    } catch {
      setError('Failed to initiate Microsoft login.')
    }
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-5">
          <div className="auth-card">
            <div className="text-center mb-4">
              <i className="fas fa-leaf text-primary-green" style={{ fontSize: '2.5rem' }}></i>
              <h3 className="fw-bold mt-2">Welcome Back</h3>
              <p className="text-muted">Sign in to your NutriAI account</p>
            </div>

            {error && (
              <div className="alert alert-danger"><i className="fas fa-exclamation-circle me-2"></i>{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="login-email" className="form-label-nutriai">Email Address</label>
                <input id="login-email" type="email" className="form-control form-control-nutriai" placeholder="your@email.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label htmlFor="login-password" className="form-label-nutriai">Password</label>
                <div style={{ position: 'relative' }}>
                  <input id="login-password" type={showPassword ? 'text' : 'password'} className="form-control form-control-nutriai" placeholder="••••••••"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
                    style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}>
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Link to="/forgot-password" className="text-primary-green" style={{ fontSize: '0.88rem' }}>Forgot Password?</Link>
              </div>
              <button type="submit" className="btn btn-nutriai-primary w-100" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in...</> : <><i className="fas fa-sign-in-alt me-2"></i>Sign In</>}
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

            <button className="btn-microsoft" onClick={handleMicrosoft}>
              <svg width="20" height="20" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
              Sign in with Microsoft
            </button>

            <p className="text-center mt-4 mb-0" style={{ fontSize: '0.9rem' }}>
              Don't have an account? <Link to="/register" className="text-primary-green fw-600">Create one</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
