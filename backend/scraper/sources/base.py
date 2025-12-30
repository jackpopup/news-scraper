"""
Base News Source Interface
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class Article:
    """Represents a news article"""
    title: str
    link: str
    summary: str
    source: str
    search_query: str
    time_text: str = ""
    is_recent: bool = False
    published_at: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            'title': self.title,
            'link': self.link,
            'summary': self.summary,
            'source': self.source,
            'search_query': self.search_query,
            'time_text': self.time_text,
            'is_recent': self.is_recent,
            'published_at': self.published_at
        }


class NewsSource(ABC):
    """Abstract base class for news sources"""

    def __init__(self, language: str = "en", region: str = "US", results_per_query: int = 10):
        self.language = language
        self.region = region
        self.results_per_query = results_per_query

    @abstractmethod
    def search(self, query: str) -> List[Article]:
        """Search for news articles matching the query"""
        pass

    @abstractmethod
    def get_section_news(self, section: str) -> List[Article]:
        """Get news from a specific section/category"""
        pass

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the name of this news source"""
        pass

    def _parse_time_text(self, time_text: str) -> bool:
        """Parse time text and determine if article is recent (within 24 hours)"""
        if not time_text:
            return False

        time_text_lower = time_text.lower()

        # Korean time indicators
        if any(x in time_text_lower for x in ['분', '시간']):
            return True
        if '1일' in time_text_lower:
            return True

        # English time indicators
        if any(x in time_text_lower for x in ['minute', 'hour', 'minutes', 'hours']):
            return True
        if '1 day' in time_text_lower:
            return True

        return False
