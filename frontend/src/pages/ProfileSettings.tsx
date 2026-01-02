import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dataApi } from '../api/bkend'
import type { Profile, CompanyTier as APICompanyTier, KeywordGroup as APIKeywordGroup } from '../api/bkend'

// Local UI types (converted from API types)
interface CompanyTier {
  id: string
  tier: number
  name: string
  englishName?: string
  score: number
}

interface KeywordGroup {
  id: string
  label: string
  type: 'bonus' | 'penalty'
  keywords: string[]
  score: number
  enabled: boolean
}

interface ProfileData {
  _id?: string
  companyTiers: CompanyTier[]
  bonusGroups: KeywordGroup[]
  penaltyGroups: KeywordGroup[]
  searchQueries: string[]
  timeFilter: '24h' | '48h' | '1w'
}

// Convert API profile to local format
function apiToLocal(apiProfile: Profile): ProfileData {
  const companyTiers: CompanyTier[] = []
  apiProfile.company_tiers.forEach(tier => {
    tier.companies.forEach((company, idx) => {
      companyTiers.push({
        id: `${tier.tier}-${idx}-${Date.now()}`,
        tier: tier.tier,
        name: company.name,
        englishName: company.aliases?.[0],
        score: tier.score,
      })
    })
  })

  return {
    _id: apiProfile._id,
    companyTiers,
    bonusGroups: apiProfile.bonus_groups.map(g => ({
      id: g.id,
      label: g.label,
      type: 'bonus' as const,
      keywords: g.keywords,
      score: g.score,
      enabled: g.enabled,
    })),
    penaltyGroups: apiProfile.penalty_groups.map(g => ({
      id: g.id,
      label: g.label,
      type: 'penalty' as const,
      keywords: g.keywords,
      score: Math.abs(g.score) * -1,
      enabled: g.enabled,
    })),
    searchQueries: [
      ...apiProfile.search_queries.auto_generated,
      ...apiProfile.search_queries.user_added,
    ],
    timeFilter: apiProfile.filters.time_range,
  }
}

// Convert local format to API format
function localToApi(local: ProfileData): Partial<Profile> {
  const tierMap = new Map<number, { tier: number; label: string; score: number; companies: { name: string; ceo?: string; aliases?: string[]; keywords?: string[] }[] }>()

  TIER_LABELS.forEach((label, idx) => {
    tierMap.set(idx, { tier: idx, label, score: TIER_SCORES[idx], companies: [] })
  })

  local.companyTiers.forEach(c => {
    const tier = tierMap.get(c.tier)
    if (tier) {
      tier.companies.push({
        name: c.name,
        aliases: c.englishName ? [c.englishName] : [],
        keywords: [c.name, ...(c.englishName ? [c.englishName] : [])],
      })
    }
  })

  return {
    company_tiers: Array.from(tierMap.values()) as APICompanyTier[],
    bonus_groups: local.bonusGroups.map(g => ({
      id: g.id,
      label: g.label,
      score: g.score,
      enabled: g.enabled,
      keywords: g.keywords,
    })) as APIKeywordGroup[],
    penalty_groups: local.penaltyGroups.map(g => ({
      id: g.id,
      label: g.label,
      score: g.score,
      enabled: g.enabled,
      keywords: g.keywords,
    })) as APIKeywordGroup[],
    search_queries: {
      auto_generated: [],
      user_added: local.searchQueries,
      disabled: [],
    },
    filters: {
      time_range: local.timeFilter,
      sources: { google_news: true, naver_news: true },
      language: 'ko',
      dedupe_enabled: true,
      history_days: 7,
    },
  }
}

const TIER_LABELS = ['Tier 0 (자사)', 'Tier 1 (주요 경쟁사)', 'Tier 2 (일반 경쟁사)', 'Tier 3 (업계 기업)']
const TIER_SCORES = [100, 60, 40, 25]

export default function ProfileSettings() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'companies' | 'keywords' | 'queries' | 'settings'>('companies')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyTier, setNewCompanyTier] = useState(1)
  const [newQuery, setNewQuery] = useState('')
  const [editingKeywordGroup, setEditingKeywordGroup] = useState<string | null>(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [draggedCompany, setDraggedCompany] = useState<string | null>(null)
  const [showAddGroupModal, setShowAddGroupModal] = useState<'bonus' | 'penalty' | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupScore, setNewGroupScore] = useState(20)

  // Load profile on mount
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get profile ID from localStorage or fetch profiles
      let profileId = localStorage.getItem('current_profile_id')

      if (!profileId) {
        // Fetch all profiles and use the first one
        const profilesResult = await dataApi.getProfiles()
        if (profilesResult.success && profilesResult.data?.items?.length) {
          profileId = profilesResult.data.items[0]._id || null
          if (profileId) {
            localStorage.setItem('current_profile_id', profileId)
          }
        }
      }

      if (!profileId) {
        setError('프로필을 찾을 수 없습니다. 온보딩을 먼저 완료해주세요.')
        return
      }

      const result = await dataApi.getProfile(profileId)
      if (result.success && result.data) {
        setProfile(apiToLocal(result.data))
      } else {
        setError('프로필을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('프로필을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // Company management
  const addCompany = () => {
    if (!newCompanyName.trim() || !profile) return
    const newCompany: CompanyTier = {
      id: `company-${Date.now()}`,
      tier: newCompanyTier,
      name: newCompanyName.trim(),
      score: TIER_SCORES[newCompanyTier],
    }
    setProfile({
      ...profile,
      companyTiers: [...profile.companyTiers, newCompany],
    })
    setNewCompanyName('')
  }

  const removeCompany = (id: string) => {
    if (!profile) return
    setProfile({
      ...profile,
      companyTiers: profile.companyTiers.filter(c => c.id !== id),
    })
  }

  const updateCompanyTier = (id: string, newTier: number) => {
    if (!profile) return
    setProfile({
      ...profile,
      companyTiers: profile.companyTiers.map(c =>
        c.id === id ? { ...c, tier: newTier, score: TIER_SCORES[newTier] } : c
      ),
    })
  }

  // Drag and drop for companies
  const handleDragStart = (id: string) => {
    setDraggedCompany(id)
  }

  const handleDragOver = (e: React.DragEvent, _targetTier: number) => {
    e.preventDefault()
  }

  const handleDrop = (targetTier: number) => {
    if (draggedCompany) {
      updateCompanyTier(draggedCompany, targetTier)
      setDraggedCompany(null)
    }
  }

  // Keyword group management
  const toggleKeywordGroup = (groupId: string, type: 'bonus' | 'penalty') => {
    if (!profile) return
    const key = type === 'bonus' ? 'bonusGroups' : 'penaltyGroups'
    setProfile({
      ...profile,
      [key]: profile[key].map(g =>
        g.id === groupId ? { ...g, enabled: !g.enabled } : g
      ),
    })
  }

  const addKeywordToGroup = (groupId: string, type: 'bonus' | 'penalty') => {
    if (!newKeyword.trim() || !profile) return
    const key = type === 'bonus' ? 'bonusGroups' : 'penaltyGroups'
    setProfile({
      ...profile,
      [key]: profile[key].map(g =>
        g.id === groupId ? { ...g, keywords: [...g.keywords, newKeyword.trim()] } : g
      ),
    })
    setNewKeyword('')
  }

  const removeKeywordFromGroup = (groupId: string, keyword: string, type: 'bonus' | 'penalty') => {
    if (!profile) return
    const key = type === 'bonus' ? 'bonusGroups' : 'penaltyGroups'
    setProfile({
      ...profile,
      [key]: profile[key].map(g =>
        g.id === groupId ? { ...g, keywords: g.keywords.filter(k => k !== keyword) } : g
      ),
    })
  }

  // Add new keyword group
  const addNewKeywordGroup = () => {
    if (!newGroupName.trim() || !profile || !showAddGroupModal) return

    const newGroup: KeywordGroup = {
      id: `${showAddGroupModal}-${Date.now()}`,
      label: newGroupName.trim(),
      type: showAddGroupModal,
      keywords: [],
      score: showAddGroupModal === 'bonus' ? newGroupScore : -Math.abs(newGroupScore),
      enabled: true,
    }

    if (showAddGroupModal === 'bonus') {
      setProfile({
        ...profile,
        bonusGroups: [...profile.bonusGroups, newGroup],
      })
    } else {
      setProfile({
        ...profile,
        penaltyGroups: [...profile.penaltyGroups, newGroup],
      })
    }

    // Reset modal state
    setShowAddGroupModal(null)
    setNewGroupName('')
    setNewGroupScore(20)
  }

  // Delete keyword group
  const deleteKeywordGroup = (groupId: string, type: 'bonus' | 'penalty') => {
    if (!profile) return
    const key = type === 'bonus' ? 'bonusGroups' : 'penaltyGroups'
    setProfile({
      ...profile,
      [key]: profile[key].filter(g => g.id !== groupId),
    })
  }

  // Search queries
  const addSearchQuery = () => {
    if (!newQuery.trim() || !profile) return
    setProfile({
      ...profile,
      searchQueries: [...profile.searchQueries, newQuery.trim()],
    })
    setNewQuery('')
  }

  const removeSearchQuery = (query: string) => {
    if (!profile) return
    setProfile({
      ...profile,
      searchQueries: profile.searchQueries.filter(q => q !== query),
    })
  }

  // Save profile
  const handleSave = async () => {
    if (!profile || !profile._id) return

    setIsSaving(true)
    setError(null)

    try {
      const apiData = localToApi(profile)
      const result = await dataApi.updateProfile(profile._id, apiData)

      if (result.success) {
        console.log('Profile saved successfully:', result.data)
        navigate('/dashboard')
      } else {
        throw new Error('프로필 저장에 실패했습니다.')
      }
    } catch (err) {
      console.error('Error saving profile:', err)
      setError(err instanceof Error ? err.message : '프로필 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const companiesByTier = (tier: number) =>
    profile?.companyTiers.filter(c => c.tier === tier) || []

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">프로필을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-800 font-medium mb-2">오류가 발생했습니다</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/onboarding')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            온보딩으로 이동
          </button>
        </div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">프로필 설정</h1>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-sm text-red-600">{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isSaving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSaving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: 'companies', label: '회사/경쟁사' },
            { id: 'keywords', label: '키워드 그룹' },
            { id: 'queries', label: '검색 쿼리' },
            { id: 'settings', label: '기타 설정' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 font-medium text-sm border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Companies Tab */}
        {activeTab === 'companies' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">회사 추가</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="회사명 입력"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={newCompanyTier}
                  onChange={(e) => setNewCompanyTier(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Tier 0 (자사)</option>
                  <option value={1}>Tier 1 (주요 경쟁사)</option>
                  <option value={2}>Tier 2 (일반 경쟁사)</option>
                  <option value={3}>Tier 3 (업계 기업)</option>
                </select>
                <button
                  onClick={addCompany}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                드래그 앤 드롭으로 티어를 변경할 수 있습니다.
              </p>
            </div>

            {/* Tier Groups */}
            {[0, 1, 2, 3].map(tier => (
              <div
                key={tier}
                onDragOver={(e) => handleDragOver(e, tier)}
                onDrop={() => handleDrop(tier)}
                className={`bg-white rounded-xl shadow-sm border p-6 ${
                  draggedCompany ? 'ring-2 ring-blue-300 ring-dashed' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">{TIER_LABELS[tier]}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    tier === 0 ? 'bg-blue-100 text-blue-700' :
                    tier === 1 ? 'bg-purple-100 text-purple-700' :
                    tier === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    +{TIER_SCORES[tier]}점
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {companiesByTier(tier).length === 0 ? (
                    <p className="text-gray-400 text-sm py-2">회사를 드래그하여 추가하세요</p>
                  ) : (
                    companiesByTier(tier).map(company => (
                      <div
                        key={company.id}
                        draggable
                        onDragStart={() => handleDragStart(company.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-move hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                        <span className="font-medium">{company.name}</span>
                        {company.englishName && (
                          <span className="text-gray-400 text-sm">({company.englishName})</span>
                        )}
                        <button
                          onClick={() => removeCompany(company.id)}
                          className="ml-1 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Keywords Tab */}
        {activeTab === 'keywords' && (
          <div className="space-y-6">
            {/* Bonus Groups */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  보너스 키워드 그룹
                </h2>
                <button
                  onClick={() => setShowAddGroupModal('bonus')}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  새 그룹 추가
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                이 키워드가 포함된 기사는 추가 점수를 받습니다.
              </p>
              <div className="space-y-4">
                {profile.bonusGroups.map(group => (
                  <div
                    key={group.id}
                    className={`border rounded-lg p-4 transition-all ${
                      group.enabled ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleKeywordGroup(group.id, 'bonus')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            group.enabled ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              group.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="font-medium text-gray-900">{group.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 font-medium">+{group.score}점</span>
                        <button
                          onClick={() => deleteKeywordGroup(group.id, 'bonus')}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="그룹 삭제"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {group.keywords.map(keyword => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm border"
                        >
                          {keyword}
                          <button
                            onClick={() => removeKeywordFromGroup(group.id, keyword, 'bonus')}
                            className="text-gray-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    {editingKeywordGroup === group.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addKeywordToGroup(group.id, 'bonus')
                            }
                          }}
                          placeholder="키워드 입력"
                          className="flex-1 px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            addKeywordToGroup(group.id, 'bonus')
                            setEditingKeywordGroup(null)
                          }}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg"
                        >
                          추가
                        </button>
                        <button
                          onClick={() => setEditingKeywordGroup(null)}
                          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKeywordGroup(group.id)}
                        className="text-sm text-green-600 hover:text-green-700"
                      >
                        + 키워드 추가
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Penalty Groups */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  페널티 키워드 그룹 (노이즈 필터)
                </h2>
                <button
                  onClick={() => setShowAddGroupModal('penalty')}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  새 그룹 추가
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                이 키워드가 포함된 기사는 점수가 감점됩니다.
              </p>
              <div className="space-y-4">
                {profile.penaltyGroups.map(group => (
                  <div
                    key={group.id}
                    className={`border rounded-lg p-4 transition-all ${
                      group.enabled ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleKeywordGroup(group.id, 'penalty')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            group.enabled ? 'bg-red-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              group.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="font-medium text-gray-900">{group.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-red-600 font-medium">{group.score}점</span>
                        <button
                          onClick={() => deleteKeywordGroup(group.id, 'penalty')}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="그룹 삭제"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {group.keywords.length === 0 ? (
                        <span className="text-gray-400 text-sm">
                          아직 필터가 없습니다. 대시보드에서 '싫어요'를 눌러 추가하세요.
                        </span>
                      ) : (
                        group.keywords.map(keyword => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm border border-red-200"
                          >
                            -{keyword}
                            <button
                              onClick={() => removeKeywordFromGroup(group.id, keyword, 'penalty')}
                              className="text-gray-400 hover:text-red-500"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    {editingKeywordGroup === `penalty-${group.id}` ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addKeywordToGroup(group.id, 'penalty')
                            }
                          }}
                          placeholder="키워드 입력"
                          className="flex-1 px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            addKeywordToGroup(group.id, 'penalty')
                            setEditingKeywordGroup(null)
                          }}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg"
                        >
                          추가
                        </button>
                        <button
                          onClick={() => setEditingKeywordGroup(null)}
                          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingKeywordGroup(`penalty-${group.id}`)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        + 키워드 추가
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search Queries Tab */}
        {activeTab === 'queries' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">검색 쿼리</h2>
            <p className="text-sm text-gray-500 mb-4">
              Google/Naver 뉴스 검색에 사용될 쿼리입니다. 자동 생성된 쿼리 외에 직접 추가할 수 있습니다.
            </p>

            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSearchQuery()}
                placeholder='검색 쿼리 입력 (예: "네이버" AI 투자)'
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addSearchQuery}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>

            <div className="space-y-2">
              {profile.searchQueries.map((query, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-mono text-sm">{query}</span>
                  <button
                    onClick={() => removeSearchQuery(query)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">자동 생성 쿼리</h3>
              <p className="text-sm text-blue-700">
                회사명과 키워드를 기반으로 다음 쿼리가 자동 생성됩니다:
              </p>
              <ul className="mt-2 text-sm text-blue-600 space-y-1">
                <li>• 회사명 + "뉴스"</li>
                <li>• 회사명 + 관심 키워드</li>
                <li>• 경쟁사명 + 업계 동향</li>
              </ul>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">시간 필터</h2>
              <p className="text-sm text-gray-500 mb-4">
                얼마나 최근 기사까지 검색할지 설정합니다.
              </p>
              <div className="flex gap-3">
                {[
                  { value: '24h', label: '24시간' },
                  { value: '48h', label: '48시간' },
                  { value: '1w', label: '1주일' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => profile && setProfile({ ...profile, timeFilter: option.value as ProfileData['timeFilter'] })}
                    className={`px-6 py-3 rounded-lg border-2 font-medium transition-all ${
                      profile.timeFilter === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">점수 시스템 설명</h2>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">기사 점수 계산 방식</h3>
                  <p className="mb-2">
                    <code className="bg-gray-200 px-2 py-1 rounded">
                      점수 = 회사점수 + 보너스점수 + 페널티점수
                    </code>
                  </p>
                  <ul className="space-y-1">
                    <li>• <strong>회사점수</strong>: 기사에 언급된 회사의 티어 점수 합산</li>
                    <li>• <strong>보너스점수</strong>: 활성화된 보너스 키워드 매칭 점수</li>
                    <li>• <strong>페널티점수</strong>: 노이즈 필터 키워드 감점</li>
                  </ul>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">티어별 점수</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {TIER_LABELS.map((label, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{label}</span>
                        <span className="font-medium">+{TIER_SCORES[idx]}점</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add New Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {showAddGroupModal === 'bonus' ? '보너스' : '페널티'} 키워드 그룹 추가
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  그룹 이름
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="예: 투자/인수, 경영진 변경"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  점수 ({showAddGroupModal === 'bonus' ? '+' : '-'})
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={newGroupScore}
                    onChange={(e) => setNewGroupScore(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className={`w-16 text-center font-medium ${
                    showAddGroupModal === 'bonus' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {showAddGroupModal === 'bonus' ? '+' : '-'}{newGroupScore}점
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddGroupModal(null)
                  setNewGroupName('')
                  setNewGroupScore(20)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={addNewKeywordGroup}
                disabled={!newGroupName.trim()}
                className={`flex-1 px-4 py-2 rounded-lg text-white ${
                  showAddGroupModal === 'bonus'
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
                    : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                }`}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
