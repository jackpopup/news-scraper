"""
News Scraper Module
"""
from .core import NewsScraper
from .scoring import ScoringEngine
from .summarizer import Summarizer

__all__ = ['NewsScraper', 'ScoringEngine', 'Summarizer']
