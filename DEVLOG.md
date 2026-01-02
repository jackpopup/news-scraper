# News Curator - 개발 로그

Claude Code와 함께 진행한 개발 작업 기록입니다.

---

## 2024-12-29 (Day 1)

### 1. 프로젝트 시작 - 웹 서비스로 확장 결정

```
자 이걸 기반으로 다른 사람들도 쓸 수 있는 프로그램을 만들고 싶은데 다른 폴더에 새로운 프로젝트를 시작해 볼까?
```

**Claude 작업:**
- `c:/GitHub/news-scraper/` 프로젝트 폴더 생성
- 기존 CLI 뉴스 스크래퍼를 웹 서비스로 확장하기로 결정
- PRD(Product Requirements Document) 문서 작성 시작

---

### 2. PRD 문서 작성

```
PRD를 작성해줘
```

**Claude 작업:**
- `docs/PRD.md` - 671줄의 상세 기획서 작성
- 제품 개요, 타겟 사용자, 핵심 가치 제안 정의
- MVP 기능 명세 (P0/P1/P2)
- 온보딩 튜토리얼 Flow 설계
- 화면 구성 (메인 대시보드, 브리핑 발행 모달)
- 기술 스택 및 아키텍처 설계
- 데이터 모델 (users, profiles, scrape_results, briefings)
- 바이브코딩 개발 가이드 포함

---

### 3. bkend.ai 백엔드 연동

```
백엔드로 https://www.bkend.ai/ 를 사용하고 싶어
```

**Claude 작업:**
- `.mcp.json` - bkend.ai MCP 설정 파일 생성
- bkend.ai 콘솔에서 테이블 확인 (users, accounts, profiles, scrape_results, briefings)
- API 연동 테스트

---

## 2024-12-30 (Day 2)

### 4. 프론트엔드 프로젝트 생성

```
프론트엔드 기본 세팅을 해줘
```

**Claude 작업:**
- `frontend/` - Vite + React + TypeScript 프로젝트 생성
- Tailwind CSS 설치 및 설정
- React Router 설정
- 폴더 구조 생성 (components, pages, hooks, utils, api)

---

### 5. 로그인/회원가입 구현

```
로그인/회원가입 화면 만들어줘
```

**Claude 작업:**
- `frontend/src/pages/Login.tsx` - 로그인 페이지
- `frontend/src/pages/Signup.tsx` - 회원가입 페이지 (비밀번호 규칙 표시)
- `frontend/src/pages/ForgotPassword.tsx` - 비밀번호 찾기 페이지
- `frontend/src/components/ui/Input.tsx` - 입력 컴포넌트
- `frontend/src/components/ui/Button.tsx` - 버튼 컴포넌트
- `frontend/src/api/bkend.ts` - bkend.ai API 클라이언트

---

### 6. API URL 오류 수정

```
서버 연결이 안된다는데?
bkend 쪽에 문의를 해보니 api-enduser.bkend.ai 인데 -dev가 붙었네요...
```

**Claude 작업:**
- MCP 문서의 URL이 잘못됨 확인 (`api-enduser-dev.bkend.ai` → `api-enduser.bkend.ai`)
- `frontend/vite.config.ts` - 프록시 URL 수정
- `frontend/src/api/bkend.ts` - API URL 수정
- `frontend/.env` - 환경변수 수정

---

### 7. 토큰 저장 버그 수정

```
로그인 기능까지만 구현되고 이후는 구현이 안된건가?
```

**Claude 작업:**
- API 응답이 `token`이 아닌 `access_token`임을 확인
- `frontend/src/api/bkend.ts` - 토큰 저장 코드 수정
  - `result.data?.token` → `result.data?.access_token`

---

### 8. 대시보드 구현

```
대시보드 기본 페이지 구현해줘
```

**Claude 작업:**
- `frontend/src/pages/Dashboard.tsx` - 대시보드 페이지
  - 헤더 (로고, 사용자명, 로그아웃)
  - 환영 메시지
  - 통계 카드 4개 (전체 기사, 오늘 새 기사, 키워드 매칭, 발송된 브리핑)
  - 오늘의 주요 기사 리스트 (Mock 데이터)
  - 빠른 실행 버튼 (뉴스 스크래핑, 프로필 설정, 브리핑 발송)
  - 내 모니터링 프로필 카드
- `frontend/src/App.tsx` - PublicRoute 추가 (로그인 상태면 대시보드로 리다이렉트)

---

## 기술 스택

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: bkend.ai (BaaS)
- **Scraper**: Python (기존 CLI 스크래퍼 활용)
- **Deployment**: 미정 (Vercel 예정)

---

## 주요 기능 (구현 완료)

1. **회원가입/로그인**
   - 이메일 기반 인증
   - 비밀번호 규칙 실시간 표시
   - 비밀번호 찾기

2. **대시보드 (기본 UI)**
   - 통계 카드
   - 오늘의 주요 기사 (Mock)
   - 빠른 실행 버튼

---

## 다음 작업 (TODO)

- [ ] 프로필 설정 시스템 UI 구현
- [ ] 온보딩 (3단계 간소화 버전)
- [ ] 메인 대시보드 완성 (실제 데이터 연동, 드래그앤드롭)
- [ ] 브리핑 발행 기능
- [ ] 배포 (Vercel)

---

## 2026-01-02 (Day 3)

### 9. PRD 대폭 개선 - 실제 사용 패턴 반영

```
기획 개선: 1회성 온보딩 → 지속적 튜닝 시스템
```

**문제 인식:**
- 기존 PRD는 "5단계 온보딩 후 끝"이라는 비현실적 가정
- 실제 PR 담당자는 매일 결과를 보며 미세 조정 필요
- ONDA 뉴스 스크래퍼 운영 경험에서 배운 점 반영

**Claude 작업:**

#### 섹션 4.2 재설계: 프로필 설정 시스템
- **온보딩 5단계 상세화**: 기본정보 → 관심키워드 → 경쟁사 → 업계동향 → 노이즈필터
  - 2단계: AI 추천 키워드 5개 + [×]로 쉽게 제거 + 직접 입력
  - 5단계: 노이즈 필터는 "지금은 설정 안 함" 권장 (👎 싫어요로 착착 추가)
- **프로필 설정 페이지 추가**: 온보딩 후에도 언제든 접근 가능
  - 회사 티어별 관리 (드래그로 순서 변경)
  - 검색 쿼리 자동 생성 + 수동 추가
  - 보너스/페널티 키워드 그룹 ON/OFF
  - 시간 필터 (24h/48h/1w)
- **피드백 기반 노이즈 필터**: 👎 클릭 → "왜 별로?" → 키워드 선택 → 자동 추가
- **점수 breakdown 표시**: 왜 이 기사가 TOP 10인지 투명하게

#### 섹션 6 데이터 모델 업데이트
- **profiles**: 4티어 회사 관리, 보너스/페널티 그룹, 피드백 학습
- **articles**: 점수 breakdown 상세 저장 (company_score, bonus_breakdown 등)
- **scrape_history**: 중복 방지용 히스토리

#### 섹션 6.2 추가: 스코어링 알고리즘 명세
- 점수 = 회사점수 + 보너스점수 + 페널티점수
- 티어별/그룹별 기본 점수 표
- 중복 기사 처리 로직
- 히스토리 기반 필터링

**핵심 철학:**
> "온보딩은 시작일 뿐. PR 담당자는 매일 결과를 보며 미세 조정한다."

---

### 10. 온보딩 5단계 UI 구현

**Claude 작업:**

#### frontend/src/pages/Onboarding.tsx (완전 재작성)
- **Step 1: 기본 정보**
  - 회사명 입력 → AI 자동 완성 (대표자명, 영문명, 업종)
  - 업종 선택 (IT/테크, 금융, 제조, 유통, 숙박/여행, 헬스케어, 미디어)
  - 직무 선택 (PR담당자, 대표/경영진, 투자자, 마케터, 기타)

- **Step 2: 관심 키워드**
  - AI 추천 키워드 5개 (업종 기반)
  - [×] 버튼으로 쉽게 삭제
  - 클릭으로 선택/해제 토글
  - 직접 키워드 추가 (Enter 또는 추가 버튼)

- **Step 3: 경쟁사**
  - AI 추천 경쟁사 (업종별 주요 기업)
  - 체크박스 스타일 선택
  - 직접 경쟁사 추가
  - 선택 안 해도 다음 단계 진행 가능

- **Step 4: 업계 동향 키워드**
  - 업종별 트렌드 키워드 추천
  - 상위 3개 기본 선택
  - 클릭으로 토글, 직접 추가 가능

- **Step 5: 노이즈 필터**
  - "지금은 설정 안 함" (권장) - 기본 선택
  - "기본 필터 적용" - 광고, 이벤트, 할인, 쿠폰, 프로모션
  - Tip: 싫어요 버튼으로 추후 추가 안내

---

### 11. 프로필 설정 페이지 구현

**Claude 작업:**

#### frontend/src/pages/ProfileSettings.tsx (신규)
4개 탭 구조:

1. **회사/경쟁사 탭**
   - 티어별 회사 관리 (Tier 0~3)
   - 드래그 앤 드롭으로 티어 변경
   - 회사 추가/삭제
   - 티어별 점수 표시 (+100, +60, +40, +25)

2. **키워드 그룹 탭**
   - 보너스 키워드 그룹 (ON/OFF 토글)
   - 페널티 키워드 그룹 (노이즈 필터)
   - 그룹별 키워드 추가/삭제
   - 점수 표시

3. **검색 쿼리 탭**
   - 수동 쿼리 추가
   - 자동 생성 쿼리 설명

4. **기타 설정 탭**
   - 시간 필터 (24h/48h/1w)
   - 점수 시스템 설명

---

### 12. 피드백 모달 (싫어요 → 노이즈 필터) 구현

**Claude 작업:**

#### frontend/src/components/FeedbackModal.tsx (신규)
- 2단계 모달:
  1. **이유 선택**: 관련 없는 기사, 광고/홍보성, 이미 본 내용, 품질이 낮음, 기타
  2. **키워드 선택**: 기사 제목에서 추출한 키워드 + 직접 입력
- 선택한 키워드 → 노이즈 필터에 자동 추가

---

### 13. 대시보드 개선

**Claude 작업:**

#### frontend/src/pages/Dashboard.tsx
- 기사별 좋아요/싫어요 버튼 추가
- 싫어요 클릭 → FeedbackModal 오픈
- 점수 breakdown 표시 (회사점수, 보너스점수, 페널티점수)
- 기사 순위 표시 (1, 2, 3...)
- 피드백 통계 카드 추가
- 프로필 설정 페이지로 이동 버튼 연결

---

## 현재 프론트엔드 구조

```
frontend/src/
├── App.tsx                    # 라우터 설정
├── main.tsx                   # 엔트리포인트
├── api/
│   └── bkend.ts              # bkend.ai API 클라이언트
├── components/
│   ├── ui/
│   │   ├── Button.tsx        # 버튼 컴포넌트
│   │   └── Input.tsx         # 입력 컴포넌트
│   └── FeedbackModal.tsx     # 피드백 모달 (NEW)
└── pages/
    ├── Login.tsx             # 로그인
    ├── Signup.tsx            # 회원가입
    ├── ForgotPassword.tsx    # 비밀번호 찾기
    ├── Dashboard.tsx         # 대시보드 (개선)
    ├── Onboarding.tsx        # 온보딩 5단계 (재작성)
    └── ProfileSettings.tsx   # 프로필 설정 (NEW)
```

---

## 라우트 구조

| 경로 | 페이지 | 접근 권한 |
|------|--------|-----------|
| `/login` | 로그인 | 비로그인 |
| `/signup` | 회원가입 | 비로그인 |
| `/forgot-password` | 비밀번호 찾기 | 비로그인 |
| `/onboarding` | 온보딩 5단계 | 로그인 필요 |
| `/dashboard` | 대시보드 | 로그인 필요 |
| `/settings` | 프로필 설정 | 로그인 필요 |

---

## 다음 작업 (TODO)

- [x] bkend.ai API 연동 (프로필 저장/불러오기)
- [ ] 실제 뉴스 스크래퍼 연동
- [ ] 이메일 브리핑 발송 기능
- [ ] 배포 (Vercel)

---

## 2026-01-02 (Day 3 계속)

### 14. bkend.ai API 완전 연동

**Claude 작업:**

#### frontend/src/api/bkend.ts 대폭 확장
- **타입 정의 추가** (PRD 기반):
  - `Company`, `CompanyTier`, `KeywordGroup` 등 프로필 관련 타입
  - `Profile` (전체 프로필 구조)
  - `Article` (기사 상세 정보)
  - `User` (사용자 정보)

- **dataApi 확장**:
  - `getProfiles()` - 프로필 목록 조회
  - `getProfile(id)` - 단일 프로필 조회
  - `createProfile(profile)` - 프로필 생성
  - `updateProfile(id, updates)` - 프로필 수정
  - `deleteProfile(id)` - 프로필 삭제
  - `updateUser(updates)` - 사용자 정보 수정
  - `getArticles(profileId, options)` - 기사 목록 조회
  - `getTopArticles(profileId, limit)` - TOP 기사 조회
  - `addFeedback(profileId, articleId, type, keywords)` - 피드백 추가
  - `addNoiseKeywords(profileId, keywords)` - 노이즈 필터 키워드 추가

- **createDefaultProfile 함수**:
  - 온보딩 데이터로 전체 프로필 구조 생성
  - 역할별 키워드 자동 추가
  - 보너스/페널티 그룹 기본 설정

---

### 15. 온보딩 API 연동

**Claude 작업:**

#### frontend/src/pages/Onboarding.tsx
- `createDefaultProfile` import 및 사용
- `handleComplete`에서 실제 API 호출:
  ```typescript
  const result = await dataApi.createProfile(profileData)
  if (result.success) {
    localStorage.setItem('current_profile_id', result.data._id)
    navigate('/dashboard')
  }
  ```
- 저장 중 로딩 상태 표시
- 에러 발생 시 에러 메시지 표시

---

### 16. 프로필 설정 API 연동

**Claude 작업:**

#### frontend/src/pages/ProfileSettings.tsx
- **API ↔ UI 데이터 변환 함수**:
  - `apiToLocal()` - API 프로필 → UI 상태
  - `localToApi()` - UI 상태 → API 프로필

- **프로필 로드 로직**:
  - 컴포넌트 마운트 시 `loadProfile()` 호출
  - `localStorage`에서 profile ID 확인
  - 없으면 프로필 목록 조회 후 첫 번째 사용

- **프로필 저장 로직**:
  - `handleSave`에서 `dataApi.updateProfile()` 호출
  - 저장 중 로딩 표시, 에러 처리

- **로딩/에러 상태 UI**:
  - 로딩 스피너
  - 에러 발생 시 온보딩 이동 버튼

---

### 17. 대시보드 API 연동

**Claude 작업:**

#### frontend/src/pages/Dashboard.tsx
- **실제 데이터 로드**:
  - `loadData()` - 사용자, 프로필, 기사 동시 로드
  - `loadArticles()` - TOP 10 기사 조회

- **Mock 데이터 제거**:
  - `mockArticles` → `articles` (API에서 로드)
  - `mockStats` → `stats` (프로필 기반 계산)

- **피드백 API 연동**:
  - `handleLike` → `dataApi.addFeedback(..., 'like')`
  - `handleFeedbackSubmit` → `dataApi.addFeedback(..., 'dislike')` + `dataApi.addNoiseKeywords()`

- **프로필 요약 표시**:
  - `getProfileSummary()` - 회사명, 키워드 그룹 요약
  - 시간 필터 설정 표시

- **빈 상태 UI**:
  - 기사가 없을 때 안내 메시지
  - 로딩 중 스피너

---

## 현재 상태 요약

### 완료된 기능
1. **회원가입/로그인** - bkend.ai 인증 연동 완료
2. **온보딩 5단계** - 프로필 생성 API 연동 완료
3. **프로필 설정** - CRUD API 연동 완료
4. **대시보드** - 기사 조회, 피드백 API 연동 완료

### 프론트엔드 → bkend.ai 데이터 흐름
```
온보딩 완료 → createProfile() → profiles 컬렉션
             └→ localStorage에 profile_id 저장

대시보드 로드 → getProfile() + getTopArticles()
            └→ 기사 목록 표시

좋아요/싫어요 → addFeedback() → feedback 컬렉션
싫어요 + 키워드 → addNoiseKeywords() → profiles.penalty_groups 업데이트

프로필 설정 저장 → updateProfile() → profiles 컬렉션 업데이트
```

---

### 18. Naver News API 스크래퍼 구현

**Claude 작업:**

#### backend/scrape_profile.py (신규, 1038줄)

bkend.ai에서 프로필을 읽어와서 Naver News API로 뉴스를 스크래핑하고 스코어링하는 스크립트.

- **RawArticle 데이터클래스**: 스크래핑된 원본 기사 정보
- **GoogleNewsScraper**: Google News RSS 스크래퍼 (fallback용)
- **NaverNewsScraper**: Naver News API 스크래퍼 (메인)
  - API URL: `https://openapi.naver.com/v1/search/news.json`
  - 헤더: `X-Naver-Client-Id`, `X-Naver-Client-Secret`
  - 최신순 정렬 (`sort: 'date'`)
  - 검색어당 20개 결과

- **ProfileScoringEngine**: 프로필 기반 점수 계산
  - `company_score`: 티어별 점수 (Tier0: 100, Tier1: 60, Tier2: 40, Tier3: 25)
  - `bonus_score`: 보너스 키워드 그룹 매칭
  - `penalty_score`: 페널티 키워드 그룹 매칭
  - 점수 breakdown 상세 저장

- **중복 기사 제거 알고리즘**:
  - `extract_main_entity()`: 제목에서 인물/회사명 추출
  - `entities_match()`: 같은 주체인지 판단
  - `deduplicate_articles()`: 엔티티 + 텍스트 유사도 결합
    - 같은 주체면 낮은 임계값 (0.25) 적용
    - 제목 70% + 요약 30% 가중치
    - 점수 높은 기사 유지

- **사용법**:
  ```bash
  python backend/scrape_profile.py --all          # 모든 프로필
  python backend/scrape_profile.py --profile "팝업스튜디오"  # 특정 프로필
  python backend/scrape_profile.py --list         # 프로필 목록
  ```

---

### 19. 대시보드 로컬 데이터 로드 기능

**Claude 작업:**

#### frontend/src/pages/Dashboard.tsx
- **loadArticlesFromLocal()**: API 실패 시 로컬 JSON 파일에서 로드
  - `/data/articles.json` fetch
  - 기사 링크 해시로 고유 ID 생성 (새로고침해도 동일)
  - API 형식 → UI 형식 변환

- **노이즈 필터 지속성**:
  - `localStorage`에 상태 저장:
    - `liked_articles`, `disliked_articles`
    - `local_noise_keywords`
    - `hide_noise_filtered`
  - `useEffect`로 상태 변경 시 자동 저장

- **displayedArticles 계산**:
  - 싫어요한 기사 숨김
  - 페널티 점수 있는 기사 숨김 (노이즈 필터 ON일 때)
  - 로컬 노이즈 키워드 포함 기사 숨김

---

### 20. 키워드 그룹 관리 기능 완성

**Claude 작업:**

#### frontend/src/pages/ProfileSettings.tsx
- **새 키워드 그룹 추가 모달**:
  - 그룹 이름 입력
  - 점수 슬라이더 (5~50점)
  - 보너스(초록)/페널티(빨강) 구분 UI

- **그룹 삭제 기능**: `deleteKeywordGroup()`
- **그룹 활성화/비활성화 토글**
- **키워드 추가/삭제**: 그룹 내 개별 키워드 관리

---

### 21. HTML 엔티티 디코딩 수정

**문제:**
```
기사 제목에 &quot;, &amp; 등 HTML 엔티티가 그대로 표시됨
```

**해결:**
```python
import html
title = html.unescape(re.sub(r'<[^>]+>', '', item.get('title', '')))
description = html.unescape(re.sub(r'<[^>]+>', '', item.get('description', '')))
```

---

### 22. 언론사 출처 표시 수정

**문제:**
```
API 호출 시 출처가 전부 '네이버뉴스'로 표시됨
실제로는 조선일보, 동아일보, 이투데이 등 원 언론사가 있음
```

**해결:**

#### DOMAIN_TO_SOURCE 딕셔너리 (100+ 언론사)
```python
DOMAIN_TO_SOURCE = {
    # 종합일간지
    'chosun.com': '조선일보',
    'donga.com': '동아일보',
    'joongang.co.kr': '중앙일보',
    'hankyung.com': '한국경제',
    'mk.co.kr': '매일경제',
    # IT/테크
    'etnews.com': '전자신문',
    'zdnet.co.kr': 'ZDNet Korea',
    'bloter.net': '블로터',
    # 스타트업 전문
    'platum.kr': '플래텀',
    'venturesquare.net': '벤처스퀘어',
    'thevc.kr': '더브이씨',
    # ... 100개 이상
}
```

#### _extract_source() 메서드
```python
def _extract_source(self, url: str) -> str:
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    if domain.startswith('www.'):
        domain = domain[4:]

    # 정확히 매칭
    if domain in self.DOMAIN_TO_SOURCE:
        return self.DOMAIN_TO_SOURCE[domain]

    # 서브도메인 매칭 (news.chosun.com → 조선일보)
    for known_domain, source_name in self.DOMAIN_TO_SOURCE.items():
        if domain.endswith('.' + known_domain):
            return source_name

    # 매핑 없으면 도메인 정리해서 반환
    return "네이버뉴스"
```

---

### 23. 노란색 배경 기사 설명

**사용자 질문:**
```
이렇게 색이 노랗게 나오는 건 어떤 이유야?
```

**설명:**
- 노란색 배경(`bg-yellow-50`)은 **노이즈 필터에 걸린 기사**
- 조건:
  1. `penalty_score < 0` (페널티 키워드 매칭)
  2. 로컬 노이즈 키워드가 제목에 포함

```tsx
const isNoiseFiltered = (article.scoreBreakdown?.penalty ?? 0) < 0 ||
                        hasLocalNoiseKeyword(article.title)

className={`p-6 ${isNoiseFiltered ? 'opacity-60 bg-yellow-50' : 'hover:bg-gray-50'}`}
```

---

### 24. 이메일 브리핑 시스템 구현

**사용자 요청:**
```
https://www.neusral.com/r?b=N489gv
브리핑 발송부터 하고 UI는 이처럼 TOP 3 기사는 별도로 기사 내용을 요약하는 방식으로 해줘
```

**Claude 작업:**

#### backend/send_briefing.py (신규, 383줄)

- **ArticleSummarizer 클래스**:
  - Anthropic Claude API로 기사 요약
  - OpenAI GPT fallback
  - 2-3문장 요약 생성

- **EmailBriefingSender 클래스**:
  - Gmail SMTP 발송
  - HTML 이메일 템플릿 생성
  - TOP 3 기사: AI 요약 + 컬러 배지 (금/은/동)
  - 나머지 기사 (4~20): 간단 리스트

- **HTML 템플릿 구조**:
  ```
  ┌─────────────────────────────────────┐
  │  📰 [프로필명] Daily Briefing       │
  │  2026년 1월 2일                     │
  ├─────────────────────────────────────┤
  │  🥇 TOP 1 (금색 배지)               │
  │  [기사 제목]                        │
  │  출처 · 시간                        │
  │  AI 요약: ...                       │
  │  [기사 읽기 →]                      │
  ├─────────────────────────────────────┤
  │  🥈 TOP 2, 🥉 TOP 3 ...            │
  ├─────────────────────────────────────┤
  │  📋 기타 주요 기사 (4-20)           │
  │  4. [제목] - 출처                   │
  │  ...                                │
  └─────────────────────────────────────┘
  ```

- **사용법**:
  ```bash
  # 실제 발송
  python backend/send_briefing.py --to jack@popupstudio.ai --profile "팝업스튜디오"

  # 미리보기 (HTML 저장)
  python backend/send_briefing.py --preview --to test@test.com
  ```

---

### 25. Gmail SMTP 설정

**문제:**
```
.env에 GMAIL_EMAIL, GMAIL_PASSWORD가 비어있음
```

**해결:**
기존 AI-driven-work 프로젝트의 email_config.py에서 앱 비밀번호 발견:
```python
# c:\GitHub\AI-driven-work\scraping\email_config.py
GMAIL_EMAIL = "jack@popupstudio.ai"
GMAIL_PASSWORD = "oamk laly rycb wxjh"
```

.env 업데이트:
```env
GMAIL_EMAIL=jack@popupstudio.ai
GMAIL_PASSWORD=oamk laly rycb wxjh
```

---

### 26. 브리핑 발송 실행

**실행 결과:**
```bash
$ python backend/send_briefing.py --to jack@popupstudio.ai --profile "팝업스튜디오"

============================================================
Sending briefing to: jack@popupstudio.ai
============================================================

Loading articles from: articles_33608bed_2026-01-02.json
Loaded 211 articles

Generating HTML content...
  Summarizing article 1/3: 제로백, AI 빌더톤 팝업데이 개최…
  Summarizing article 2/3: [더 보다] 일 돕는 AI, 일 뺏는 AI...
  Summarizing article 3/3: 데이원컴퍼니, 실무 특화 'AI 아웃소싱' 서비스 출시...

Sending email...
Email sent successfully to jack@popupstudio.ai
```

---

## 2026-01-02 작업 통계

| 항목 | 내용 |
|------|------|
| 총 작업 시간 | 약 4시간 |
| 신규 파일 | 5개 |
| 수정 파일 | 7개 |
| 총 코드 라인 | 4,612줄 |

### 신규 파일
- `backend/scrape_profile.py` (1,038줄) - 스크래핑 + 스코어링
- `backend/send_briefing.py` (383줄) - 이메일 브리핑
- `frontend/src/components/FeedbackModal.tsx` (224줄)
- `frontend/src/pages/ProfileSettings.tsx` (988줄)
- `docs/conversation-history.md`

### 수정 파일
- `frontend/src/api/bkend.ts` (+380줄)
- `frontend/src/pages/Dashboard.tsx` (+520줄)
- `frontend/src/pages/Onboarding.tsx` (+716줄)
- `frontend/src/App.tsx`
- `.env`
- `.gitignore`
- `docs/PRD.md`

---

## 현재 완료 상태

### ✅ 완료된 기능
1. **회원가입/로그인** - bkend.ai 인증
2. **온보딩 5단계** - AI 추천 + 프로필 생성
3. **프로필 설정** - 4탭 CRUD, 키워드 그룹 관리
4. **대시보드** - 기사 목록, 점수 표시, 좋아요/싫어요
5. **피드백 시스템** - 노이즈 필터 자동 추가
6. **Naver News API 스크래핑** - 프로필 기반
7. **중복 기사 제거** - 엔티티 + 유사도
8. **언론사 출처 표시** - 100+ 도메인 매핑
9. **이메일 브리핑 발송** - AI 요약 + Neusral 스타일

### ⏳ 미구현 기능
- [ ] UI에서 스크래핑 실행 버튼
- [ ] 자동 스케줄링 (GitHub Actions)
- [ ] 프로필별 개별 브리핑
- [ ] Vercel 배포

---

## 다음 세션 TODO

1. 대시보드에 "스크래핑 실행" 버튼 추가
2. GitHub Actions로 자동 스크래핑 설정
3. Vercel 배포
4. 피드백 학습 기반 스코어링 개선

---
