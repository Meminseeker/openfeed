"""Application configuration via environment variables (see .env.example)."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("OPENFEED_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.environ.get("OPENFEED_DATABASE_URL", f"sqlite:///{DATA_DIR / 'openfeed.db'}")

# Base URL of the self-hosted RSSHub instance (used for experimental X / Instagram feeds).
RSSHUB_BASE_URL = os.environ.get("OPENFEED_RSSHUB_BASE_URL", "http://localhost:1200").rstrip("/")

# Polling intervals (minutes) per platform.
POLL_INTERVALS = {
    "youtube": int(os.environ.get("OPENFEED_POLL_YOUTUBE_MIN", "30")),
    "tiktok": int(os.environ.get("OPENFEED_POLL_TIKTOK_MIN", "60")),
    "x": int(os.environ.get("OPENFEED_POLL_X_MIN", "90")),
    "instagram": int(os.environ.get("OPENFEED_POLL_IG_MIN", "90")),
}

# HTTP timeouts / identity used when talking to external services.
HTTP_TIMEOUT = float(os.environ.get("OPENFEED_HTTP_TIMEOUT", "20"))
USER_AGENT = os.environ.get(
    "OPENFEED_USER_AGENT",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
)

# Max items ingested per account per poll, and max items returned by the feed API.
INGEST_LIMIT = int(os.environ.get("OPENFEED_INGEST_LIMIT", "15"))
FEED_PAGE_LIMIT = int(os.environ.get("OPENFEED_FEED_PAGE_LIMIT", "30"))
