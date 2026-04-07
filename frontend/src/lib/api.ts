export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

const LS_TOKEN_KEY = 'classroom_mvp_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(LS_TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (!token) localStorage.removeItem(LS_TOKEN_KEY)
  else localStorage.setItem(LS_TOKEN_KEY, token)
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken()
  if (!token) throw new ApiError('Not authenticated', 401)
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })

  const text = await res.text()
  const json = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const message =
      (json as { error?: string })?.error || `Request failed (${res.status})`
    throw new ApiError(message, res.status, json)
  }

  return json as T
}

