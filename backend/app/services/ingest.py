"""Ingestion orchestration: dispatch per-platform fetchers, upsert items, track health."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import INGEST_LIMIT
from ..models import Account, Item
from . import rsshub, tiktok, youtube

logger = logging.getLogger("openfeed.ingest")


def _upsert_items(db: Session, account: Account, normalized: list[youtube.NormalizedItem]) -> int:
    new_count = 0
    for ni in normalized:
        existing = db.scalar(
            select(Item).where(
                Item.platform == account.platform,
                Item.platform_item_id == ni.platform_item_id,
            )
        )
        if existing:
            # Backfill: upgrade rows that were saved without a thumbnail.
            if not existing.thumbnail_url and ni.thumbnail_url:
                existing.thumbnail_url = ni.thumbnail_url
            continue
        db.add(
            Item(
                account_id=account.id,
                platform=account.platform,
                platform_item_id=ni.platform_item_id,
                type=ni.type,
                title=ni.title or "",
                description=ni.description or "",
                thumbnail_url=ni.thumbnail_url or "",
                media_ref=ni.media_ref or "",
                url=ni.url or "",
                author_name=ni.author_name or account.display_name,
                published_at=ni.published_at,
            )
        )
        new_count += 1
    return new_count


def refresh_account(db: Session, account: Account) -> tuple[int, str, str]:
    """Fetch latest items for one account. Returns (new_items, status, error)."""
    try:
        if account.platform == "youtube":
            items = youtube.fetch_items(account.handle, limit=INGEST_LIMIT)
            if not account.display_name:
                info = youtube.resolve_channel_id(account.handle)
                account.display_name = info.title
                account.avatar_url = info.avatar_url or account.avatar_url
        elif account.platform == "tiktok":
            items, display_name, avatar = tiktok.fetch_items(account.handle, limit=INGEST_LIMIT)
            if display_name and not account.display_name:
                account.display_name = display_name
            if avatar and not account.avatar_url:
                account.avatar_url = avatar
        elif account.platform in ("x", "instagram"):
            items, display_name = rsshub.fetch_items(account.platform, account.handle, limit=INGEST_LIMIT)
            if display_name and not account.display_name:
                account.display_name = display_name
        else:
            raise ValueError(f"Unknown platform '{account.platform}'")

        new_count = _upsert_items(db, account, items)
        account.last_fetched_at = datetime.now(timezone.utc)
        account.fetch_status = "ok"
        account.fetch_error = ""
        db.commit()
        return new_count, "ok", ""
    except Exception as exc:
        logger.warning("Refresh failed for %s/%s: %s", account.platform, account.handle, exc)
        db.rollback()
        account.fetch_status = "error"
        account.fetch_error = str(exc)[:1000]
        db.commit()
        return 0, "error", account.fetch_error


def resolve_new_account(platform: str, handle: str) -> dict:
    """Resolve canonical identity for a newly subscribed account.

    For YouTube this converts @handle -> UC channel id (the RSS feed needs it).
    Returns dict with keys: handle, display_name, avatar_url, profile_url.
    """
    if platform == "youtube":
        info = youtube.resolve_channel_id(handle)
        return {
            "handle": info.channel_id,
            "display_name": info.title,
            "avatar_url": info.avatar_url,
            "profile_url": info.profile_url,
        }
    return {"handle": handle, "display_name": "", "avatar_url": "", "profile_url": ""}
