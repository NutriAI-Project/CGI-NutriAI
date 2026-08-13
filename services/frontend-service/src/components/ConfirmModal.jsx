import PropTypes from 'prop-types'

export default function ConfirmModal({ show, title, message, onConfirm, onCancel }) {
  if (!show) return null

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-nutriai">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">{title || 'Confirm Action'}</h5>
            <button type="button" className="btn-close" onClick={onCancel}></button>
          </div>
          <div className="modal-body">
            <p>{message || 'Are you sure you want to proceed?'}</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button className="btn btn-danger" onClick={onConfirm}>
              <i className="fas fa-trash me-1"></i>Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

ConfirmModal.propTypes = {
  show: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}
