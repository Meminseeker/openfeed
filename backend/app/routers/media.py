"""Media proxy: streams TikTok mp4s (with Range support) and proxies thumbnails.

TikTok's CDN enforces TLS fingerprinting (JA3) plus challenge cookies captured
during yt-dlp extraction, so playback is proxied through curl_cffi with Chrome
impersonation replaying the exact session yt-dlp established.
Thumbnail proxy exists mainly for Instagram CDN images that reject hotlinking.
"""
from __future__ import annotations

import logging

import httpx
from curl_cffi import requests as cffi_requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..config import HTTP_TIMEOUT, USER_AGENT
from ..database import get_db
from ..models import Item
from ..services import tiktok

logger = logging.getLogger("openfeed.media")
router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/tiktok/{item_id}/stream")
def tiktok_stream(item_id: int, request: Request, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item or item.platform != "tiktok":
        raise HTTPException(status_code=404, detail="TikTok item not found")

    try:
        session = tiktok.resolve_stream_session(item.url)
    except tiktok.TikTokError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    headers = dict(session.headers)
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    try:
        upstream = cffi_requests.get(
            session.url,
            headers=headers,
            cookies=session.cookies,
            impersonate="chrome",
            timeout=HTTP_TIMEOUT,
            stream=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"CDN request failed: {exc}") from exc

    if upstream.status_code == 403:
        # Cached session went stale (or CDN rejected it): drop cache once so the
        # next play re-resolves fresh, and tell the client to retry.
        tiktok._stream_cache.pop(item.url, None)
        upstream.close()
        raise HTTPException(status_code=503, detail="Stream session expired; retry")

    resp_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() in ("content-type", "content-length", "content-range", "accept-ranges")
    }

    def streamer():
        try:
            yield from upstream.iter_content(chunk_size=256 * 1024)
        finally:
            upstream.close()

    return StreamingResponse(
        streamer(),
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type", "video/mp4"),
    )


@router.get("/thumb")
def thumbnail_proxy(url: str = Query(..., max_length=2048)):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="Invalid thumbnail URL")
    try:
        with httpx.Client(
            timeout=HTTP_TIMEOUT, follow_redirects=True, headers={"User-Agent": USER_AGENT}
        ) as client:
            resp = client.get(url)
        if resp.status_code != 200 or not resp.content:
            raise HTTPException(status_code=404, detail="Thumbnail unavailable")
        return StreamingResponse(
            iter([resp.content]),
            media_type=resp.headers.get("content-type", "image/jpeg"),
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Thumbnail fetch failed: {exc}") from exc
