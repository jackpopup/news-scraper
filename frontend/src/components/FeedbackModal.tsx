import { useState } from 'react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  article: {
    title: string
    source: string
  }
  onSubmit: (keywords: string[]) => void
}

// 기사 제목에서 키워드 추출 (Mock - 실제로는 NLP 처리)
const extractKeywords = (title: string): string[] => {
  // 간단한 키워드 추출 로직
  const commonWords = ['의', '이', '가', '을', '를', '은', '는', '에', '에서', '으로', '로', '와', '과', '도', '만', '등']
  const words = title.split(/[\s,."'·…]+/)
    .filter(word => word.length >= 2 && !commonWords.includes(word))
    .slice(0, 6)

  return words
}

export default function FeedbackModal({ isOpen, onClose, article, onSubmit }: FeedbackModalProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [customKeyword, setCustomKeyword] = useState('')
  const [step, setStep] = useState<'reason' | 'keywords'>('reason')

  const extractedKeywords = extractKeywords(article.title)

  const REASONS = [
    { id: 'irrelevant', label: '관련 없는 기사', icon: '🎯' },
    { id: 'ad', label: '광고/홍보성', icon: '📢' },
    { id: 'duplicate', label: '이미 본 내용', icon: '🔄' },
    { id: 'low_quality', label: '품질이 낮음', icon: '👎' },
    { id: 'other', label: '기타', icon: '💬' },
  ]

  const handleReasonSelect = (reasonId: string) => {
    if (reasonId === 'ad' || reasonId === 'irrelevant') {
      setStep('keywords')
    } else {
      // 바로 제출
      onSubmit([])
      handleClose()
    }
  }

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev =>
      prev.includes(keyword)
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    )
  }

  const addCustomKeyword = () => {
    if (customKeyword.trim() && !selectedKeywords.includes(customKeyword.trim())) {
      setSelectedKeywords(prev => [...prev, customKeyword.trim()])
      setCustomKeyword('')
    }
  }

  const handleSubmit = () => {
    onSubmit(selectedKeywords)
    handleClose()
  }

  const handleClose = () => {
    setSelectedKeywords([])
    setCustomKeyword('')
    setStep('reason')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {step === 'reason' ? '왜 별로인가요?' : '노이즈 필터에 추가'}
              </h2>
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                {article.title}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'reason' && (
            <div className="space-y-3">
              {REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleReasonSelect(r.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                >
                  <span className="text-2xl">{r.icon}</span>
                  <span className="font-medium text-gray-700">{r.label}</span>
                </button>
              ))}
            </div>
          )}

          {step === 'keywords' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  어떤 키워드 때문에 이 기사가 나왔나요? 선택한 키워드는 앞으로 자동 필터링됩니다.
                </p>

                {/* Extracted keywords */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {extractedKeywords.map(keyword => (
                    <button
                      key={keyword}
                      onClick={() => toggleKeyword(keyword)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selectedKeywords.includes(keyword)
                          ? 'bg-red-100 text-red-700 border-2 border-red-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {selectedKeywords.includes(keyword) && '- '}
                      {keyword}
                    </button>
                  ))}
                </div>

                {/* Custom keyword input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomKeyword()}
                    placeholder="직접 입력"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addCustomKeyword}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                  >
                    추가
                  </button>
                </div>

                {/* Selected keywords preview */}
                {selectedKeywords.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600 font-medium mb-2">노이즈 필터에 추가될 키워드:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedKeywords.map(keyword => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                        >
                          -{keyword}
                          <button
                            onClick={() => toggleKeyword(keyword)}
                            className="hover:text-red-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'keywords' && (
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
            <button
              onClick={() => setStep('reason')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedKeywords.length === 0}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                selectedKeywords.length > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {selectedKeywords.length > 0
                ? `${selectedKeywords.length}개 필터 추가`
                : '키워드를 선택하세요'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
