import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, dataApi } from '../api/bkend'
import type { Profile, Article as APIArticle } from '../api/bkend'
import FeedbackModal from '../components/FeedbackModal'

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
  const [totalArticles, setTotalArticles] = useState(0)
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

  // 노이즈 필터링된 기사 제외한 표시용 기사 목록
  const displayedArticles = articles.filter(article => {
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
          setProfile(firstProfile)
        }
      } else {
        const profileResult = await dataApi.getProfile(profileId)
        console.log('Profile result:', profileResult)
        if (profileResult.success && profileResult.data) {
          setProfile(profileResult.data)
        }
      }

      // Fetch articles - always try to load even if API fails
      console.log('Loading articles with profileId:', profileId)
      await loadArticles(profileId || 'default')
    } catch (error) {
      console.error('Failed to load data:', error)
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
        setTotalArticles(result.data.total || result.data.items.length)
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

  const loadArticlesFromLocal = async (_profileId: string) => {
    try {
      console.log('Fetching /data/articles.json...')
      const response = await fetch('/data/articles.json')
      console.log('Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Local data loaded:', data.total_articles, 'articles')
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
            scoreBreakdown: {
              company: a.company_score || 0,
              bonus: a.bonus_score || 0,
              penalty: a.penalty_score || 0,
            },
          }))
          console.log('Setting articles:', localArticles.length)
          setArticles(localArticles)
          setTotalArticles(data.total_articles || localArticles.length)
        }
      }
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
    totalArticles: articles.length,  // 전체 수집된 기사
    displayedArticles: displayedArticles.length,  // 필터 적용 후 표시되는 기사
    matchedKeywords: (profile?.search_queries?.user_added?.length || 0) + (profile?.search_queries?.auto_generated?.length || 0),
    noiseFiltered: noiseFilteredCount,
    localNoiseKeywords: localNoiseKeywords.length,  // 로컬 노이즈 키워드 수
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

  // Get profile summary for sidebar
  const getProfileSummary = () => {
    if (!profile) return { companies: '설정 필요', keywords: '설정 필요' }

    const companies = profile.company_tiers
      .flatMap(t => t.companies)
      .slice(0, 3)
      .map(c => c.name)
      .join(', ')

    const keywords = profile.bonus_groups
      .filter(g => g.enabled)
      .slice(0, 2)
      .map(g => g.label)
      .join(', ')

    return {
      companies: companies || '설정 필요',
      keywords: keywords || '설정 필요',
    }
  }

  const profileSummary = getProfileSummary()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">News Curator</h1>
          </div>
          <div className="flex items-center gap-4">
            {!loading && user && (
              <span className="text-gray-600">{user.name}님</span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            {loading ? '로딩 중...' : `안녕하세요, ${user?.name || '사용자'}님!`}
          </h2>
          <p className="text-gray-500 mt-1">오늘의 뉴스 브리핑을 확인하세요.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">전체 기사</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalArticles}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">표시 기사</p>
                <p className="text-2xl font-bold text-green-600">{stats.displayedArticles}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">키워드 매칭</p>
                <p className="text-2xl font-bold text-purple-600">{stats.matchedKeywords}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">노이즈 필터</p>
                <p className="text-2xl font-bold text-orange-600">{stats.noiseFiltered}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Top Articles */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">오늘의 주요 기사</h3>
              <span className="text-sm text-gray-500">점수 순 정렬</span>
            </div>
            <div className="divide-y">
              {articles.length === 0 && !articlesLoading ? (
                <div className="p-12 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <p className="font-medium">아직 수집된 기사가 없습니다</p>
                  <p className="text-sm mt-1">뉴스 스크래핑을 실행해보세요</p>
                </div>
              ) : articlesLoading ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">기사를 불러오는 중...</p>
                </div>
              ) : (showAllArticles ? articles : displayedArticles.slice(0, 10)).map((article, idx) => {
                const isNoiseFiltered = (article.scoreBreakdown?.penalty ?? 0) < 0 || hasLocalNoiseKeyword(article.title)
                return (
                <div
                  key={article.id}
                  className={`p-6 transition-colors ${
                    dislikedArticles.has(article.id) ? 'opacity-40 bg-gray-50' :
                    isNoiseFiltered ? 'opacity-60 bg-yellow-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-500">
                      {idx + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {article.link ? (
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline"
                          >
                            {article.title}
                          </a>
                        ) : (
                          article.title
                        )}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                        <span>{article.source}</span>
                        <span>·</span>
                        <span>{article.time}</span>
                      </div>

                      {/* Score Breakdown */}
                      {article.scoreBreakdown && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">점수:</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                            회사 +{article.scoreBreakdown.company}
                          </span>
                          <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded">
                            보너스 +{article.scoreBreakdown.bonus}
                          </span>
                          {article.scoreBreakdown.penalty < 0 && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded">
                              페널티 {article.scoreBreakdown.penalty}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-start gap-2">
                      {/* Relevance Score */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        article.relevance >= 90 ? 'bg-green-100 text-green-800' :
                        article.relevance >= 70 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {article.relevance}점
                      </span>

                      {/* Like/Dislike buttons */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleLike(article.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            likedArticles.has(article.id)
                              ? 'bg-green-100 text-green-600'
                              : 'hover:bg-gray-100 text-gray-400'
                          }`}
                          title="좋아요"
                        >
                          <svg className="w-5 h-5" fill={likedArticles.has(article.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDislike(article)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            dislikedArticles.has(article.id)
                              ? 'bg-red-100 text-red-600'
                              : 'hover:bg-gray-100 text-gray-400'
                          }`}
                          title="싫어요 (노이즈 필터 추가)"
                        >
                          <svg className="w-5 h-5" fill={dislikedArticles.has(article.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )})}

            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
              <button
                onClick={() => setShowAllArticles(!showAllArticles)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {showAllArticles ? '접기' : `모든 기사 보기 (${articles.length}개)`} →
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideNoiseFiltered}
                  onChange={(e) => setHideNoiseFiltered(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                노이즈 필터 적용
                {hideNoiseFiltered && articles.length !== displayedArticles.length && (
                  <span className="text-xs text-gray-400">
                    ({articles.length - displayedArticles.length}개 숨김)
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">빠른 실행</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">뉴스 스크래핑 실행</span>
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">프로필 설정</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">브리핑 발송</span>
                </button>
              </div>
            </div>

            {/* Profile Summary */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-sm p-6 text-white">
              <h3 className="font-semibold mb-3">
                {profile?.name || '내 모니터링 프로필'}
              </h3>
              <div className="space-y-2 text-sm text-blue-100">
                <p>• 관심 기업: {profileSummary.companies}</p>
                <p>• 키워드 그룹: {profileSummary.keywords}</p>
                <p>• 시간 필터: {profile?.filters?.time_range === '24h' ? '24시간' : profile?.filters?.time_range === '48h' ? '48시간' : '1주일'}</p>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                프로필 설정하기
              </button>
            </div>

            {/* Feedback Stats */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">피드백 통계</h3>
              <div className="flex justify-between text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{likedArticles.size}</p>
                  <p className="text-gray-500">좋아요</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{dislikedArticles.size}</p>
                  <p className="text-gray-500">싫어요</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{localNoiseKeywords.length}</p>
                  <p className="text-gray-500">노이즈 키워드</p>
                </div>
              </div>
              {localNoiseKeywords.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">노이즈 키워드:</p>
                  <div className="flex flex-wrap gap-1">
                    {localNoiseKeywords.map(kw => (
                      <span key={kw} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                        -{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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
