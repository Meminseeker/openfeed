"""TikTok ingestion via yt-dlp (unofficial; public accounts, no login).

Metadata: full (non-flat) extraction of the N most recent posts from tiktok.com/@user.
Playback: direct mp4 URL resolved on demand (URLs expire quickly) and streamed
through the backend media proxy with the headers TikTok's CDN requires.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from ..config import USER_AGENT
from .youtube import NormalizedItem


class TikTokError(RuntimeError):
    pass


def _ydl(extra: dict | None = None) -> YoutubeDL:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": True,
        "skip_download": True,
        "http_headers": {"User-Agent": USER_AGENT, "Referer": "https://www.tiktok.com/"},
        "socket_timeout": 20,
        "extractor_retries": 2,
    }
    if extra:
        opts.update(extra)
    return YoutubeDL(opts)


def fetch_items(handle: str, limit: int = 15) -> tuple[list[NormalizedItem], str, str]:
    """Return (items, display_name, avatar_url) for a TikTok user."""
    url = f"https://www.tiktok.com/@{handle}"
    try:
        with _ydl({"playlistend": limit}) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as exc:
        raise TikTokError(f"yt-dlp failed for @{handle}: {exc}") from exc
    except Exception as exc:  # yt-dlp raises many exception types
        raise TikTokError(f"yt-dlp error for @{handle}: {exc}") from exc

    if not info:
        raise TikTokError(f"No data returned for @{handle} (account may be private, renamed, or rate-limited)")

    entries = [e for e in (info.get("entries") or []) if e]
    display_name = info.get("uploader") or info.get("channel") or handle
    avatar_url = ""

    items: list[NormalizedItem] = []
    for entry in entries[:limit]:
        video_id = str(entry.get("id") or "")
        if not video_id:
            continue
        if not avatar_url:
            avatar_url = entry.get("uploader_avatar") or ""
        timestamp = entry.get("timestamp") or entry.get("release_timestamp")
        published_at = None
        if timestamp:
            from datetime import datetime, timezone

            published_at = datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
        is_video = entry.get("duration") is not None or entry.get("formats") is not None
        items.append(
            NormalizedItem(
                platform_item_id=video_id,
                type="video" if is_video else "image",
                title=(entry.get("title") or entry.get("description") or "")[:500],
                description=entry.get("description") or "",
                thumbnail_url=entry.get("thumbnail") or "",
                media_ref=video_id,
                url=entry.get("webpage_url") or f"https://www.tiktok.com/@{handle}/video/{video_id}",
                author_name=entry.get("uploader") or display_name,
                published_at=published_at,
            )
        )
    return items, display_name, avatar_url


# --- Playback: resolve + cache direct stream sessions (URLs expire fast) ---
# TikTok's CDN enforces TLS fingerprinting + challenge cookies obtained during
# extraction, so we capture and reuse the whole request context (url, headers,
# cookies) and replay it with curl_cffi impersonation in the media proxy.
@dataclass
class StreamSession:
    url: str
    headers: dict
    cookies: dict
    expires_at: float


_stream_cache: dict[str, StreamSession] = {}
_STREAM_TTL = 30 * 60  # seconds


def resolve_stream_session(video_url: str) -> StreamSession:
    """Resolve a TikTok video page URL to a replayable CDN stream session."""
    now = time.time()
    cached = _stream_cache.get(video_url)
    if cached and cached.expires_at > now:
        return cached

    try:
        with _ydl({"format": "best[ext=mp4]/best"}) as ydl:
            info = ydl.extract_info(video_url, download=False)
            cookies = {c.name: c.value for c in ydl.cookiejar}
    except Exception as exc:
        raise TikTokError(f"Could not resolve stream for {video_url}: {exc}") from exc

    if not info:
        raise TikTokError(f"Could not resolve stream for {video_url}")

    direct = info.get("url")
    headers = info.get("http_headers") or {}
    if not direct:
        for fmt in reversed(info.get("formats") or []):
            if fmt.get("url") and (fmt.get("ext") == "mp4" or "mp4" in (fmt.get("format_id") or "")):
                direct = fmt["url"]
                headers = fmt.get("http_headers") or headers
                break
    if not direct and info.get("requested_formats"):
        direct = info["requested_formats"][0].get("url")
    if not direct:
        raise TikTokError(f"No playable mp4 found for {video_url}")

    session = StreamSession(url=direct, headers=headers, cookies=cookies, expires_at=now + _STREAM_TTL)
    _stream_cache[video_url] = session
    return session
