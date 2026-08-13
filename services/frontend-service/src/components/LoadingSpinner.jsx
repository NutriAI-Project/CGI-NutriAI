import PropTypes from 'prop-types'

export default function LoadingSpinner({ fullPage = false }) {
  if (fullPage) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-light)' }}>
        <div className="text-center">
          <output className="spinner-border text-success" style={{ width: '3rem', height: '3rem', display: 'inline-block' }}>
            <span className="visually-hidden">Loading...</span>
          </output>
          <p className="mt-3 text-muted fw-500">Loading NutriAI...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-5">
      <output className="spinner-border text-success" style={{ display: 'inline-block' }}>
        <span className="visually-hidden">Loading...</span>
      </output>
    </div>
  )
}

LoadingSpinner.propTypes = {
  fullPage: PropTypes.bool,
}
