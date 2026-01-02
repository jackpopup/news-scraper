# News Curator 개발 대화 기록

## 세션 정보
- **날짜**: 2026년 1월 2일 (Day 3)
- **프로젝트**: News Curator (news-scraper)
- **작업 시간**: 약 4시간
- **이전 작업**: Day 1-2에서 프로젝트 시작, 프론트엔드 기본 구현

---

## 이전 세션 요약 (Day 1-2)

### Day 1 (2024-12-29)
1. 프로젝트 생성 및 PRD 작성
2. bkend.ai 백엔드 연동 설정

### Day 2 (2024-12-30)
3. 프론트엔드 기본 세팅 (Vite + React + TypeScript + Tailwind)
4. 로그인/회원가입 구현
5. API URL 오류 수정 (`api-enduser-dev` → `api-enduser`)
6. 토큰 저장 버그 수정 (`token` → `access_token`)
7. 대시보드 기본 구현 (Mock 데이터)

---

## Day 3 대화 내용 (2026-01-02)

### 대화 1: PRD 개선 - 실제 사용 패턴 반영

**배경:**
- 기존 PRD는 "5단계 온보딩 후 끝"이라는 비현실적 가정
- ONDA 뉴스 스크래퍼 운영 경험에서 "매일 결과 보며 미세 조정" 필요성 인식

**작업 내용:**
- 섹션 4.2 프로필 설정 시스템 재설계
- 온보딩 5단계 상세화 (기본정보 → 관심키워드 → 경쟁사 → 업계동향 → 노이즈필터)
- 피드백 기반 노이즈 필터 설계 (👎 → 키워드 추출 → 자동 추가)
- 스코어링 알고리즘 명세 추가

---

### 대화 2: 온보딩 5단계 UI 구현

**작업 내용:**
`frontend/src/pages/Onboarding.tsx` 완전 재작성 (799줄)

- **Step 1: 기본 정보** - 회사명 입력 시 AI 자동 완성 (대표자명, 영문명, 업종)
- **Step 2: 관심 키워드** - 업종별 AI 추천 + 직접 추가
- **Step 3: 경쟁사** - 업종별 AI 추천 + 체크박스 선택
- **Step 4: 업계 동향 키워드** - 트렌드 키워드 추천
- **Step 5: 노이즈 필터** - "지금은 설정 안 함" 권장

---

### 대화 3: 프로필 설정 페이지 구현

**작업 내용:**
`frontend/src/pages/ProfileSettings.tsx` 신규 (988줄)

4개 탭 구조:
1. **회사/경쟁사** - 티어별 관리, 드래그 앤 드롭
2. **키워드 그룹** - 보너스/페널티 그룹 ON/OFF
3. **검색 쿼리** - 수동/자동 쿼리 관리
4. **기타 설정** - 시간 필터, 점수 설명

---

### 대화 4: 피드백 모달 구현

**작업 내용:**
`frontend/src/components/FeedbackModal.tsx` 신규 (224줄)

- 싫어요 클릭 시 2단계 모달
- 이유 선택 → 키워드 선택 → 노이즈 필터 자동 추가

---

### 대화 5: 대시보드 개선

**작업 내용:**
`frontend/src/pages/Dashboard.tsx` 대폭 수정 (+520줄)

- 좋아요/싫어요 버튼 추가
- 점수 breakdown 표시 (회사+보너스+페널티)
- 피드백 통계 카드
- 프로필 설정 페이지 연결

---

### 대화 6: bkend.ai API 완전 연동

**작업 내용:**
`frontend/src/api/bkend.ts` 대폭 확장 (+380줄)

- 타입 정의 (Profile, Article, User 등)
- dataApi 확장:
  - getProfiles(), getProfile(), createProfile(), updateProfile()
  - getArticles(), getTopArticles()
  - addFeedback(), addNoiseKeywords()
- createDefaultProfile() 헬퍼 함수

---

### 대화 7: Naver News API 스크래퍼 구현

**작업 내용:**
`backend/scrape_profile.py` 신규 (1,038줄)

- NaverNewsScraper 클래스 - Naver News API 연동
- ProfileScoringEngine - 티어별/그룹별 점수 계산
- 중복 기사 제거 알고리즘 (엔티티 + 유사도)
- bkend.ai 프로필 읽기 연동

**사용법:**
```bash
python backend/scrape_profile.py --all
python backend/scrape_profile.py --profile "팝업스튜디오"
```

---

### 대화 8: 언론사 출처 표시 문제

**사용자:**
> "음 api 호출을 하니까 출처가 전부 '네이버뉴스'로 나와 그런데 실제는 이투데이, 조선일보, 동아일보 이처럼 원 언론사 출처가 있고, 실제 클릭해도 언론사로 넘어가잖아? 이부분을 고칠 수 있을까?"

**해결:**
- URL에서 도메인 추출하여 언론사명 매핑
- DOMAIN_TO_SOURCE 딕셔너리 (100+ 언론사)
- _extract_source() 메서드 구현

```python
DOMAIN_TO_SOURCE = {
    'chosun.com': '조선일보',
    'donga.com': '동아일보',
    'mk.co.kr': '매일경제',
    'platum.kr': '플래텀',
    # ... 100개 이상
}
```

---

### 대화 9: 노란색 배경 기사 질문

**사용자:**
> [스크린샷] "이렇게 색이 노랗게 나오는 건 어떤 이유야?"

**응답:**
노란색 배경(`bg-yellow-50`)은 노이즈 필터에 걸린 기사:
1. `penalty_score < 0` (페널티 키워드 매칭)
2. 로컬 노이즈 키워드가 제목에 포함

---

### 대화 10: 기능 현황 점검

**사용자:**
> "뉴스 스크래핑과 브리핑 발송 기능은 아직 개발이 안됐네?"

**응답:**
- 완료: 대시보드, 프로필 설정, 피드백 시스템
- 미완료: UI 스크래핑 버튼, 이메일 브리핑

---

### 대화 11: 이메일 브리핑 구현 요청

**사용자:**
> "https://www.neusral.com/r?b=N489gv 브리핑 발송부터 하고 UI는 이처럼 TOP 3 기사는 별도로 기사 내용을 요약하는 방식으로 해줘"

**작업 내용:**
`backend/send_briefing.py` 신규 (383줄)

- ArticleSummarizer - Anthropic/OpenAI API로 기사 요약
- EmailBriefingSender - Gmail SMTP 발송
- HTML 템플릿 - TOP 3 AI 요약 + 나머지 리스트

---

### 대화 12: Gmail 설정

**사용자:**
> "ㅇㅋ 설정 후 발송"
> "그거 이전에 온다 스크래퍼 만들 때 해 놓은거 있어"

**해결:**
기존 프로젝트(`AI-driven-work/scraping/email_config.py`)에서 Gmail 앱 비밀번호 발견하여 .env에 추가

---

### 대화 13: 브리핑 발송 실행

**실행:**
```bash
python backend/send_briefing.py --to jack@popupstudio.ai --profile "팝업스튜디오"
```

**결과:**
```
Loading articles from: articles_33608bed_2026-01-02.json
Loaded 211 articles
Generating HTML content...
  Summarizing article 1/3: 제로백, AI 빌더톤 팝업데이 개최…
  Summarizing article 2/3: [더 보다] 일 돕는 AI, 일 뺏는 AI...
  Summarizing article 3/3: 데이원컴퍼니, 실무 특화 'AI 아웃소싱' 서비스 출시...
Email sent successfully to jack@popupstudio.ai
```

---

### 대화 14: 개발 문서 정리 요청

**사용자:**
> "자 오늘은 여기까지 하고 지금까지 작업한거 전체 내용을 그 뭐 문서로 정리할 수 없나? bkend 연결 이후부터 지금까지"

**작업:**
- `docs/development-log.md` 생성
- `docs/conversation-history.md` 생성 (현재 문서)

---

### 대화 15: 대화 기록 보완 요청

**사용자:**
> "히스토리가 너무 짧은데? 내가 4시간 넘게 작업했는데 ..언론사 출처 문제는 거의 후반 30분 정도 작업이었던거 같아"
> "네가 추적할 수 있는 모든 부분을 다 해줘"

**작업:**
- Git 히스토리, 파일 변경사항, DEVLOG.md 분석
- DEVLOG.md에 Day 3 전체 작업 내용 추가 (18~26번 항목)
- 현재 문서 완성

---

## 생성된 파일 목록

### 신규 파일 (5개, 2,633줄)
| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `backend/scrape_profile.py` | 1,038 | Naver API 스크래핑 + 스코어링 |
| `backend/send_briefing.py` | 383 | 이메일 브리핑 발송 |
| `frontend/src/pages/ProfileSettings.tsx` | 988 | 프로필 설정 4탭 |
| `frontend/src/components/FeedbackModal.tsx` | 224 | 싫어요 피드백 모달 |
| `docs/conversation-history.md` | - | 현재 문서 |

### 수정 파일 (7개, +1,616줄)
| 파일 | 추가 줄 | 변경 내용 |
|------|---------|-----------|
| `frontend/src/api/bkend.ts` | +380 | 타입 정의, API 확장 |
| `frontend/src/pages/Onboarding.tsx` | +716 | 5단계 완전 재작성 |
| `frontend/src/pages/Dashboard.tsx` | +520 | 실제 데이터 연동, 피드백 |
| `frontend/src/App.tsx` | - | 라우트 추가 |
| `docs/PRD.md` | - | 스코어링 알고리즘 추가 |
| `.env` | - | Gmail 설정 추가 |
| `.gitignore` | - | 출력 파일 제외 |

### 총 코드량
- **4,612줄** (신규 + 수정)

---

## 환경 설정 (.env)

```env
# AI APIs
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Email Settings
GMAIL_EMAIL=jack@popupstudio.ai
GMAIL_PASSWORD=oamk laly rycb wxjh

# Naver Search API
NAVER_CLIENT_ID=VPzRniKfX7ef_JYbLYB6
NAVER_CLIENT_SECRET=2QY9CpGOnX

# bkend.ai Backend
BKEND_ORG_ID=org_82d80e71-a9af-4374-b3a5-eab8c3e68efc
BKEND_API_KEY=ak_a24c0436c96a3a03c4aa2fecea658ec14ffbfbd4f02affc672e7e113051cef98
BKEND_SERVICE_URL=https://api-enduser-dev.bkend.ai
BKEND_PROJECT_ID=hv95e8qu7zgbcuvh7p85
BKEND_ENVIRONMENT=dev
```

---

## 주요 이슈 및 해결

| # | 이슈 | 원인 | 해결 |
|---|------|------|------|
| 1 | API URL 연결 실패 | MCP 문서의 URL 오류 | `api-enduser-dev` → `api-enduser` |
| 2 | 로그인 후 토큰 미저장 | 응답 필드명 불일치 | `token` → `access_token` |
| 3 | 출처가 모두 "네이버뉴스" | Naver API가 source 미제공 | URL 도메인에서 언론사 매핑 |
| 4 | 제목에 `&quot;` 표시 | HTML 엔티티 미처리 | `html.unescape()` 적용 |
| 5 | 노이즈 필터 초기화 | 새로고침 시 상태 소실 | `localStorage` 지속성 구현 |
| 6 | 중복 기사 다수 | 같은 뉴스 여러 언론사 보도 | 엔티티+유사도 기반 중복 제거 |
| 7 | Gmail 발송 실패 | 앱 비밀번호 미설정 | 기존 프로젝트에서 재사용 |

---

## 프로젝트 현재 상태

### ✅ 완료된 기능
1. 회원가입/로그인 (bkend.ai 인증)
2. 온보딩 5단계 (AI 추천 + 프로필 생성)
3. 프로필 설정 (4탭 CRUD, 키워드 그룹)
4. 대시보드 (기사 목록, 점수 표시)
5. 좋아요/싫어요 피드백
6. 노이즈 필터 (서버 + 로컬)
7. Naver News API 스크래핑
8. 중복 기사 제거
9. 언론사 출처 표시 (100+ 매핑)
10. 이메일 브리핑 발송 (AI 요약)

### ⏳ 미구현 기능
- [ ] UI에서 스크래핑 실행 버튼
- [ ] 자동 스케줄링 (GitHub Actions)
- [ ] 프로필별 개별 브리핑
- [ ] Vercel 배포
- [ ] 피드백 기반 스코어링 학습

---

## 다음 세션 TODO

1. 대시보드에 "스크래핑 실행" 버튼 추가
2. GitHub Actions로 자동 스크래핑 설정
3. Vercel 배포
4. 피드백 학습 기반 스코어링 개선

---

*문서 생성일: 2026년 1월 2일*
*작업 시간: 약 4시간*
*총 코드: 4,612줄*
