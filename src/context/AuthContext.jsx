import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CLIENT_ID, SCOPES } from '../config'

const AuthContext = createContext(null)

const SESSION_KEY = 'fp_token'
const SILENT_FLAG = 'fp_silent_tried'

function buildAuthUrl(extra = {}) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: window.location.origin + '/FinancePlannerTracker/',
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    ...extra,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

function saveSession(token) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      token,
      expires: Date.now() + 55 * 60 * 1000,
    }))
    sessionStorage.removeItem(SILENT_FLAG)
  } catch {}
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { token, expires } = JSON.parse(raw)
    if (Date.now() > expires) { sessionStorage.removeItem(SESSION_KEY); return null }
    return token
  } catch { return null }
}

const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem('fp_user')) || null } catch { return null }
})()

async function fetchProfile(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(savedUser)
  const [token, setTokenState] = useState(null)
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    const hash   = window.location.hash
    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const hashError   = params.get('error')

    // 1. Returning from Google with a token
    if (accessToken) {
      window.history.replaceState(null, '', window.location.pathname)
      setTokenState(accessToken)
      saveSession(accessToken)
      fetchProfile(accessToken)
        .then(profile => {
          const u = { email: profile.email, name: profile.name, picture: profile.picture }
          setUser(u)
          localStorage.setItem('fp_user', JSON.stringify(u))
        })
        .catch(() => {})
        .finally(() => setLoading(false))
      return
    }

    // 2. Silent auth failed
    if (hashError) {
      window.history.replaceState(null, '', window.location.pathname)
      sessionStorage.removeItem(SILENT_FLAG)
      setLoading(false)
      return
    }

    // 3. Valid token in sessionStorage
    const sessionToken = loadSession()
    if (sessionToken) {
      setTokenState(sessionToken)
      setLoading(false)
      return
    }

    // 4. Try silent re-auth using cached user hint
    const alreadyTried = sessionStorage.getItem(SILENT_FLAG)
    if (savedUser && !alreadyTried) {
      sessionStorage.setItem(SILENT_FLAG, '1')
      window.location.href = buildAuthUrl({ prompt: 'none', login_hint: savedUser.email })
      return
    }

    // 5. Nothing worked — show login
    setLoading(false)
  }, [])

  const login = useCallback(() => {
    sessionStorage.removeItem(SILENT_FLAG)
    window.location.href = buildAuthUrl()
  }, [])

  const logout = useCallback(() => {
    setTokenState(null)
    setUser(null)
    localStorage.removeItem('fp_user')
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SILENT_FLAG)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
