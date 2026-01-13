# news-scraper MVP Plan

## Overview

PR 담당자용 뉴스 모니터링 서비스
- Target: 스타트업 PR 담당자
- Goal: 쉽고 쓸만한 무료 서비스

## Phase 1 (Current MVP)

### Features

| Feature | Description |
|---------|-------------|
| Keyword Sidebar | Left panel with user keywords, ON/OFF toggle |
| Tier Color Coding | Company (red) > Competitor (orange) > Industry (blue) |
| Manual Keyword Management | Add/remove keywords instantly |
| Feedback Buttons | Thumbs up/down (save only, for future learning) |
| Scheduled Scraping | 3x daily (07:00, 13:00, 18:00 KST) |

### Scraping Schedule

| Time (KST) | Purpose |
|------------|---------|
| 07:00 | Morning briefing - overnight news |
| 13:00 | Midday update - morning news |
| 18:00 | Evening wrap-up - afternoon news |

### Architecture

```
GitHub Actions (3x daily)
    |
    v
Scraping Script (backend/main.py)
    |
    v
bkend.ai (data storage)
    |
    v
Frontend (Vercel) - displays stored data
```

### UI Layout

```
+---------------+----------------------------+
| My Keywords   | Last Update: 1:00 PM       |
| [v] Company   | Next: 6:00 PM (5hrs)       |
| [v] Competitor+----------------------------+
| + Add         | [color] Article 1    up/dn |
|               | Score: 85                  |
| Exclude       |                            |
| [x] Politics  | [color] Article 2    up/dn |
+---------------+----------------------------+
```

### Scoring System (from onda-news-scraper)

**Tier-based Company Scoring:**
- Tier 0 (Our Company): 80 points - Red
- Tier 1 (Major Competitors): 60 points - Orange
- Tier 2-3 (Medium): 45-50 points - Yellow
- Tier 4+ (Industry): 35-40 points - Blue/Gray

**Penalty System:**
- Politics: -500
- Local Government: -500
- Promotion: -40
- B2C Hotel: -60
- Overseas Incidents: -100

**Bonus System:**
- Recent Article: +25
- Investment: +15
- Major Announcement: +15
- B2B Solution: +50~70

## Phase 2 (Future)

- AI competitor recommendation (onboarding)
- Feedback-based keyword auto-suggestion
- Briefing link sharing

## Excluded from MVP

- Email sending
- Press release distribution
- Monetization

## Technical Notes

### GitHub Actions Secrets Required

```
BKEND_SERVICE_URL: bkend.ai service URL
OPENAI_API_KEY: For AI summarization (optional)
```

### Local Development

```bash
cd backend
pip install -r requirements.txt
python main.py --profile ../examples/hospitality.yaml
```
