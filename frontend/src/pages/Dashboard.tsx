import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, dataApi } from '../api/bkend'
import type { Profile, Article as APIArticle } from '../api/bkend'
import FeedbackModal from '../components/FeedbackModal'
import KeywordSidebar from '../components/KeywordSidebar'

interface User {
  _id: string
  email: string
  name: string
}

interface Article {
  id: string
  title: string
  source: string
  time: string
  relevance: number
  link?: string
  matchedCompany?: string
  matchedKeywords?: string[]
  scoreBreakdown?: {
    company: number
    bonus: number
    penalty: number
  }
}

// Convert API article to UI format
function apiToArticle(apiArticle: APIArticle): Article {
  const publishedAt = new Date(apiArticle.published_at)
  const now = new Date()
  const diffMs = now.getTime() - publishedAt.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const timeStr = diffHours < 24 ? `${diffHours}시간 전` : `${Math.floor(diffHours / 24)}일 전`

  return {
    id: apiArticle._id,
    title: apiArticle.title,
    source: apiArticle.source,
    time: timeStr,
    relevance: apiArticle.final_score,
    link: apiArticle.link,
    matchedCompany: apiArticle.company_matched,
    matchedKeywords: apiArticle.bonus_breakdown?.map(b => b.keyword) || [],
    scoreBreakdown: {
      company: apiArticle.company_score,
      bonus: apiArticle.bonus_score,
      penalty: apiArticle.penalty_score,
    },
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean
    article: Article | null
  }>({ isOpen: false, article: null })
  const [likedArticles, setLikedArticles] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('liked_articles')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [dislikedArticles, setDislikedArticles] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('disliked_articles')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  // 사용자가 추가한 노이즈 키워드 (실시간 필터링용)
  const [localNoiseKeywords, setLocalNoiseKeywords] = useState<string[]>(() => {
    const saved = localStorage.getItem('local_noise_keywords')
    return saved ? JSON.parse(saved) : []
  })
  const [showAllArticles, setShowAllArticles] = useState(false)
  const [hideNoiseFiltered, setHideNoiseFiltered] = useState(() => {
    const saved = localStorage.getItem('hide_noise_filtered')
    return saved !== null ? JSON.parse(saved) : true
  })

  // 사이드바 필터 상태
  const [selectedFilter, setSelectedFilter] = useState<{
    type: 'all' | 'keyword_group' | 'company_tier'
    id?: string
  }>({ type: 'all' })

  // 사이드바 접기/펼치기 (모바일)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // 좋아요/싫어요 상태를 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('liked_articles', JSON.stringify([...likedArticles]))
  }, [likedArticles])

  useEffect(() => {
    localStorage.setItem('disliked_articles', JSON.stringify([...dislikedArticles]))
  }, [dislikedArticles])

  useEffect(() => {
    localStorage.setItem('hide_noise_filtered', JSON.stringify(hideNoiseFiltered))
  }, [hideNoiseFiltered])

  useEffect(() => {
    localStorage.setItem('local_noise_keywords', JSON.stringify(localNoiseKeywords))
  }, [localNoiseKeywords])

  useEffect(() => {
    loadData()
  }, [])

  // 로컬 노이즈 키워드가 제목에 포함되어 있는지 확인
  const hasLocalNoiseKeyword = (title: string): boolean => {
    if (localNoiseKeywords.length === 0) return false
    const titleLower = title.toLowerCase()
    return localNoiseKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()))
  }

  // 필터링된 기사 목록
  const getFilteredArticles = () => {
    let filtered = articles.filter(article => {
      // 싫어요 누른 기사는 항상 숨김
      if (dislikedArticles.has(article.id)) return false
      // 노이즈 필터 켜져있을 때:
      if (hideNoiseFiltered) {
        // 1) 서버에서 penalty가 있는 기사 숨김
        if (article.scoreBreakdown && article.scoreBreakdown.penalty < 0) return false
        // 2) 로컬 노이즈 키워드가 포함된 기사 숨김
        if (hasLocalNoiseKeyword(article.title)) return false
      }
      return true
    })

    // 사이드바 필터 적용
    if (selectedFilter.type === 'keyword_group' && selectedFilter.id) {
      const group = profile?.bonus_groups?.find(g => g.id === selectedFilter.id)
      if (group && group.keywords) {
        filtered = filtered.filter(article => {
          const titleLower = article.title.toLowerCase()
          return group.keywords.some(kw => titleLower.includes(kw.toLowerCase()))
        })
      }
    } else if (selectedFilter.type === 'company_tier' && selectedFilter.id) {
      // id 형식: "tier-companyName"
      const companyName = selectedFilter.id.split('-').slice(1).join('-')
      filtered = filtered.filter(article => {
        const titleLower = article.title.toLowerCase()
        return titleLower.includes(companyName.toLowerCase()) ||
               article.matchedCompany?.toLowerCase() === companyName.toLowerCase()
      })
    }

    return filtered
  }

  const displayedArticles = getFilteredArticles()

  // 데모용 기본 프로필 (API 실패시 fallback)
  const getDemoProfile = (): Profile => ({
    _id: 'demo',
    name: '오늘의 탑뉴스',
    is_default: true,
    company_tiers: [
      {
        tier: 0,
        label: '우리 회사',
        score: 100,
        companies: [{ name: '온다', aliases: ['ONDA', '온다매니지먼트'] }]
      },
      {
        tier: 1,
        label: '주요 경쟁사',
        score: 60,
        companies: [
          { name: '야놀자' },
          { name: '여기어때' },
          { name: '에어비앤비' }
        ]
      },
      {
        tier: 2,
        label: 'OTA/플랫폼',
        score: 40,
        companies: [
          { name: '부킹닷컴' },
          { name: '익스피디아' },
          { name: '트립닷컴' },
          { name: '아고다' }
        ]
      }
    ],
    bonus_groups: [
      {
        id: 'hospitality',
        label: '호스피탈리티테크',
        score: 20,
        enabled: true,
        keywords: ['호스피탈리티', '호텔테크', 'PMS', '객실관리']
      },
      {
        id: 'travel',
        label: '트래블테크',
        score: 15,
        enabled: true,
        keywords: ['트래블테크', '여행테크', 'OTA', '숙박예약']
      },
      {
        id: 'startup',
        label: '스타트업',
        score: 10,
        enabled: true,
        keywords: ['스타트업', '투자', '시리즈A', '유니콘']
      }
    ],
    penalty_groups: [
      {
        id: 'noise',
        label: '광고/이벤트',
        score: -30,
        enabled: true,
        keywords: ['할인', '프로모션', '이벤트', '쿠폰']
      }
    ],
    search_queries: {
      auto_generated: ['온다 호텔', '야놀자', '여기어때', '숙박 플랫폼'],
      user_added: [],
      disabled: []
    },
    filters: {
      time_range: '24h',
      sources: { google_news: false, naver_news: true },
      language: 'ko',
      dedupe_enabled: true,
      history_days: 7
    },
    output: {
      top_articles: 20,
      include_summary: true,
      summary_length: 100
    },
    feedback: {
      liked_patterns: [],
      disliked_patterns: []
    }
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // Fetch user
      const userResult = await authApi.getMe()
      if (userResult.success && userResult.data) {
        setUser(userResult.data)
      }

      // Fetch profile
      let profileId: string | null = localStorage.getItem('current_profile_id')
      console.log('Initial profileId from localStorage:', profileId)
      let loadedProfile: Profile | null = null

      if (!profileId) {
        const profilesResult = await dataApi.getProfiles()
        console.log('Profiles result:', profilesResult)
        if (profilesResult.success && profilesResult.data?.items?.length) {
          const firstProfile = profilesResult.data.items[0]
          profileId = firstProfile._id || null
          console.log('Got first profile ID:', profileId)
          if (profileId) {
            localStorage.setItem('current_profile_id', profileId)
          }
          loadedProfile = firstProfile
        }
      } else {
        const profileResult = await dataApi.getProfile(profileId)
        console.log('Profile result:', profileResult)
        if (profileResult.success && profileResult.data) {
          loadedProfile = profileResult.data
        }
      }

      // API에서 프로필을 못 가져오면 데모 프로필 사용
      if (!loadedProfile || !loadedProfile.bonus_groups?.length) {
        console.log('Using demo profile as fallback')
        loadedProfile = getDemoProfile()
      }
      setProfile(loadedProfile)

      // Fetch articles - always try to load even if API fails
      console.log('Loading articles with profileId:', profileId)
      await loadArticles(profileId || 'default')
    } catch (error) {
      console.error('Failed to load data:', error)
      // 에러 발생시에도 데모 프로필 사용
      setProfile(getDemoProfile())
    } finally {
      setLoading(false)
    }
  }

  const loadArticles = async (profileId: string) => {
    setArticlesLoading(true)
    try {
      const result = await dataApi.getTopArticles(profileId, 10)
      console.log('API result:', result)
      if (result.success && result.data && result.data.items && result.data.items.length > 0) {
        setArticles(result.data.items.map(apiToArticle))
      } else {
        // Fallback: Load from local JSON file (for development/demo)
        console.log('No articles from API, loading from local...')
        await loadArticlesFromLocal(profileId)
      }
    } catch (error) {
      console.error('Failed to load articles from API, trying local:', error)
      await loadArticlesFromLocal(profileId)
    } finally {
      setArticlesLoading(false)
    }
  }

  const loadArticlesFromLocal = async (profileId: string) => {
    try {
      // 프로필별 JSON 파일 먼저 시도, 없으면 기본 파일로 fallback
      const filesToTry = [
        `/data/articles_${profileId}.json`,  // 프로필별 파일
        '/data/articles.json'                 // 기본 fallback
      ]

      for (const filePath of filesToTry) {
        console.log(`Trying to fetch ${filePath}...`)
        try {
          const response = await fetch(filePath)
          if (response.ok) {
            const data = await response.json()
            console.log(`Local data loaded from ${filePath}:`, data.total_articles, 'articles')

            // 프로필 ID가 일치하는지 확인 (다른 사용자의 파일 로드 방지)
            if (data.profile_id && data.profile_id !== profileId && filePath !== '/data/articles.json') {
              console.log(`Profile ID mismatch: expected ${profileId}, got ${data.profile_id}`)
              continue
            }

            if (data.articles && data.articles.length > 0) {
              // 기사 링크를 기반으로 고유한 ID 생성 (새로고침해도 동일한 ID 유지)
              const generateArticleId = (link: string, title: string) => {
                const str = link || title
                let hash = 0
                for (let i = 0; i < str.length; i++) {
                  const char = str.charCodeAt(i)
                  hash = ((hash << 5) - hash) + char
                  hash = hash & hash // Convert to 32bit integer
                }
                return `article-${Math.abs(hash)}`
              }

              const localArticles = data.articles.map((a: any) => ({
                id: generateArticleId(a.link, a.title),
                title: a.title,
                source: a.source,
                time: a.time_text || '방금 전',
                relevance: a.final_score,
                link: a.link,
                matchedCompany: a.company_matched || '',
                matchedKeywords: a.bonus_breakdown?.map((b: any) => b.keyword) || [],
                scoreBreakdown: {
                  company: a.company_score || 0,
                  bonus: a.bonus_score || 0,
                  penalty: a.penalty_score || 0,
                },
              }))
              console.log('Setting articles:', localArticles.length)
              setArticles(localArticles)
              return // 성공하면 종료
            }
          }
        } catch (e) {
          console.log(`Failed to load ${filePath}:`, e)
        }
      }

      console.log('No articles files found')
    } catch (error) {
      console.error('Failed to load local articles:', error)
    }
  }

  const handleLogout = () => {
    authApi.logout()
    localStorage.removeItem('current_profile_id')
    navigate('/login')
  }

  // Computed stats
  const noiseFilteredCount = articles.filter(a =>
    (a.scoreBreakdown?.penalty ?? 0) < 0 || hasLocalNoiseKeyword(a.title)
  ).length
  const stats = {
    totalArticles: articles.length,
    displayedArticles: displayedArticles.length,
    matchedKeywords: (profile?.search_queries?.user_added?.length || 0) + (profile?.search_queries?.auto_generated?.length || 0),
    noiseFiltered: noiseFilteredCount,
    localNoiseKeywords: localNoiseKeywords.length,
  }

  const handleLike = async (articleId: string) => {
    if (dislikedArticles.has(articleId)) {
      setDislikedArticles(prev => {
        const next = new Set(prev)
        next.delete(articleId)
        return next
      })
    }

    const isLiked = likedArticles.has(articleId)
    setLikedArticles(prev => {
      const next = new Set(prev)
      if (isLiked) {
        next.delete(articleId)
      } else {
        next.add(articleId)
      }
      return next
    })

    // Send feedback to API
    const profileId = localStorage.getItem('current_profile_id')
    if (profileId && !isLiked) {
      try {
        await dataApi.addFeedback(profileId, articleId, 'like')
      } catch (error) {
        console.error('Failed to add like feedback:', error)
      }
    }
  }

  const handleDislike = (article: Article) => {
    if (likedArticles.has(article.id)) {
      setLikedArticles(prev => {
        const next = new Set(prev)
        next.delete(article.id)
        return next
      })
    }
    setFeedbackModal({ isOpen: true, article })
  }

  const handleFeedbackSubmit = async (keywords: string[]) => {
    if (feedbackModal.article) {
      const articleId = feedbackModal.article.id
      setDislikedArticles(prev => new Set([...prev, articleId]))

      // 로컬 노이즈 키워드에 즉시 추가 (실시간 필터링)
      if (keywords.length > 0) {
        setLocalNoiseKeywords(prev => {
          const newKeywords = [...new Set([...prev, ...keywords])]
          console.log('Local noise keywords updated:', newKeywords)
          return newKeywords
        })
      }

      const profileId = localStorage.getItem('current_profile_id')
      console.log('handleFeedbackSubmit called:', { articleId, profileId, keywords })

      if (profileId) {
        try {
          // Add dislike feedback
          const feedbackResult = await dataApi.addFeedback(profileId, articleId, 'dislike', keywords)
          console.log('Feedback result:', feedbackResult)

          // Add noise keywords to profile if any
          if (keywords.length > 0) {
            const noiseResult = await dataApi.addNoiseKeywords(profileId, keywords)
            console.log('Noise keywords result:', noiseResult)
          }
        } catch (error) {
          console.error('Failed to add feedback:', error)
        }
      }
    }
    setFeedbackModal({ isOpen: false, article: null })
  }

  // 현재 필터 제목
  const getFilterTitle = () => {
    if (selectedFilter.type === 'all') return '오늘의 탑뉴스'
    if (selectedFilter.type === 'keyword_group' && selectedFilter.id) {
      const group = profile?.bonus_groups?.find(g => g.id === selectedFilter.id)
      return group?.label || '키워드 그룹'
    }
    if (selectedFilter.type === 'company_tier' && selectedFilter.id) {
      const companyName = selectedFilter.id.split('-').slice(1).join('-')
      return companyName
    }
    return '뉴스'
  }

  // 현재 날짜 표시
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일`

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* 사이드바 토글 버튼 (모바일) */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors lg:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900">News Curator</h1>
                <p className="text-[10px] text-slate-500 hidden sm:block">AI-Powered News Monitoring</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden md:block">{dateStr}</span>
            {!loading && user && (
              <span className="text-sm font-medium text-slate-700">{user.name}님</span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽 사이드바 */}
        <div className={`${sidebarCollapsed ? 'hidden' : 'block'} lg:block flex-shrink-0`}>
          <KeywordSidebar
            profile={profile}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            onNavigateSettings={() => navigate('/settings')}
          />
        </div>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">전체 기사</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalArticles}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">표시 기사</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.displayedArticles}</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">좋아요</p>
                    <p className="text-2xl font-bold text-violet-600 mt-0.5">{likedArticles.size}</p>
                  </div>
                  <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">노이즈 필터</p>
                    <p className="text-2xl font-bold text-amber-600 mt-0.5">{stats.noiseFiltered}</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 기사 목록 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    {getFilterTitle()}
                    {selectedFilter.type !== 'all' && (
                      <button
                        onClick={() => setSelectedFilter({ type: 'all' })}
                        className="text-xs text-slate-400 hover:text-slate-600 font-normal"
                      >
                        ✕ 필터 해제
                      </button>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedFilter.type === 'all'
                      ? '관련도 점수 순 정렬'
                      : `${displayedArticles.length}개 기사 매칭`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      checked={hideNoiseFiltered}
                      onChange={(e) => setHideNoiseFiltered(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs">노이즈 필터</span>
                  </label>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {articles.length === 0 && !articlesLoading ? (
                  <div className="p-12 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                    <p className="font-medium text-slate-700">아직 수집된 기사가 없습니다</p>
                    <p className="text-sm text-slate-500 mt-1">뉴스 스크래핑을 실행해보세요</p>
                  </div>
                ) : articlesLoading ? (
                  <div className="p-12 text-center">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">기사를 불러오는 중...</p>
                  </div>
                ) : displayedArticles.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 bg-amber-100 rounded-xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </div>
                    <p className="font-medium text-slate-700">필터에 매칭되는 기사가 없습니다</p>
                    <p className="text-sm text-slate-500 mt-1">다른 필터를 선택하거나 전체 보기를 사용하세요</p>
                    <button
                      onClick={() => setSelectedFilter({ type: 'all' })}
                      className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      전체 기사 보기 →
                    </button>
                  </div>
                ) : (
                  (showAllArticles ? displayedArticles : displayedArticles.slice(0, 15)).map((article, idx) => {
                    const isNoiseFiltered = (article.scoreBreakdown?.penalty ?? 0) < 0 || hasLocalNoiseKeyword(article.title)
                    return (
                      <div
                        key={article.id}
                        className={`px-5 py-4 transition-all duration-200 ${
                          dislikedArticles.has(article.id) ? 'opacity-40 bg-slate-50' :
                          isNoiseFiltered ? 'opacity-60 bg-amber-50/50' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex gap-3 items-start">
                          {/* Rank */}
                          <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            idx < 3 ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {idx + 1}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 leading-snug text-sm">
                              {article.link ? (
                                <a
                                  href={article.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-indigo-600 transition-colors"
                                >
                                  {article.title}
                                </a>
                              ) : (
                                article.title
                              )}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{article.source}</span>
                              <span className="text-xs text-slate-400">{article.time}</span>
                              {/* 매칭된 회사 표시 */}
                              {article.matchedCompany && (
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                  {article.matchedCompany}
                                </span>
                              )}
                              {/* 매칭된 키워드 표시 (최대 2개) */}
                              {article.matchedKeywords && article.matchedKeywords.slice(0, 2).map((kw, i) => (
                                <span key={i} className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                  #{kw}
                                </span>
                              ))}
                            </div>

                            {/* Score Breakdown */}
                            {article.scoreBreakdown && (
                              <div className="flex items-center gap-1.5 mt-2 text-xs">
                                {article.scoreBreakdown.company > 0 && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                                    회사 +{article.scoreBreakdown.company}
                                  </span>
                                )}
                                {article.scoreBreakdown.bonus > 0 && (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">
                                    키워드 +{article.scoreBreakdown.bonus}
                                  </span>
                                )}
                                {article.scoreBreakdown.penalty < 0 && (
                                  <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">
                                    노이즈 {article.scoreBreakdown.penalty}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {/* Relevance Score */}
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              article.relevance >= 90 ? 'bg-emerald-100 text-emerald-700' :
                              article.relevance >= 70 ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {article.relevance}점
                            </span>

                            {/* Like/Dislike buttons */}
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleLike(article.id)}
                                className={`p-1.5 rounded-lg transition-all duration-200 ${
                                  likedArticles.has(article.id)
                                    ? 'bg-emerald-100 text-emerald-600 shadow-sm'
                                    : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                                }`}
                                title="좋아요"
                              >
                                <svg className="w-4 h-4" fill={likedArticles.has(article.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDislike(article)}
                                className={`p-1.5 rounded-lg transition-all duration-200 ${
                                  dislikedArticles.has(article.id)
                                    ? 'bg-red-100 text-red-600 shadow-sm'
                                    : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                                }`}
                                title="싫어요 (노이즈 필터 추가)"
                              >
                                <svg className="w-4 h-4" fill={dislikedArticles.has(article.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {displayedArticles.length > 15 && (
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <button
                    onClick={() => setShowAllArticles(!showAllArticles)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {showAllArticles ? '접기' : `더 보기 (${displayedArticles.length - 15}개)`} →
                  </button>
                  {hideNoiseFiltered && articles.length !== displayedArticles.length && (
                    <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-md">
                      {articles.length - displayedArticles.length}개 필터링됨
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 빠른 실행 버튼들 */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all text-left group">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700 text-sm">뉴스 스크래핑</span>
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all text-left group"
              >
                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700 text-sm">프로필 설정</span>
              </button>
              <button className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all text-left group">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700 text-sm">브리핑 발송</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackModal.isOpen}
        onClose={() => setFeedbackModal({ isOpen: false, article: null })}
        article={feedbackModal.article || { title: '', source: '' }}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}
