"""
Scoring Engine
Calculates relevance scores for articles based on profile configuration
"""

import re
from typing import Dict, List, Any, Optional
from config.loader import ProfileConfig, CompanyTier, KeywordCategory, BonusRule, PenaltyRule


class ScoringEngine:
    """
    Configurable scoring engine for news articles
    Uses profile settings to calculate relevance scores
    """

    def __init__(self, profile: ProfileConfig):
        self.profile = profile

    def calculate_score(self, article: Dict) -> Dict:
        """
        Calculate total score for an article
        Returns article with score details added
        """
        text = (article.get('title', '') + ' ' + article.get('summary', '')).lower()
        title = article.get('title', '').lower()

        score = 0
        score_breakdown = []
        matched_keywords = []

        # 1. Company tier scores
        company_score, company_matches = self._calculate_company_score(text)
        score += company_score
        if company_matches:
            score_breakdown.extend(company_matches)
            matched_keywords.extend([m['keyword'] for m in company_matches])

        # 2. Keyword category scores
        keyword_score, keyword_matches = self._calculate_keyword_score(text)
        score += keyword_score
        if keyword_matches:
            score_breakdown.extend(keyword_matches)
            matched_keywords.extend([m['keyword'] for m in keyword_matches])

        # 3. Bonus scores
        bonus_score, bonus_matches = self._calculate_bonus_score(article, text, title)
        score += bonus_score
        if bonus_matches:
            score_breakdown.extend(bonus_matches)

        # 4. Penalty scores
        penalty_score, penalty_matches = self._calculate_penalty_score(article, text)
        score += penalty_score
        if penalty_matches:
            score_breakdown.extend(penalty_matches)

        # Update article with scoring info
        article['score'] = score
        article['score_breakdown'] = score_breakdown
        article['matched_keywords'] = list(set(matched_keywords))
        article['main_company'] = self._get_main_company(text)

        return article

    def _calculate_company_score(self, text: str) -> tuple[int, List[Dict]]:
        """Calculate score based on company tier matches"""
        score = 0
        matches = []

        # Check tiers in order (lower tier = higher priority)
        for tier_num in sorted(self.profile.companies.keys()):
            tier = self.profile.companies[tier_num]

            for keyword in tier.keywords:
                if keyword.lower() in text:
                    score += tier.score
                    matches.append({
                        'type': 'company',
                        'label': tier.label,
                        'keyword': keyword,
                        'score': tier.score
                    })
                    # Only count one match per tier
                    break

        return score, matches

    def _calculate_keyword_score(self, text: str) -> tuple[int, List[Dict]]:
        """Calculate score based on keyword category matches"""
        score = 0
        matches = []

        for category_key, category in self.profile.keywords.items():
            category_matched = False

            for term in category.terms:
                if term.lower() in text:
                    if not category_matched:
                        score += category.score
                        matches.append({
                            'type': 'keyword',
                            'label': category.label,
                            'keyword': term,
                            'score': category.score
                        })
                        category_matched = True

        return score, matches

    def _calculate_bonus_score(self, article: Dict, text: str, title: str) -> tuple[int, List[Dict]]:
        """Calculate bonus scores"""
        score = 0
        matches = []

        for bonus_key, bonus in self.profile.bonuses.items():
            bonus_applied = False

            # Check condition-based bonuses
            if bonus.condition:
                if self._check_condition(bonus.condition, article):
                    score += bonus.score
                    matches.append({
                        'type': 'bonus',
                        'label': bonus.label,
                        'keyword': bonus.condition,
                        'score': bonus.score
                    })
                    bonus_applied = True

            # Check keyword-based bonuses
            if not bonus_applied and bonus.keywords:
                for keyword in bonus.keywords:
                    if keyword.lower() in text:
                        score += bonus.score
                        matches.append({
                            'type': 'bonus',
                            'label': bonus.label,
                            'keyword': keyword,
                            'score': bonus.score
                        })
                        break

            # Check pattern-based bonuses
            if not bonus_applied and bonus.patterns:
                for pattern in bonus.patterns:
                    if re.search(pattern, text):
                        score += bonus.score
                        matches.append({
                            'type': 'bonus',
                            'label': bonus.label,
                            'keyword': f'pattern:{pattern}',
                            'score': bonus.score
                        })
                        break

        return score, matches

    def _calculate_penalty_score(self, article: Dict, text: str) -> tuple[int, List[Dict]]:
        """Calculate penalty scores (negative)"""
        score = 0
        matches = []

        for penalty_key, penalty in self.profile.penalties.items():
            penalty_applied = False

            # Check condition-based penalties
            if penalty.condition:
                if self._check_condition(penalty.condition, article):
                    score += penalty.score  # Already negative
                    matches.append({
                        'type': 'penalty',
                        'label': penalty.label,
                        'keyword': penalty.condition,
                        'score': penalty.score
                    })
                    penalty_applied = True

            # Check keyword-based penalties with threshold
            if not penalty_applied and penalty.keywords:
                match_count = 0
                matched_keywords = []

                for keyword in penalty.keywords:
                    if keyword.lower() in text:
                        match_count += 1
                        matched_keywords.append(keyword)

                if match_count >= penalty.threshold:
                    score += penalty.score  # Already negative
                    matches.append({
                        'type': 'penalty',
                        'label': penalty.label,
                        'keyword': ', '.join(matched_keywords[:3]),
                        'score': penalty.score
                    })

        return score, matches

    def _check_condition(self, condition: str, article: Dict) -> bool:
        """Check if a condition is met"""
        # Parse simple conditions like "published_within_hours < 24"
        if 'published_within_hours' in condition:
            # Check if article is recent
            is_recent = article.get('is_recent', False)
            time_text = article.get('time_text', '')

            if '< 24' in condition:
                return is_recent

        if 'published_days_ago' in condition:
            time_text = article.get('time_text', '').lower()

            if '>= 2' in condition:
                # Check if 2+ days old
                return any(x in time_text for x in ['2일', '3일', '4일', '5일', '6일', '7일', '주', '2 day', '3 day', '4 day', 'week'])

            if '>= 3' in condition:
                return any(x in time_text for x in ['3일', '4일', '5일', '6일', '7일', '주', '3 day', '4 day', 'week'])

        return False

    def _get_main_company(self, text: str) -> Optional[str]:
        """Get the main company mentioned in the article"""
        # Check tiers in order (lower tier = higher priority)
        for tier_num in sorted(self.profile.companies.keys()):
            tier = self.profile.companies[tier_num]

            for keyword in tier.keywords:
                if keyword.lower() in text:
                    return keyword

        return None


class ArticleProcessor:
    """
    Processes articles: deduplication, diversity, sorting
    """

    def __init__(self, profile: ProfileConfig):
        self.profile = profile
        self.scoring_engine = ScoringEngine(profile)

    def process_articles(self, articles: List[Dict]) -> List[Dict]:
        """
        Full processing pipeline:
        1. Score all articles
        2. Remove duplicates
        3. Apply diversity rules
        4. Sort by score
        """
        # 1. Score all articles
        scored = [self.scoring_engine.calculate_score(a) for a in articles]

        # 2. Remove duplicates
        unique = self._remove_duplicates(scored)

        # 3. Sort by score
        sorted_articles = sorted(unique, key=lambda x: x.get('score', 0), reverse=True)

        # 4. Apply diversity rules
        diversified = self._apply_diversity(sorted_articles)

        return diversified

    def _remove_duplicates(self, articles: List[Dict], threshold: float = 0.35) -> List[Dict]:
        """Remove duplicate articles based on title similarity"""
        unique = []

        for article in articles:
            is_duplicate = False

            for existing in unique:
                similarity = self._calculate_similarity(
                    article.get('title', ''),
                    existing.get('title', '')
                )

                if similarity >= threshold:
                    is_duplicate = True
                    # Keep the higher scoring one
                    if article.get('score', 0) > existing.get('score', 0):
                        unique.remove(existing)
                        unique.append(article)
                    break

            if not is_duplicate:
                unique.append(article)

        return unique

    def _calculate_similarity(self, title1: str, title2: str) -> float:
        """Calculate Jaccard similarity between two titles"""
        # Clean and split into words
        words1 = set(re.sub(r'[^\w\s]', '', title1.lower()).split())
        words2 = set(re.sub(r'[^\w\s]', '', title2.lower()).split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0

    def _apply_diversity(self, articles: List[Dict]) -> List[Dict]:
        """Apply diversity rules (limit articles per company)"""
        max_per_company = self.profile.output.max_per_company
        company_count = {}
        diversified = []
        overflow = []

        for article in articles:
            company = article.get('main_company')

            if company is None:
                diversified.append(article)
            else:
                current = company_count.get(company, 0)
                if current < max_per_company:
                    diversified.append(article)
                    company_count[company] = current + 1
                else:
                    overflow.append(article)

        # Add overflow articles at the end (lower priority)
        return diversified + overflow

    def get_top_articles(self, articles: List[Dict]) -> List[Dict]:
        """Get top N articles based on profile settings"""
        return articles[:self.profile.output.top_articles]

    def get_detailed_articles(self, articles: List[Dict]) -> List[Dict]:
        """Get top N articles for detailed summary"""
        return articles[:self.profile.output.top_detailed]
