"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    url: str = Field(..., description="Profile URL or @handle; platform is auto-detected")
    group_tag: str = ""


class AccountUpdate(BaseModel):
    group_tag: str | None = None
    display_name: str | None = None


class AccountOut(BaseModel):
    id: int
    platform: str
    handle: str
    display_name: str
    avatar_url: str
    profile_url: str
    group_tag: str
    last_fetched_at: datetime | None
    fetch_status: str
    fetch_error: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ItemOut(BaseModel):
    id: int
    platform: str
    platform_item_id: str
    type: str
    title: str
    description: str
    thumbnail_url: str
    media_ref: str
    url: str
    author_name: str
    published_at: datetime | None
    account_id: int

    model_config = {"from_attributes": True}


class FeedResponse(BaseModel):
    items: list[ItemOut]
    next_cursor: str | None = None  # ISO timestamp of oldest item; pass as `before`


class RefreshResult(BaseModel):
    account_id: int
    platform: str
    new_items: int
    status: str
    error: str = ""
