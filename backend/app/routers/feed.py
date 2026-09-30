"""Unified chronological feed endpoint. No ranking. Ever."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import FEED_PAGE_LIMIT
from ..database import get_db
from ..models import Item
from ..schemas import FeedResponse, ItemOut

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
def get_feed(
    platform: str | None = Query(default=None),
    account_id: int | None = Query(default=None),
    kind: str | None = Query(default=None, description="video|short|live|post|image|text"),
    group: str | None = Query(default=None),
    before: str | None = Query(default=None, description="ISO cursor: only items older than this"),
    limit: int = Query(default=FEED_PAGE_LIMIT, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(Item)

    if platform:
        stmt = stmt.where(Item.platform == platform)
    if account_id:
        stmt = stmt.where(Item.account_id == account_id)
    if kind:
        stmt = stmt.where(Item.type == kind)
    if group:
        from ..models import Account

        stmt = stmt.where(Item.account_id.in_(select(Account.id).where(Account.group_tag == group)))
    if before:
        try:
            cursor = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid 'before' cursor: {before}") from exc
        stmt = stmt.where(Item.published_at < cursor)

    # NULL published_at sorts last; chronological, newest first.
    stmt = stmt.order_by(Item.published_at.desc().nulls_last(), Item.id.desc()).limit(limit + 1)

    rows = list(db.scalars(stmt).all())
    has_more = len(rows) > limit
    page = rows[:limit]

    next_cursor = None
    if has_more and page and page[-1].published_at:
        next_cursor = page[-1].published_at.astimezone(timezone.utc).isoformat()

    return FeedResponse(
        items=[ItemOut.model_validate(r) for r in page],
        next_cursor=next_cursor,
    )


@router.get("/groups", response_model=list[str])
def list_groups(db: Session = Depends(get_db)):
    from ..models import Account

    rows = db.scalars(
        select(Account.group_tag).where(Account.group_tag != "").distinct()
    ).all()
    return sorted(rows)
