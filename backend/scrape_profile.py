#!/usr/bin/env python3
"""
Profile-based News Scraper
bkend.ai에서 프로필을 읽어와서 뉴스를 스크래핑하고 articles 컬렉션에 저장
"""

import os
import sys
import io
import json
import re
import html
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from urllib.parse import quote, urlparse

# Fix console encoding for Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Load .env file
from pathlib import Path
env_file = Path(__file__).parent.parent / '.env'
if env_file.exists():
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())


# ============================================================
# Scrape History Management (중복 기사 방지)
# ============================================================

HISTORY_FILE = Path(__file__).parent.parent / 'output' / 'scrape_history.json'
HISTORY_DAYS = 7  # 7일간 히스토리 유지


def load_scrape_history() -> Dict:
    """스크랩 히스토리 로드"""
    if not HISTORY_FILE.exists():
        return {'articles': [], 'last_updated': None}

    try:
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            history = json.load(f)

        # 오래된 항목 제거 (7일 이상)
        cutoff = datetime.now() - timedelta(days=HISTORY_DAYS)
        history['articles'] = [
            a for a in history['articles']
            if datetime.fromisoformat(a['scraped_at']) > cutoff
        ]

        return history
    except Exception:
        return {'articles': [], 'last_updated': None}


def save_scrape_history(history: Dict):
    """스크랩 히스토리 저장"""
    history['last_updated'] = datetime.now().isoformat()
    try:
        HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"히스토리 저장 실패: {e}")


def add_to_history(articles: List[Dict], history: Dict) -> Dict:
    """스크랩한 기사를 히스토리에 추가"""
    now = datetime.now().isoformat()
    for article in articles:
        history['articles'].append({
            'title': article.get('title', ''),
            'link': article.get('link', ''),
            'scraped_at': now
        })
    return history


# ============================================================
# Untrusted Sources (신뢰할 수 없는 소스)
# ============================================================

UNTRUSTED_SOURCES = ['msn.com', 'nate.com']  # 날짜 검증 불가, 오래된 기사 재노출 문제


# ============================================================
# bkend.ai API Client
# ============================================================

class BkendAPIClient:
    """bkend.ai API Client for profile-based scraping"""

    def __init__(self):
        # Production URL 사용 (dev URL은 테이블이 없음)
        self.base_url = 'https://api-enduser.bkend.ai'
        self.project_id = os.environ.get('BKEND_PROJECT_ID', 'hv95e8qu7zgbcuvh7p85')
        self.environment = os.environ.get('BKEND_ENVIRONMENT', 'dev')
        self.api_key = os.environ.get('BKEND_API_KEY', '')

        self.headers = {
            'Content-Type': 'application/json',
            'X-Project-Id': self.project_id,
            'X-Environment': self.environment,
        }
        # API Key가 있으면 인증 헤더 추가 (admin/user 권한 획득)
        # 주의: X-API-Key (API 대문자) - bkend.ai는 대소문자 구분함
        if self.api_key:
            self.headers['X-API-Key'] = self.api_key

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict:
        """Make HTTP request to bkend.ai"""
        url = f"{self.base_url}{endpoint}"

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                params=params,
                timeout=30
            )
            return response.json()
        except Exception as e:
            print(f"API Error: {e}")
            return {'success': False, 'error': str(e)}

    def get_all_profiles(self) -> List[Dict]:
        """모든 프로필 조회"""
        result = self._request('GET', '/data/profiles')
        if result.get('success') and result.get('data'):
            return result['data'].get('items', [])
        return []

    def get_profile(self, profile_id: str) -> Optional[Dict]:
        """특정 프로필 조회"""
        result = self._request('GET', f'/data/profiles/{profile_id}')
        if result.get('success'):
            return result.get('data')
        return None

    def save_article(self, article_data: Dict) -> bool:
        """기사 저장"""
        result = self._request('POST', '/data/articles', data=article_data)
        return result.get('success', False)

    def save_articles_batch(self, articles: List[Dict]) -> int:
        """기사 일괄 저장"""
        saved = 0
        for article in articles:
            if self.save_article(article):
                saved += 1
        return saved

    def get_existing_articles(self, profile_id: str, days: int = 7) -> List[str]:
        """기존 기사 링크 조회 (중복 방지용)"""
        params = {
            'andFilters': json.dumps({'profile_id': profile_id}),
            'limit': 1000
        }
        result = self._request('GET', '/data/articles', params=params)
        if result.get('success') and result.get('data'):
            items = result['data'].get('items', [])
            return [item.get('link', '') for item in items]
        return []


# ============================================================
# News Scrapers
# ============================================================

@dataclass
class RawArticle:
    """스크래핑된 기사 데이터"""
    title: str
    link: str
    summary: str
    source: str
    search_query: str
    time_text: str = ""
    is_recent: bool = False


class GoogleNewsScraper:
    """Google News 스크래퍼"""

    BASE_URL = "https://www.google.com/search"

    def __init__(self, language: str = "ko", region: str = "KR", results_per_query: int = 20):
        self.language = language
        self.region = region
        self.results_per_query = results_per_query

    def search(self, query: str) -> List[RawArticle]:
        """Google News 검색"""
        from bs4 import BeautifulSoup

        encoded_query = quote(query)
        url = f"{self.BASE_URL}?q={encoded_query}&tbm=nws&hl={self.language}&gl={self.region}&tbs=qdr:d"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': f'{self.language}-{self.region},{self.language};q=0.9'
        }

        try:
            response = requests.get(url, headers=headers, timeout=15)
            soup = BeautifulSoup(response.text, 'html.parser')

            articles = []
            for item in soup.select('div.SoaBEf')[:self.results_per_query]:
                article = self._parse_item(item, query)
                if article:
                    articles.append(article)

            return articles
        except Exception as e:
            print(f"  [Google News Error] {query}: {e}")
            return []

    def _parse_item(self, item, query: str) -> Optional[RawArticle]:
        """Google News 결과 파싱"""
        try:
            title_elem = item.select_one('div.n0jPhd') or item.select_one('div.MBeuO')
            if not title_elem:
                return None
            title = title_elem.get_text(strip=True)

            link_elem = item.select_one('a')
            if not link_elem:
                return None
            link = link_elem.get('href', '')

            summary_elem = item.select_one('div.GI74Re')
            summary = summary_elem.get_text(strip=True) if summary_elem else ""

            source_elem = item.select_one('div.NUnG9d') or item.select_one('span.NUnG9d')
            source = source_elem.get_text(strip=True) if source_elem else "Google News"

            time_elem = item.select_one('div.OSrXXb span') or item.select_one('span.WG9SHc')
            time_text = time_elem.get_text(strip=True) if time_elem else ""

            is_recent = self._is_recent(time_text)

            return RawArticle(
                title=title,
                link=link,
                summary=summary,
                source=source,
                search_query=query,
                time_text=time_text,
                is_recent=is_recent
            )
        except Exception:
            return None

    def _is_recent(self, time_text: str) -> bool:
        """24시간 이내인지 확인"""
        if not time_text:
            return False
        time_lower = time_text.lower()
        return any(x in time_lower for x in ['분', '시간', 'minute', 'hour', '1일', '1 day'])


class NaverNewsScraper:
    """Naver News API 스크래퍼"""

    API_URL = "https://openapi.naver.com/v1/search/news.json"

    # 도메인 → 언론사명 매핑
    DOMAIN_TO_SOURCE = {
        # 종합일간지
        'chosun.com': '조선일보',
        'donga.com': '동아일보',
        'joongang.co.kr': '중앙일보',
        'hani.co.kr': '한겨레',
        'khan.co.kr': '경향신문',
        'kmib.co.kr': '국민일보',
        'segye.com': '세계일보',
        'munhwa.com': '문화일보',
        'hankyung.com': '한국경제',
        'mk.co.kr': '매일경제',
        'sedaily.com': '서울경제',
        'fnnews.com': '파이낸셜뉴스',
        'mt.co.kr': '머니투데이',
        'edaily.co.kr': '이데일리',
        'asiae.co.kr': '아시아경제',
        'etnews.com': '전자신문',
        'zdnet.co.kr': 'ZDNet Korea',
        'bloter.net': '블로터',
        'techm.kr': '테크M',
        'itworld.co.kr': 'ITWorld',
        # IT/테크
        'theverge.com': 'The Verge',
        'techcrunch.com': 'TechCrunch',
        'wired.com': 'Wired',
        'engadget.com': 'Engadget',
        # 경제/비즈니스
        'etoday.co.kr': '이투데이',
        'news1.kr': '뉴스1',
        'newsis.com': '뉴시스',
        'yna.co.kr': '연합뉴스',
        'yonhapnews.co.kr': '연합뉴스',
        'ytn.co.kr': 'YTN',
        'sbs.co.kr': 'SBS',
        'kbs.co.kr': 'KBS',
        'mbc.co.kr': 'MBC',
        'jtbc.co.kr': 'JTBC',
        'biz.chosun.com': '조선비즈',
        'news.mt.co.kr': '머니투데이',
        'weekly.chosun.com': '주간조선',
        'economist.co.kr': '이코노미스트',
        # 스타트업/IT 전문
        'platum.kr': '플래텀',
        'venturesquare.net': '벤처스퀘어',
        'besuccess.com': 'beSUCCESS',
        'startupn.kr': '스타트업엔',
        'thevc.kr': '더브이씨',
        'dealsite.co.kr': '딜사이트',
        # 기타
        'hankookilbo.com': '한국일보',
        'ohmynews.com': '오마이뉴스',
        'mediatoday.co.kr': '미디어오늘',
        'sisain.co.kr': '시사IN',
        'pressian.com': '프레시안',
        'newstapa.org': '뉴스타파',
        'nocutnews.co.kr': 'CBS노컷뉴스',
        'moneys.mt.co.kr': '머니S',
        'weekly.donga.com': '주간동아',
        'thebell.co.kr': '더벨',
        'bizwatch.co.kr': '비즈워치',
        'bloter.net': '블로터',
        'byline.network': '바이라인네트워크',
        'ddaily.co.kr': '디지털데일리',
        'inews24.com': '아이뉴스24',
        'itchosun.com': 'IT조선',
        'boannews.com': '보안뉴스',
        'dailysecu.com': '데일리시큐',
        'ajunews.com': '아주경제',
        'newspim.com': '뉴스핌',
        'bokuennews.com': '보건뉴스',
        'medifonews.com': '메디포뉴스',
        'healthinnews.co.kr': '헬스인뉴스',
        'yakup.com': '약업닷컴',
        # 추가 언론사
        'newdaily.co.kr': '뉴데일리',
        'greened.kr': '그린포스트코리아',
        'heraldcorp.com': '헤럴드경제',
        'herald.co.kr': '헤럴드경제',
        'hankooki.com': '한국아이닷컴',
        'kdfnews.com': 'KDF뉴스',
        'einfomax.co.kr': '연합인포맥스',
        'kidd.co.kr': '한국산업일보',
        'biztribune.co.kr': '비즈트리뷴',
        'fomos.kr': '포모스',
        'gameple.co.kr': '게임플',
        'newsprime.co.kr': '프라임경제',
        'pinpointnews.co.kr': '핀포인트뉴스',
        'womentimes.co.kr': '여성시대',
        'e-sciencenews.com': '이사이언스',
        'gamevu.co.kr': '게임뷰',
        'gamemeca.com': '게임메카',
        'inven.co.kr': '인벤',
        'ruliweb.com': '루리웹',
        'thisisgame.com': '게임동아',
        'gamefocus.co.kr': '게임포커스',
        'gameshot.net': '게임샷',
        'game.donga.com': '게임동아',
        'news.naver.com': '네이버뉴스',
        'n.news.naver.com': '네이버뉴스',
        'sports.chosun.com': '스포츠조선',
        'sports.donga.com': '스포츠동아',
        'sports.khan.co.kr': '스포츠경향',
        'isplus.joins.com': '일간스포츠',
        'osen.mt.co.kr': 'OSEN',
        'starnewskorea.com': '스타뉴스',
        'mydaily.co.kr': '마이데일리',
        'topstarnews.net': '톱스타뉴스',
        'digitalchosun.dizzo.com': '디지털조선일보',
        'it.chosun.com': 'IT조선',
        'biz.newdaily.co.kr': '뉴데일리경제',
        'news.heraldcorp.com': '헤럴드경제',
    }

    def __init__(self, results_per_query: int = 20):
        self.results_per_query = results_per_query
        self.client_id = os.environ.get('NAVER_CLIENT_ID', '')
        self.client_secret = os.environ.get('NAVER_CLIENT_SECRET', '')

    def search(self, query: str) -> List[RawArticle]:
        """Naver News API 검색"""
        if not self.client_id or not self.client_secret:
            print(f"  [Naver API] API 키가 설정되지 않았습니다.")
            return []

        headers = {
            'X-Naver-Client-Id': self.client_id,
            'X-Naver-Client-Secret': self.client_secret,
        }

        params = {
            'query': query,
            'display': self.results_per_query,
            'start': 1,
            'sort': 'date',  # 최신순 정렬
        }

        try:
            response = requests.get(self.API_URL, headers=headers, params=params, timeout=15)

            if response.status_code != 200:
                print(f"  [Naver API Error] {query}: HTTP {response.status_code}")
                return []

            data = response.json()
            articles = []

            for item in data.get('items', []):
                article = self._parse_item(item, query)
                if article:
                    articles.append(article)

            return articles
        except Exception as e:
            print(f"  [Naver API Error] {query}: {e}")
            return []

    def _parse_item(self, item: Dict, query: str) -> Optional[RawArticle]:
        """Naver API 결과 파싱"""
        try:
            # HTML 태그 제거 후 HTML 엔티티 디코딩 (&quot; → ", &amp; → & 등)
            title = html.unescape(re.sub(r'<[^>]+>', '', item.get('title', '')))
            description = html.unescape(re.sub(r'<[^>]+>', '', item.get('description', '')))

            link = item.get('originallink') or item.get('link', '')

            # 원 언론사 추출
            source = self._extract_source(link)

            # pubDate 파싱: "Thu, 02 Jan 2026 14:30:00 +0900"
            pub_date = item.get('pubDate', '')
            time_text = self._format_time(pub_date)

            is_recent = self._is_recent(pub_date)

            return RawArticle(
                title=title,
                link=link,
                summary=description,
                source=source,
                search_query=query,
                time_text=time_text,
                is_recent=is_recent
            )
        except Exception:
            return None

    def _extract_source(self, url: str) -> str:
        """URL에서 언론사명 추출"""
        if not url:
            return "네이버뉴스"

        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()

            # www. 제거
            if domain.startswith('www.'):
                domain = domain[4:]

            # 정확히 매칭되는 도메인 찾기
            if domain in self.DOMAIN_TO_SOURCE:
                return self.DOMAIN_TO_SOURCE[domain]

            # 서브도메인 포함 매칭 (예: news.chosun.com → 조선일보)
            for known_domain, source_name in self.DOMAIN_TO_SOURCE.items():
                if domain.endswith('.' + known_domain) or domain == known_domain:
                    return source_name

            # 매핑에 없으면 도메인 이름을 정리해서 반환
            # 예: news.example.co.kr → example
            parts = domain.replace('.co.kr', '').replace('.com', '').replace('.kr', '').replace('.net', '').split('.')
            if parts:
                # 마지막 의미있는 부분 (news.abc → abc)
                name = parts[-1] if len(parts) == 1 else parts[-1] if parts[-1] != 'news' else parts[0]
                return name.upper() if len(name) <= 4 else name.capitalize()

            return "네이버뉴스"
        except Exception:
            return "네이버뉴스"

    def _format_time(self, pub_date: str) -> str:
        """발행 시간을 읽기 쉬운 형태로 변환"""
        if not pub_date:
            return ""
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(pub_date)
            now = datetime.now(dt.tzinfo)
            diff = now - dt

            if diff.total_seconds() < 3600:
                return f"{int(diff.total_seconds() // 60)}분 전"
            elif diff.total_seconds() < 86400:
                return f"{int(diff.total_seconds() // 3600)}시간 전"
            else:
                return f"{diff.days}일 전"
        except Exception:
            return pub_date

    def _is_recent(self, pub_date: str) -> bool:
        """24시간 이내인지 확인"""
        if not pub_date:
            return False
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(pub_date)
            now = datetime.now(dt.tzinfo)
            diff = now - dt
            return diff.total_seconds() < 86400
        except Exception:
            return False


# ============================================================
# Scoring Engine
# ============================================================

class ProfileScoringEngine:
    """프로필 기반 스코어링 엔진"""

    def __init__(self, profile: Dict):
        self.profile = profile
        self.company_tiers = profile.get('company_tiers', [])
        self.bonus_groups = profile.get('bonus_groups', [])
        self.penalty_groups = profile.get('penalty_groups', [])

    def score_article(self, article: RawArticle) -> Dict:
        """기사 점수 계산"""
        text = (article.title + ' ' + article.summary).lower()

        # 1. Company Score
        company_score = 0
        company_matched = None
        company_breakdown = []

        for tier in sorted(self.company_tiers, key=lambda t: t.get('tier', 99)):
            tier_score = tier.get('score', 0)
            for company in tier.get('companies', []):
                keywords = company.get('keywords', [company.get('name', '')])
                for keyword in keywords:
                    if keyword and keyword.lower() in text:
                        company_score = tier_score
                        company_matched = company.get('name', keyword)
                        company_breakdown.append({
                            'tier': tier.get('tier'),
                            'label': tier.get('label'),
                            'company': company_matched,
                            'keyword': keyword,
                            'score': tier_score
                        })
                        break
                if company_matched:
                    break
            if company_matched:
                break

        # 2. Bonus Score
        bonus_score = 0
        bonus_breakdown = []

        for group in self.bonus_groups:
            if not group.get('enabled', True):
                continue

            group_score = group.get('score', 0)
            matched_keyword = None

            for keyword in group.get('keywords', []):
                if keyword and keyword.lower() in text:
                    matched_keyword = keyword
                    break

            # 패턴 매칭
            if not matched_keyword:
                for pattern in group.get('patterns', []):
                    if pattern and re.search(pattern, text, re.IGNORECASE):
                        matched_keyword = f"pattern:{pattern}"
                        break

            if matched_keyword:
                bonus_score += group_score
                bonus_breakdown.append({
                    'group': group.get('label', group.get('id', '')),
                    'keyword': matched_keyword,
                    'score': group_score
                })

        # 3. Penalty Score
        penalty_score = 0
        penalty_breakdown = []

        for group in self.penalty_groups:
            if not group.get('enabled', True):
                continue

            group_score = group.get('score', 0)  # 이미 음수

            for keyword in group.get('keywords', []):
                if keyword and keyword.lower() in text:
                    penalty_score += group_score
                    penalty_breakdown.append({
                        'group': group.get('label', group.get('id', '')),
                        'keyword': keyword,
                        'score': group_score
                    })
                    break  # 그룹당 한 번만

        # 4. Final Score
        final_score = company_score + bonus_score + penalty_score

        return {
            'title': article.title,
            'link': article.link,
            'source': article.source,
            'summary': article.summary,
            'search_query': article.search_query,
            'time_text': article.time_text,
            'is_recent': article.is_recent,
            'final_score': final_score,
            'company_score': company_score,
            'company_matched': company_matched,
            'company_breakdown': company_breakdown,
            'bonus_score': bonus_score,
            'bonus_breakdown': bonus_breakdown,
            'penalty_score': penalty_score,
            'penalty_breakdown': penalty_breakdown,
        }


# ============================================================
# Deduplication (Enhanced with ONDA scraper features)
# ============================================================

# 불용어 (의미 없는 단어)
STOPWORDS = {
    '의', '를', '을', '이', '가', '은', '는', '에', '에서', '와', '과',
    '로', '으로', '도', '만', '더', '등', '및', '또', '그', '저', '이런',
    '것', '수', '중', '후', '전', '약', '각', '매', '내', '외', '상', '하',
    '대', '소', '신', '구', '위', '아래', '앞', '뒤', '간', '별', '당',
    '말', '년', '월', '일', '시', '분', '초', '명', '개', '곳', '번',
    '절반', '이상', '최대', '최소', '약', '경험', '집중', '새해', '올해'
}


def has_same_core_keywords(title1: str, title2: str) -> bool:
    """
    두 제목이 같은 핵심 키워드를 공유하는지 확인
    예: "해외숙박 예약 플랫폼 이용자 절반 이상 피해 경험"
        "해외숙박 예약 플랫폼 이용자 54.6% 피해 경험"
    -> 핵심 키워드: 해외숙박, 플랫폼, 이용자, 피해 -> 중복
    """
    def extract_keywords(title: str) -> set:
        # 숫자와 % 제거
        title_clean = re.sub(r'\d+\.?\d*%?', '', title)
        # 특수문자 제거 (한글, 영문, 숫자만 남김)
        title_clean = re.sub(r'[^\w\s가-힣]', ' ', title_clean)
        # 단어 분리
        words = title_clean.lower().split()
        # 2글자 이상, 불용어 제외
        keywords = set(w for w in words if len(w) >= 2 and w not in STOPWORDS)
        return keywords

    kw1 = extract_keywords(title1)
    kw2 = extract_keywords(title2)

    if not kw1 or not kw2:
        return False

    # 공통 키워드 비율 계산
    common = kw1 & kw2
    smaller_set = min(len(kw1), len(kw2))

    # 작은 집합의 50% 이상이 공통이면 중복
    if smaller_set > 0 and len(common) / smaller_set >= 0.5:
        return True

    # 핵심 주제 키워드가 3개 이상 공통이면 중복
    if len(common) >= 3:
        return True

    return False


def extract_article_topic(article: Dict) -> Dict:
    """기사의 핵심 토픽 추출 (중복 판단용)"""
    text = (article.get('title', '') + ' ' + article.get('summary', '')).lower()

    # 금액 추출
    amounts = re.findall(r'\d+억|\d+조|\d+만', text)

    # 이벤트 타입 추출
    event_type = None
    if any(kw in text for kw in ['투자', '펀딩', '시리즈']):
        event_type = 'investment'
    elif any(kw in text for kw in ['인수', '합병', 'm&a']):
        event_type = 'ma'
    elif any(kw in text for kw in ['출시', '런칭', '오픈']):
        event_type = 'launch'
    elif any(kw in text for kw in ['실적', '매출', '영업이익']):
        event_type = 'earnings'
    elif any(kw in text for kw in ['규제', '법안', '허용', '금지']):
        event_type = 'regulation'

    return {
        'amounts': amounts,
        'event_type': event_type
    }


def is_same_story(article1: Dict, article2: Dict) -> bool:
    """
    두 기사가 같은 사건/스토리인지 판단
    - 같은 회사 + 같은 이벤트 타입 = 같은 스토리
    - 같은 회사 + 같은 금액 = 같은 스토리
    """
    topic1 = extract_article_topic(article1)
    topic2 = extract_article_topic(article2)

    # 회사명 추출 (company_matched가 있으면 사용)
    company1 = article1.get('company_matched', '')
    company2 = article2.get('company_matched', '')

    # company_matched가 없으면 제목에서 추출
    if not company1:
        company1 = extract_main_entity(article1.get('title', ''))
    if not company2:
        company2 = extract_main_entity(article2.get('title', ''))

    # 같은 회사 + 같은 이벤트 타입 = 같은 스토리
    if company1 and company2 and company1.lower() == company2.lower():
        if topic1['event_type'] == topic2['event_type'] and topic1['event_type'] is not None:
            return True

        # 같은 회사 + 같은 금액 = 같은 스토리
        shared_amounts = set(topic1['amounts']) & set(topic2['amounts'])
        if shared_amounts:
            return True

    # 제목의 공통 단어가 많으면 중복
    title1 = article1.get('title', '').lower()
    title2 = article2.get('title', '').lower()
    words1 = set(re.sub(r'[^\w\s]', '', title1).split())
    words2 = set(re.sub(r'[^\w\s]', '', title2).split())
    common_words = words1 & words2
    meaningful_common = common_words - STOPWORDS

    # 같은 회사가 언급되고 공통 단어가 3개 이상이면 중복
    if company1 and company1.lower() == company2.lower() and len(meaningful_common) >= 3:
        return True

    return False


def is_already_scraped(article: Dict, history: Dict) -> bool:
    """
    이미 스크랩한 기사인지 확인
    - 같은 링크
    - 또는 제목 유사도 50% 이상
    - 또는 핵심 키워드가 동일한 경우
    """
    for hist_article in history.get('articles', []):
        # 같은 링크면 중복
        if article.get('link') == hist_article.get('link'):
            return True

        # 제목 유사도 체크 (50% 이상이면 중복)
        similarity = title_similarity(article.get('title', ''), hist_article.get('title', ''))
        if similarity >= 0.5:
            return True

        # 핵심 키워드 기반 중복 체크
        if has_same_core_keywords(article.get('title', ''), hist_article.get('title', '')):
            return True

    return False


def filter_already_scraped(articles: List[Dict], history: Dict, silent: bool = False) -> List[Dict]:
    """이미 스크랩한 기사 필터링"""
    new_articles = []
    skipped = 0

    for article in articles:
        if is_already_scraped(article, history):
            skipped += 1
        else:
            new_articles.append(article)

    if not silent and skipped > 0:
        print(f"   -> 이전 스크랩 기사 {skipped}개 제외")

    return new_articles


def is_untrusted_source(link: str) -> bool:
    """신뢰할 수 없는 소스인지 확인"""
    link_lower = link.lower()
    for source in UNTRUSTED_SOURCES:
        if source in link_lower:
            return True
    return False


def is_too_old_article(time_text: str) -> bool:
    """
    48시간(2일) 이상 지난 기사인지 체크
    True면 너무 오래된 기사 (제외 대상)
    """
    if not time_text:
        return False  # 시간 정보가 없으면 일단 통과

    # 신선한 기사 마커 (통과)
    fresh_markers = ['분 전', '시간 전', '1일 전', '1일전', '어제', '분', '시간']
    for marker in fresh_markers:
        if marker in time_text:
            return False  # 신선한 기사

    # 2일 이상 된 기사는 모두 제외
    old_markers = ['2일', '3일', '4일', '5일', '6일', '7일', '주일', '주 전', '개월', '년 전']
    for marker in old_markers:
        if marker in time_text:
            return True

    return False  # 알 수 없는 형식이면 일단 통과


def extract_actual_publish_date(url: str, timeout: int = 5) -> Optional[str]:
    """
    기사 URL에서 실제 발행일 추출 (메타태그/JSON-LD에서)
    Returns: YYYY-MM-DD 형식 날짜 또는 None
    """
    from bs4 import BeautifulSoup

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        soup = BeautifulSoup(response.text, 'html.parser')

        # 1. meta article:published_time (가장 신뢰할 수 있음)
        meta = soup.find('meta', {'property': 'article:published_time'})
        if meta and meta.get('content'):
            return meta['content'][:10]

        # 2. meta datePublished
        meta = soup.find('meta', {'itemprop': 'datePublished'})
        if meta and meta.get('content'):
            return meta['content'][:10]

        # 3. JSON-LD structured data
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.text)
                if isinstance(data, dict) and 'datePublished' in data:
                    return data['datePublished'][:10]
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and 'datePublished' in item:
                            return item['datePublished'][:10]
            except:
                pass

        # 4. time 태그의 datetime 속성
        time_tag = soup.find('time', datetime=True)
        if time_tag:
            return time_tag['datetime'][:10]

        # 5. URL에서 날짜 패턴 추출 (fallback)
        date_patterns = [
            r'/(\d{4})/(\d{2})/(\d{2})/',
            r'/(\d{4})(\d{2})(\d{2})',
            r'[=/](\d{4})-(\d{2})-(\d{2})',
            r'[=/](\d{4})\.(\d{2})\.(\d{2})',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, url)
            if match:
                return f'{match.group(1)}-{match.group(2)}-{match.group(3)}'

        return None
    except Exception:
        return None


def verify_article_freshness(article: Dict, max_days: int = 2) -> tuple:
    """
    기사의 실제 발행일을 확인하여 신선도 검증

    Args:
        article: 기사 dict (link 필드 필요)
        max_days: 허용할 최대 일수 (기본 2일)

    Returns:
        tuple: (is_fresh: bool, actual_date: str or None)
    """
    url = article.get('link', '')
    if not url:
        return True, None

    actual_date = extract_actual_publish_date(url)
    if not actual_date:
        return True, None  # 날짜를 못 찾으면 일단 통과

    try:
        pub_date = datetime.strptime(actual_date, '%Y-%m-%d')
        days_old = (datetime.now() - pub_date).days

        article['actual_publish_date'] = actual_date
        article['days_old'] = days_old

        return days_old <= max_days, actual_date
    except:
        return True, actual_date


def extract_main_entity(title: str) -> str:
    """제목에서 주요 엔티티(인물/회사명) 추출"""
    # 대괄호 태그 제거 (예: [신년사], [단독], [속보])
    clean_title = re.sub(r'\[[^\]]+\]', '', title)
    # 특수문자 제거
    clean_title = re.sub(r'[^\w\s]', ' ', clean_title)
    words = clean_title.split()

    if not words:
        return ""

    # 스킵할 단어들 (태그성 단어)
    skip_words = {'신년사', '단독', '속보', '종합', '긴급', '업데이트', '오피셜', '공식'}

    # 스킵 단어 제거
    words = [w for w in words if w not in skip_words]

    if not words:
        return ""

    # 패턴 1: "인물명 회사명" (예: "정신아 카카오", "이재용 삼성")
    # 한글 이름(2-4글자) + 회사명 패턴
    if len(words) >= 2:
        first = words[0]
        second = words[1]
        # 첫 단어가 한글 이름 패턴 (2-4글자)
        if 2 <= len(first) <= 4 and all('\uac00' <= c <= '\ud7a3' for c in first):
            # 두 번째 단어가 회사명이면 둘 다 반환
            if len(second) >= 2:
                return f"{first} {second}"

    # 패턴 2: 회사명만 (예: "카카오", "네이버", "삼성전자")
    # 첫 번째 의미있는 단어(2글자 이상)를 엔티티로
    for word in words[:3]:
        if len(word) >= 2:
            return word

    return words[0] if words else ""


def entities_match(entity1: str, entity2: str) -> bool:
    """두 엔티티가 같은 주체인지 확인"""
    if not entity1 or not entity2:
        return False

    e1 = entity1.lower().strip()
    e2 = entity2.lower().strip()

    # 완전 일치
    if e1 == e2:
        return True

    # 한 쪽이 다른 쪽을 포함
    if e1 in e2 or e2 in e1:
        return True

    # 단어 단위로 비교 (인물+회사 패턴)
    words1 = set(e1.split())
    words2 = set(e2.split())

    # 공통 단어가 있으면 (인물명 또는 회사명 일치)
    common = words1 & words2
    if common:
        # 공통 단어가 2글자 이상이면 같은 주체로 간주
        if any(len(w) >= 2 for w in common):
            return True

    return False


def deduplicate_articles(articles: List[Dict], threshold: float = 0.35) -> List[Dict]:
    """
    중복 기사 제거 (강화된 버전)
    - 엔티티 기반 + 텍스트 유사도
    - 같은 스토리 판단 (회사+이벤트, 회사+금액)
    - 핵심 키워드 공유 체크
    """
    unique = []

    for article in articles:
        is_dup = False
        title = article.get('title', '')
        link = article.get('link', '')
        summary = article.get('summary', '')

        # 현재 기사의 주요 엔티티 추출
        current_entity = extract_main_entity(title)

        for existing in unique:
            # 1. 링크가 같으면 중복
            if link and link == existing.get('link', ''):
                is_dup = True
                break

            existing_title = existing.get('title', '')
            existing_entity = extract_main_entity(existing_title)

            # 2. 같은 스토리인지 체크 (회사+이벤트 또는 회사+금액)
            if is_same_story(article, existing):
                is_dup = True
                # 점수가 더 높은 것 유지
                if article.get('final_score', 0) > existing.get('final_score', 0):
                    unique.remove(existing)
                    unique.append(article)
                break

            # 3. 핵심 키워드 공유 체크
            if has_same_core_keywords(title, existing_title):
                is_dup = True
                if article.get('final_score', 0) > existing.get('final_score', 0):
                    unique.remove(existing)
                    unique.append(article)
                break

            # 4. 엔티티 매칭 체크 - 같은 주체면 낮은 임계값 적용
            entity_match = entities_match(current_entity, existing_entity)
            effective_threshold = 0.25 if entity_match else threshold

            # 5. 제목 유사도 체크
            title_sim = title_similarity(title, existing_title)

            # 6. 요약(내용) 유사도도 함께 체크
            existing_summary = existing.get('summary', '')
            if summary and existing_summary:
                summary_sim = title_similarity(summary, existing_summary)
                # 제목 70% + 요약 30% 가중치
                combined_sim = (title_sim * 0.7) + (summary_sim * 0.3)
            else:
                combined_sim = title_sim

            # 7. 엔티티 매칭 시 추가 보너스 (같은 주체면 유사도 +20%)
            if entity_match:
                combined_sim = min(1.0, combined_sim + 0.2)

            if combined_sim >= effective_threshold:
                # 점수가 높은 것을 유지
                if article.get('final_score', 0) > existing.get('final_score', 0):
                    unique.remove(existing)
                    unique.append(article)
                is_dup = True
                break

        if not is_dup:
            unique.append(article)

    return unique


def title_similarity(title1: str, title2: str) -> float:
    """제목 유사도 계산 (한국어 뉴스 최적화)"""
    # 특수문자 제거 및 소문자 변환
    clean1 = re.sub(r'[^\w\s]', '', title1.lower())
    clean2 = re.sub(r'[^\w\s]', '', title2.lower())

    words1 = set(clean1.split())
    words2 = set(clean2.split())

    if not words1 or not words2:
        return 0.0

    # 1. Jaccard 유사도
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    jaccard = intersection / union if union > 0 else 0.0

    # 2. 핵심 키워드 매칭 (길이 2 이상 단어, 한국어 특성 반영)
    core_words1 = set(w for w in words1 if len(w) >= 2)
    core_words2 = set(w for w in words2 if len(w) >= 2)

    if core_words1 and core_words2:
        core_intersection = len(core_words1 & core_words2)
        # 교집합 / 더 작은 집합 크기 (포함 비율)
        min_size = min(len(core_words1), len(core_words2))
        core_sim = core_intersection / min_size if min_size > 0 else 0.0
    else:
        core_sim = 0.0

    # 3. 첫 단어(주어) 일치 여부 - 같은 주제인지 확인
    first_word_match = 1.0 if clean1.split()[0] == clean2.split()[0] else 0.0

    # 4. 동의어/유사어 매칭
    synonyms = {
        '출시': {'출시', '론칭', '런칭', '발표', '공개', '선보'},
        '론칭': {'출시', '론칭', '런칭', '발표', '공개', '선보'},
        'db': {'db', '데이터베이스', 'database'},
        '데이터베이스': {'db', '데이터베이스', 'database'},
        '서비스': {'서비스', '솔루션', '플랫폼'},
        '기반': {'기반', '기반의', '활용'},
    }

    # 동의어 확장된 단어 집합
    def expand_synonyms(words: set) -> set:
        expanded = set(words)
        for word in words:
            if word in synonyms:
                expanded.update(synonyms[word])
        return expanded

    expanded1 = expand_synonyms(core_words1)
    expanded2 = expand_synonyms(core_words2)
    expanded_intersection = len(expanded1 & expanded2)
    expanded_union = len(expanded1 | expanded2)
    synonym_sim = expanded_intersection / expanded_union if expanded_union > 0 else 0.0

    # 가중 평균: Jaccard 20%, Core 30%, 첫단어 20%, 동의어 30%
    final_sim = (jaccard * 0.2) + (core_sim * 0.3) + (first_word_match * 0.2) + (synonym_sim * 0.3)

    return final_sim


# ============================================================
# Main Scraper
# ============================================================

def scrape_profile(profile_id: str, silent: bool = False):
    """프로필 기반 뉴스 스크래핑 실행"""

    if not silent:
        print("=" * 60)
        print("News Curator - Profile-based Scraper")
        print("=" * 60)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # 1. bkend.ai 클라이언트 초기화
    client = BkendAPIClient()

    # 2. 프로필 조회
    if not silent:
        print(f"[Step 1] Loading profile: {profile_id}")

    profile = client.get_profile(profile_id)
    if not profile:
        print(f"Error: Profile not found: {profile_id}")
        return None

    profile_name = profile.get('name', 'Unknown')
    if not silent:
        print(f"   -> Profile: {profile_name}\n")

    # 3. 검색 쿼리 추출
    search_queries_config = profile.get('search_queries', {})
    search_queries = (
        search_queries_config.get('auto_generated', []) +
        search_queries_config.get('user_added', [])
    )
    disabled = set(search_queries_config.get('disabled', []))
    search_queries = [q for q in search_queries if q not in disabled]

    if not search_queries:
        print("Error: No search queries in profile")
        return None

    if not silent:
        print(f"[Step 2] Search queries ({len(search_queries)} total):")
        for q in search_queries[:5]:
            print(f"   - {q}")
        if len(search_queries) > 5:
            print(f"   ... and {len(search_queries) - 5} more\n")

    # 4. 기존 기사 링크 조회 (중복 방지)
    existing_links = set(client.get_existing_articles(profile_id))
    if not silent:
        print(f"[Step 3] Existing articles in DB: {len(existing_links)}")

    # 4-1. 로컬 히스토리 로드 (7일간 스크랩 기록)
    history = load_scrape_history()
    if not silent:
        print(f"   -> Local history: {len(history.get('articles', []))} articles\n")

    # 5. 뉴스 소스 설정
    filters = profile.get('filters', {})
    sources_config = filters.get('sources', {'google_news': True, 'naver_news': True})

    scrapers = []
    if sources_config.get('google_news', True):
        scrapers.append(('Google News', GoogleNewsScraper()))
    if sources_config.get('naver_news', True):
        scrapers.append(('Naver News', NaverNewsScraper()))

    # 6. 스크래핑 실행
    if not silent:
        print(f"[Step 4] Scraping from {len(scrapers)} sources...")

    all_articles: List[RawArticle] = []

    for source_name, scraper in scrapers:
        if not silent:
            print(f"\n   [{source_name}]")

        for query in search_queries:
            if not silent:
                print(f"      Searching: {query}", end='')

            try:
                articles = scraper.search(query)
                initial_count = len(articles)

                # 기존 링크 제외
                articles = [a for a in articles if a.link not in existing_links]

                # 신뢰할 수 없는 소스 제외
                articles = [a for a in articles if not is_untrusted_source(a.link)]

                # 48시간 이상 된 기사 제외
                articles = [a for a in articles if not is_too_old_article(a.time_text)]

                all_articles.extend(articles)

                if not silent:
                    filtered = initial_count - len(articles)
                    filter_info = f" (filtered {filtered})" if filtered > 0 else ""
                    print(f" -> {len(articles)} articles{filter_info}")
            except Exception as e:
                if not silent:
                    print(f" -> Error: {e}")

    if not silent:
        print(f"\n   -> Total collected: {len(all_articles)} articles\n")

    if not all_articles:
        print("No new articles found.")
        return {'articles': [], 'saved': 0}

    # 7. 스코어링
    if not silent:
        print("[Step 5] Scoring articles...")

    scoring_engine = ProfileScoringEngine(profile)
    scored_articles = [scoring_engine.score_article(a) for a in all_articles]

    # 8. 히스토리 기반 중복 제거 (이전 스크랩 기록과 비교)
    if not silent:
        print("[Step 6] Checking against history...")

    before_history = len(scored_articles)
    scored_articles = filter_already_scraped(scored_articles, history, silent=silent)
    if not silent and before_history > len(scored_articles):
        print(f"   -> After history filter: {len(scored_articles)} articles")

    # 9. 세션 내 중복 제거 (같은 스토리, 핵심 키워드 공유 등)
    if not silent:
        print("[Step 7] Removing duplicates (same story, keywords)...")

    unique_articles = deduplicate_articles(scored_articles)

    if not silent:
        print(f"   -> Unique articles: {len(unique_articles)}\n")

    # 10. 점수순 정렬
    sorted_articles = sorted(unique_articles, key=lambda x: x.get('final_score', 0), reverse=True)

    # 11. bkend.ai에 저장
    if not silent:
        print("[Step 8] Saving to bkend.ai...")

    now = datetime.now().isoformat()
    saved = 0
    articles_to_save = []

    for rank, article in enumerate(sorted_articles, 1):
        article_data = {
            'profile_id': profile_id,
            'result_id': f"{profile_id}_{now[:10]}",
            'title': article['title'],
            'link': article['link'],
            'source': article['source'],
            'summary': article.get('summary', ''),
            'published_at': now,  # 실제로는 time_text를 파싱해야 함
            'scraped_at': now,
            'final_score': article['final_score'],
            'company_score': article['company_score'],
            'company_matched': article.get('company_matched'),
            'bonus_score': article['bonus_score'],
            'bonus_breakdown': article.get('bonus_breakdown', []),
            'penalty_score': article['penalty_score'],
            'penalty_breakdown': article.get('penalty_breakdown', []),
            'is_duplicate': False,
            'rank': rank
        }
        articles_to_save.append(article_data)

        if client.save_article(article_data):
            saved += 1

    # 로컬 파일로도 저장 (백업 및 테이블 미생성 시 대비)
    output_dir = Path(__file__).parent.parent / 'output'
    output_dir.mkdir(exist_ok=True)

    # 날짜 포함 파일 (히스토리용)
    output_file = output_dir / f"articles_{profile_id[:8]}_{now[:10]}.json"

    # 프로필별 최신 파일 (프론트엔드용) - 항상 같은 이름으로 덮어씀
    latest_file = output_dir / f"articles_{profile_id}.json"

    article_data_output = {
        'profile_id': profile_id,
        'profile_name': profile_name,
        'scraped_at': now,
        'total_articles': len(articles_to_save),
        'articles': articles_to_save
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(article_data_output, f, ensure_ascii=False, indent=2)

    # 프로필별 최신 파일도 저장
    with open(latest_file, 'w', encoding='utf-8') as f:
        json.dump(article_data_output, f, ensure_ascii=False, indent=2)

    if not silent:
        print(f"   -> Saved to bkend.ai: {saved} articles")
        print(f"   -> Saved to file: {output_file}\n")

    # 12. 히스토리에 추가 및 저장
    history = add_to_history(articles_to_save, history)
    save_scrape_history(history)
    if not silent:
        print(f"[Step 9] Updated scrape history: {len(history.get('articles', []))} articles\n")

    # 13. 결과 출력
    if not silent:
        print("=" * 60)
        print(f"TOP 10 Articles")
        print("=" * 60)

        for idx, article in enumerate(sorted_articles[:10], 1):
            score = article['final_score']
            company = article.get('company_matched', '')
            company_str = f" [{company}]" if company else ""

            print(f"\n[{idx}] Score: {score}{company_str}")
            print(f"    {article['title'][:60]}...")
            print(f"    Source: {article['source']}")

            if article.get('bonus_breakdown'):
                bonuses = ', '.join([b['group'] for b in article['bonus_breakdown'][:3]])
                print(f"    Bonus: {bonuses}")

    if not silent:
        print("\n" + "=" * 60)
        print(f"Scraping complete! Saved {saved} articles.")
        print("=" * 60)

    return {
        'profile_id': profile_id,
        'profile_name': profile_name,
        'total_collected': len(all_articles),
        'unique_articles': len(unique_articles),
        'saved': saved,
        'articles': sorted_articles[:10]
    }


def scrape_all_profiles(silent: bool = False):
    """모든 프로필 스크래핑"""
    client = BkendAPIClient()
    profiles = client.get_all_profiles()

    if not profiles:
        print("No profiles found.")
        return

    print(f"Found {len(profiles)} profiles\n")

    results = []
    for profile in profiles:
        profile_id = profile.get('_id')
        profile_name = profile.get('name', 'Unknown')

        print(f"\n{'='*60}")
        print(f"Scraping profile: {profile_name}")
        print(f"{'='*60}\n")

        result = scrape_profile(profile_id, silent=True)
        if result:
            results.append(result)
            print(f"  -> Saved {result.get('saved', 0)} articles")

    return results


# ============================================================
# CLI Entry Point
# ============================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Profile-based News Scraper')
    parser.add_argument('--profile', '-p', type=str, help='Profile ID to scrape')
    parser.add_argument('--all', '-a', action='store_true', help='Scrape all profiles')
    parser.add_argument('--silent', '-s', action='store_true', help='Suppress output')
    parser.add_argument('--list', '-l', action='store_true', help='List all profiles')

    args = parser.parse_args()

    if args.list:
        client = BkendAPIClient()
        profiles = client.get_all_profiles()
        print(f"\nAvailable profiles ({len(profiles)} total):\n")
        for p in profiles:
            print(f"  ID: {p.get('_id')}")
            print(f"  Name: {p.get('name')}")
            print(f"  User: {p.get('user_id', 'N/A')}")
            print()
    elif args.all:
        scrape_all_profiles(silent=args.silent)
    elif args.profile:
        scrape_profile(args.profile, silent=args.silent)
    else:
        parser.print_help()
