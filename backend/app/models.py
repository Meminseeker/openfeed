"""ORM models."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base, UTCDateTime

PLATFORMS = ("youtube", "tiktok", "x", "instagram")
ITEM_TYPES = ("video", "short", "live", "post", "image", "text")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    platform: Mapped[str] = mapped_column(String(20), index=True)
    handle: Mapped[str] = mapped_column(String(255))  # canonical handle or channel id
    display_name: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str] = mapped_column(String(1024), default="")
    profile_url: Mapped[str] = mapped_column(String(1024), default="")
    # Reserved for future "concept tabs" (e.g. "ev", "finance"). Stored from day one.
    group_tag: Mapped[str] = mapped_column(String(100), default="", index=True)
    last_fetched_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    fetch_status: Mapped[str] = mapped_column(String(20), default="pending")  # ok|error|pending|disabled
    fetch_error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    items: Mapped[list["Item"]] = relationship(
        back_populates="account", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        UniqueConstraint("platform", "handle", name="uq_account_platform_handle"),
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    platform: Mapped[str] = mapped_column(String(20), index=True)
    platform_item_id: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(20), default="video")
    title: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    thumbnail_url: Mapped[str] = mapped_column(String(2048), default="")
    # How to render: youtube embed id / tiktok video id / external url
    media_ref: Mapped[str] = mapped_column(String(1024), default="")
    url: Mapped[str] = mapped_column(String(1024), default="")  # canonical link out
    author_name: Mapped[str] = mapped_column(String(255), default="")
    published_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime(), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    account: Mapped[Account] = relationship(back_populates="items")

    __table_args__ = (
        UniqueConstraint("platform", "platform_item_id", name="uq_item_platform_extid"),
        Index("ix_items_feed", "published_at"),
    )
