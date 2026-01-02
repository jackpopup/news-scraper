import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dataApi, createDefaultProfile } from '../api/bkend'

// Types
interface CompanyInfo {
  name: string
  ceo: string
  industry: string
  englishName: string
}

interface Keyword {
  id: string
  label: string
  selected: boolean
  isCustom?: boolean
}

interface Competitor {
  id: string
  name: string
  selected: boolean
  isCustom?: boolean
}

type Role = 'pr' | 'executive' | 'investor' | 'marketer' | 'other'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'pr', label: 'PR/홍보 담당자' },
  { value: 'executive', label: '대표/경영진' },
  { value: 'investor', label: '투자자/VC' },
  { value: 'marketer', label: '마케팅 담당자' },
  { value: 'other', label: '기타' },
]

// Mock AI recommendations (실제로는 API 호출)
const getAIKeywordRecommendations = (industry: string): Keyword[] => {
  const recommendations: Record<string, string[]> = {
    'IT/테크': ['AI', '클라우드', 'SaaS', '스타트업', '빅데이터'],
    '금융': ['핀테크', '디지털금융', '블록체인', '투자', 'IPO'],
    '제조': ['스마트팩토리', '자동화', '공급망', 'ESG', '탄소중립'],
    '유통/리테일': ['이커머스', 'D2C', '옴니채널', '물류', '라스트마일'],
    '숙박/여행': ['OTA', '호텔', '트래블테크', '인바운드', '관광'],
    '헬스케어': ['디지털헬스', '바이오', '원격의료', '제약', '임상'],
    '미디어/엔터': ['OTT', '콘텐츠', 'IP', '메타버스', '크리에이터'],
  }

  const keywords = recommendations[industry] || ['투자', 'M&A', '신규사업', '실적', '파트너십']
  return keywords.map((label, idx) => ({
    id: `rec-${idx}`,
    label,
    selected: true, // 기본 선택됨
  }))
}

const getAICompetitorRecommendations = (_companyName: string, industry: string): Competitor[] => {
  // 실제로는 AI가 회사명+업계 기반으로 추천
  const competitors: Record<string, string[]> = {
    'IT/테크': ['네이버', '카카오', '라인', '쿠팡', '토스'],
    '금융': ['신한금융', 'KB금융', '하나금융', '우리금융', '카카오뱅크'],
    '제조': ['삼성전자', 'LG전자', 'SK하이닉스', '현대자동차', '기아'],
    '유통/리테일': ['쿠팡', '네이버쇼핑', '신세계', '롯데', 'SSG'],
    '숙박/여행': ['여기어때', '야놀자', '에어비앤비', '부킹닷컴', '아고다'],
    '헬스케어': ['삼성바이오', '셀트리온', 'SK바이오팜', '한미약품', '녹십자'],
    '미디어/엔터': ['넷플릭스', '디즈니+', '웨이브', '티빙', 'CJ ENM'],
  }

  const list = competitors[industry] || ['경쟁사A', '경쟁사B', '경쟁사C']
  return list.slice(0, 4).map((name, idx) => ({
    id: `comp-${idx}`,
    name,
    selected: false, // 기본 미선택
  }))
}

const INDUSTRY_TREND_KEYWORDS: Record<string, string[]> = {
  'IT/테크': ['생성형AI', 'ChatGPT', '클라우드', '사이버보안', 'DevOps'],
  '금융': ['오픈뱅킹', 'CBDC', '마이데이터', '규제샌드박스', 'ESG금융'],
  '제조': ['스마트공장', '탄소중립', '공급망', '반도체', '전기차'],
  '유통/리테일': ['라이브커머스', '새벽배송', '무인점포', '구독경제', 'MZ세대'],
  '숙박/여행': ['워케이션', '호캉스', '로컬여행', '지속가능관광', 'K관광'],
  '헬스케어': ['원격의료', '정밀의료', '디지털치료제', '바이오시밀러', 'mRNA'],
  '미디어/엔터': ['K콘텐츠', '메타버스', 'NFT', '숏폼', 'AI창작'],
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Step 1: 기본 정보
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: '',
    ceo: '',
    industry: '',
    englishName: '',
  })
  const [role, setRole] = useState<Role | ''>('')
  const [isLoadingAI, setIsLoadingAI] = useState(false)

  // Step 2: 관심 키워드
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [customKeyword, setCustomKeyword] = useState('')

  // Step 3: 경쟁사
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [customCompetitor, setCustomCompetitor] = useState('')

  // Step 4: 업계 동향
  const [trendKeywords, setTrendKeywords] = useState<Keyword[]>([])
  const [customTrendKeyword, setCustomTrendKeyword] = useState('')

  // Step 5: 노이즈 필터
  const [noiseOption, setNoiseOption] = useState<'none' | 'basic'>('none')

  // AI 자동 완성 (Step 1)
  const handleCompanyNameBlur = async () => {
    if (companyInfo.name.length < 2) return

    setIsLoadingAI(true)
    // Mock AI response - 실제로는 API 호출
    await new Promise(resolve => setTimeout(resolve, 800))

    // 시뮬레이션: 회사명으로 정보 추론
    const mockData: Partial<CompanyInfo> = {
      ceo: companyInfo.name.includes('삼성') ? '이재용' :
           companyInfo.name.includes('네이버') ? '최수연' : '',
      industry: companyInfo.name.includes('전자') ? '제조' :
                companyInfo.name.includes('네이버') || companyInfo.name.includes('카카오') ? 'IT/테크' : '',
      englishName: companyInfo.name.includes('삼성') ? 'Samsung' :
                   companyInfo.name.includes('네이버') ? 'Naver' : '',
    }

    setCompanyInfo(prev => ({
      ...prev,
      ceo: prev.ceo || mockData.ceo || '',
      industry: prev.industry || mockData.industry || '',
      englishName: prev.englishName || mockData.englishName || '',
    }))
    setIsLoadingAI(false)
  }

  // Step 2로 넘어갈 때 AI 키워드 추천
  useEffect(() => {
    if (step === 2 && keywords.length === 0 && companyInfo.industry) {
      setKeywords(getAIKeywordRecommendations(companyInfo.industry))
    }
  }, [step, companyInfo.industry])

  // Step 3로 넘어갈 때 AI 경쟁사 추천
  useEffect(() => {
    if (step === 3 && competitors.length === 0 && companyInfo.name && companyInfo.industry) {
      setCompetitors(getAICompetitorRecommendations(companyInfo.name, companyInfo.industry))
    }
  }, [step, companyInfo.name, companyInfo.industry])

  // Step 4로 넘어갈 때 업계 동향 키워드
  useEffect(() => {
    if (step === 4 && trendKeywords.length === 0 && companyInfo.industry) {
      const trends = INDUSTRY_TREND_KEYWORDS[companyInfo.industry] || INDUSTRY_TREND_KEYWORDS['IT/테크']
      setTrendKeywords(trends.map((label, idx) => ({
        id: `trend-${idx}`,
        label,
        selected: idx < 3, // 상위 3개 기본 선택
      })))
    }
  }, [step, companyInfo.industry])

  // 키워드 토글
  const toggleKeyword = (id: string) => {
    setKeywords(prev => prev.map(k =>
      k.id === id ? { ...k, selected: !k.selected } : k
    ))
  }

  // 키워드 추가
  const addCustomKeyword = () => {
    if (!customKeyword.trim()) return
    setKeywords(prev => [...prev, {
      id: `custom-${Date.now()}`,
      label: customKeyword.trim(),
      selected: true,
      isCustom: true,
    }])
    setCustomKeyword('')
  }

  // 키워드 삭제
  const removeKeyword = (id: string) => {
    setKeywords(prev => prev.filter(k => k.id !== id))
  }

  // 경쟁사 토글
  const toggleCompetitor = (id: string) => {
    setCompetitors(prev => prev.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ))
  }

  // 경쟁사 추가
  const addCustomCompetitor = () => {
    if (!customCompetitor.trim()) return
    setCompetitors(prev => [...prev, {
      id: `custom-comp-${Date.now()}`,
      name: customCompetitor.trim(),
      selected: true,
      isCustom: true,
    }])
    setCustomCompetitor('')
  }

  // 경쟁사 삭제
  const removeCompetitor = (id: string) => {
    setCompetitors(prev => prev.filter(c => c.id !== id))
  }

  // 업계 동향 키워드 토글
  const toggleTrendKeyword = (id: string) => {
    setTrendKeywords(prev => prev.map(k =>
      k.id === id ? { ...k, selected: !k.selected } : k
    ))
  }

  // 업계 동향 키워드 추가
  const addCustomTrendKeyword = () => {
    if (!customTrendKeyword.trim()) return
    setTrendKeywords(prev => [...prev, {
      id: `custom-trend-${Date.now()}`,
      label: customTrendKeyword.trim(),
      selected: true,
      isCustom: true,
    }])
    setCustomTrendKeyword('')
  }

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 역할 매핑 (내부 값 → API 값)
  const roleMapping: Record<Role, string> = {
    'pr': 'PR담당자',
    'executive': '경영진',
    'investor': '투자자',
    'marketer': '마케터',
    'other': '기타',
  }

  // 완료 처리
  const handleComplete = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      // 프로필 데이터 생성
      const profileData = createDefaultProfile({
        companyName: companyInfo.name,
        companyCeo: companyInfo.ceo || undefined,
        industry: companyInfo.industry,
        role: roleMapping[role as Role] || '기타',
        keywords: keywords.filter(k => k.selected).map(k => k.label),
        competitors: competitors.filter(c => c.selected).map(c => c.name),
        industryKeywords: trendKeywords.filter(k => k.selected).map(k => k.label),
        noiseFilter: noiseOption,
      })

      console.log('Creating profile:', profileData)

      // bkend.ai에 프로필 저장
      const result = await dataApi.createProfile(profileData)

      if (result.success) {
        console.log('Profile created successfully:', result.data)
        // 프로필 ID를 localStorage에 저장 (대시보드에서 사용)
        if (result.data?._id) {
          localStorage.setItem('current_profile_id', result.data._id)
        }
        navigate('/dashboard')
      } else {
        throw new Error('프로필 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      setSaveError(error instanceof Error ? error.message : '프로필 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // Step validation
  const canProceed = () => {
    switch (step) {
      case 1:
        return companyInfo.name.trim().length >= 2 && companyInfo.industry && role
      case 2:
        return keywords.some(k => k.selected)
      case 3:
        return true // 경쟁사는 선택 사항
      case 4:
        return true // 업계 동향도 선택 사항
      case 5:
        return true // 노이즈 필터는 항상 진행 가능
      default:
        return false
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Progress Bar */}
        <div className="px-8 pt-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500">단계 {step}/5</span>
            <span className="text-sm text-gray-400">
              {step === 1 && '기본 정보'}
              {step === 2 && '관심 키워드'}
              {step === 3 && '경쟁사'}
              {step === 4 && '업계 동향'}
              {step === 5 && '노이즈 필터'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        <div className="p-8">
          {/* Step 1: 기본 정보 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">어떤 회사에서 일하세요?</h2>
                <p className="text-gray-500">회사 정보를 입력하면 맞춤형 뉴스를 추천해드려요.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    회사명 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={companyInfo.name}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, name: e.target.value }))}
                      onBlur={handleCompanyNameBlur}
                      placeholder="예: 삼성전자, 네이버"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {isLoadingAI && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">입력하시면 AI가 관련 정보를 자동으로 채워드려요</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">대표자명</label>
                    <input
                      type="text"
                      value={companyInfo.ceo}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, ceo: e.target.value }))}
                      placeholder="자동 입력"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">영문 회사명</label>
                    <input
                      type="text"
                      value={companyInfo.englishName}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, englishName: e.target.value }))}
                      placeholder="자동 입력"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    업종 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={companyInfo.industry}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">업종을 선택하세요</option>
                    <option value="IT/테크">IT/테크</option>
                    <option value="금융">금융</option>
                    <option value="제조">제조</option>
                    <option value="유통/리테일">유통/리테일</option>
                    <option value="숙박/여행">숙박/여행</option>
                    <option value="헬스케어">헬스케어</option>
                    <option value="미디어/엔터">미디어/엔터테인먼트</option>
                    <option value="기타">기타</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    직무 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setRole(option.value)}
                        className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          role === option.value
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 관심 키워드 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">관심 키워드를 선택하세요</h2>
                <p className="text-gray-500">AI가 업종에 맞는 키워드를 추천했어요. 필요 없는 건 삭제하고, 추가하고 싶은 키워드를 입력하세요.</p>
              </div>

              <div className="space-y-4">
                {/* AI 추천 키워드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI 추천 키워드
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword) => (
                      <div
                        key={keyword.id}
                        className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                          keyword.selected
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                            : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                        }`}
                        onClick={() => toggleKeyword(keyword.id)}
                      >
                        <span>{keyword.label}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeKeyword(keyword.id)
                          }}
                          className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200 text-blue-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 직접 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    직접 추가
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customKeyword}
                      onChange={(e) => setCustomKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomKeyword()}
                      placeholder="키워드 입력 후 Enter"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={addCustomKeyword}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      추가
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Tip:</span> 키워드는 언제든 '프로필 설정'에서 수정할 수 있어요.
                    매일 결과를 보며 조금씩 조정하는 게 가장 좋아요!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 경쟁사 */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">경쟁사를 추가하세요</h2>
                <p className="text-gray-500">모니터링하고 싶은 경쟁사를 선택하거나 직접 입력하세요.</p>
              </div>

              <div className="space-y-4">
                {/* AI 추천 경쟁사 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {companyInfo.industry} 업계 주요 기업
                  </label>
                  <div className="space-y-2">
                    {competitors.map((comp) => (
                      <div
                        key={comp.id}
                        onClick={() => toggleCompetitor(comp.id)}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          comp.selected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`font-medium ${comp.selected ? 'text-blue-700' : 'text-gray-700'}`}>
                          {comp.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {comp.isCustom && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeCompetitor(comp.id)
                              }}
                              className="text-gray-400 hover:text-red-500"
                            >
                              삭제
                            </button>
                          )}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            comp.selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {comp.selected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 직접 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    경쟁사 직접 추가
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customCompetitor}
                      onChange={(e) => setCustomCompetitor(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomCompetitor()}
                      placeholder="회사명 입력"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={addCustomCompetitor}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      추가
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    선택하지 않아도 다음 단계로 넘어갈 수 있어요. 나중에 프로필 설정에서 추가할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 업계 동향 */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">업계 동향 키워드</h2>
                <p className="text-gray-500">관심 있는 업계 트렌드 키워드를 선택하세요.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {companyInfo.industry} 업계 트렌드
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {trendKeywords.map((keyword) => (
                      <button
                        key={keyword.id}
                        onClick={() => toggleTrendKeyword(keyword.id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          keyword.selected
                            ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                            : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {keyword.label}
                        {keyword.selected && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 직접 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    직접 추가
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customTrendKeyword}
                      onChange={(e) => setCustomTrendKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCustomTrendKeyword()}
                      placeholder="트렌드 키워드 입력"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={addCustomTrendKeyword}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: 노이즈 필터 */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">노이즈 필터 설정</h2>
                <p className="text-gray-500">광고성 기사나 관련 없는 기사를 자동으로 필터링할 수 있어요.</p>
              </div>

              <div className="space-y-4">
                <div
                  onClick={() => setNoiseOption('none')}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                    noiseOption === 'none'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      noiseOption === 'none' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {noiseOption === 'none' && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">지금은 설정 안 함 (권장)</h3>
                      <p className="text-sm text-gray-500">
                        먼저 결과를 확인하고, 불필요한 기사가 나오면 '싫어요' 버튼으로 노이즈 필터를 추가하세요.
                        이 방법이 더 정확한 필터링을 만들어요.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setNoiseOption('basic')}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                    noiseOption === 'basic'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      noiseOption === 'basic' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {noiseOption === 'basic' && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">기본 필터 적용</h3>
                      <p className="text-sm text-gray-500 mb-3">
                        광고, 이벤트, 할인, 쿠폰 등 일반적인 홍보성 기사를 필터링합니다.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['광고', '이벤트', '할인', '쿠폰', '프로모션'].map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium"
                          >
                            -{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Tip:</span> 대시보드에서 기사에 '싫어요'를 누르면 "왜 별로인가요?" 팝업이 나와요.
                    거기서 선택한 키워드가 자동으로 노이즈 필터에 추가됩니다.
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-800">{saveError}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8 flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              이전
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className={`px-8 py-3 rounded-lg font-medium transition-all ${
                canProceed()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              다음
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isSaving}
              className={`px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                isSaving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isSaving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isSaving ? '저장 중...' : '시작하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
