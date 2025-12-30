# News Curator

PR 담당자를 위한 AI 기반 맞춤형 뉴스 큐레이션 서비스

## 누구를 위한 서비스인가요?

- **PR/홍보 담당자**: 업계 동향 파악 및 미디어 모니터링
- **마케팅 팀**: 경쟁사 뉴스 및 시장 트렌드 추적
- **경영진**: 일일 산업 뉴스 브리핑 수신
- **투자자/VC**: 포트폴리오 기업 및 산업군 모니터링

## 주요 기능

- **맞춤형 키워드 설정**: 회사, 경쟁사, 산업 키워드를 자유롭게 정의
- **스마트 점수 시스템**: 중요도에 따른 자동 기사 순위 산정
- **AI 요약**: GPT/Claude 기반 핵심 내용 요약
- **다양한 뉴스 소스**: Google News, 네이버 뉴스(한국어) 지원
- **이메일 자동 발송**: 매일 큐레이션된 뉴스 브리핑 수신
- **중복 방지**: 이미 본 기사는 자동으로 제외

## 산업별 템플릿

바로 사용 가능한 산업별 설정 템플릿을 제공합니다:

| 산업군 | 파일 | 설명 |
|-------|------|------|
| 숙박/여행 | `examples/hospitality.yaml` | OTA, 호텔, 트래블테크 |
| 핀테크 | `examples/fintech.yaml` | 은행, 결제, 암호화폐 |
| 이커머스 | `examples/ecommerce.yaml` | 리테일, 마켓플레이스, 물류 |
| AI/테크 | `examples/ai-tech.yaml` | AI 스타트업, 빅테크, SaaS |

## 기술 스택

- **Backend**: [bkend.ai](https://www.bkend.ai/) - AI 네이티브 BaaS
- **Frontend**: React + TypeScript
- **AI**: OpenAI GPT / Anthropic Claude
- **News Sources**: Google News, Naver News API

## Quick Start

### 1. bkend.ai 설정

1. [bkend.ai](https://www.bkend.ai/) 에서 계정 생성
2. 새 서비스 생성 후 API Key 발급
3. 환경변수 설정:

```bash
export BKEND_API_KEY="your-api-key"
export BKEND_SERVICE_URL="https://your-service.bknd.io"
```

### 2. 로컬 실행

```bash
# Backend (스크래퍼)
cd backend
pip install -r requirements.txt
python main.py --profile examples/hospitality.yaml

# Frontend (대시보드)
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 3. 프로필 생성

`config/` 폴더에 YAML 파일을 만들어 나만의 뉴스 큐레이터를 설정하세요.

## 프로필 구조

```yaml
profile:
  name: "내 산업 뉴스"
  description: "우리 회사를 위한 맞춤 뉴스"
  language: ko
  region: KR

# 회사별 중요도 설정
companies:
  tier_0:  # 우리 회사 (최고 우선순위)
    label: "Our Company"
    score: 80
    keywords: ["우리회사", "OurCompany"]
  tier_1:  # 주요 경쟁사
    label: "Major Competitors"
    score: 60
    keywords: ["경쟁사1", "경쟁사2"]

# 관심 키워드
keywords:
  investment:
    label: "투자/M&A"
    score: 40
    terms: ["투자유치", "인수", "합병", "IPO"]
  regulation:
    label: "규제/정책"
    score: 45
    terms: ["규제", "법안", "정책"]

# 보너스 점수
bonuses:
  recent:
    label: "최신 기사"
    score: 25
    condition: "published_within_hours < 24"
  has_numbers:
    label: "구체적 수치"
    score: 15
    patterns: ["\\d+억", "\\d+%"]

# 페널티 (제외할 기사)
penalties:
  promotion:
    label: "광고/프로모션"
    score: -40
    keywords: ["할인", "이벤트", "쿠폰"]
  politics:
    label: "정치 기사"
    score: -500
    keywords: ["대통령", "국회의원", "기소"]

# 검색 쿼리
search_queries:
  - "우리회사 뉴스"
  - "경쟁사 동향"
  - "산업 트렌드"

# 뉴스 소스
sources:
  - type: google_news
    language: ko
    region: KR

# 출력 설정
output:
  top_articles: 10      # 상위 기사 수
  top_detailed: 3       # 상세 요약 기사 수
  summary_length: 100   # 요약 글자 수

  email:
    enabled: true
    subject_template: "{profile_name} 뉴스 브리핑 - {date}"
    recipients: ["team@company.com"]

  diversity:
    max_per_company: 2  # 회사당 최대 기사 수

  history:
    enabled: true
    days_to_keep: 7     # 중복 방지 기간
```

## 아키텍처

```
news-scraper/
├── backend/
│   ├── main.py              # CLI 엔트리포인트
│   ├── scraper/
│   │   ├── core.py          # 메인 스크래핑 로직
│   │   ├── sources/         # 뉴스 소스 어댑터
│   │   │   ├── google.py    # Google News
│   │   │   └── naver.py     # Naver News
│   │   ├── scoring.py       # 점수 계산 엔진
│   │   └── summarizer.py    # AI 요약 모듈
│   ├── config/
│   │   └── loader.py        # YAML 설정 로더
│   └── bknd/
│       └── client.py        # bkend.ai API 클라이언트
├── frontend/
│   ├── src/
│   │   ├── components/      # React 컴포넌트
│   │   ├── pages/           # 페이지
│   │   └── api/             # API 클라이언트
│   └── package.json
├── config/                   # 사용자 설정 파일
├── examples/                 # 산업별 템플릿
└── requirements.txt
```

## bkend.ai 데이터 모델

### Collections

**profiles** - 뉴스 프로필 설정
- `name`: 프로필 이름
- `config`: YAML 설정 내용 (JSON)
- `created_at`: 생성일
- `updated_at`: 수정일
- `user_id`: 사용자 ID

**scrape_results** - 스크래핑 결과
- `profile_id`: 프로필 ID
- `articles`: 수집된 기사 목록
- `scraped_at`: 스크래핑 시간
- `top_articles`: TOP N 기사

**scrape_history** - 중복 방지용 히스토리
- `profile_id`: 프로필 ID
- `article_link`: 기사 링크
- `article_title`: 기사 제목
- `scraped_at`: 스크래핑 시간

## API 엔드포인트 (bkend.ai 자동 생성)

bkend.ai가 자동으로 REST API를 생성합니다:

- `GET /profiles` - 프로필 목록
- `POST /profiles` - 프로필 생성
- `GET /profiles/:id` - 프로필 상세
- `PUT /profiles/:id` - 프로필 수정
- `DELETE /profiles/:id` - 프로필 삭제
- `GET /scrape_results?profile_id=xxx` - 스크래핑 결과
- `POST /scrape_history` - 히스토리 저장

## 사용 예시

### CLI로 스크래핑 실행

```bash
# 특정 프로필로 실행
python backend/main.py --profile config/my-profile.yaml

# 이메일 발송 포함
python backend/main.py --profile config/my-profile.yaml --email

# 조용히 실행 (자동화용)
python backend/main.py --profile config/my-profile.yaml --email --silent
```

### GitHub Actions 자동화

```yaml
name: Daily News Scrape
on:
  schedule:
    - cron: '0 9 * * 1-5'  # 평일 오전 9시

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements.txt
      - run: python backend/main.py --profile config/my-profile.yaml --email --silent
        env:
          BKEND_API_KEY: ${{ secrets.BKEND_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GMAIL_EMAIL: ${{ secrets.GMAIL_EMAIL }}
          GMAIL_PASSWORD: ${{ secrets.GMAIL_PASSWORD }}
```

## License

MIT
