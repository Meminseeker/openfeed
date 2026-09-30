"""YouTube ingestion: native RSS + yt-dlp tab extraction + community-post scraping.

Content kinds:
  - video  : regular uploads (RSS feed, classified against the /videos tab)
  - short  : /shorts tab entries
  - live   : /streams tab entries (past livestreams only)
  - post   : /posts tab community posts (scraped from ytInitialData)

The RSS feed provides reliable metadata (timestamps, descriptions) for recent
uploads of ALL kinds but doesn't label them; the yt-dlp tab extractions provide
the kind labels (id -> kind). The two are merged, so most items get both full
metadata and the correct kind.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import feedparser
import httpx

from ..config import HTTP_TIMEOUT, USER_AGENT

logger = logging.getLogger("openfeed.youtube")

RSS_TEMPLATE = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

VIDEO_KINDS = ("video", "short", "live", "post")


class YouTubeError(RuntimeError):
    pass


@dataclass
class ChannelInfo:
    channel_id: str
    title: str = ""
    avatar_url: str = ""
    profile_url: str = ""


@dataclass
class NormalizedItem:
    platform_item_id: str
    type: str  # video | short | live | post
    title: str = ""
    description: str = ""
    thumbnail_url: str = ""
    media_ref: str = ""
    url: str = ""
    author_name: str = ""
    published_at: object = None  # datetime | None


def _client() -> httpx.Client:
    return httpx.Client(
        timeout=HTTP_TIMEOUT,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
        follow_redirects=True,
    )


# ---------------------------------------------------------------- channel resolution
def resolve_channel_id(handle: str) -> ChannelInfo:
    """Resolve a YouTube handle (/channel id/user/c-name) to a channel id + metadata."""
    if handle.startswith("UC") and re.match(r"^UC[\w-]{22}$", handle):
        channel_id = handle
        page_url = f"https://www.youtube.com/channel/{channel_id}"
    else:
        if handle.startswith("@"):
            page_url = f"https://www.youtube.com/{handle}"
        else:
            page_url = f"https://www.youtube.com/@{handle}"
        channel_id = ""

    with _client() as client:
        resp = client.get(page_url)
        if resp.status_code == 404 and not handle.startswith("@"):
            for prefix in ("user", "c"):
                resp = client.get(f"https://www.youtube.com/{prefix}/{handle}")
                if resp.status_code == 200:
                    break
        if resp.status_code != 200:
            raise YouTubeError(f"Could not fetch channel page for '{handle}' (HTTP {resp.status_code})")
        html = resp.text

    if not channel_id:
        m = re.search(r'<meta itemprop="identifier" content="(UC[\w-]{22})"', html)
        if not m:
            m = re.search(r'"channelId"\s*:\s*"(UC[\w-]{22})"', html)
        if not m:
            m = re.search(r'rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{22})"', html)
        if not m:
            raise YouTubeError(f"Could not resolve channel id for '{handle}'")
        channel_id = m.group(1)

    title = ""
    m = re.search(r"<title>([^<]+)</title>", html)
    if m:
        title = m.group(1).replace(" - YouTube", "").strip()

    avatar = ""
    m = re.search(r'"avatar"\s*:\s*\{[^{}]*"thumbnails"\s*:\s*\[\s*\{[^{}]*"url"\s*:\s*"([^"]+)"', html)
    if m:
        avatar = m.group(1).replace("\\u0026", "&")

    return ChannelInfo(
        channel_id=channel_id,
        title=title,
        avatar_url=avatar,
        profile_url=f"https://www.youtube.com/channel/{channel_id}",
    )


# ---------------------------------------------------------------- RSS (metadata base)
def _fetch_rss(channel_id: str, limit: int) -> list[NormalizedItem]:
    url = RSS_TEMPLATE.format(channel_id=channel_id)
    with _client() as client:
        resp = client.get(url)
        if resp.status_code != 200:
            raise YouTubeError(f"RSS fetch failed for channel {channel_id} (HTTP {resp.status_code})")
        feed = feedparser.parse(resp.text)

    if feed.bozo and not feed.entries:
        raise YouTubeError(f"RSS parse failed for channel {channel_id}: {feed.bozo_exception}")

    items: list[NormalizedItem] = []
    for entry in feed.entries[:limit]:
        video_id = entry.get("yt_videoid", "")
        if not video_id:
            continue
        media_group = entry.get("media_group", {}) or {}
        published = None
        if entry.get("published_parsed"):
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        items.append(
            NormalizedItem(
                platform_item_id=video_id,
                type="video",  # refined later via tab classification
                title=entry.get("title", ""),
                description=media_group.get("media_description", "") or "",
                thumbnail_url=f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                media_ref=video_id,
                url=entry.get("link", f"https://www.youtube.com/watch?v={video_id}"),
                author_name=entry.get("author", ""),
                published_at=published,
            )
        )
    return items


# ---------------------------------------------------------------- tab classification (kind labels)
def _fetch_tab_kinds(channel_id: str, limit: int) -> dict[str, str]:
    """Return {video_id: kind} by flat-extracting the channel's videos/shorts/streams tabs.

    Best-effort: returns whatever tabs succeed; callers treat missing ids as 'video'.
    """
    from yt_dlp import YoutubeDL

    kinds: dict[str, str] = {}
    base = f"https://www.youtube.com/channel/{channel_id}"
    for tab, kind in (("videos", "video"), ("shorts", "short"), ("streams", "live")):
        try:
            with YoutubeDL(
                {
                    "quiet": True,
                    "no_warnings": True,
                    "extract_flat": True,
                    "playlistend": limit,
                    "ignoreerrors": True,
                    "skip_download": True,
                    "socket_timeout": 20,
                }
            ) as ydl:
                info = ydl.extract_info(f"{base}/{tab}", download=False)
            for e in (info or {}).get("entries") or []:
                if e and e.get("id"):
                    kinds[str(e["id"])] = kind
        except Exception as exc:
            # e.g. channel simply has no such tab
            logger.info("YouTube tab '%s' unavailable for %s: %s", tab, channel_id, exc)
    return kinds


# ---------------------------------------------------------------- community posts
_REL_TIME_RE = re.compile(
    r"(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago",
    re.I,
)
_REL_UNITS = {
    "minute": timedelta(minutes=1), "minutes": timedelta(minutes=1),
    "hour": timedelta(hours=1), "hours": timedelta(hours=1),
    "day": timedelta(days=1), "days": timedelta(days=1),
    "week": timedelta(weeks=1), "weeks": timedelta(weeks=1),
    "month": timedelta(days=30), "months": timedelta(days=30),
    "year": timedelta(days=365), "years": timedelta(days=365),
}


def _parse_relative_time(text: str) -> datetime | None:
    m = _REL_TIME_RE.search(text or "")
    if not m:
        return None
    return datetime.now(timezone.utc) - int(m.group(1)) * _REL_UNITS[m.group(2).lower()]


def _runs_text(node: dict | None) -> str:
    if not node:
        return ""
    if "simpleText" in node:
        return node["simpleText"]
    return "".join(r.get("text", "") for r in node.get("runs", []))


def _thumb_from_attachment(att: dict) -> str:
    """First image URL from any known backstage attachment type."""
    if not att:
        return ""
    candidates: list[dict] = []
    if "backstageImageRenderer" in att:
        candidates.append(att["backstageImageRenderer"])
    if "postMultiImageRenderer" in att:
        for img in att["postMultiImageRenderer"].get("images", []):
            if "backstageImageRenderer" in img:
                candidates.append(img["backstageImageRenderer"])
    for c in candidates:
        image = c.get("image") or {}
        # Backstage images: image.thumbnails is the array directly.
        # (Video-style renderers nest it as image.thumbnail.thumbnails — try both.)
        thumbs = image.get("thumbnails") or ((image.get("thumbnail") or {}).get("thumbnails")) or []
        if thumbs:
            return thumbs[-1].get("url", "")
    video = att.get("videoRenderer") or {}
    if video.get("videoId"):
        return f"https://i.ytimg.com/vi/{video['videoId']}/hqdefault.jpg"
    return ""


def _find_post_renderers(node, out: list) -> None:
    if isinstance(node, dict):
        if "backstagePostRenderer" in node:
            out.append(node["backstagePostRenderer"])
            return
        for v in node.values():
            _find_post_renderers(v, out)
    elif isinstance(node, list):
        for v in node:
            _find_post_renderers(v, out)


def fetch_community_posts(channel_id: str, limit: int = 15) -> list[NormalizedItem]:
    """Scrape community posts from the channel's /posts tab (ytInitialData)."""
    url = f"https://www.youtube.com/channel/{channel_id}/posts"
    with _client() as client:
        resp = client.get(url)
        if resp.status_code != 200:
            raise YouTubeError(f"Posts tab fetch failed for {channel_id} (HTTP {resp.status_code})")
        html = resp.text

    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S) or re.search(
        r'ytInitialData"?\s*=\s*(\{.*?\});\s*(?:</script>|if)', html, re.S
    )
    if not m:
        raise YouTubeError(f"Could not locate ytInitialData on posts tab for {channel_id}")

    import json

    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as exc:
        raise YouTubeError(f"ytInitialData JSON parse failed for {channel_id}: {exc}") from exc

    renderers: list[dict] = []
    _find_post_renderers(data, renderers)

    items: list[NormalizedItem] = []
    for p in renderers[:limit]:
        post_id = p.get("postId") or ""
        if not post_id:
            continue
        text = _runs_text(p.get("contentText"))
        published = _parse_relative_time(_runs_text(p.get("publishedTimeText")))
        thumbnail = _thumb_from_attachment(p.get("backstageAttachment") or {})
        items.append(
            NormalizedItem(
                platform_item_id=post_id,
                type="post",
                title=text[:160],
                description=text,
                thumbnail_url=thumbnail,
                media_ref="",
                url=f"https://www.youtube.com/post/{post_id}",
                author_name=_runs_text(p.get("authorText")),
                published_at=published,
            )
        )
    return items


# ---------------------------------------------------------------- orchestration
def fetch_items(channel_id: str, limit: int = 15) -> list[NormalizedItem]:
    """Full channel fetch: videos + shorts + past livestreams + community posts."""
    # 1. RSS: authoritative metadata for recent uploads (all video kinds mixed).
    rss_items = _fetch_rss(channel_id, limit)

    # 2. Tabs: kind labels. Best-effort — on failure everything stays 'video'.
    try:
        kinds = _fetch_tab_kinds(channel_id, limit)
    except Exception as exc:
        logger.warning("Tab classification failed for %s: %s", channel_id, exc)
        kinds = {}

    for item in rss_items:
        item.type = kinds.get(item.platform_item_id, "video")

    # 3. Community posts. Best-effort. (RSS covers the recent-uploads window;
    #    older tab-only entries are skipped — they lack timestamps anyway.)
    try:
        posts = fetch_community_posts(channel_id, limit)
    except Exception as exc:
        logger.info("Community posts unavailable for %s: %s", channel_id, exc)
        posts = []

    known = {i.platform_item_id for i in rss_items}
    posts = [p for p in posts if p.platform_item_id not in known]
    return list(rss_items) + posts
