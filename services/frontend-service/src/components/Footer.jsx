import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'

export default function Footer({ isLanding = false } = {}) {
  return (
    <footer className={`footer-nutriai ${isLanding ? '' : 'mt-5'}`}>
      <div className="container">
        <div className="row">
          <div className="col-md-4 mb-3">
            <div className="footer-brand"><i className="fas fa-leaf me-2"></i>NutriAI Health Portal</div>
            <p className={isLanding ? '' : 'mb-0'}>AI-powered personalized diet planning for better health outcomes.</p>
          </div>
          <div className="col-md-4 mb-3">
            <h6 className="text-white mb-2">{isLanding ? 'Platform' : 'Quick Links'}</h6>
            <ul className="list-unstyled">
              {isLanding ? (
                <>
                  <li><a href="#features">Features</a></li>
                  <li><a href="#how-it-works">How It Works</a></li>
                  <li><Link to="/help">Help Center</Link></li>
                </>
              ) : (
                <>
                  <li><Link to="/dashboard">Dashboard</Link></li>
                  <li><Link to="/documents">Documents</Link></li>
                  <li><Link to="/diet-plan">Diet Plan</Link></li>
                  <li><Link to="/help">Help</Link></li>
                </>
              )}
            </ul>
          </div>
          <div className="col-md-4 mb-3">
            <h6 className="text-white mb-2">Contact</h6>
            <p className="mb-1"><i className="fas fa-envelope me-2"></i>support@nutriai-health.com</p>
            <p className="mb-0"><i className="fas fa-phone me-2"></i>+91 9381427678</p>
          </div>
        </div>
        <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <p className="text-center mb-0">&copy; 2026 NutriAI Health Portal. All rights reserved.</p>
      </div>
    </footer>
  )
}

Footer.propTypes = {
  isLanding: PropTypes.bool
}
