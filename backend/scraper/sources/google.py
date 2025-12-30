"""
Google News Source Adapter
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
from typing import List
from .base import NewsSource, Article


class GoogleNewsSource(NewsSource):
    """Google News scraper"""

    BASE_URL = "https://www.google.com/search"

    @property
    def source_name(self) -> str:
        return "Google News"

    def search(self, query: str) -> List[Article]:
        """Search Google News for articles"""
        encoded_query = quote(query)

        # Build URL with language/region settings
        params = {
            'q': query,
            'tbm': 'nws',
            'hl': self.language,
            'gl': self.region,
            'tbs': 'qdr:w'  # Last week
        }

        url = f"{self.BASE_URL}?q={encoded_query}&tbm=nws&hl={self.language}&gl={self.region}&tbs=qdr:w"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': f'{self.language}-{self.region},{self.language};q=0.9'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')

            articles = []

            # Parse Google News results
            for item in soup.select('div.SoaBEf')[:self.results_per_query]:
                article = self._parse_result_item(item, query)
                if article:
                    articles.append(article)

            return articles

        except Exception as e:
            print(f"Google News search error ({query}): {e}")
            return []

    def _parse_result_item(self, item, query: str) -> Article | None:
        """Parse a single Google News result item"""
        try:
            # Title
            title_elem = item.select_one('div.n0jPhd')
            if not title_elem:
                title_elem = item.select_one('div.MBeuO')
            if not title_elem:
                return None

            title = title_elem.get_text(strip=True)

            # Link
            link_elem = item.select_one('a')
            if not link_elem:
                return None
            link = link_elem.get('href', '')

            # Summary
            summary_elem = item.select_one('div.GI74Re')
            summary = summary_elem.get_text(strip=True) if summary_elem else ""

            # Source/Publisher
            source_elem = item.select_one('div.NUnG9d')
            if not source_elem:
                source_elem = item.select_one('span.NUnG9d')
            if not source_elem:
                source_elem = item.select_one('div.CEMjEf span')
            source = source_elem.get_text(strip=True) if source_elem else "Unknown"

            # Time
            time_elem = item.select_one('div.OSrXXb span')
            if not time_elem:
                time_elem = item.select_one('span.WG9SHc')
            if not time_elem:
                time_elem = item.select_one('div.ZE0LJd span')
            time_text = time_elem.get_text(strip=True) if time_elem else ""

            is_recent = self._parse_time_text(time_text)

            return Article(
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

    def get_section_news(self, section: str = "business") -> List[Article]:
        """Get news from a specific Google News section"""
        # Google News sections are accessed via topic search
        section_queries = {
            'business': 'business news',
            'technology': 'technology news',
            'science': 'science news',
            'health': 'health news',
            'entertainment': 'entertainment news',
            'sports': 'sports news'
        }

        query = section_queries.get(section, f"{section} news")
        return self.search(query)
