"""
News Scraper Core
Main scraping engine that orchestrates the entire pipeline
"""

from typing import List, Dict, Optional
from datetime import datetime

from config.loader import ProfileConfig, load_profile
from .sources import GoogleNewsSource, NaverNewsSource, NewsSource
from .scoring import ScoringEngine, ArticleProcessor
from .summarizer import Summarizer, AIEditor


class NewsScraper:
    """
    Main news scraper class
    Orchestrates the full scraping pipeline
    """

    def __init__(self, profile: ProfileConfig):
        self.profile = profile
        self.sources: List[NewsSource] = []
        self.processor = ArticleProcessor(profile)
        self.summarizer = Summarizer(
            max_chars=profile.output.summary_length,
            language=profile.language
        )
        self.ai_editor = AIEditor(
            profile_name=profile.name,
            language=profile.language
        )

        # Initialize news sources based on profile
        self._init_sources()

    def _init_sources(self):
        """Initialize news sources from profile configuration"""
        for source_config in self.profile.sources:
            if source_config.type == 'google_news':
                self.sources.append(GoogleNewsSource(
                    language=source_config.language,
                    region=source_config.region,
                    results_per_query=source_config.results_per_query
                ))
            elif source_config.type == 'naver_news':
                self.sources.append(NaverNewsSource(
                    language=source_config.language,
                    region=source_config.region,
                    results_per_query=source_config.results_per_query
                ))

    def scrape(self, silent: bool = False, history: Optional[List[Dict]] = None) -> Dict:
        """
        Run the full scraping pipeline

        Args:
            silent: Suppress console output
            history: Previous scrape history for deduplication

        Returns:
            Dictionary with scraping results
        """
        start_time = datetime.now()

        if not silent:
            print("=" * 60)
            print(f"News Curator - {self.profile.name}")
            print("=" * 60)
            print(f"Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")

        # Step 1: Collect articles from all sources
        if not silent:
            print("[Step 1] Collecting news articles...")

        all_articles = self._collect_articles(silent)

        if not silent:
            print(f"   -> Collected {len(all_articles)} articles\n")

        # Step 2: Filter out previously scraped articles
        if history:
            if not silent:
                print("[Step 2] Filtering duplicate articles...")

            before = len(all_articles)
            all_articles = self._filter_history(all_articles, history)

            if not silent:
                print(f"   -> Removed {before - len(all_articles)} duplicates\n")

        # Step 3: Process articles (score, dedupe, diversity)
        if not silent:
            print("[Step 3] Processing and scoring articles...")

        processed = self.processor.process_articles(all_articles)

        if not silent:
            print(f"   -> Processed {len(processed)} unique articles\n")

        # Step 4: Get top articles
        top_articles = self.processor.get_top_articles(processed)

        # Step 5: AI Editor selection for top detailed articles
        if not silent:
            print("[Step 4] AI Editor selecting top articles...")

        top_detailed = self.ai_editor.select_top_articles(
            top_articles,
            count=self.profile.output.top_detailed
        )

        if not silent:
            ai_count = sum(1 for a in top_detailed if a.get('ai_selected', False))
            print(f"   -> AI selected {ai_count} articles\n")

        # Step 6: Generate summaries for top detailed articles
        if not silent:
            print("[Step 5] Generating summaries...")

        for idx, article in enumerate(top_detailed, 1):
            if not silent:
                print(f"   [{idx}/{len(top_detailed)}] Summarizing...")

            if not article.get('ai_summary'):
                article['ai_summary'] = self.summarizer.summarize(article)

        if not silent:
            print(f"   -> Summaries complete\n")

        # Update top_articles with summarized versions
        for i, detailed in enumerate(top_detailed):
            if i < len(top_articles):
                top_articles[i] = detailed

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        result = {
            'profile_name': self.profile.name,
            'scraped_at': start_time.isoformat(),
            'duration_seconds': duration,
            'total_collected': len(all_articles),
            'total_processed': len(processed),
            'top_articles': top_articles,
            'top_detailed': top_detailed,
            'all_articles': processed  # For history saving
        }

        if not silent:
            print("=" * 60)
            print(f"Scraping complete! ({duration:.1f}s)")
            print(f"Top {len(top_articles)} articles ready")
            print("=" * 60)

        return result

    def _collect_articles(self, silent: bool = False) -> List[Dict]:
        """Collect articles from all sources using search queries"""
        all_articles = []
        queries = self.profile.search_queries
        total_queries = len(queries) * len(self.sources)
        current = 0

        for source in self.sources:
            for query in queries:
                current += 1
                if not silent:
                    print(f"   [{current}/{total_queries}] {source.source_name}: '{query}'")

                try:
                    articles = source.search(query)
                    for article in articles:
                        all_articles.append(article.to_dict())
                except Exception as e:
                    if not silent:
                        print(f"      Error: {e}")

        return all_articles

    def _filter_history(self, articles: List[Dict], history: List[Dict]) -> List[Dict]:
        """Filter out articles that were previously scraped"""
        history_links = set(h.get('article_link', h.get('link', '')) for h in history)
        history_titles = set(h.get('article_title', h.get('title', '')).lower() for h in history)

        filtered = []
        for article in articles:
            link = article.get('link', '')
            title = article.get('title', '').lower()

            # Skip if link matches
            if link in history_links:
                continue

            # Skip if title is very similar
            is_similar = False
            for hist_title in history_titles:
                if self._title_similarity(title, hist_title) > 0.7:
                    is_similar = True
                    break

            if not is_similar:
                filtered.append(article)

        return filtered

    def _title_similarity(self, title1: str, title2: str) -> float:
        """Calculate simple title similarity"""
        words1 = set(title1.split())
        words2 = set(title2.split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0


def create_scraper(profile_path: str) -> NewsScraper:
    """
    Factory function to create a scraper from a profile file

    Args:
        profile_path: Path to YAML profile file

    Returns:
        Configured NewsScraper instance
    """
    profile = load_profile(profile_path)
    return NewsScraper(profile)
