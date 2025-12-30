#!/usr/bin/env python3
"""
News Curator - CLI Entry Point
PR 담당자를 위한 AI 기반 맞춤형 뉴스 큐레이션 서비스
"""

import argparse
import io
import os
import sys
from datetime import datetime
from typing import Optional

# Fix console encoding for Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.loader import load_profile
from scraper.core import NewsScraper
from bkend.client import BkendClient


def create_html_email(profile_name: str, articles: list, top_detailed: list, language: str = "ko") -> str:
    """Generate HTML email content"""
    date_str = datetime.now().strftime("%Y년 %m월 %d일" if language == "ko" else "%B %d, %Y")

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }}
        .header h1 {{ margin: 0 0 10px 0; font-size: 24px; }}
        .header p {{ margin: 0; opacity: 0.9; }}
        .section {{ margin-bottom: 30px; }}
        .section-title {{ font-size: 18px; font-weight: 600; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 20px; }}
        .top-article {{ background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 20px; border-radius: 0 8px 8px 0; }}
        .top-article .rank {{ display: inline-block; background: #667eea; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 10px; }}
        .top-article h3 {{ margin: 0 0 10px 0; font-size: 16px; }}
        .top-article h3 a {{ color: #333; text-decoration: none; }}
        .top-article h3 a:hover {{ color: #667eea; }}
        .top-article .summary {{ color: #555; font-size: 14px; margin-bottom: 10px; }}
        .top-article .meta {{ font-size: 12px; color: #888; }}
        .article-list {{ list-style: none; padding: 0; }}
        .article-list li {{ padding: 15px 0; border-bottom: 1px solid #eee; }}
        .article-list li:last-child {{ border-bottom: none; }}
        .article-list .title {{ font-weight: 500; }}
        .article-list .title a {{ color: #333; text-decoration: none; }}
        .article-list .title a:hover {{ color: #667eea; }}
        .article-list .meta {{ font-size: 12px; color: #888; margin-top: 5px; }}
        .footer {{ text-align: center; padding: 20px; color: #888; font-size: 12px; border-top: 1px solid #eee; margin-top: 30px; }}
        .ai-badge {{ display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{profile_name}</h1>
        <p>{date_str}</p>
    </div>
"""

    # Top Detailed Articles
    if top_detailed:
        section_title = "TOP 뉴스" if language == "ko" else "TOP Stories"
        html += f"""
    <div class="section">
        <div class="section-title">{section_title}</div>
"""
        for idx, article in enumerate(top_detailed, 1):
            ai_badge = '<span class="ai-badge">AI 선정</span>' if article.get('ai_selected') else ''
            summary = article.get('ai_summary', article.get('summary', ''))[:150]
            html += f"""
        <div class="top-article">
            <h3><span class="rank">{idx}</span><a href="{article.get('link', '#')}">{article.get('title', '')}</a>{ai_badge}</h3>
            <div class="summary">{summary}</div>
            <div class="meta">{article.get('source', '')} | Score: {article.get('score', 0)}</div>
        </div>
"""
        html += "    </div>\n"

    # Other Top Articles
    remaining = [a for a in articles if a not in top_detailed][: 10 - len(top_detailed)]
    if remaining:
        section_title = "기타 주요 뉴스" if language == "ko" else "Other Headlines"
        html += f"""
    <div class="section">
        <div class="section-title">{section_title}</div>
        <ul class="article-list">
"""
        for article in remaining:
            html += f"""
            <li>
                <div class="title"><a href="{article.get('link', '#')}">{article.get('title', '')}</a></div>
                <div class="meta">{article.get('source', '')} | Score: {article.get('score', 0)}</div>
            </li>
"""
        html += """
        </ul>
    </div>
"""

    html += """
    <div class="footer">
        Powered by News Curator<br>
        AI-powered news curation for PR professionals
    </div>
</body>
</html>
"""
    return html


def send_email_gmail(to: str, subject: str, html_content: str) -> bool:
    """Send email using Gmail SMTP"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    gmail_email = os.environ.get('GMAIL_EMAIL')
    gmail_password = os.environ.get('GMAIL_PASSWORD')

    if not gmail_email or not gmail_password:
        print("Error: GMAIL_EMAIL and GMAIL_PASSWORD environment variables required")
        return False

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = gmail_email
        msg['To'] = to

        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(gmail_email, gmail_password)
            server.send_message(msg)

        return True

    except Exception as e:
        print(f"Email sending error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='News Curator - AI-powered news curation for PR professionals'
    )
    parser.add_argument(
        '--profile', '-p',
        type=str,
        required=True,
        help='Path to YAML profile configuration file'
    )
    parser.add_argument(
        '--email', '-e',
        action='store_true',
        help='Send results via email'
    )
    parser.add_argument(
        '--to',
        type=str,
        help='Email recipient address'
    )
    parser.add_argument(
        '--silent', '-s',
        action='store_true',
        help='Suppress console output (for automation)'
    )
    parser.add_argument(
        '--no-history',
        action='store_true',
        help='Skip history check (for testing)'
    )
    parser.add_argument(
        '--save-bknd',
        action='store_true',
        help='Save results to bkend.ai backend'
    )
    parser.add_argument(
        '--profile-id',
        type=str,
        help='Profile ID in bkend.ai (for history tracking)'
    )

    args = parser.parse_args()

    # Load profile
    try:
        profile = load_profile(args.profile)
    except FileNotFoundError:
        print(f"Error: Profile not found: {args.profile}")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading profile: {e}")
        sys.exit(1)

    # Initialize bknd client if needed
    bknd_client: Optional[BkendClient] = None
    history = []

    if args.save_bknd or (not args.no_history and os.environ.get('BKEND_SERVICE_URL')):
        try:
            bknd_client = BkendClient()

            # Load history for deduplication
            if args.profile_id and not args.no_history:
                history = bknd_client.get_history(
                    args.profile_id,
                    days=profile.output.history_days
                )
                if not args.silent:
                    print(f"Loaded {len(history)} history entries from bkend.ai\n")

        except Exception as e:
            if not args.silent:
                print(f"Warning: Could not connect to bkend.ai: {e}\n")

    # Create and run scraper
    scraper = NewsScraper(profile)
    result = scraper.scrape(silent=args.silent, history=history if history else None)

    top_articles = result['top_articles']
    top_detailed = result['top_detailed']

    # Save to bkend.ai if requested
    if args.save_bknd and bknd_client and args.profile_id:
        try:
            # Save scrape result
            bknd_client.save_scrape_result(
                profile_id=args.profile_id,
                articles=result['all_articles'],
                top_articles=top_articles
            )

            # Add to history
            bknd_client.add_to_history(args.profile_id, top_articles)

            if not args.silent:
                print(f"\nResults saved to bkend.ai")

        except Exception as e:
            if not args.silent:
                print(f"Warning: Could not save to bkend.ai: {e}")

    # Send email if requested
    if args.email:
        if not args.to and profile.output.email_recipients:
            args.to = profile.output.email_recipients[0]

        if not args.to:
            print("Error: Email recipient required (--to or in profile)")
            sys.exit(1)

        # Generate subject
        date_str = datetime.now().strftime("%Y년 %m월 %d일" if profile.language == "ko" else "%B %d, %Y")
        subject = profile.output.email_subject_template.format(
            profile_name=profile.name,
            date=date_str
        )

        # Generate email
        html_content = create_html_email(
            profile_name=profile.name,
            articles=top_articles,
            top_detailed=top_detailed,
            language=profile.language
        )

        # Send
        if not args.silent:
            print(f"\nSending email to {args.to}...")

        success = send_email_gmail(args.to, subject, html_content)

        if success:
            if args.silent:
                print(f"SUCCESS: Email sent to {args.to}")
            else:
                print(f"Email sent successfully!")
        else:
            if args.silent:
                print(f"FAILED: Email sending failed")
            else:
                print(f"Failed to send email")
            sys.exit(1)

        return

    # Print results to console (if not sending email)
    if not args.silent:
        print("\n" + "=" * 60)
        print(f"{profile.name} - TOP {len(top_articles)} News")
        print("=" * 60)

        # Top detailed articles
        print(f"\n*** TOP {len(top_detailed)} Headlines ***\n")

        for idx, article in enumerate(top_detailed, 1):
            ai_badge = "[AI]" if article.get('ai_selected') else ""
            print(f"[{idx}] {ai_badge} Score: {article.get('score', 0)}")
            print("-" * 60)
            print(f"Title: {article.get('title', '')}")
            print(f"\nSummary: {article.get('ai_summary', article.get('summary', ''))[:150]}")
            print(f"\nSource: {article.get('source', '')} | {article.get('link', '')}")
            print("=" * 60 + "\n")

        # Other articles
        remaining = [a for a in top_articles if a not in top_detailed]
        if remaining:
            print(f"\n*** Other Headlines ***\n")
            for idx, article in enumerate(remaining, len(top_detailed) + 1):
                print(f"[{idx}] {article.get('title', '')}")
                print(f"    Source: {article.get('source', '')} | Score: {article.get('score', 0)}")
                print()


if __name__ == "__main__":
    main()
