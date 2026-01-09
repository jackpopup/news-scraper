#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
스크래퍼 헬스체크 스크립트
Google News와 Naver News 스크래핑이 정상 작동하는지 테스트합니다.
"""

import sys
import io
import logging
from scraper.sources.google import GoogleNewsSource
from scraper.sources.naver import NaverNewsSource

# Windows 콘솔 UTF-8 출력 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_google_news():
    """Google News 스크래핑 테스트"""
    print("\n" + "="*50)
    print("Google News 테스트")
    print("="*50)

    source = GoogleNewsSource(language='ko', region='KR', results_per_query=5)

    test_queries = ['온다 호텔', '야놀자']
    total_articles = 0

    for query in test_queries:
        articles = source.search(query)
        print(f"\n검색어: '{query}'")
        print(f"  수집된 기사: {len(articles)}개")

        for i, article in enumerate(articles[:3], 1):
            print(f"  {i}. {article.title[:50]}... ({article.source})")

        total_articles += len(articles)

    if total_articles > 0:
        print(f"\n✅ Google News: 정상 ({total_articles}개 기사 수집)")
        return True
    else:
        print(f"\n❌ Google News: 실패 (0개 기사)")
        return False


def test_naver_news():
    """Naver News 스크래핑 테스트"""
    print("\n" + "="*50)
    print("Naver News 테스트")
    print("="*50)

    source = NaverNewsSource(language='ko', region='KR', results_per_query=5)

    test_queries = ['온다 호텔', '야놀자']
    total_articles = 0

    for query in test_queries:
        articles = source.search(query)
        print(f"\n검색어: '{query}'")
        print(f"  수집된 기사: {len(articles)}개")

        for i, article in enumerate(articles[:3], 1):
            print(f"  {i}. {article.title[:50]}... ({article.source})")

        total_articles += len(articles)

    if total_articles > 0:
        print(f"\n✅ Naver News: 정상 ({total_articles}개 기사 수집)")
        return True
    else:
        print(f"\n❌ Naver News: 실패 (0개 기사)")
        return False


def main():
    print("="*50)
    print("뉴스 스크래퍼 헬스체크")
    print("="*50)

    results = {
        'google': test_google_news(),
        'naver': test_naver_news()
    }

    print("\n" + "="*50)
    print("종합 결과")
    print("="*50)

    all_passed = all(results.values())

    for source, passed in results.items():
        status = "✅ 정상" if passed else "❌ 실패"
        print(f"  {source.capitalize()}: {status}")

    if all_passed:
        print("\n모든 스크래퍼가 정상 작동합니다.")
        return 0
    else:
        print("\n일부 스크래퍼에 문제가 있습니다.")
        print("HTML 선택자가 변경되었을 수 있습니다.")
        print("backend/scraper/sources/ 파일을 확인하세요.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
