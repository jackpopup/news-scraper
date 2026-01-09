// Use proxy in development to avoid CORS issues
const API_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_BKEND_API_URL || 'https://api-enduser.bkend.ai')
const PROJECT_ID = import.meta.env.VITE_BKEND_PROJECT_ID || 'hv95e8qu7zgbcuvh7p85'
const ENVIRONMENT = import.meta.env.VITE_BKEND_ENVIRONMENT || 'dev'

const TOKEN_KEY = 'bkend_token'

// ═══════════════════════════════════════════════════════════════════════════
// Type Definitions (PRD 기반)
// ═══════════════════════════════════════════════════════════════════════════

export interface Company {
  name: string
  ceo?: string
  aliases?: string[]
  keywords?: string[]
}

export interface CompanyTier {
  tier: number
  label: string
  score: number
  companies: Company[]
}

export interface KeywordGroup {
  id: string
  label: string
  score: number
  enabled: boolean
  keywords: string[]
  patterns?: string[]
}

export interface SearchQueries {
  auto_generated: string[]
  user_added: string[]
  disabled: string[]
}

export interface ProfileFilters {
  time_range: '24h' | '48h' | '1w'
  sources: {
    google_news: boolean
    naver_news: boolean
  }
  language: string
  dedupe_enabled: boolean
  history_days: number
}

export interface ProfileOutput {
  top_articles: number
  include_summary: boolean
  summary_length: number
}

export interface FeedbackPattern {
  keyword?: string
  company?: string
  source?: string
  count: number
}

export interface ProfileFeedback {
  liked_patterns: FeedbackPattern[]
  disliked_patterns: FeedbackPattern[]
}

export interface Profile {
  _id?: string
  user_id?: string
  name: string
  is_default: boolean
  company_tiers: CompanyTier[]
  search_queries: SearchQueries
  bonus_groups: KeywordGroup[]
  penalty_groups: KeywordGroup[]
  filters: ProfileFilters
  output: ProfileOutput
  feedback: ProfileFeedback
  created_at?: string
  updated_at?: string
}

export interface User {
  _id: string
  email: string
  name: string
  company?: string
  industry?: string
  role?: string
  onboarding_completed?: boolean
}

export interface Article {
  _id: string
  result_id: string
  profile_id: string
  title: string
  link: string
  source: string
  published_at: string
  scraped_at: string
  final_score: number
  company_score: number
  company_matched?: string
  bonus_score: number
  bonus_breakdown?: { group: string; keyword: string; score: number }[]
  penalty_score: number
  penalty_breakdown?: { group: string; keyword: string; score: number }[]
  summary?: string
  is_duplicate: boolean
  rank?: number
}

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
  // ═══════════════════════════════════════════════════════════════════════════
  // Profile CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async getProfiles() {
    // selfFilters를 사용하여 로그인한 사용자의 프로필만 가져옴
    // bkend.ai에서 createdBy가 현재 사용자와 일치하는 것만 반환
    const params = new URLSearchParams()
    params.append('selfFilters', JSON.stringify({ createdBy: true }))
    return request<{ success: boolean; data?: { items: Profile[] } }>(`/data/profiles?${params.toString()}`)
  },

  async getProfile(profileId: string) {
    return request<{ success: boolean; data?: Profile }>(`/data/profiles/${profileId}`)
  },

  async createProfile(profile: Omit<Profile, '_id' | 'user_id' | 'created_at' | 'updated_at'>) {
    return request<{ success: boolean; data?: Profile }>('/data/profiles', {
      method: 'POST',
      body: JSON.stringify(profile),
    })
  },

  async updateProfile(profileId: string, updates: Partial<Profile>) {
    return request<{ success: boolean; data?: Profile }>(`/data/profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  },

  async deleteProfile(profileId: string) {
    return request<{ success: boolean }>(`/data/profiles/${profileId}`, {
      method: 'DELETE',
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // User Info Update
  // ═══════════════════════════════════════════════════════════════════════════

  async updateUser(updates: Partial<User>) {
    return request<{ success: boolean; data?: User }>('/data/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Scrape Results & Articles
  // ═══════════════════════════════════════════════════════════════════════════

  async getScrapeResults(profileId: string) {
    return request<{ success: boolean; data?: { items: unknown[] } }>(
      `/data/scrape_results?andFilters=${encodeURIComponent(JSON.stringify({ profile_id: profileId }))}`
    )
  },

  async getArticles(profileId: string, options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams()
    params.append('andFilters', JSON.stringify({ profile_id: profileId }))
    params.append('sortBy', JSON.stringify({ final_score: -1 }))
    if (options?.limit) params.append('limit', String(options.limit))
    if (options?.offset) params.append('offset', String(options.offset))

    return request<{ success: boolean; data?: { items: Article[]; total: number } }>(
      `/data/articles?${params.toString()}`
    )
  },

  async getTopArticles(profileId: string, limit = 10) {
    return this.getArticles(profileId, { limit })
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Feedback
  // ═══════════════════════════════════════════════════════════════════════════

  async addFeedback(profileId: string, articleId: string, type: 'like' | 'dislike', keywords?: string[]) {
    return request<{ success: boolean }>('/data/feedback', {
      method: 'POST',
      body: JSON.stringify({
        profile_id: profileId,
        article_id: articleId,
        type,
        keywords,
        created_at: new Date().toISOString(),
      }),
    })
  },

  async addNoiseKeywords(profileId: string, keywords: string[]) {
    // Get current profile and update penalty_groups
    const profileResult = await this.getProfile(profileId)
    if (!profileResult.success || !profileResult.data) {
      return { success: false, error: 'Profile not found' }
    }

    const profile = profileResult.data
    const userNoiseGroup = profile.penalty_groups.find(g => g.id === 'user_noise')

    if (userNoiseGroup) {
      // Add keywords to existing user_noise group
      const newKeywords = [...new Set([...userNoiseGroup.keywords, ...keywords])]
      userNoiseGroup.keywords = newKeywords
    } else {
      // Create new user_noise group
      profile.penalty_groups.push({
        id: 'user_noise',
        label: '사용자 노이즈 필터',
        score: -100,
        enabled: true,
        keywords,
      })
    }

    return this.updateProfile(profileId, { penalty_groups: profile.penalty_groups })
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// Default Profile Template (온보딩용)
// ═══════════════════════════════════════════════════════════════════════════

export function createDefaultProfile(data: {
  companyName: string
  companyCeo?: string
  industry: string
  role: string
  keywords: string[]
  competitors: string[]
  industryKeywords: string[]
  noiseFilter: 'none' | 'basic'
}): Omit<Profile, '_id' | 'user_id' | 'created_at' | 'updated_at'> {
  const { companyName, companyCeo, role, keywords, competitors, industryKeywords, noiseFilter } = data

  // 자동 검색 쿼리 생성
  const autoQueries = [
    companyName,
    ...(companyCeo ? [`${companyName} ${companyCeo}`] : []),
    ...keywords.map(k => `${companyName} ${k}`),
    ...competitors,
    ...industryKeywords,
  ]

  // 역할별 추가 키워드
  const roleKeywords: Record<string, string[]> = {
    'PR담당자': ['보도자료', '언론', '기자간담회', '미디어'],
    '마케터': ['캠페인', '광고', '마케팅', '브랜드'],
    '경영진': ['실적', '전략', '비전', '경영'],
    '투자자': ['투자', '펀딩', '밸류에이션', '엑싯'],
  }

  return {
    name: `${companyName} Daily`,
    is_default: true,
    company_tiers: [
      {
        tier: 0,
        label: '우리 회사',
        score: 100,
        companies: [{
          name: companyName,
          ceo: companyCeo,
          aliases: [],
          keywords: [companyName, ...(companyCeo ? [companyCeo] : [])],
        }],
      },
      {
        tier: 1,
        label: '핵심 경쟁사',
        score: 60,
        companies: competitors.map(name => ({
          name,
          ceo: '',
          aliases: [],
          keywords: [name],
        })),
      },
      {
        tier: 2,
        label: '관심 기업',
        score: 40,
        companies: [],
      },
      {
        tier: 3,
        label: '업계 동향',
        score: 25,
        companies: [],
      },
    ],
    search_queries: {
      auto_generated: autoQueries,
      user_added: [],
      disabled: [],
    },
    bonus_groups: [
      {
        id: 'investment',
        label: '투자/M&A',
        score: 40,
        enabled: true,
        keywords: ['투자유치', '인수', '합병', 'M&A', '펀딩', 'IPO', '시리즈'],
      },
      {
        id: 'regulation',
        label: '규제/정책',
        score: 35,
        enabled: true,
        keywords: ['규제', '법안', '정책', '허용', '금지', '시행령'],
      },
      {
        id: 'launch',
        label: '신제품/런칭',
        score: 30,
        enabled: true,
        keywords: ['출시', '런칭', '신제품', '오픈', '베타', '발표'],
      },
      {
        id: 'earnings',
        label: '실적/시장데이터',
        score: 25,
        enabled: true,
        keywords: ['매출', '영업이익', '성장률', '점유율', '실적'],
      },
      {
        id: 'exclusive',
        label: '단독/최초',
        score: 20,
        enabled: true,
        keywords: ['단독', '최초', '독점', '세계 최초', '업계 최초'],
      },
      {
        id: 'role_keywords',
        label: `${role} 관심사`,
        score: 15,
        enabled: true,
        keywords: roleKeywords[role] || [],
      },
    ],
    penalty_groups: noiseFilter === 'basic' ? [
      {
        id: 'promotion',
        label: '광고/이벤트',
        score: -20,
        enabled: true,
        keywords: ['광고', '이벤트', '할인', '쿠폰', '프로모션', '경품'],
      },
    ] : [],
    filters: {
      time_range: '24h',
      sources: {
        google_news: true,
        naver_news: true,
      },
      language: 'ko',
      dedupe_enabled: true,
      history_days: 7,
    },
    output: {
      top_articles: 10,
      include_summary: true,
      summary_length: 100,
    },
    feedback: {
      liked_patterns: [],
      disliked_patterns: [],
    },
  }
}
