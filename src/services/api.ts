const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '')
const SESSION_KEY = 'tienda-pos-session'

type RequestOptions = RequestInit & {
  token?: string
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Error de API' }))
    throw new Error(errorBody.message || 'Error de API')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function saveSession(session: unknown) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function readSession<T>() {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as T) : null
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
