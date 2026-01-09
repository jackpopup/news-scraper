import { useState } from 'react'
import type { Profile } from '../api/bkend'

interface KeywordSidebarProps {
  profile: Profile | null
  selectedFilter: {
    type: 'all' | 'keyword_group' | 'company_tier'
    id?: string
  }
  onFilterChange: (filter: { type: 'all' | 'keyword_group' | 'company_tier'; id?: string }) => void
  onNavigateSettings: () => void
}

export default function KeywordSidebar({
  profile,
  selectedFilter,
  onFilterChange,
  onNavigateSettings,
}: KeywordSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['keywords', 'companies'])
  )

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // 모든 키워드 그룹 (보너스 + 페널티)
  const bonusGroups = profile?.bonus_groups?.filter((g) => g.enabled) || []
  const penaltyGroups = profile?.penalty_groups?.filter((g) => g.enabled) || []

  // 회사 티어
  const companyTiers = profile?.company_tiers || []

  // 총 키워드 수 계산
  const totalKeywords = bonusGroups.reduce((sum, g) => sum + (g.keywords?.length || 0), 0)
  const totalCompanies = companyTiers.reduce((sum, t) => sum + (t.companies?.length || 0), 0)

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-full overflow-y-auto">
      {/* 프로필 헤더 */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">
            {profile?.name || '내 프로필'}
          </h2>
          <button
            onClick={onNavigateSettings}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="프로필 설정"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {profile?.filters?.time_range === '24h'
            ? '최근 24시간'
            : profile?.filters?.time_range === '48h'
            ? '최근 48시간'
            : '최근 1주일'}{' '}
          기사
        </p>
      </div>

      {/* 전체 보기 */}
      <div className="p-2">
        <button
          onClick={() => onFilterChange({ type: 'all' })}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
            selectedFilter.type === 'all'
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <span className="text-sm">오늘의 탑뉴스</span>
        </button>
      </div>

      {/* 키워드 그룹 섹션 */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => toggleSection('keywords')}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              키워드 그룹
            </span>
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {bonusGroups.length}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${
              expandedSections.has('keywords') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('keywords') && (
          <div className="px-2 pb-2">
            {bonusGroups.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-slate-400">키워드 그룹이 없습니다</p>
                <button
                  onClick={onNavigateSettings}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + 키워드 추가
                </button>
              </div>
            ) : (
              bonusGroups.map((group) => (
                <div key={group.id} className="mb-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                      selectedFilter.type === 'keyword_group' && selectedFilter.id === group.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <svg
                      className={`w-3 h-3 text-slate-400 transition-transform ${
                        expandedGroups.has(group.id) ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <svg
                      className="w-4 h-4 text-indigo-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    <span className="text-sm flex-1 truncate">{group.label}</span>
                    <span className="text-xs text-slate-400">+{group.score}</span>
                  </button>

                  {/* 키워드 목록 (펼쳐졌을 때) */}
                  {expandedGroups.has(group.id) && group.keywords && group.keywords.length > 0 && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {group.keywords.map((keyword, idx) => (
                        <button
                          key={idx}
                          onClick={() => onFilterChange({ type: 'keyword_group', id: group.id })}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                        >
                          <span className="text-slate-300">#</span>
                          <span className="truncate">{keyword}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 회사/경쟁사 섹션 */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => toggleSection('companies')}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              회사/경쟁사
            </span>
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {totalCompanies}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${
              expandedSections.has('companies') ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections.has('companies') && (
          <div className="px-2 pb-2">
            {companyTiers.length === 0 ||
            companyTiers.every((t) => !t.companies || t.companies.length === 0) ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-slate-400">등록된 회사가 없습니다</p>
                <button
                  onClick={onNavigateSettings}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + 회사 추가
                </button>
              </div>
            ) : (
              companyTiers.map((tier) => {
                if (!tier.companies || tier.companies.length === 0) return null
                const tierColors = [
                  'text-amber-500', // Tier 0 - 우리 회사
                  'text-blue-500', // Tier 1
                  'text-slate-500', // Tier 2
                  'text-slate-400', // Tier 3
                ]
                return (
                  <div key={tier.tier} className="mb-2">
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <svg
                        className={`w-4 h-4 ${tierColors[tier.tier] || 'text-slate-400'}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs font-medium text-slate-500">{tier.label}</span>
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        +{tier.score}
                      </span>
                    </div>
                    <div className="ml-2 space-y-0.5">
                      {tier.companies.map((company, idx) => (
                        <button
                          key={idx}
                          onClick={() =>
                            onFilterChange({ type: 'company_tier', id: `${tier.tier}-${company.name}` })
                          }
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm rounded transition-colors ${
                            selectedFilter.type === 'company_tier' &&
                            selectedFilter.id === `${tier.tier}-${company.name}`
                              ? 'bg-indigo-50 text-indigo-700 font-medium'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{company.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* 노이즈 필터 섹션 */}
      {penaltyGroups.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => toggleSection('noise')}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                노이즈 필터
              </span>
              <span className="text-xs text-red-400 bg-red-50 px-1.5 py-0.5 rounded">
                {penaltyGroups.length}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${
                expandedSections.has('noise') ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSections.has('noise') && (
            <div className="px-2 pb-2">
              {penaltyGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <span className="truncate">{group.label}</span>
                  <span className="text-xs text-red-400">{group.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 프로필 요약 (하단) */}
      <div className="border-t border-slate-100 p-4 mt-auto">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>프로필 요약</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">키워드</span>
              <span className="text-slate-600 font-medium">{totalKeywords}개</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">회사</span>
              <span className="text-slate-600 font-medium">{totalCompanies}개</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">기간</span>
              <span className="text-slate-600 font-medium">
                {profile?.filters?.time_range || '24h'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
