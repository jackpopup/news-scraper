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
from datetime import datetime
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
        # API Key는 enduser API에서 사용하지 않음

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
# Deduplication
# ============================================================

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


def deduplicate_articles(articles: List[Dict], threshold: float = 0.5) -> List[Dict]:
    """중복 기사 제거 (엔티티 기반 + 텍스트 유사도)"""
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

            # 2. 엔티티 매칭 체크 - 같은 주체면 낮은 임계값 적용
            entity_match = entities_match(current_entity, existing_entity)
            effective_threshold = 0.25 if entity_match else threshold

            # 3. 제목 유사도 체크
            title_sim = title_similarity(title, existing_title)

            # 4. 요약(내용) 유사도도 함께 체크
            existing_summary = existing.get('summary', '')
            if summary and existing_summary:
                summary_sim = title_similarity(summary, existing_summary)
                # 제목 70% + 요약 30% 가중치
                combined_sim = (title_sim * 0.7) + (summary_sim * 0.3)
            else:
                combined_sim = title_sim

            # 5. 엔티티 매칭 시 추가 보너스 (같은 주체면 유사도 +20%)
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
        print(f"[Step 3] Existing articles: {len(existing_links)}\n")

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
                # 기존 링크 제외
                articles = [a for a in articles if a.link not in existing_links]
                all_articles.extend(articles)

                if not silent:
                    print(f" -> {len(articles)} articles")
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

    # 8. 중복 제거
    if not silent:
        print("[Step 6] Removing duplicates...")

    unique_articles = deduplicate_articles(scored_articles)

    if not silent:
        print(f"   -> Unique articles: {len(unique_articles)}\n")

    # 9. 점수순 정렬
    sorted_articles = sorted(unique_articles, key=lambda x: x.get('final_score', 0), reverse=True)

    # 10. bkend.ai에 저장
    if not silent:
        print("[Step 7] Saving to bkend.ai...")

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
    output_file = output_dir / f"articles_{profile_id[:8]}_{now[:10]}.json"

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'profile_id': profile_id,
            'profile_name': profile_name,
            'scraped_at': now,
            'total_articles': len(articles_to_save),
            'articles': articles_to_save
        }, f, ensure_ascii=False, indent=2)

    if not silent:
        print(f"   -> Saved to bkend.ai: {saved} articles")
        print(f"   -> Saved to file: {output_file}\n")

    # 11. 결과 출력
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
