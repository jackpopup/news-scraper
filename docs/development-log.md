# News Curator 개발 로그

## 프로젝트 개요
bkend.ai 백엔드 연결 이후 News Curator 웹 애플리케이션 개발 과정을 정리한 문서입니다.

---

## 1. bkend.ai 백엔드 연동

### 1.1 인증 시스템 구현
- **파일**: `frontend/src/api/index.ts`
- bkend.ai API를 활용한 사용자 인증 구현
- 로그인/회원가입/로그아웃 기능
- JWT 토큰 기반 세션 관리

### 1.2 프로필 시스템
- **컬렉션**: `profiles`
- 사용자별 뉴스 프로필 저장
- 프로필 구조:
  - `company_tiers`: 관심 회사 (Tier 1~3 점수 차등)
  - `search_queries`: 검색 키워드
  - `bonus_groups`: 보너스 키워드 그룹
  - `penalty_groups`: 페널티 키워드 그룹 (노이즈 필터)

---

## 2. 프론트엔드 개발

### 2.1 대시보드 (`Dashboard.tsx`)
- 수집된 뉴스 기사 목록 표시
- 관련도 점수 기반 정렬
- 기능:
  - 좋아요/싫어요 피드백
  - 노이즈 필터 토글
  - 기사 점수 breakdown 표시 (회사 점수, 보너스, 페널티)
  - 로컬 노이즈 키워드 실시간 필터링

### 2.2 프로필 설정 (`ProfileSettings.tsx`)
- 4개 탭 구조:
  1. **회사**: Tier별 관심 회사 관리
  2. **키워드**: 보너스/페널티 키워드 그룹 관리
  3. **검색어**: 뉴스 검색 쿼리 관리
  4. **고급**: 기타 설정

- 키워드 그룹 기능:
  - 새 그룹 추가 (이름, 점수 설정)
  - 그룹 활성화/비활성화 토글
  - 그룹 삭제
  - 키워드 추가/삭제

### 2.3 피드백 모달 (`FeedbackModal.tsx`)
- 싫어요 클릭 시 노이즈 키워드 추출
- 기사 제목에서 자동 키워드 추천
- 선택한 키워드를 노이즈 필터에 추가

### 2.4 노이즈 필터 지속성
- `localStorage`에 저장:
  - `liked_articles`: 좋아요한 기사 ID
  - `disliked_articles`: 싫어요한 기사 ID
  - `local_noise_keywords`: 로컬 노이즈 키워드
  - `hide_noise_filtered`: 노이즈 필터 표시 설정
- 새로고침해도 상태 유지

---

## 3. 백엔드 스크래핑 시스템

### 3.1 Naver News API 연동 (`scrape_profile.py`)

#### API 설정
```python
NAVER_CLIENT_ID=VPzRniKfX7ef_JYbLYB6
NAVER_CLIENT_SECRET=2QY9CpGOnX
```

#### 주요 클래스
- `NaverNewsScraper`: Naver News API 검색
- `ProfileScoringEngine`: 기사 점수 계산
- `deduplicate_articles()`: 중복 기사 제거

#### 점수 계산 로직
```
final_score = company_score + bonus_score + penalty_score

- company_score: Tier 1(+50), Tier 2(+30), Tier 3(+15)
- bonus_score: 보너스 키워드 매칭 시 그룹별 점수 추가
- penalty_score: 페널티 키워드 매칭 시 그룹별 점수 감점
```

### 3.2 출처(언론사) 추출 기능
- **문제**: Naver API 결과가 모두 "네이버뉴스"로 표시됨
- **해결**: URL에서 실제 언론사 도메인 추출

```python
DOMAIN_TO_SOURCE = {
    'chosun.com': '조선일보',
    'donga.com': '동아일보',
    'joongang.co.kr': '중앙일보',
    'hankyung.com': '한국경제',
    'mk.co.kr': '매일경제',
    'etnews.com': '전자신문',
    'platum.kr': '플래텀',
    # ... 100+ 언론사 매핑
}
```

### 3.3 HTML 엔티티 디코딩
- **문제**: 기사 제목에 `&quot;`, `&amp;` 등 HTML 엔티티 노출
- **해결**: `html.unescape()` 적용

```python
title = html.unescape(re.sub(r'<[^>]+>', '', item.get('title', '')))
```

### 3.4 중복 기사 제거 알고리즘
- 엔티티 기반 + 텍스트 유사도 결합
- 같은 주체(인물/회사) 기사는 낮은 임계값 적용

```python
def deduplicate_articles(articles, threshold=0.5):
    # 1. 링크 중복 체크
    # 2. 엔티티 매칭 (인물명+회사명 추출)
    # 3. 제목 유사도 계산
    # 4. 요약 유사도 계산 (가중치: 제목 70% + 요약 30%)
    # 5. 점수 높은 기사 유지
```

---

## 4. 이메일 브리핑 시스템

### 4.1 브리핑 발송 (`send_briefing.py`)

#### 주요 클래스
- `ArticleSummarizer`: AI 기반 기사 요약 (Anthropic Claude / OpenAI GPT)
- `EmailBriefingSender`: HTML 이메일 생성 및 발송

#### 기능
- TOP 3 기사: AI 요약 포함, 컬러 배지 (금/은/동)
- 나머지 기사 (4~20위): 간단한 리스트 형태
- Neusral 스타일 레이아웃

#### 사용법
```bash
# 실제 발송
python backend/send_briefing.py --to jack@popupstudio.ai --profile "팝업스튜디오"

# 미리보기 (HTML 파일 저장)
python backend/send_briefing.py --preview --to test@test.com
```

### 4.2 Gmail SMTP 설정
```env
GMAIL_EMAIL=jack@popupstudio.ai
GMAIL_PASSWORD=oamk laly rycb wxjh  # 앱 비밀번호
```

### 4.3 이메일 템플릿 구조
```
┌─────────────────────────────────────┐
│  📰 팝업스튜디오 Daily Briefing     │
│  2026년 1월 2일                     │
├─────────────────────────────────────┤
│  🥇 TOP 1                           │
│  [기사 제목]                        │
│  AI 요약 내용...                    │
├─────────────────────────────────────┤
│  🥈 TOP 2                           │
│  [기사 제목]                        │
│  AI 요약 내용...                    │
├─────────────────────────────────────┤
│  🥉 TOP 3                           │
│  [기사 제목]                        │
│  AI 요약 내용...                    │
├─────────────────────────────────────┤
│  📋 기타 주요 기사                  │
│  4. [기사 제목] - 출처              │
│  5. [기사 제목] - 출처              │
│  ...                                │
└─────────────────────────────────────┘
```

---

## 5. 파일 구조

```
news-scraper/
├── backend/
│   ├── scrape_profile.py      # 뉴스 스크래핑 + 스코어링
│   └── send_briefing.py       # 이메일 브리핑 발송
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── index.ts       # bkend.ai API 클라이언트
│   │   ├── components/
│   │   │   └── FeedbackModal.tsx
│   │   └── pages/
│   │       ├── Dashboard.tsx      # 대시보드
│   │       ├── ProfileSettings.tsx # 프로필 설정
│   │       └── Login.tsx          # 로그인
│   └── vite.config.ts         # Vite 설정 (프록시)
├── output/
│   ├── articles_*.json        # 스크래핑 결과
│   └── briefing_preview.html  # 브리핑 미리보기
├── .env                       # 환경 변수
└── docs/
    └── development-log.md     # 이 문서
```

---

## 6. 환경 변수 (.env)

```env
# AI APIs
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Email
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

## 7. 다음 단계 (미구현)

1. **UI 스크래핑 버튼**: 대시보드에서 직접 스크래핑 실행
2. **자동 스케줄링**: GitHub Actions 또는 cron으로 자동 스크래핑
3. **프로필별 브리핑**: 여러 프로필에 대해 개별 브리핑 발송
4. **피드백 학습**: 좋아요/싫어요 데이터로 스코어링 개선

---

## 8. 주요 이슈 및 해결

| 이슈 | 원인 | 해결 |
|------|------|------|
| 출처가 모두 "네이버뉴스" | Naver API가 originallink 제공 | URL에서 도메인 추출하여 언론사 매핑 |
| 제목에 `&quot;` 표시 | HTML 엔티티 미처리 | `html.unescape()` 적용 |
| 노이즈 필터 초기화 | 새로고침 시 상태 소실 | `localStorage` 지속성 구현 |
| 중복 기사 다수 | 같은 뉴스 여러 언론사 보도 | 엔티티+유사도 기반 중복 제거 |
| Gmail 발송 실패 | 앱 비밀번호 미설정 | 기존 프로젝트에서 앱 비밀번호 재사용 |

---

*마지막 업데이트: 2026년 1월 2일*
