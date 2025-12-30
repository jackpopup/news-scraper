"""
Naver News Source Adapter (Korean)
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
from typing import List
from .base import NewsSource, Article


class NaverNewsSource(NewsSource):
    """Naver News scraper for Korean news"""

    SEARCH_URL = "https://search.naver.com/search.naver"
    SECTION_URL = "https://news.naver.com/section"

    # Section IDs
    SECTIONS = {
        'politics': '100',
        'economy': '101',
        'society': '102',
        'culture': '103',
        'world': '104',
        'it': '105',
        'science': '105'
    }

    @property
    def source_name(self) -> str:
        return "Naver News"

    def search(self, query: str) -> List[Article]:
        """Search Naver News for articles"""
        encoded_query = quote(query)
        url = f"{self.SEARCH_URL}?where=news&query={encoded_query}&sort=1"  # sort=1 for recent

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')

            articles = []

            # Try multiple selectors for Naver News results
            news_items = soup.select('div.news_area')
            if not news_items:
                news_items = soup.select('li.bx')
            if not news_items:
                news_items = soup.select('div.news_wrap')

            for item in news_items[:self.results_per_query]:
                article = self._parse_search_result(item, query)
                if article:
                    articles.append(article)

            return articles

        except Exception as e:
            print(f"Naver News search error ({query}): {e}")
            return []

    def _parse_search_result(self, item, query: str) -> Article | None:
        """Parse a single Naver News search result"""
        try:
            # Title - try multiple selectors
            title_elem = item.select_one('a.news_tit')
            if not title_elem:
                title_elem = item.select_one('a.api_txt_lines')
            if not title_elem:
                title_elem = item.select_one('a.news_tit_link')
            if not title_elem:
                return None

            title = title_elem.get_text(strip=True)
            link = title_elem.get('href', '')

            # Summary
            summary_elem = item.select_one('div.news_dsc')
            if not summary_elem:
                summary_elem = item.select_one('div.api_txt_lines.dsc_txt_wrap')
            if not summary_elem:
                summary_elem = item.select_one('a.api_txt_lines.dsc_txt_wrap')
            summary = summary_elem.get_text(strip=True) if summary_elem else ""

            # Publisher
            press_elem = item.select_one('a.info.press')
            if not press_elem:
                press_elem = item.select_one('a.info')
            if not press_elem:
                press_elem = item.select_one('span.info')
            press = press_elem.get_text(strip=True) if press_elem else "Unknown"
            press = press.replace('언론사 선정', '').strip()

            # Time
            time_elem = item.select_one('span.info')
            time_text = ""
            if time_elem:
                # Find time info (usually second span.info)
                info_elems = item.select('span.info')
                for elem in info_elems:
                    text = elem.get_text(strip=True)
                    if any(x in text for x in ['분', '시간', '일', '전']):
                        time_text = text
                        break

            is_recent = self._parse_time_text(time_text)

            return Article(
                title=title,
                link=link,
                summary=summary,
                source=press,
                search_query=query,
                time_text=time_text,
                is_recent=is_recent
            )

        except Exception:
            return None

    def get_section_news(self, section: str = "it") -> List[Article]:
        """Get news from a specific Naver News section"""
        section_id = self.SECTIONS.get(section.lower(), '105')  # Default to IT
        url = f"{self.SECTION_URL}/{section_id}"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')

            articles = []

            # Parse section news items
            news_items = soup.select('div.sa_text')

            for item in news_items[:self.results_per_query]:
                article = self._parse_section_item(item, section)
                if article:
                    articles.append(article)

            return articles

        except Exception as e:
            print(f"Naver section news error: {e}")
            return []

    def _parse_section_item(self, item, section: str) -> Article | None:
        """Parse a single Naver News section item"""
        try:
            # Title
            title_elem = item.select_one('strong.sa_text_strong')
            if not title_elem:
                return None
            title = title_elem.get_text(strip=True)

            # Link
            link_elem = item.select_one('a.sa_text_title')
            if not link_elem:
                link_elem = item.select_one('a')
            link = link_elem.get('href', '') if link_elem else ""

            # Summary
            summary_elem = item.select_one('div.sa_text_lede')
            summary = summary_elem.get_text(strip=True) if summary_elem else ""

            # Publisher
            press_elem = item.select_one('div.sa_text_press')
            press = press_elem.get_text(strip=True) if press_elem else "Naver News"

            return Article(
                title=title,
                link=link,
                summary=summary,
                source=press,
                search_query=f'section:{section}',
                time_text="",
                is_recent=True  # Section news is usually recent
            )

        except Exception:
            return None
