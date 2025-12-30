"""
AI Summarizer Module
Generates article summaries using OpenAI GPT or Anthropic Claude
"""

import os
import re
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional


class Summarizer:
    """
    AI-powered article summarizer
    Supports OpenAI GPT and Anthropic Claude
    """

    def __init__(self, max_chars: int = 100, language: str = "ko"):
        self.max_chars = max_chars
        self.language = language
        self.openai_key = os.environ.get('OPENAI_API_KEY')
        self.anthropic_key = os.environ.get('ANTHROPIC_API_KEY')

    def summarize(self, article: Dict) -> str:
        """
        Generate a summary for an article
        Tries AI first, falls back to extraction
        """
        # Fetch full article content if needed
        content = self._fetch_article_content(article.get('link', ''))
        if not content:
            content = article.get('summary', article.get('title', ''))

        # Try AI summarization
        summary = None

        if self.openai_key:
            summary = self._summarize_with_openai(article, content)

        if not summary and self.anthropic_key:
            summary = self._summarize_with_claude(article, content)

        # Fallback to extraction
        if not summary:
            summary = self._extract_summary(article, content)

        return summary

    def summarize_batch(self, articles: List[Dict]) -> List[Dict]:
        """
        Generate summaries for multiple articles
        """
        for article in articles:
            article['ai_summary'] = self.summarize(article)
        return articles

    def _summarize_with_openai(self, article: Dict, content: str) -> Optional[str]:
        """Generate summary using OpenAI GPT"""
        try:
            import openai
            openai.api_key = self.openai_key

            prompt = self._build_prompt(article, content)

            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self._get_system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.3
            )

            summary = response.choices[0].message.content.strip()
            summary = summary.strip('"\'')

            if len(summary) <= self.max_chars + 20:
                return summary

        except Exception as e:
            print(f"OpenAI summarization error: {e}")

        return None

    def _summarize_with_claude(self, article: Dict, content: str) -> Optional[str]:
        """Generate summary using Anthropic Claude"""
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.anthropic_key)

            prompt = self._build_prompt(article, content)

            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=200,
                messages=[
                    {"role": "user", "content": f"{self._get_system_prompt()}\n\n{prompt}"}
                ]
            )

            summary = response.content[0].text.strip()
            summary = summary.strip('"\'')

            if len(summary) <= self.max_chars + 20:
                return summary

        except Exception as e:
            print(f"Claude summarization error: {e}")

        return None

    def _get_system_prompt(self) -> str:
        """Get system prompt based on language"""
        if self.language == 'ko':
            return """당신은 PR/홍보 담당자를 위한 뉴스 요약 전문가입니다.
기사를 읽고 핵심 내용을 간결하게 요약해주세요."""
        else:
            return """You are a news summarization expert for PR professionals.
Read the article and summarize the key points concisely."""

    def _build_prompt(self, article: Dict, content: str) -> str:
        """Build summarization prompt"""
        if self.language == 'ko':
            return f"""다음 기사를 {self.max_chars}자 내외로 요약해주세요.

요약 규칙:
1. 구체적인 숫자가 있으면 포함 (금액, 비율, 증감률 등)
2. "~했다", "~이다" 형식의 완결된 문장
3. 핵심 팩트 1-2개만 전달
4. 회사명이나 브랜드명을 명확히 언급

제목: {article.get('title', '')}
내용: {content[:1500]}

{self.max_chars}자 내외 요약:"""
        else:
            return f"""Summarize the following article in about {self.max_chars} characters.

Rules:
1. Include specific numbers if present (amounts, percentages, growth rates)
2. Use complete sentences
3. Focus on 1-2 key facts
4. Clearly mention company/brand names

Title: {article.get('title', '')}
Content: {content[:1500]}

Summary ({self.max_chars} chars):"""

    def _extract_summary(self, article: Dict, content: str) -> str:
        """Extract summary without AI (fallback)"""
        # Try to find a sentence with numbers
        sentences = re.split(r'[.!?]', content)

        for sentence in sentences:
            sentence = sentence.strip()
            # Look for sentences with numbers that are appropriate length
            if re.search(r'\d+', sentence) and 30 <= len(sentence) <= self.max_chars:
                return sentence + "."

        # Fall back to title or truncated summary
        summary = article.get('summary', article.get('title', ''))

        if len(summary) <= self.max_chars:
            return summary

        # Truncate at last complete word
        truncated = summary[:self.max_chars]
        last_space = truncated.rfind(' ')
        if last_space > self.max_chars // 2:
            truncated = truncated[:last_space]

        return truncated + "..."

    def _fetch_article_content(self, url: str) -> str:
        """Fetch full article content from URL"""
        if not url:
            return ""

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.encoding = response.apparent_encoding
            soup = BeautifulSoup(response.text, 'html.parser')

            # Remove unwanted elements
            for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'ad']):
                tag.decompose()

            # Try common article selectors
            selectors = [
                'article',
                'div.article_body',
                'div.article-body',
                'div.news_body',
                'div.article_txt',
                'div#articleBodyContents',
                'div.content',
                'div.article-content',
                'div.view_txt',
                'div.newsct_article',
                'div.story-body',
                'main'
            ]

            content = ""
            for selector in selectors:
                elem = soup.select_one(selector)
                if elem:
                    content = elem.get_text(separator=' ', strip=True)
                    if len(content) > 100:
                        break

            # Fallback: get all paragraphs
            if not content or len(content) < 100:
                paragraphs = soup.find_all('p')
                content = ' '.join([
                    p.get_text(strip=True)
                    for p in paragraphs
                    if len(p.get_text(strip=True)) > 30
                ])

            return content[:3000]

        except Exception as e:
            print(f"Article fetch error ({url}): {e}")
            return ""


class AIEditor:
    """
    AI Editor for selecting top articles
    Uses AI to pick the most newsworthy articles
    """

    def __init__(self, profile_name: str = "News Curator", language: str = "ko"):
        self.profile_name = profile_name
        self.language = language
        self.openai_key = os.environ.get('OPENAI_API_KEY')
        self.anthropic_key = os.environ.get('ANTHROPIC_API_KEY')

    def select_top_articles(self, articles: List[Dict], count: int = 3) -> List[Dict]:
        """
        Use AI to select the top N most newsworthy articles
        Falls back to score-based selection if AI fails
        """
        if not articles:
            return []

        # Prepare article info for AI
        articles_info = []
        for idx, article in enumerate(articles[:10], 1):
            articles_info.append({
                "번호" if self.language == 'ko' else "number": idx,
                "제목" if self.language == 'ko' else "title": article.get('title', ''),
                "요약" if self.language == 'ko' else "summary": article.get('summary', '')[:200],
                "출처" if self.language == 'ko' else "source": article.get('source', ''),
                "점수" if self.language == 'ko' else "score": article.get('score', 0)
            })

        result = None

        if self.openai_key:
            result = self._select_with_openai(articles_info, count)

        if not result and self.anthropic_key:
            result = self._select_with_claude(articles_info, count)

        if result:
            selected = []
            for item in result:
                idx = item.get('번호', item.get('number', 0)) - 1
                if 0 <= idx < len(articles):
                    article = articles[idx].copy()
                    article['ai_summary'] = item.get('요약', item.get('summary', ''))
                    article['ai_selected'] = True
                    selected.append(article)

            if len(selected) >= count:
                return selected[:count]

        # Fallback: return top by score
        return articles[:count]

    def _select_with_openai(self, articles_info: List[Dict], count: int) -> Optional[List[Dict]]:
        """Select articles using OpenAI"""
        try:
            import openai
            import json

            openai.api_key = self.openai_key
            prompt = self._build_selection_prompt(articles_info, count)

            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a news editor. Respond only in JSON format."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return result.get('top', result.get('top3', []))

        except Exception as e:
            print(f"OpenAI selection error: {e}")
            return None

    def _select_with_claude(self, articles_info: List[Dict], count: int) -> Optional[List[Dict]]:
        """Select articles using Claude"""
        try:
            import anthropic
            import json

            client = anthropic.Anthropic(api_key=self.anthropic_key)
            prompt = self._build_selection_prompt(articles_info, count)

            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=800,
                messages=[
                    {"role": "user", "content": prompt + "\n\nRespond only in JSON format."}
                ]
            )

            response_text = response.content[0].text
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1

            if json_start >= 0 and json_end > json_start:
                result = json.loads(response_text[json_start:json_end])
                return result.get('top', result.get('top3', []))

        except Exception as e:
            print(f"Claude selection error: {e}")

        return None

    def _build_selection_prompt(self, articles_info: List[Dict], count: int) -> str:
        """Build article selection prompt"""
        import json

        if self.language == 'ko':
            return f"""당신은 {self.profile_name}의 뉴스 에디터입니다.

아래 기사들 중에서 가장 중요한 TOP {count}개를 선정해주세요.

선정 기준 (중요도 순):
1. 투자/M&A 소식 (산업 판도 변화)
2. 규제/정책 변화 (비즈니스 영향)
3. 주요 기업의 신규 서비스/제품
4. 구체적 시장 데이터가 있는 기사

각 선정 기사에 대해 60-100자 요약을 작성해주세요.

기사 목록:
{json.dumps(articles_info, ensure_ascii=False, indent=2)}

응답 형식 (JSON):
{{
  "top": [
    {{"번호": 1, "요약": "60-100자 요약"}},
    {{"번호": 2, "요약": "60-100자 요약"}},
    {{"번호": 3, "요약": "60-100자 요약"}}
  ]
}}"""
        else:
            return f"""You are a news editor for {self.profile_name}.

Select the TOP {count} most important articles from the list below.

Selection criteria (by importance):
1. Investment/M&A news (industry changes)
2. Regulation/policy changes (business impact)
3. Major company new services/products
4. Articles with concrete market data

Write a 60-100 character summary for each selected article.

Articles:
{json.dumps(articles_info, ensure_ascii=False, indent=2)}

Response format (JSON):
{{
  "top": [
    {{"number": 1, "summary": "60-100 char summary"}},
    {{"number": 2, "summary": "60-100 char summary"}},
    {{"number": 3, "summary": "60-100 char summary"}}
  ]
}}"""
