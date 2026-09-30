"""Detect platform + canonical handle from a user-supplied profile URL.

Supported inputs:
  - https://www.youtube.com/@handle | /channel/UC.. | /c/name | /user/name
  - https://www.tiktok.com/@handle
  - https://x.com/handle | https://twitter.com/handle
  - https://www.instagram.com/handle
  - "platform:handle" shorthand (e.g. "tiktok:@someone")
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse


class DetectionError(ValueError):
    pass


@dataclass(frozen=True)
class DetectedAccount:
    platform: str  # youtube|tiktok|x|instagram
    handle: str    # canonical handle (without @); for YouTube may be a URL path segment
    profile_url: str


_YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}
_TT_HOSTS = {"tiktok.com", "www.tiktok.com", "vm.tiktok.com"}
_X_HOSTS = {"x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"}
_IG_HOSTS = {"instagram.com", "www.instagram.com"}
_X_RESERVED = {"home", "explore", "notifications", "messages", "settings", "search", "i", "compose"}
_IG_RESERVED = {"p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv"}


def detect(raw: str) -> DetectedAccount:
    raw = raw.strip()
    if not raw:
        raise DetectionError("Empty input")

    # Explicit shorthand: "platform:handle"
    m = re.match(r"^(youtube|yt|tiktok|tt|x|twitter|instagram|ig)\s*:\s*(\S+)$", raw, re.I)
    if m:
        alias, handle = m.group(1).lower(), m.group(2).strip()
        platform = {
            "youtube": "youtube", "yt": "youtube",
            "tiktok": "tiktok", "tt": "tiktok",
            "x": "x", "twitter": "x",
            "instagram": "instagram", "ig": "instagram",
        }[alias]
        # YouTube resolution accepts both @handle and bare forms; keep as given.
        if platform != "youtube":
            handle = handle.lstrip("@")
        return DetectedAccount(platform, handle, _profile_url(platform, handle))

    if not re.match(r"^https?://", raw, re.I):
        raise DetectionError(
            "Please provide a full profile URL (e.g. https://www.youtube.com/@mkbhd) "
            "or a platform:handle shorthand (e.g. tiktok:@someone)"
        )

    parsed = urlparse(raw)
    host = parsed.netloc.lower()
    path = parsed.path.strip("/")
    segments = [s for s in path.split("/") if s]

    if host in _YT_HOSTS:
        if not segments:
            raise DetectionError("Not a YouTube channel URL")
        first = segments[0]
        if first in ("channel", "c", "user") and len(segments) >= 2:
            handle = segments[1]
        elif first.startswith("@"):
            handle = first  # keep @ form; resolution to channel id happens later
        elif first in ("watch", "shorts", "feed", "playlist", "results"):
            raise DetectionError("That is a YouTube page, not a channel. Use the channel URL.")
        else:
            handle = first
        return DetectedAccount("youtube", handle, _profile_url("youtube", handle))

    if host in _TT_HOSTS:
        if not segments or not segments[0].startswith("@"):
            raise DetectionError("Not a TikTok profile URL (expected https://www.tiktok.com/@user)")
        handle = segments[0].lstrip("@")
        return DetectedAccount("tiktok", handle, f"https://www.tiktok.com/@{handle}")

    if host in _X_HOSTS:
        if not segments or segments[0].lower() in _X_RESERVED or segments[0] == "i":
            raise DetectionError("Not an X profile URL (expected https://x.com/user)")
        handle = segments[0].lstrip("@")
        if not re.match(r"^[A-Za-z0-9_]{1,15}$", handle):
            raise DetectionError(f"'{handle}' is not a valid X handle")
        return DetectedAccount("x", handle, f"https://x.com/{handle}")

    if host in _IG_HOSTS:
        if not segments or segments[0].lower() in _IG_RESERVED:
            raise DetectionError("Not an Instagram profile URL (expected https://www.instagram.com/user)")
        handle = segments[0].lstrip("@")
        return DetectedAccount("instagram", handle, f"https://www.instagram.com/{handle}/")

    raise DetectionError(f"Unsupported platform for host '{host}'. Supported: YouTube, TikTok, X, Instagram.")


def _profile_url(platform: str, handle: str) -> str:
    if platform == "youtube":
        if handle.startswith("@"):
            return f"https://www.youtube.com/{handle}"
        if handle.startswith("UC"):
            return f"https://www.youtube.com/channel/{handle}"
        return f"https://www.youtube.com/@{handle}"
    return {
        "tiktok": f"https://www.tiktok.com/@{handle}",
        "x": f"https://x.com/{handle}",
        "instagram": f"https://www.instagram.com/{handle}/",
    }[platform]
