import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function Landing() {
  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.querySelector('.navbar')
      if (!navbar) return
      if (window.scrollY > 50) {
        navbar.style.background = 'linear-gradient(135deg, #2E7D32 0%, #1565C0 100%)'
        navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.15)'
      } else {
        navbar.style.background = 'transparent'
        navbar.style.boxShadow = 'none'
      }
    }
    window.addEventListener('scroll', handleScroll)
    // Set initial transparent
    const navbar = document.querySelector('.navbar')
    if (navbar) { navbar.style.background = 'transparent'; navbar.style.boxShadow = 'none' }
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* Landing Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark fixed-top" style={{ background: 'transparent', transition: 'background 0.3s' }}>
        <div className="container">
          <Link className="navbar-brand" to="/"><i className="fas fa-leaf"></i> NutriAI</Link>
          <button className="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#landingNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="landingNav">
            <ul className="navbar-nav ms-auto gap-2 align-items-center">
              <li className="nav-item"><a className="nav-link" href="#features">Features</a></li>
              <li className="nav-item"><a className="nav-link" href="#how-it-works">How It Works</a></li>
              <li className="nav-item"><a className="nav-link" href="#testimonials">Testimonials</a></li>
              <li className="nav-item"><Link className="btn btn-outline-light-nav" to="/login">Login</Link></li>
              <li className="nav-item"><Link className="btn btn-solid-light-nav" to="/register">Get Started</Link></li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="floating-icons">
          <i className="fas fa-heartbeat floating-icon"></i>
          <i className="fas fa-pills floating-icon"></i>
          <i className="fas fa-apple-alt floating-icon"></i>
          <i className="fas fa-stethoscope floating-icon"></i>
          <i className="fas fa-notes-medical floating-icon"></i>
          <i className="fas fa-dna floating-icon"></i>
          <i className="fas fa-syringe floating-icon"></i>
          <i className="fas fa-leaf floating-icon"></i>
        </div>
        <div className="container hero-content">
          <div className="row align-items-center">
            <div className="col-lg-7">
              <h1 className="hero-title">
                Smart Nutrition,<br />
                <span style={{ color: 'var(--accent-light-green)' }}>Powered by AI</span>
              </h1>
              <p className="hero-subtitle">
                Upload your medical reports, and let our AI analyze them to create
                personalized diet plans tailored to your health needs. Safe, smart,
                and allergy-aware nutrition guidance at your fingertips.
              </p>
              <div className="hero-buttons">
                <Link to="/register" className="btn btn-hero-primary">
                  <i className="fas fa-rocket me-2"></i>Get Started Free
                </Link>
                <a href="#features" className="btn btn-hero-ghost">
                  <i className="fas fa-info-circle me-2"></i>Learn More
                </a>
              </div>
              <div className="mt-4 d-flex gap-4">
                <div><div className="fw-bold fs-4">OpenAI</div><small style={{ opacity: 0.7 }}>AI Engine</small></div>
                <div><div className="fw-bold fs-4">100%</div><small style={{ opacity: 0.7 }}>Allergy Safe</small></div>
                <div><div className="fw-bold fs-4">HIPAA</div><small style={{ opacity: 0.7 }}>Compliant</small></div>
              </div>
            </div>
            <div className="col-lg-5 d-none d-lg-block text-center">
              <div style={{ fontSize: '12rem', opacity: 0.15 }}><i className="fas fa-seedling"></i></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title">Why Choose NutriAI?</h2>
            <p className="section-subtitle">Everything you need for intelligent, personalized nutrition management</p>
          </div>
          <div className="row g-4">
            {[
              { icon: 'fa-brain', color: 'green', title: 'AI Diet Planning', desc: 'Our AI engine analyzes your medical reports and generates personalized weekly meal plans with precise nutritional guidelines.' },
              { icon: 'fa-file-medical-alt', color: 'blue', title: 'Smart Document OCR', desc: 'Upload lab reports and prescriptions. Azure AI extracts and understands your medical data automatically.' },
              { icon: 'fa-shield-alt', color: 'teal', title: 'Allergy Protection', desc: 'Your food allergies are always front and center. Our AI never recommends foods that could trigger reactions.' },
              { icon: 'fa-chart-line', color: 'orange', title: 'Health Tracking', desc: 'Track weight, blood sugar, blood pressure, and meals with interactive charts to monitor your progress.' },
            ].map((f) => (
              <div key={f.title} className="col-md-6 col-lg-3 feature-card-animated">
                <div className="feature-card">
                  <div className={`feature-icon ${f.color}`}><i className={`fas ${f.icon}`}></i></div>
                  <h5>{f.title}</h5>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Get your personalized diet plan in three simple steps</p>
          </div>
          <div className="row g-4">
            {[
              { num: '1', title: 'Upload Documents', desc: 'Upload your lab reports, prescriptions, or medical documents. Our AI-powered OCR extracts all the important data.' },
              { num: '2', title: 'AI Analysis', desc: 'The AI engine analyzes your medical data along with your allergies and preferences to create a safe, personalized plan.' },
              { num: '3', title: 'Get Your Plan', desc: 'Receive a detailed weekly meal plan with foods to eat, foods to avoid, nutritional guidelines, and allergy warnings.' },
            ].map((s) => (
              <div key={s.title} className="col-md-4">
                <div className="step-card">
                  <div className="step-number">{s.num}</div>
                  <h5>{s.title}</h5>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section" id="testimonials">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title">What Our Users Say</h2>
            <p className="section-subtitle">Trusted by patients and healthcare professionals</p>
          </div>
          <div className="row g-4">
            {[
              { text: '"NutriAI completely changed how I manage my diabetes diet. The AI understands my lab reports and gives me practical meal plans I can actually follow."', author: 'Sarah Johnson', role: 'Type 2 Diabetes Patient' },
              { text: '"As someone with multiple food allergies, I finally feel safe with diet recommendations. The allergy protection feature is incredibly thorough."', author: 'Michael Chen', role: 'Allergy Patient' },
              { text: '"I recommend NutriAI to all my patients. It bridges the gap between lab results and actionable dietary advice beautifully."', author: 'Dr. Emily Rodriguez', role: 'Clinical Nutritionist' },
            ].map((t) => (
              <div key={t.author} className="col-md-4">
                <div className="testimonial-card">
                  <div className="testimonial-text">{t.text}</div>
                  <div className="testimonial-author">{t.author}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Transform Your Health?</h2>
          <p>Join thousands of patients using AI-powered nutrition planning for better health outcomes.</p>
          <Link to="/register" className="btn btn-hero-primary btn-lg">
            <i className="fas fa-rocket me-2"></i>Start Your Journey
          </Link>
        </div>
      </section>

      <Footer isLanding />
    </>
  )
}
