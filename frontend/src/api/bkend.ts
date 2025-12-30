// Use proxy in development to avoid CORS issues
const API_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_BKEND_API_URL || 'https://api-enduser.bkend.ai')
const PROJECT_ID = import.meta.env.VITE_BKEND_PROJECT_ID || 'hv95e8qu7zgbcuvh7p85'
const ENVIRONMENT = import.meta.env.VITE_BKEND_ENVIRONMENT || 'dev'

const TOKEN_KEY = 'bkend_token'

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Project-Id': PROJECT_ID,
    'X-Environment': ENVIRONMENT,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const data = await response.json()
  return data
}

// Auth API
export const authApi = {
  async signup(email: string, password: string, name: string) {
    const result = await request<{ success: boolean; data?: { access_token: string }; error?: { message: string } }>(
      '/auth/signup/password',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }
    )

    if (result.success && result.data?.access_token) {
      setToken(result.data.access_token)
    }

    return {
      success: result.success,
      error: result.error?.message,
    }
  },

  async signin(email: string, password: string) {
    const result = await request<{ success: boolean; data?: { access_token: string }; error?: { message: string } }>(
      '/auth/signin/password',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    )

    if (result.success && result.data?.access_token) {
      setToken(result.data.access_token)
    }

    return {
      success: result.success,
      error: result.error?.message,
    }
  },

  async requestPasswordReset(email: string) {
    const result = await request<{ success: boolean; error?: { message: string } }>(
      '/auth/password/reset-request',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    )
    return {
      success: result.success,
      error: result.error?.message,
    }
  },

  async getMe() {
    return request<{ success: boolean; data?: { _id: string; email: string; name: string } }>(
      '/auth/me'
    )
  },

  logout() {
    removeToken()
  },

  isLoggedIn(): boolean {
    return !!getToken()
  },
}

// Data API
export const dataApi = {
  async getProfiles() {
    return request<{ success: boolean; data?: { items: unknown[] } }>('/data/profiles')
  },

  async createProfile(data: Record<string, unknown>) {
    return request<{ success: boolean; data?: unknown }>('/data/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getScrapeResults(profileId: string) {
    return request<{ success: boolean; data?: { items: unknown[] } }>(
      `/data/scrape_results?andFilters=${encodeURIComponent(JSON.stringify({ profile_id: profileId }))}`
    )
  },
}
