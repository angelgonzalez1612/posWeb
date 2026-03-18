import { useEffect, useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { LoginPage } from './pages/LoginPage'
import { apiRequest, clearSession, readSession, saveSession } from './services/api'
import type { AuthSession } from './types'

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession<AuthSession>())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const savedSession = readSession<AuthSession>()

      if (!savedSession?.token) {
        setBooting(false)
        return
      }

      try {
        const response = await apiRequest<{ user: AuthSession['user'] }>('/auth/me', {
          token: savedSession.token,
        })

        const nextSession = {
          ...savedSession,
          user: response.user,
        }

        saveSession(nextSession)
        setSession(nextSession)
      } catch {
        clearSession()
        setSession(null)
      } finally {
        setBooting(false)
      }
    }

    void restoreSession()
  }, [])

  const handleLogin = async (credentials: { email: string; password: string }) => {
    setLoading(true)
    setError('')

    try {
      const nextSession = await apiRequest<AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
      saveSession(nextSession)
      setSession(nextSession)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesion')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
  }

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.4),_transparent_30%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4">
        <div className="rounded-[32px] border border-slate-200 bg-white px-8 py-7 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-500">Tienda POS</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
            <p className="text-sm font-medium text-slate-600">Validando sesion...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} error={error} loading={loading} />
  }

  return <Dashboard session={session} onLogout={handleLogout} />
}
