"""Account (subscription) management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Account
from ..schemas import AccountCreate, AccountOut, AccountUpdate, RefreshResult
from ..services import ingest
from ..services.detect import DetectionError, detect

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.scalars(select(Account).order_by(Account.platform, Account.display_name)).all()


@router.post("", response_model=AccountOut, status_code=201)
def add_account(payload: AccountCreate, db: Session = Depends(get_db)):
    try:
        detected = detect(payload.url)
    except DetectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    existing = db.scalar(
        select(Account).where(Account.platform == detected.platform, Account.handle == detected.handle)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Account already subscribed")

    # Resolve canonical identity (YouTube @handle -> UC channel id)
    resolved = ingest.resolve_new_account(detected.platform, detected.handle)
    canonical_handle = resolved["handle"] or detected.handle

    existing = db.scalar(
        select(Account).where(Account.platform == detected.platform, Account.handle == canonical_handle)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Account already subscribed")

    account = Account(
        platform=detected.platform,
        handle=canonical_handle,
        display_name=resolved["display_name"] or detected.handle,
        avatar_url=resolved["avatar_url"] or "",
        profile_url=resolved["profile_url"] or detected.profile_url,
        group_tag=payload.group_tag.strip(),
        fetch_status="pending",
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    # Immediate first fetch so the UI isn't empty; failure is surfaced, not fatal.
    ingest.refresh_account(db, account)
    db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(account_id: int, payload: AccountUpdate, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if payload.group_tag is not None:
        account.group_tag = payload.group_tag.strip()
    if payload.display_name is not None:
        account.display_name = payload.display_name.strip()
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()


@router.post("/{account_id}/refresh", response_model=RefreshResult)
def refresh_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    new_items, status, error = ingest.refresh_account(db, account)
    return RefreshResult(
        account_id=account.id, platform=account.platform,
        new_items=new_items, status=status, error=error,
    )
