"""Experimental X / Instagram ingestion via a self-hosted RSSHub instance.

Requires RSSHub running (see docker-compose.yml) with the user's own cookies
configured (TWITTER_AUTH_TOKEN / IG_* env vars). These routes scrape private
APIs and may break at any time — accounts using them are flagged 'experimental'
in the UI and surface fetch errors visibly.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape

import feedparser
import httpx

from ..config import HTTP_TIMEOUT, RSSHUB_BASE_URL, USER_AGENT
from .youtube import NormalizedItem


class RSSHubError(RuntimeError):
    pass


def _route(platform: str, handle: str) -> str:
    if platform == "x":
        return f"/twitter/user/{handle}"
    if platform == "instagram":
        return f"/instagram/user/{handle}"
    raise RSSHubError(f"Unsupported RSSHub platform: {platform}")


_IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
_TAG_RE = re.compile(r"<[^>]+>")


def _first_img(html: str) -> str:
    m = _IMG_RE.search(html or "")
    return unescape(m.group(1)) if m else ""


def _strip_tags(html: str) -> str:
    return unescape(_TAG_RE.sub("", html or "")).strip()


def fetch_items(platform: str, handle: str, limit: int = 15) -> tuple[list[NormalizedItem], str]:
    """Return (items, display_name) from the local RSSHub instance."""
    url = f"{RSSHUB_BASE_URL}{_route(platform, handle)}"
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
            resp = client.get(url)
    except httpx.HTTPError as exc:
        raise RSSHubError(
            f"Cannot reach RSSHub at {RSSHUB_BASE_URL} — is the container running? ({exc})"
        ) from exc

    if resp.status_code != 200:
        raise RSSHubError(
            f"RSSHub route {_route(platform, handle)} returned HTTP {resp.status_code}. "
            "Check that the required cookies are configured in .env"
        )

    feed = feedparser.parse(resp.text)
    if not feed.entries:
        raise RSSHubError(
            f"RSSHub returned no entries for {platform}/@{handle} "
            "(route may be broken or blocked — this integration is experimental)"
        )

    display_name = (feed.feed.get("title") or handle).replace("Twitter", "").strip(" -@") or handle

    items: list[NormalizedItem] = []
    for entry in feed.entries[:limit]:
        ext_id = entry.get("id") or entry.get("link") or ""
        if not ext_id:
            continue
        html_desc = entry.get("description", "") or ""
        thumbnail = _first_img(html_desc)
        text = entry.get("title") or _strip_tags(html_desc)
        published = None
        if entry.get("published_parsed"):
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        items.append(
            NormalizedItem(
                platform_item_id=ext_id[-255:],
                type="image" if thumbnail else "text",
                title=text[:500],
                description=_strip_tags(html_desc)[:2000],
                thumbnail_url=thumbnail,
                media_ref=entry.get("link", ""),
                url=entry.get("link", ""),
                author_name=display_name,
                published_at=published,
            )
        )
    return items, display_name
