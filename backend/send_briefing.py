#!/usr/bin/env python3
"""
News Briefing Email Sender
뉴스 브리핑을 이메일로 발송하는 스크립트
- TOP 3 기사: AI 요약 포함
- 나머지 기사: 제목 + 출처 목록
"""

import os
import sys
import io
import json
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

# Fix console encoding for Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Load .env file
env_file = Path(__file__).parent.parent / '.env'
if env_file.exists():
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())


class ArticleSummarizer:
    """AI를 사용한 기사 요약"""

    def __init__(self):
        self.anthropic_key = os.environ.get('ANTHROPIC_API_KEY', '')
        self.openai_key = os.environ.get('OPENAI_API_KEY', '')

    def summarize(self, title: str, description: str) -> str:
        """기사 제목과 설명을 바탕으로 한글 요약 생성"""
        if self.anthropic_key:
            return self._summarize_with_anthropic(title, description)
        elif self.openai_key:
            return self._summarize_with_openai(title, description)
        else:
            # AI 키가 없으면 description을 그대로 사용
            return description[:200] + '...' if len(description) > 200 else description

    def _summarize_with_anthropic(self, title: str, description: str) -> str:
        """Anthropic Claude로 요약"""
        try:
            response = requests.post(
                'https://api.anthropic.com/v1/messages',
                headers={
                    'x-api-key': self.anthropic_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                json={
                    'model': 'claude-3-haiku-20240307',
                    'max_tokens': 300,
                    'messages': [{
                        'role': 'user',
                        'content': f"""다음 뉴스 기사를 2-3문장으로 핵심만 요약해주세요. 한글로 작성하고, 객관적인 톤을 유지하세요.

제목: {title}
내용: {description}

요약:"""
                    }]
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                return data['content'][0]['text'].strip()
            else:
                return description[:200] + '...' if len(description) > 200 else description
        except Exception as e:
            print(f"  [Anthropic Error] {e}")
            return description[:200] + '...' if len(description) > 200 else description

    def _summarize_with_openai(self, title: str, description: str) -> str:
        """OpenAI GPT로 요약"""
        try:
            response = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {self.openai_key}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': 'gpt-3.5-turbo',
                    'messages': [{
                        'role': 'user',
                        'content': f"""다음 뉴스 기사를 2-3문장으로 핵심만 요약해주세요. 한글로 작성하고, 객관적인 톤을 유지하세요.

제목: {title}
내용: {description}

요약:"""
                    }],
                    'max_tokens': 300,
                    'temperature': 0.3,
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                return data['choices'][0]['message']['content'].strip()
            else:
                return description[:200] + '...' if len(description) > 200 else description
        except Exception as e:
            print(f"  [OpenAI Error] {e}")
            return description[:200] + '...' if len(description) > 200 else description


class EmailBriefingSender:
    """이메일 브리핑 발송"""

    def __init__(self):
        self.gmail_email = os.environ.get('GMAIL_EMAIL', '')
        self.gmail_password = os.environ.get('GMAIL_PASSWORD', '')
        self.summarizer = ArticleSummarizer()

    def load_articles(self, profile_id: str = None) -> List[Dict]:
        """최신 기사 로드"""
        output_dir = Path(__file__).parent.parent / 'output'

        # 가장 최근 articles 파일 찾기
        article_files = list(output_dir.glob('articles_*.json'))
        if not article_files:
            print("No article files found")
            return []

        # profile_id가 있으면 해당 파일, 없으면 최신 파일
        if profile_id:
            matching = [f for f in article_files if profile_id in f.name]
            if matching:
                latest_file = max(matching, key=lambda f: f.stat().st_mtime)
            else:
                latest_file = max(article_files, key=lambda f: f.stat().st_mtime)
        else:
            latest_file = max(article_files, key=lambda f: f.stat().st_mtime)

        print(f"Loading articles from: {latest_file.name}")

        with open(latest_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return data.get('articles', [])

    def generate_html(self, articles: List[Dict], profile_name: str = "Daily") -> str:
        """HTML 이메일 본문 생성"""
        today = datetime.now().strftime('%Y년 %m월 %d일')

        # TOP 3 기사 (점수 높은 순, 페널티 없는 것만)
        top_articles = [a for a in articles if a.get('penalty_score', 0) >= 0][:3]

        # 나머지 기사 (4위 ~ 20위)
        other_articles = [a for a in articles if a.get('penalty_score', 0) >= 0][3:20]

        # TOP 3 요약 생성
        top_summaries = []
        for i, article in enumerate(top_articles):
            print(f"  Summarizing article {i+1}/3: {article['title'][:30]}...")
            summary = self.summarizer.summarize(
                article.get('title', ''),
                article.get('summary', '')
            )
            top_summaries.append({
                **article,
                'ai_summary': summary
            })

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{profile_name} 뉴스 브리핑</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
                {profile_name} 뉴스 브리핑
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
                {today} | {len(articles)}개 기사 중 TOP {len(top_articles)}
            </p>
        </div>

        <!-- TOP 3 Section -->
        <div style="padding: 30px 20px;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #667eea;">
                오늘의 TOP 뉴스
            </h2>

            {self._generate_top_articles_html(top_summaries)}
        </div>

        <!-- Other Articles Section -->
        <div style="padding: 0 20px 30px 20px;">
            <h2 style="color: #1a1a1a; font-size: 16px; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #e0e0e0;">
                더 많은 뉴스
            </h2>

            {self._generate_other_articles_html(other_articles)}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
                이 뉴스레터는 News Curator가 자동으로 생성했습니다.
            </p>
            <p style="color: #999; font-size: 11px; margin: 10px 0 0 0;">
                Powered by AI News Curation
            </p>
        </div>

    </div>
</body>
</html>
"""
        return html

    def _generate_top_articles_html(self, articles: List[Dict]) -> str:
        """TOP 3 기사 HTML 생성"""
        html_parts = []

        for i, article in enumerate(articles):
            rank_colors = ['#FF6B6B', '#4ECDC4', '#45B7D1']
            color = rank_colors[i] if i < len(rank_colors) else '#667eea'

            html_parts.append(f"""
            <div style="margin-bottom: 25px; padding: 20px; background-color: #fafafa; border-radius: 12px; border-left: 4px solid {color};">
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <div style="flex-shrink: 0; width: 36px; height: 36px; background-color: {color}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-weight: bold; font-size: 16px;">{i+1}</span>
                    </div>
                    <div style="flex: 1;">
                        <a href="{article.get('link', '#')}" style="text-decoration: none; color: #1a1a1a;">
                            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; line-height: 1.4;">
                                {article.get('title', '')}
                            </h3>
                        </a>
                        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                            {article.get('ai_summary', article.get('summary', '')[:150])}
                        </p>
                        <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: #999;">
                            <span style="background-color: #e8e8e8; padding: 2px 8px; border-radius: 4px;">
                                {article.get('source', '')}
                            </span>
                            <span>{article.get('time_text', '')}</span>
                            <span style="color: {color}; font-weight: 600;">{article.get('final_score', 0)}점</span>
                        </div>
                    </div>
                </div>
            </div>
            """)

        return '\n'.join(html_parts)

    def _generate_other_articles_html(self, articles: List[Dict]) -> str:
        """나머지 기사 목록 HTML 생성"""
        if not articles:
            return '<p style="color: #999; font-size: 14px;">추가 기사가 없습니다.</p>'

        html_parts = []

        for article in articles:
            html_parts.append(f"""
            <div style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                <a href="{article.get('link', '#')}" style="text-decoration: none; color: #333;">
                    <p style="margin: 0 0 5px 0; font-size: 14px; line-height: 1.4;">
                        {article.get('title', '')}
                    </p>
                </a>
                <div style="font-size: 11px; color: #999;">
                    <span>{article.get('source', '')}</span>
                    <span style="margin: 0 5px;">·</span>
                    <span>{article.get('time_text', '')}</span>
                    <span style="margin: 0 5px;">·</span>
                    <span>{article.get('final_score', 0)}점</span>
                </div>
            </div>
            """)

        return '\n'.join(html_parts)

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """이메일 발송"""
        if not self.gmail_email or not self.gmail_password:
            print("Gmail credentials not set. Please set GMAIL_EMAIL and GMAIL_PASSWORD.")
            return False

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.gmail_email
            msg['To'] = to_email

            # HTML 버전
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)

            # Gmail SMTP 서버로 발송
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(self.gmail_email, self.gmail_password)
                server.sendmail(self.gmail_email, to_email, msg.as_string())

            print(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            print(f"Failed to send email: {e}")
            return False

    def send_briefing(self, to_email: str, profile_name: str = "Daily", profile_id: str = None) -> bool:
        """브리핑 발송"""
        print(f"\n{'='*60}")
        print(f"Sending briefing to: {to_email}")
        print(f"{'='*60}\n")

        # 기사 로드
        articles = self.load_articles(profile_id)
        if not articles:
            print("No articles to send")
            return False

        print(f"Loaded {len(articles)} articles")

        # HTML 생성
        print("\nGenerating HTML content...")
        html_content = self.generate_html(articles, profile_name)

        # 이메일 발송
        today = datetime.now().strftime('%m/%d')
        subject = f"[{profile_name}] {today} 뉴스 브리핑 - TOP {min(3, len(articles))}개 기사"

        print("\nSending email...")
        return self.send_email(to_email, subject, html_content)


def main():
    import argparse

    parser = argparse.ArgumentParser(description='News Briefing Email Sender')
    parser.add_argument('--to', '-t', required=True, help='Recipient email address')
    parser.add_argument('--profile', '-p', default='Daily', help='Profile name for the briefing')
    parser.add_argument('--profile-id', help='Profile ID to load articles from')
    parser.add_argument('--preview', action='store_true', help='Preview HTML without sending')

    args = parser.parse_args()

    sender = EmailBriefingSender()

    if args.preview:
        # HTML 미리보기 (파일로 저장)
        articles = sender.load_articles(args.profile_id)
        if articles:
            html = sender.generate_html(articles, args.profile)
            preview_file = Path(__file__).parent.parent / 'output' / 'briefing_preview.html'
            with open(preview_file, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"Preview saved to: {preview_file}")
    else:
        sender.send_briefing(args.to, args.profile, args.profile_id)


if __name__ == '__main__':
    main()
