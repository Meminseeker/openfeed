from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import Account, Item
from app.services.ingest import _upsert_items
from app.services.youtube import NormalizedItem


def _seed(db):
    yt = Account(platform="youtube", handle="UCtest", display_name="YT Chan", profile_url="https://youtube.com/channel/UCtest")
    tt = Account(platform="tiktok", handle="ttuser", display_name="TT User", profile_url="https://tiktok.com/@ttuser", group_tag="fun")
    db.add_all([yt, tt])
    db.commit()
    now = datetime.now(timezone.utc)
    for i in range(5):
        db.add(Item(
            account_id=yt.id, platform="youtube", platform_item_id=f"yt{i}",
            type="video", title=f"yt video {i}", media_ref=f"yt{i}",
            url=f"https://youtube.com/watch?v=yt{i}", author_name="YT Chan",
            published_at=now - timedelta(hours=i),
        ))
    for i in range(3):
        db.add(Item(
            account_id=tt.id, platform="tiktok", platform_item_id=f"tt{i}",
            type="video", title=f"tt video {i}", media_ref=f"tt{i}",
            url=f"https://tiktok.com/@ttuser/video/tt{i}", author_name="TT User",
            published_at=now - timedelta(minutes=30 * i),
        ))
    # YouTube kind variety: shorts / live / posts mixed into the same channel
    db.add(Item(
        account_id=yt.id, platform="youtube", platform_item_id="ytshort0",
        type="short", title="a short", media_ref="ytshort0",
        url="https://youtube.com/shorts/ytshort0", author_name="YT Chan",
        published_at=now - timedelta(minutes=5),
    ))
    db.add(Item(
        account_id=yt.id, platform="youtube", platform_item_id="ytpost0",
        type="post", title="a community post", description="full post text",
        url="https://youtube.com/post/ytpost0", author_name="YT Chan",
        published_at=now - timedelta(minutes=2),
    ))
    db.commit()
    return yt, tt


def test_feed_chronological_union(client):
    db = SessionLocal()
    _seed(db)
    db.close()

    resp = client.get("/api/feed?limit=20")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 10
    stamps = [i["published_at"] for i in data["items"]]
    assert stamps == sorted(stamps, reverse=True), "feed must be strictly chronological"
    # two items share the "now" timestamp (tt0, yt0); tie broken by id desc
    assert data["items"][0]["platform"] == "tiktok"
    # the youtube post (2 min old) is next after the two "now" videos
    assert data["items"][2]["type"] == "post"


def test_feed_filters(client):
    resp = client.get("/api/feed?platform=youtube")
    assert {i["platform"] for i in resp.json()["items"]} == {"youtube"}

    resp = client.get("/api/feed?group=fun")
    assert {i["platform"] for i in resp.json()["items"]} == {"tiktok"}

    resp = client.get("/api/feed/groups")
    assert resp.json() == ["fun"]


def test_feed_kind_filter(client):
    resp = client.get("/api/feed?kind=short")
    kinds = {i["type"] for i in resp.json()["items"]}
    assert kinds == {"short"}

    resp = client.get("/api/feed?kind=post")
    items = resp.json()["items"]
    assert len(items) == 1 and items[0]["type"] == "post"

    resp = client.get("/api/feed?kind=video&platform=youtube")
    items = resp.json()["items"]
    assert items and all(i["type"] == "video" and i["platform"] == "youtube" for i in items)


def test_feed_pagination(client):
    from urllib.parse import quote

    page1 = client.get("/api/feed?limit=5").json()
    assert len(page1["items"]) == 5
    assert page1["next_cursor"]

    page2 = client.get(f"/api/feed?limit=5&before={quote(page1['next_cursor'])}").json()
    assert len(page2["items"]) == 5
    ids1 = {i["id"] for i in page1["items"]}
    ids2 = {i["id"] for i in page2["items"]}
    assert not ids1 & ids2, "pages must not overlap"


def test_upsert_dedup(client):
    db = SessionLocal()
    account = db.query(Account).filter_by(platform="youtube").first()
    incoming = [
        NormalizedItem(platform_item_id="yt0", type="video", title="dup"),
        NormalizedItem(platform_item_id="yt-new", type="video", title="fresh"),
    ]
    added = _upsert_items(db, account, incoming)
    db.commit()
    assert added == 1, "only the unseen item should be inserted"
    added_again = _upsert_items(db, account, incoming)
    db.commit()
    assert added_again == 0
    db.close()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_account_crud_validation(client):
    # invalid URL -> 422
    resp = client.post("/api/accounts", json={"url": "not a url at all"})
    assert resp.status_code == 422
    # missing account -> 404
    assert client.post("/api/accounts/99999/refresh").status_code == 404
    assert client.delete("/api/accounts/99999").status_code == 404
