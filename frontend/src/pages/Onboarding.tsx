import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [companyName, setCompanyName] = useState('')

  const handleComplete = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-lg w-full p-8 bg-white rounded-lg shadow-md">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500">단계 {step}/5</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-4">어떤 회사에서 일하세요?</h2>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="회사명을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {step > 1 && step < 5 && (
          <div>
            <h2 className="text-xl font-bold mb-4">온보딩 {step}단계</h2>
            <p className="text-gray-600">추가 설정이 여기에 표시됩니다.</p>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-xl font-bold mb-4">설정 완료!</h2>
            <p className="text-gray-600">모든 설정이 완료되었습니다.</p>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              이전
            </button>
          )}
          <div className="ml-auto">
            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                다음
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                시작하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
