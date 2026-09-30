"""Background polling: refreshes accounts on per-platform schedules with jitter/backoff."""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from ..config import POLL_INTERVALS
from ..database import SessionLocal
from ..models import Account
from .ingest import refresh_account

logger = logging.getLogger("openfeed.poller")

_scheduler: BackgroundScheduler | None = None
# Consecutive-error backoff: skip accounts that keep failing, up to 6h.
_ERROR_BACKOFF = {2: 2, 3: 4, 4: 8}  # errors -> interval multiplier (capped)
_account_error_counts: dict[int, int] = {}


def _due(account: Account, now: datetime) -> bool:
    interval_min = POLL_INTERVALS.get(account.platform, 60)
    errors = _account_error_counts.get(account.id, 0)
    multiplier = _ERROR_BACKOFF.get(errors, 12 if errors > 4 else 1)
    interval = timedelta(minutes=interval_min * multiplier)
    if account.last_fetched_at is None:
        return True
    last = account.last_fetched_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return now - last >= interval


def poll_due_accounts() -> None:
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        accounts = list(db.scalars(select(Account)).all())
        due = [a for a in accounts if _due(a, now)]
        if not due:
            return
        logger.info("Polling %d/%d accounts", len(due), len(accounts))
        for account in due:
            new_items, status, _ = refresh_account(db, account)
            if status == "ok":
                _account_error_counts.pop(account.id, None)
            else:
                _account_error_counts[account.id] = _account_error_counts.get(account.id, 0) + 1
            logger.info(
                "  %s/@%s -> %s (+%d items)", account.platform, account.handle, status, new_items
            )
    finally:
        db.close()


def start() -> None:
    global _scheduler
    if _scheduler:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        poll_due_accounts,
        "interval",
        minutes=5,
        jitter=30,
        id="poll_due_accounts",
        misfire_grace_time=300,
        coalesce=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=15 + random.uniform(0, 10)),
    )
    _scheduler.start()
    logger.info("Poller started (intervals: %s)", POLL_INTERVALS)


def shutdown() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
