import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function ForgotPassword() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-5">
          <div className="auth-card">
            <div className="text-center mb-4">
              <i className="fas fa-lock text-primary-green" style={{ fontSize: '2.5rem' }}></i>
              <h3 className="fw-bold mt-2">Reset Password</h3>
              <p className="text-muted">Enter your email to receive password reset instructions</p>
            </div>
            <form>
              <div className="mb-3">
                <label htmlFor="forgot-password-email" className="form-label-nutriai">Email Address</label>
                <input id="forgot-password-email" type="email" className="form-control form-control-nutriai" placeholder="your@email.com" required />
              </div>
              <button type="submit" className="btn btn-nutriai-primary w-100">
                <i className="fas fa-paper-plane me-2"></i>Send Reset Link
              </button>
            </form>
            <p className="text-center mt-4 mb-0" style={{ fontSize: '0.9rem' }}>
              Remember your password? <Link to="/login" className="text-primary-green fw-600">Sign In</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
