import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/bkend'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; passwordConfirm?: string; general?: string }>({})
  const [loading, setLoading] = useState(false)

  const validatePassword = (pwd: string) => {
    const hasMinLength = pwd.length >= 8
    const hasUpperCase = /[A-Z]/.test(pwd)
    const hasLowerCase = /[a-z]/.test(pwd)
    const hasNumber = /[0-9]/.test(pwd)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)

    return {
      isValid: hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar,
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
    }
  }

  const validate = () => {
    const newErrors: typeof errors = {}

    if (!name.trim()) {
      newErrors.name = '이름을 입력해주세요'
    }

    if (!email) {
      newErrors.email = '이메일을 입력해주세요'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다'
    }

    if (!password) {
      newErrors.password = '비밀번호를 입력해주세요'
    } else {
      const pwdValidation = validatePassword(password)
      if (!pwdValidation.isValid) {
        newErrors.password = '비밀번호 조건을 충족해주세요'
      }
    }

    if (password !== passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setErrors({})
    setLoading(true)

    try {
      const result = await authApi.signup(email, password, name)
      if (result.success) {
        navigate('/onboarding')
      } else {
        setErrors({ general: result.error || '회원가입에 실패했습니다' })
      }
    } catch {
      setErrors({ general: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' })
    } finally {
      setLoading(false)
    }
  }

  const pwdValidation = validatePassword(password)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">News Curator</h1>
          <p className="text-gray-500 mt-2">PR 담당자를 위한 맞춤형 뉴스 큐레이션</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">회원가입</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="이름"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />

            <Input
              type="email"
              label="이메일"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />

            <div>
              <Input
                type="password"
                label="비밀번호"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
              {password && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500 mb-1">비밀번호 조건:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className={pwdValidation.hasMinLength ? 'text-green-600' : 'text-gray-400'}>
                      {pwdValidation.hasMinLength ? '✓' : '○'} 8자 이상
                    </span>
                    <span className={pwdValidation.hasUpperCase ? 'text-green-600' : 'text-gray-400'}>
                      {pwdValidation.hasUpperCase ? '✓' : '○'} 대문자 포함
                    </span>
                    <span className={pwdValidation.hasLowerCase ? 'text-green-600' : 'text-gray-400'}>
                      {pwdValidation.hasLowerCase ? '✓' : '○'} 소문자 포함
                    </span>
                    <span className={pwdValidation.hasNumber ? 'text-green-600' : 'text-gray-400'}>
                      {pwdValidation.hasNumber ? '✓' : '○'} 숫자 포함
                    </span>
                    <span className={pwdValidation.hasSpecialChar ? 'text-green-600' : 'text-gray-400'}>
                      {pwdValidation.hasSpecialChar ? '✓' : '○'} 특수문자 포함
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Input
              type="password"
              label="비밀번호 확인"
              placeholder="비밀번호를 다시 입력하세요"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              error={errors.passwordConfirm}
            />

            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            <Button type="submit" loading={loading}>
              회원가입
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-blue-600 font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-8">
          © 2024 News Curator. All rights reserved.
        </p>
      </div>
    </div>
  )
}
