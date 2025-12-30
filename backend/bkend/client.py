"""
bkend.ai API Client
Handles all interactions with the bkend.ai backend service
"""

import os
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta


class BkendClient:
    """
    Client for interacting with bkend.ai backend service
    """

    def __init__(self, api_key: Optional[str] = None, service_url: Optional[str] = None):
        self.api_key = api_key or os.environ.get('BKEND_API_KEY')
        self.service_url = service_url or os.environ.get('BKEND_SERVICE_URL')

        if not self.service_url:
            raise ValueError("BKEND_SERVICE_URL is required")

        self.service_url = self.service_url.rstrip('/')
        self.headers = {
            'Content-Type': 'application/json',
        }
        if self.api_key:
            self.headers['Authorization'] = f'Bearer {self.api_key}'

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict:
        """Make HTTP request to bkend.ai"""
        url = f"{self.service_url}{endpoint}"

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                params=params,
                timeout=30
            )
            response.raise_for_status()
            return response.json() if response.text else {}
        except requests.exceptions.RequestException as e:
            print(f"bkend.ai API error: {e}")
            return {}

    # ==========================================
    # Profiles Collection
    # ==========================================

    def get_profiles(self, user_id: Optional[str] = None) -> List[Dict]:
        """Get all profiles, optionally filtered by user"""
        params = {}
        if user_id:
            params['user_id'] = user_id
        result = self._request('GET', '/profiles', params=params)
        return result.get('data', []) if isinstance(result, dict) else []

    def get_profile(self, profile_id: str) -> Optional[Dict]:
        """Get a single profile by ID"""
        result = self._request('GET', f'/profiles/{profile_id}')
        return result if result else None

    def create_profile(self, name: str, config: Dict, user_id: Optional[str] = None) -> Optional[Dict]:
        """Create a new profile"""
        data = {
            'name': name,
            'config': config,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        if user_id:
            data['user_id'] = user_id
        return self._request('POST', '/profiles', data=data)

    def update_profile(self, profile_id: str, name: Optional[str] = None, config: Optional[Dict] = None) -> Optional[Dict]:
        """Update an existing profile"""
        data = {'updated_at': datetime.now().isoformat()}
        if name:
            data['name'] = name
        if config:
            data['config'] = config
        return self._request('PUT', f'/profiles/{profile_id}', data=data)

    def delete_profile(self, profile_id: str) -> bool:
        """Delete a profile"""
        result = self._request('DELETE', f'/profiles/{profile_id}')
        return bool(result)

    # ==========================================
    # Scrape Results Collection
    # ==========================================

    def save_scrape_result(self, profile_id: str, articles: List[Dict], top_articles: List[Dict]) -> Optional[Dict]:
        """Save scraping result"""
        data = {
            'profile_id': profile_id,
            'articles': articles,
            'top_articles': top_articles,
            'scraped_at': datetime.now().isoformat(),
            'article_count': len(articles),
            'top_count': len(top_articles)
        }
        return self._request('POST', '/scrape_results', data=data)

    def get_scrape_results(self, profile_id: str, limit: int = 10) -> List[Dict]:
        """Get scraping results for a profile"""
        params = {
            'profile_id': profile_id,
            'limit': limit,
            'sort': '-scraped_at'
        }
        result = self._request('GET', '/scrape_results', params=params)
        return result.get('data', []) if isinstance(result, dict) else []

    def get_latest_result(self, profile_id: str) -> Optional[Dict]:
        """Get the most recent scraping result"""
        results = self.get_scrape_results(profile_id, limit=1)
        return results[0] if results else None

    # ==========================================
    # Scrape History Collection (Deduplication)
    # ==========================================

    def add_to_history(self, profile_id: str, articles: List[Dict]) -> int:
        """Add articles to history for deduplication"""
        added = 0
        now = datetime.now().isoformat()

        for article in articles:
            data = {
                'profile_id': profile_id,
                'article_link': article.get('link', ''),
                'article_title': article.get('title', ''),
                'scraped_at': now
            }
            result = self._request('POST', '/scrape_history', data=data)
            if result:
                added += 1

        return added

    def get_history(self, profile_id: str, days: int = 7) -> List[Dict]:
        """Get scrape history for deduplication"""
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        params = {
            'profile_id': profile_id,
            'scraped_at[$gte]': cutoff
        }
        result = self._request('GET', '/scrape_history', params=params)
        return result.get('data', []) if isinstance(result, dict) else []

    def is_already_scraped(self, profile_id: str, article: Dict, days: int = 7) -> bool:
        """Check if an article was already scraped"""
        history = self.get_history(profile_id, days)

        article_link = article.get('link', '')
        article_title = article.get('title', '').lower()

        for hist in history:
            # Check by link
            if hist.get('article_link') == article_link:
                return True

            # Check by title similarity (simple word overlap)
            hist_title = hist.get('article_title', '').lower()
            if self._title_similarity(article_title, hist_title) > 0.7:
                return True

        return False

    def _title_similarity(self, title1: str, title2: str) -> float:
        """Calculate title similarity using word overlap"""
        words1 = set(title1.split())
        words2 = set(title2.split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0

    def cleanup_old_history(self, profile_id: str, days: int = 7) -> int:
        """Remove history entries older than specified days"""
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        params = {
            'profile_id': profile_id,
            'scraped_at[$lt]': cutoff
        }
        # This would need a batch delete endpoint or iteration
        # For now, just return 0 as bkend.ai may handle TTL differently
        return 0

    # ==========================================
    # User Management (if using bkend.ai auth)
    # ==========================================

    def get_user(self, user_id: str) -> Optional[Dict]:
        """Get user information"""
        return self._request('GET', f'/users/{user_id}')

    def create_user(self, email: str, name: str) -> Optional[Dict]:
        """Create a new user"""
        data = {
            'email': email,
            'name': name,
            'created_at': datetime.now().isoformat()
        }
        return self._request('POST', '/users', data=data)


# Convenience function for quick client creation
def get_client() -> BkendClient:
    """Get a bkend.ai client using environment variables"""
    return BkendClient()
