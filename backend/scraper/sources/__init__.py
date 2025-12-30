"""
News Source Adapters
"""
from .google import GoogleNewsSource
from .naver import NaverNewsSource
from .base import NewsSource

__all__ = ['NewsSource', 'GoogleNewsSource', 'NaverNewsSource']
