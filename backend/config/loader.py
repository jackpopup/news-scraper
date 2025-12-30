"""
YAML Configuration Loader
Loads and validates profile configurations
"""

import yaml
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field


@dataclass
class CompanyTier:
    label: str
    score: int
    keywords: List[str]


@dataclass
class KeywordCategory:
    label: str
    score: int
    terms: List[str]


@dataclass
class BonusRule:
    label: str
    score: int
    keywords: List[str] = field(default_factory=list)
    patterns: List[str] = field(default_factory=list)
    condition: Optional[str] = None


@dataclass
class PenaltyRule:
    label: str
    score: int  # Should be negative
    keywords: List[str] = field(default_factory=list)
    threshold: int = 1
    condition: Optional[str] = None


@dataclass
class SourceConfig:
    type: str
    language: str = "en"
    region: str = "US"
    results_per_query: int = 10


@dataclass
class OutputConfig:
    top_articles: int = 10
    top_detailed: int = 3
    summary_length: int = 100
    email_enabled: bool = False
    email_subject_template: str = "{profile_name} Daily Brief - {date}"
    email_recipients: List[str] = field(default_factory=list)
    max_per_company: int = 2
    history_enabled: bool = True
    history_days: int = 7


@dataclass
class ProfileConfig:
    name: str
    description: str
    language: str
    region: str
    companies: Dict[int, CompanyTier]
    keywords: Dict[str, KeywordCategory]
    bonuses: Dict[str, BonusRule]
    penalties: Dict[str, PenaltyRule]
    search_queries: List[str]
    sources: List[SourceConfig]
    output: OutputConfig


def load_profile(profile_path: str) -> ProfileConfig:
    """
    Load a profile configuration from YAML file
    """
    if not os.path.exists(profile_path):
        raise FileNotFoundError(f"Profile not found: {profile_path}")

    with open(profile_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)

    return parse_profile(data)


def parse_profile(data: Dict[str, Any]) -> ProfileConfig:
    """
    Parse raw YAML data into ProfileConfig
    """
    profile_data = data.get('profile', {})

    # Parse companies
    companies = {}
    for tier_key, tier_data in data.get('companies', {}).items():
        tier_num = int(tier_key.replace('tier_', ''))
        companies[tier_num] = CompanyTier(
            label=tier_data.get('label', f'Tier {tier_num}'),
            score=tier_data.get('score', 0),
            keywords=tier_data.get('keywords', [])
        )

    # Parse keywords
    keywords = {}
    for key, kw_data in data.get('keywords', {}).items():
        keywords[key] = KeywordCategory(
            label=kw_data.get('label', key),
            score=kw_data.get('score', 0),
            terms=kw_data.get('terms', [])
        )

    # Parse bonuses
    bonuses = {}
    for key, bonus_data in data.get('bonuses', {}).items():
        bonuses[key] = BonusRule(
            label=bonus_data.get('label', key),
            score=bonus_data.get('score', 0),
            keywords=bonus_data.get('keywords', []),
            patterns=bonus_data.get('patterns', []),
            condition=bonus_data.get('condition')
        )

    # Parse penalties
    penalties = {}
    for key, penalty_data in data.get('penalties', {}).items():
        penalties[key] = PenaltyRule(
            label=penalty_data.get('label', key),
            score=penalty_data.get('score', 0),
            keywords=penalty_data.get('keywords', []),
            threshold=penalty_data.get('threshold', 1),
            condition=penalty_data.get('condition')
        )

    # Parse sources
    sources = []
    for src_data in data.get('sources', []):
        sources.append(SourceConfig(
            type=src_data.get('type', 'google_news'),
            language=src_data.get('language', 'en'),
            region=src_data.get('region', 'US'),
            results_per_query=src_data.get('results_per_query', 10)
        ))

    # Parse output config
    output_data = data.get('output', {})
    email_data = output_data.get('email', {})
    diversity_data = output_data.get('diversity', {})
    history_data = output_data.get('history', {})

    output = OutputConfig(
        top_articles=output_data.get('top_articles', 10),
        top_detailed=output_data.get('top_detailed', 3),
        summary_length=output_data.get('summary_length', 100),
        email_enabled=email_data.get('enabled', False),
        email_subject_template=email_data.get('subject_template', '{profile_name} Daily Brief - {date}'),
        email_recipients=email_data.get('recipients', []),
        max_per_company=diversity_data.get('max_per_company', 2),
        history_enabled=history_data.get('enabled', True),
        history_days=history_data.get('days_to_keep', 7)
    )

    return ProfileConfig(
        name=profile_data.get('name', 'Unnamed Profile'),
        description=profile_data.get('description', ''),
        language=profile_data.get('language', 'en'),
        region=profile_data.get('region', 'US'),
        companies=companies,
        keywords=keywords,
        bonuses=bonuses,
        penalties=penalties,
        search_queries=data.get('search_queries', []),
        sources=sources,
        output=output
    )


def list_profiles(config_dir: str) -> List[Dict[str, str]]:
    """
    List all available profiles in config directory
    """
    profiles = []

    if not os.path.exists(config_dir):
        return profiles

    for filename in os.listdir(config_dir):
        if filename.endswith('.yaml') or filename.endswith('.yml'):
            filepath = os.path.join(config_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                profile_data = data.get('profile', {})
                profiles.append({
                    'filename': filename,
                    'name': profile_data.get('name', filename),
                    'description': profile_data.get('description', ''),
                    'language': profile_data.get('language', 'en')
                })
            except Exception:
                pass

    return profiles


def save_profile(profile: ProfileConfig, filepath: str) -> None:
    """
    Save profile configuration to YAML file
    """
    data = {
        'profile': {
            'name': profile.name,
            'description': profile.description,
            'language': profile.language,
            'region': profile.region
        },
        'companies': {},
        'keywords': {},
        'bonuses': {},
        'penalties': {},
        'search_queries': profile.search_queries,
        'sources': [],
        'output': {
            'top_articles': profile.output.top_articles,
            'top_detailed': profile.output.top_detailed,
            'summary_length': profile.output.summary_length,
            'email': {
                'enabled': profile.output.email_enabled,
                'subject_template': profile.output.email_subject_template,
                'recipients': profile.output.email_recipients
            },
            'diversity': {
                'max_per_company': profile.output.max_per_company
            },
            'history': {
                'enabled': profile.output.history_enabled,
                'days_to_keep': profile.output.history_days
            }
        }
    }

    # Convert companies
    for tier, company in profile.companies.items():
        data['companies'][f'tier_{tier}'] = {
            'label': company.label,
            'score': company.score,
            'keywords': company.keywords
        }

    # Convert keywords
    for key, kw in profile.keywords.items():
        data['keywords'][key] = {
            'label': kw.label,
            'score': kw.score,
            'terms': kw.terms
        }

    # Convert bonuses
    for key, bonus in profile.bonuses.items():
        bonus_data = {
            'label': bonus.label,
            'score': bonus.score
        }
        if bonus.keywords:
            bonus_data['keywords'] = bonus.keywords
        if bonus.patterns:
            bonus_data['patterns'] = bonus.patterns
        if bonus.condition:
            bonus_data['condition'] = bonus.condition
        data['bonuses'][key] = bonus_data

    # Convert penalties
    for key, penalty in profile.penalties.items():
        penalty_data = {
            'label': penalty.label,
            'score': penalty.score
        }
        if penalty.keywords:
            penalty_data['keywords'] = penalty.keywords
        if penalty.threshold > 1:
            penalty_data['threshold'] = penalty.threshold
        if penalty.condition:
            penalty_data['condition'] = penalty.condition
        data['penalties'][key] = penalty_data

    # Convert sources
    for source in profile.sources:
        data['sources'].append({
            'type': source.type,
            'language': source.language,
            'region': source.region,
            'results_per_query': source.results_per_query
        })

    with open(filepath, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
