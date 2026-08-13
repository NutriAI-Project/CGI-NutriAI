import { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const faqs = [
  { q: 'How does NutriAI generate diet plans?', a: 'NutriAI uses state-of-the-art AI models from Azure OpenAI to analyze your medical documents (lab reports, prescriptions) and generate personalized diet plans. The AI considers your medical conditions, food allergies, and dietary preferences to create safe, practical meal plans.' },
  { q: 'What types of documents can I upload?', a: 'You can upload PDF documents, PNG images, and JPG/JPEG images up to 10MB in size. Common uploads include blood test reports, medical prescriptions, diagnostic reports, and health assessment documents.' },
  { q: 'How does the OCR processing work?', a: 'After uploading, your document is sent to Azure Document Intelligence for OCR (Optical Character Recognition). This AI service extracts all text, tables, and key-value pairs from your document. Processing typically takes 30-60 seconds.' },
  { q: 'How are my food allergies handled?', a: 'Your food allergies are stored securely and are always included in every diet plan generation request. The AI is explicitly instructed to NEVER recommend foods containing your allergens, and any potential allergen-containing foods are flagged in the "Foods to Avoid" section with appropriate risk levels.' },
  { q: 'Can I get my diet plan as a PDF?', a: 'Yes! Every generated diet plan can be downloaded as a professionally formatted PDF document. Click the download button on any plan in your history to get a printable version.' },
  { q: 'What health metrics can I track?', a: 'You can track weight, fasting blood sugar, post-meal blood sugar, blood pressure (systolic and diastolic), and meals (with estimated calories). All data is visualized with interactive charts over a 30-day period.' },
  { q: 'Is my medical data secure?', a: 'Absolutely. All data is encrypted in transit (TLS 1.2+) and at rest. Documents are stored in Azure Blob Storage with SAS token access controls. The application follows HIPAA-compliant security practices with Azure Key Vault for secret management.' },
  { q: 'What are the meal reminders?', a: 'When you generate a diet plan, NutriAI automatically schedules 28 email reminders (4 meals × 7 days) via Azure Service Bus. Each reminder includes your recommended foods to eat and avoid for that specific meal, sent at the appropriate meal time.' },
]

export default function Help() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4"><h3 className="fw-bold"><i className="fas fa-question-circle text-primary-green me-2"></i>Help Center</h3><p className="text-muted">Frequently asked questions and support</p></div>

          <div className="content-card">
            <div className="accordion" id="helpAccordion">
              {faqs.map((faq, i) => (
                <div key={faq.q} className="accordion-item" style={{ border: 'none', borderBottom: '1px solid var(--border-light)' }}>
                  <h2 className="accordion-header">
                    <button className={`accordion-button ${openIndex === i ? '' : 'collapsed'}`} type="button" onClick={() => setOpenIndex(openIndex === i ? null : i)}
                      style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-dark)', background: openIndex === i ? 'var(--accent-pale-green)' : 'transparent' }}>
                      {faq.q}
                    </button>
                  </h2>
                  {openIndex === i && (
                    <div className="accordion-body" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="content-card mt-4 text-center py-4">
            <i className="fas fa-envelope text-primary-green mb-2" style={{ fontSize: '2rem' }}></i>
            <h5 className="fw-bold">Still Need Help?</h5>
            <p className="text-muted mb-2">Contact our support team at</p>
            <a href="mailto:support@nutriai-health.com" className="text-primary-green fw-600">support@nutriai-health.com</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
