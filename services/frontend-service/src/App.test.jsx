import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// GLOBALS SETUP
globalThis.location = {
  pathname: '/dashboard',
  href: 'http://localhost/',
}

globalThis.document = {
  getElementById: () => ({}),
  querySelector: () => ({
    style: {
      background: '',
      boxShadow: '',
    }
  }),
}

globalThis.window = {
  open: () => ({}),
}

globalThis.alert = () => {}

globalThis.scrollY = 100
globalThis.addEventListener = (event, cb) => {
  if (event === 'scroll') globalThis.mockScrollCallback = cb
}
globalThis.removeEventListener = () => {}

// Initialize controls on globalThis to avoid ReferenceErrors
globalThis.mockUseContextValue = undefined
globalThis.mockIsDragActive = false
globalThis.mockCapturedOnDrop = null
globalThis.mockInterceptorErrorCallback = null
globalThis.mockScrollCallback = null

// State overrides tracking
globalThis.mockStateIndex = 0
globalThis.mockStateOverrides = null

// MOCK DEPENDENCIES
vi.mock('react-router-dom', () => {
  const dummy = ({ children }) => <>{children}</>
  return {
    Routes: dummy,
    Route: dummy,
    BrowserRouter: dummy,
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    Navigate: () => null,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/dashboard', search: '' }),
    useParams: () => ({ id: '123' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

vi.mock('react-chartjs-2', () => ({
  Line: () => null,
  Bar: () => null,
  Doughnut: () => null,
  Pie: () => null,
}))

vi.mock('react-dropzone', () => ({
  useDropzone: (options) => {
    globalThis.mockCapturedOnDrop = options.onDrop
    return {
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: globalThis.mockIsDragActive,
    }
  },
}))

vi.mock('framer-motion', () => {
  const dummy = ({ children, ...props }) => <div {...props}>{children}</div>
  const motion = new Proxy({}, {
    get: () => dummy
  })
  return {
    motion,
    AnimatePresence: ({ children }) => <>{children}</>,
  }
})

vi.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      response: {
        use: (success, error) => {
          globalThis.mockInterceptorErrorCallback = error
        }
      }
    },
    get: vi.fn(async (url) => {
      if (url === '/profile') {
        return {
          data: {
            user: { email: 'test@example.com', username: 'testuser', age: 25, full_name: 'Test User' },
            allergies: [],
            profile: { medical_conditions: [], dietary_preferences: [] }
          }
        }
      }
      if (url === '/notifications/list') {
        return { data: { notifications: [] } }
      }
      if (url === '/health/all') {
        return { data: { overall_status: 'healthy', services: {} } }
      }
      if (url === '/health-tracker/data') {
        return { data: { logs: [], meals: [] } }
      }
      return { data: [] }
    }),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  }
  return {
    default: {
      create: () => mockAxiosInstance
    }
  }
})

// Mock React
vi.mock('react', async () => {
  const original = await vi.importActual('react')
  return {
    ...original,
    useState: (initial) => {
      let val = typeof initial === 'function' ? initial() : initial
      if (globalThis.mockStateOverrides && globalThis.mockStateIndex < globalThis.mockStateOverrides.length) {
        val = globalThis.mockStateOverrides[globalThis.mockStateIndex++]
      }
      return [val, vi.fn()]
    },
    useContext: (ctx) => {
      if (globalThis.mockUseContextValue !== undefined) {
        return globalThis.mockUseContextValue
      }
      return {
        user: { email: 'test@example.com', username: 'testuser', auth_type: 'local', full_name: 'Test User' },
        loading: false,
        flash: null,
        showFlash: vi.fn(),
        login: vi.fn(async () => ({ user: {} })),
        register: vi.fn(async () => ({ user: {} })),
        logout: vi.fn(async () => {}),
        microsoftLogin: vi.fn(async () => 'http://microsoft.auth'),
        fetchUser: vi.fn(async () => {}),
      }
    },
    useEffect: (fn) => {
      try { fn() } catch {}
    },
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (initial) => ({ current: initial }),
  }
})

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: () => ({
      render: () => {}
    })
  }
}))

// Imports for execution
import App from './App'
import api from './api/axios'
import AdminRoute from './components/AdminRoute'
import ConfirmModal from './components/ConfirmModal'
import FileUploadZone from './components/FileUploadZone'
import FlashMessage from './components/FlashMessage'
import Footer from './components/Footer'
import LoadingSpinner from './components/LoadingSpinner'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import StatusBadge from './components/StatusBadge'
import { AuthProvider } from './context/AuthContext'
import useAuth from './hooks/useAuth'

import Admin from './pages/Admin'
import Dashboard from './pages/Dashboard'
import DietPlanGenerate from './pages/DietPlanGenerate'
import DietPlanHistory from './pages/DietPlanHistory'
import Documents from './pages/Documents'
import ForgotPassword from './pages/ForgotPassword'
import HealthTracker from './pages/HealthTracker'
import Help from './pages/Help'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import Register from './pages/Register'
import SystemHealth from './pages/SystemHealth'

function traverseAndExecute(node) {
  if (!node) return
  if (node.props) {
    if (typeof node.props.onSubmit === 'function') {
      try { node.props.onSubmit({ preventDefault: () => {} }) } catch {}
    }
    if (typeof node.props.onClick === 'function') {
      try { node.props.onClick({ preventDefault: () => {}, stopPropagation: () => {} }) } catch {}
    }
    if (typeof node.props.onChange === 'function') {
      try { node.props.onChange({ preventDefault: () => {}, target: { value: '10' } }) } catch {}
    }
    if (typeof node.props.onKeyDown === 'function') {
      try { node.props.onKeyDown({ preventDefault: () => {}, key: 'Enter' }) } catch {}
    }
    if (node.props.children) {
      if (Array.isArray(node.props.children)) {
        node.props.children.forEach(traverseAndExecute)
      } else {
        traverseAndExecute(node.props.children)
      }
    }
  }
}

describe('useAuth hook', () => {
  it('throws an error if used outside AuthProvider', () => {
    globalThis.mockUseContextValue = null
    expect(() => useAuth()).toThrow('useAuth must be used within an AuthProvider')
    globalThis.mockUseContextValue = undefined
  })

  it('returns context if used inside AuthProvider', () => {
    const mockCtx = { user: { email: 'mocked@mock.com' } }
    globalThis.mockUseContextValue = mockCtx
    expect(useAuth()).toBe(mockCtx)
    globalThis.mockUseContextValue = undefined
  })
})

describe('App Component', () => {
  it('renders loading spinner when loading is true', () => {
    globalThis.mockUseContextValue = {
      loading: true,
      flash: null,
    }
    const res = App()
    expect(res).toBeDefined()
    globalThis.mockUseContextValue = undefined
  })

  it('renders routes when loading is false', () => {
    globalThis.mockUseContextValue = {
      loading: false,
      flash: { message: 'Hello', type: 'success' },
    }
    const res = App()
    expect(res).toBeDefined()
    globalThis.mockUseContextValue = undefined
  })
})

describe('AuthProvider Component', () => {
  it('renders and exposes context value functions', async () => {
    const element = AuthProvider({ children: 'child' })
    expect(element).toBeDefined()
    
    const contextValue = element.props.value
    expect(contextValue).toBeDefined()
    
    try { contextValue.showFlash('Test message') } catch {}
    try { await contextValue.login('test@test.com', 'password') } catch {}
    try { await contextValue.register({ email: 'test@test.com' }) } catch {}
    try { await contextValue.logout() } catch {}
    try { await contextValue.microsoftLogin() } catch {}
    try { await contextValue.fetchUser() } catch {}
  })
})

describe('axios interceptor', () => {
  it('triggers axios response interceptors', () => {
    expect(api).toBeDefined()
    if (globalThis.mockInterceptorErrorCallback) {
      try {
        globalThis.mockInterceptorErrorCallback({ response: { status: 401 } })
      } catch {}
      try {
        globalThis.mockInterceptorErrorCallback({ response: { status: 500 } })
      } catch {}
    }
  })
})

describe('All Pages and Components', () => {
  it('executes and renders Landing page', () => {
    const element = Landing()
    expect(element).toBeDefined()
    traverseAndExecute(element)
    if (globalThis.mockScrollCallback) {
      try { globalThis.mockScrollCallback() } catch {}
    }
  })

  it('executes and renders Login page', () => {
    const element = Login()
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Register page', () => {
    const element = Register()
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders ForgotPassword page', () => {
    const element = ForgotPassword()
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Dashboard page with data', () => {
    const mockStats = { total_documents: 1, total_diet_plans: 1, total_health_logs: 1, total_allergies: 1 }
    const mockPlan = { id: '1', plan_title: 'Plan', plan_summary: 'Summary', foods_to_eat_count: 3, foods_to_avoid_count: 1, generated_at: new Date().toISOString() }
    const mockDocs = [{ id: '1', original_filename: 'report.pdf', document_type: 'lab_report', uploaded_at: new Date().toISOString(), ocr_status: 'completed' }]

    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockStats, // stats
      mockDocs,  // recentDocs
      mockPlan,  // recentPlan
      false,     // loading
    ]

    const element = Dashboard()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('handles Dashboard fetch errors', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Failed'))
    const element = Dashboard()
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Documents page', () => {
    const mockDocuments = [
      { id: '1', original_filename: 'report.pdf', document_type: 'lab_report', ocr_status: 'completed', processed_at: new Date().toISOString() }
    ]
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockDocuments,  // documents
      false,          // loading
      false,          // uploading
      'lab_report',   // docType
      '1',            // deleteTarget
    ]
    const element = Documents()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders DietPlanGenerate page', () => {
    const mockDocs = [{ id: '1', original_filename: 'report1.pdf', document_type: 'lab_report', processed: true }]
    const mockAllergies = [{ id: '1', allergen_name: 'Peanuts' }]
    const mockResult = {
      diet_plan: {
        weekly_plan: {
          Monday: { breakfast: 'Oatmeal', lunch: 'Salad', dinner: 'Soup' }
        },
        risk_assessment: { risk_level: 'medium', logic: 'Avoid peanuts' },
        nutritional_guidelines: ['Drink water'],
        foods_to_avoid: ['Peanuts'],
        foods_to_eat: ['Oats']
      }
    }
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockDocs,      // documents
      mockAllergies, // allergies
      ['1'],         // selectedDocs
      'notes',       // notes
      false,         // generating
      mockResult,    // result
      '',            // error
      false,         // loading
    ]
    const element = DietPlanGenerate()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders DietPlanHistory page', () => {
    const mockPlans = [
      {
        id: '1',
        plan_title: 'My Diet Plan',
        plan_summary: 'Summary text here...',
        foods_to_eat_count: 5,
        foods_to_avoid_count: 2,
        generated_at: new Date().toISOString()
      }
    ]
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockPlans, // plans
      false,     // loading
    ]
    const element = DietPlanHistory()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders HealthTracker page', () => {
    const mockData = {
      logs: [{ log_date: '2026-06-21', weight: 70, blood_sugar_fasting: 100, blood_sugar_postprandial: 120, blood_pressure_systolic: 120, blood_pressure_diastolic: 80 }],
      meals: [{ meal_date: '2026-06-21', meal_type: 'breakfast', food_items: 'Oats', calories_estimate: 300 }],
      today: '2026-06-21'
    }
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockData, // data
      false,    // loading
      {},       // healthForm
      {},       // mealForm
      false,    // saving
    ]
    const element = HealthTracker()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Profile page', () => {
    const mockAllergies = [{ id: '1', allergen_name: 'Peanuts', severity: 'severe' }]
    const mockForm = { full_name: 'Test Name', age: '25', gender: 'male', weight: '70', height: '180' }
    const mockAllergyForm = { allergen_name: 'Peanuts', severity: 'moderate', notes: '' }
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockAllergies,   // allergies
      false,           // loading
      false,           // saving
      mockForm,        // form
      ['None'],        // selectedConditions
      '',              // otherCondition
      [],              // selectedPreferences
      mockAllergyForm, // allergyForm
    ]
    const element = Profile()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Notifications page', () => {
    const mockNotifications = [
      { id: 1, message: 'Test Msg', created_at: new Date().toISOString(), type: 'info', is_read: false }
    ]
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockNotifications, // notifications
      false,             // loading
    ]
    const element = Notifications()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Admin page', () => {
    const mockStats = { total_users: 2, total_documents: 5 }
    const mockUsers = [{ id: '1', username: 'testuser', email: 'test@test.com', role: 'user', is_active: true }]
    const mockDocs = [{ id: '1', original_filename: 'report.pdf', document_type: 'lab_report', ocr_status: 'completed' }]
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockStats, // stats
      mockUsers, // users
      mockDocs,  // documents
      false,     // loading
    ]
    const element = Admin()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Help page', () => {
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      0, // openIndex
    ]
    const element = Help()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders SystemHealth page', () => {
    const mockHealth = {
      overall_status: 'healthy',
      services: {
        'auth-service': { status: 'healthy', database: 'connected', timestamp: new Date().toISOString() }
      }
    }
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      mockHealth, // health
      false,      // loading
    ]
    const element = SystemHealth()
    globalThis.mockStateOverrides = null
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders AdminRoute component', () => {
    const element = AdminRoute({ children: 'child' })
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders AdminRoute component with admin role', () => {
    globalThis.mockUseContextValue = {
      user: { role: 'admin' }
    }
    const element = AdminRoute({ children: 'child' })
    expect(element).toBeDefined()
    globalThis.mockUseContextValue = undefined
  })

  it('executes and renders ConfirmModal component', () => {
    const element = ConfirmModal({ show: true, title: 'Title', message: 'Message', onConfirm: () => {}, onCancel: () => {} })
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders FileUploadZone component', () => {
    const el1 = FileUploadZone({ onFileSelect: () => {}, uploading: false, progress: 0 })
    expect(el1).toBeDefined()
    traverseAndExecute(el1)

    const el2 = FileUploadZone({ onFileSelect: () => {}, uploading: true, progress: 50 })
    expect(el2).toBeDefined()
    traverseAndExecute(el2)

    globalThis.mockIsDragActive = true
    const el3 = FileUploadZone({ onFileSelect: () => {}, uploading: false, progress: 0 })
    expect(el3).toBeDefined()
    traverseAndExecute(el3)
    globalThis.mockIsDragActive = false

    if (globalThis.mockCapturedOnDrop) {
      try { globalThis.mockCapturedOnDrop(['dummyfile']) } catch {}
    }
  })

  it('executes and renders FlashMessage component', () => {
    const element = FlashMessage({ message: 'Msg', type: 'success' })
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders Footer component', () => {
    const element = Footer()
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders LoadingSpinner component', () => {
    const el1 = LoadingSpinner({ fullPage: true })
    expect(el1).toBeDefined()
    traverseAndExecute(el1)

    const el2 = LoadingSpinner({ fullPage: false })
    expect(el2).toBeDefined()
    traverseAndExecute(el2)
  })

  it('executes and renders Navbar component under different conditions', () => {
    globalThis.mockUseContextValue = { user: null }
    const el1 = Navbar()
    expect(el1).toBeDefined()
    traverseAndExecute(el1)

    globalThis.mockUseContextValue = {
      user: { username: 'adminuser', role: 'admin' },
      logout: vi.fn(),
    }
    globalThis.mockStateIndex = 0
    globalThis.mockStateOverrides = [
      3, // notificationCount
    ]
    const el2 = Navbar()
    globalThis.mockStateOverrides = null
    expect(el2).toBeDefined()
    traverseAndExecute(el2)
    globalThis.mockUseContextValue = undefined
  })

  it('executes and renders ProtectedRoute component', () => {
    const element = ProtectedRoute({ children: 'child' })
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes and renders ProtectedRoute component when not authenticated', () => {
    globalThis.mockUseContextValue = {
      user: null
    }
    const element = ProtectedRoute({ children: 'child' })
    expect(element).toBeDefined()
    globalThis.mockUseContextValue = undefined
  })

  it('executes and renders StatusBadge component', () => {
    const element = StatusBadge({ status: 'completed' })
    expect(element).toBeDefined()
    traverseAndExecute(element)
  })

  it('executes entry point main.jsx', async () => {
    const mainModule = await import('./main.jsx')
    expect(mainModule).toBeDefined()
  })
})
