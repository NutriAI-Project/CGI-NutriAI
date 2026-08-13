import PropTypes from 'prop-types'

export default function StatusBadge({ status }) {
  return <span className={`badge-status badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
}
