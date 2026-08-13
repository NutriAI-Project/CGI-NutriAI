import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login if token expired
      if (globalThis.location.pathname !== '/login' && globalThis.location.pathname !== '/register' && globalThis.location.pathname !== '/') {
        globalThis.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
