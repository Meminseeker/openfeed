# openfeed

A local-first web app to follow accounts you choose from YouTube, TikTok, X, and
Instagram — as **one chronological feed, with no recommendation algorithm and no ads**.

Runs entirely on your machine. Your subscription list and feed cache live in a local
SQLite database.

## Platform support (honest matrix)

| Platform | How it works | Status |
|---|---|---|
| **YouTube** | Native channel RSS feeds (no API key, no quota) + yt-dlp tab extraction for kind classification + community-post scraping; privacy-enhanced `youtube-nocookie.com` embeds | ✅ Reliable, unofficial extras |
| **TikTok** | [yt-dlp](https://github.com/yt-dlp/yt-dlp) metadata extraction (public accounts, no login) + direct-mp4 playback via backend proxy | ✅ Works well (unofficial) |
| **X** | Self-hosted [RSSHub](https://docs.rsshub.app/) + **your own X login** | ⚠️ Experimental — may break |
| **Instagram** | Self-hosted RSSHub + **your own IG login/cookie** | ⚠️ Experimental — may break |

There is **no official free read API for X or arbitrary Instagram accounts** — anyone
claiming otherwise is scraping. Those two integrations are provided as best-effort
only and their failures are surfaced visibly in the UI (per-account status), never
silently.

Notes:

- YouTube embeds use privacy-enhanced mode (no Google tracking cookies), but
  monetized videos may still show YouTube's own in-player ads.
- TikTok playback carries no TikTok trackers: the video is streamed through the
  backend (`/api/media/tiktok/{id}/stream`), which replays the exact session
  yt-dlp negotiated (TikTok's CDN enforces TLS fingerprinting + challenge cookies).
- X/Instagram items render as text/images in the feed and link out for video.

## Quick start

Prerequisites: Python ≥3.11 with [uv](https://docs.astral.sh/uv/), Node.js ≥20,
Docker (only for experimental X/Instagram).

```bash
# 1. Backend (http://localhost:8800)
cd backend
uv sync
uv run uvicorn app.main:app --port 8800

# 2. Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev

# 3. Optional — only for experimental X / Instagram feeds
cp .env.example .env   # fill in your own credentials
docker compose up -d rsshub
```

Open http://localhost:5173, click **Accounts**, paste profile URLs
(e.g. `https://www.youtube.com/@veritasium`, `https://www.tiktok.com/@nba`).
Platform is auto-detected; the first fetch happens immediately.

## Features

- **Unified chronological feed** — pure time-ordered union, cursor pagination, no ranking
- **YouTube content kinds** — videos, Shorts, past livestreams, and community posts,
  all labeled with kind badges (Short / Live / Post)
  - Kinds are classified by cross-referencing the channel's RSS feed with yt-dlp
    extractions of its `/videos`, `/shorts`, and `/streams` tabs; posts are scraped
    from the `/posts` tab (ytInitialData)
  - Caveat: classification covers the RSS recency window (~15 latest uploads);
    a channel with no recent streams simply shows no `live` items
  - Post timestamps are parsed from relative text ("3 days ago") — approximate
- **Filters** — by platform (chips), by content kind (dropdown: Videos/Shorts/Live/
  Posts/Images/Text), and by source account (dropdown); `#group` chips appear when
  you tag accounts
- **Inline playback** — YouTube videos/Shorts/past streams (nocookie iframe) and
  TikTok (proxied mp4 with seeking)
- **Modal navigation** — browse content without closing the viewer: on-screen
  ‹ › buttons, **← / → arrow keys**, position indicator (3 / 25), Esc to close.
  Works across kinds: videos play, posts/images render inline
- **Account manager** — add via URL, per-account fetch health with visible errors,
  manual refresh, group tags
- **Background poller** — per-platform intervals (YT 30 min, TT 60 min, X/IG 90 min),
  backoff for repeatedly failing accounts, jitter to avoid thundering herds
- **Group tags** (`group_tag`) are stored on every account from day one — the
  foundation for future "concept tabs" (e.g. EV feed vs finance feed)

## Configuration

All optional, via environment variables (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `OPENFEED_RSSHUB_BASE_URL` | `http://localhost:1200` | RSSHub location |
| `OPENFEED_POLL_YOUTUBE_MIN` / `_TIKTOK_` / `_X_` / `_IG_` | 30/60/90/90 | Per-platform poll intervals |
| `OPENFEED_INGEST_LIMIT` | 15 | Max items per account per poll |
| `OPENFEED_DATA_DIR` | `backend/data` | SQLite location |

RSSHub credentials (X/IG) go in the **root `.env`** and are read by the RSSHub
container — see `.env.example` for variable names (`TWITTER_USERNAME`,
`IG_COOKIE`, ...). X logins should use a non-important account; IG routes don't
support 2FA. If a route breaks, the account's status dot turns red with the reason.

## Development

```bash
# Backend tests (URL detection, feed ordering/pagination/dedup, API validation)
cd backend && uv run pytest

# Frontend type-check + build
cd frontend && npm run build
```

### Project layout

```
backend/app/
├── main.py              FastAPI entry (CORS, lifespan, routers)
├── config.py            Env-based configuration
├── database.py          Engine + UTCDateTime type (SQLite drops tzinfo!)
├── models.py            Account, Item (group_tag ready for concept tabs)
├── routers/
│   ├── accounts.py      Subscribe / list / refresh / delete
│   ├── feed.py          Chronological union feed + group filters
│   └── media.py         TikTok stream proxy (curl_cffi impersonation) + thumbnails
└── services/
    ├── detect.py        URL → platform auto-detection
    ├── youtube.py       Channel resolution + native RSS + tab kind classification + posts
    ├── tiktok.py        yt-dlp metadata + stream-session resolution
    ├── rsshub.py        Experimental X/IG via local RSSHub
    ├── ingest.py        Dispatch + dedup upsert + health tracking
    └── poller.py        APScheduler with per-platform intervals + backoff
frontend/src/
├── App.tsx              Top bar, filter chips, layout
├── api.ts               Typed API client
└── components/          Feed, FeedItem, PlayerModal, AccountManager
```

## Legal / ToS note

YouTube uses official mechanisms. TikTok/X/Instagram rely on unofficial access for
your own personal, local consumption — a gray area under those platforms' terms of
service. Don't redistribute content, don't point this at accounts you shouldn't
access, and expect the experimental integrations to break occasionally (upstream
changes usually get fixed by yt-dlp/RSSHub updates).

## Roadmap ideas

- Concept tabs UI on top of the existing `group_tag`
- OPML-style import/export of subscriptions
- Optional yt-dlp/Invidious playback for fully ad-free YouTube
- Read-later / bookmarks
