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

- [ ] 온보딩 튜토리얼 (5단계 위저드)
- [ ] 메인 대시보드 완성 (실제 데이터 연동, 드래그앤드롭)
- [ ] 브리핑 발행 기능
- [ ] 배포 (Vercel)
