import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PropTypes from 'prop-types'

export default function FlashMessage({ message, type = 'success' }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(timer)
  }, [])

  const iconMap = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ duration: 0.3 }}
          style={{ position: 'fixed', top: 80, right: 20, zIndex: 9999, maxWidth: 450, width: '100%' }}
        >
          <div className={`alert alert-${type} alert-dismissible flash-message`} role="alert">
            <i className={`fas ${iconMap[type] || iconMap.info} me-2`}></i>{message}
            <button type="button" className="btn-close" onClick={() => setVisible(false)}></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

FlashMessage.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.string,
}
