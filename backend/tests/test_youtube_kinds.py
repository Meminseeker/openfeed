from datetime import datetime, timedelta, timezone

from app.services.youtube import (
    _find_post_renderers,
    _parse_relative_time,
    _runs_text,
    _thumb_from_attachment,
)


class TestParseRelativeTime:
    def test_hours(self):
        dt = _parse_relative_time("3 hours ago")
        assert dt is not None
        assert abs((datetime.now(timezone.utc) - dt) - timedelta(hours=3)) < timedelta(minutes=1)

    def test_days_edited_suffix(self):
        dt = _parse_relative_time("2 days ago (edited)")
        assert dt is not None
        assert abs((datetime.now(timezone.utc) - dt) - timedelta(days=2)) < timedelta(minutes=1)

    def test_months_approx(self):
        dt = _parse_relative_time("4 months ago")
        assert dt is not None
        assert abs((datetime.now(timezone.utc) - dt) - timedelta(days=120)) < timedelta(days=1)

    def test_non_english_returns_none(self):
        assert _parse_relative_time("4 ay önce") is None
        assert _parse_relative_time("") is None
        assert _parse_relative_time("yesterday") is None


class TestRunsText:
    def test_runs(self):
        node = {"runs": [{"text": "Hello "}, {"text": "world"}]}
        assert _runs_text(node) == "Hello world"

    def test_simple_text(self):
        assert _runs_text({"simpleText": "hi"}) == "hi"

    def test_none(self):
        assert _runs_text(None) == ""


class TestThumbFromAttachment:
    def test_single_image_backstage_structure(self):
        # Real ytInitialData structure: image.thumbnails is the array directly
        att = {
            "backstageImageRenderer": {
                "image": {"thumbnails": [{"url": "small.jpg"}, {"url": "big.jpg"}]}
            }
        }
        assert _thumb_from_attachment(att) == "big.jpg"

    def test_single_image_nested_structure(self):
        # Video-style nesting: image.thumbnail.thumbnails
        att = {
            "backstageImageRenderer": {
                "image": {"thumbnail": {"thumbnails": [{"url": "small.jpg"}, {"url": "big.jpg"}]}}
            }
        }
        assert _thumb_from_attachment(att) == "big.jpg"

    def test_multi_image_takes_first(self):
        att = {
            "postMultiImageRenderer": {
                "images": [
                    {"backstageImageRenderer": {"image": {"thumbnails": [{"url": "one.jpg"}]}}},
                    {"backstageImageRenderer": {"image": {"thumbnails": [{"url": "two.jpg"}]}}},
                ]
            }
        }
        assert _thumb_from_attachment(att) == "one.jpg"

    def test_video_attachment(self):
        att = {"videoRenderer": {"videoId": "abc123"}}
        assert _thumb_from_attachment(att) == "https://i.ytimg.com/vi/abc123/hqdefault.jpg"

    def test_empty(self):
        assert _thumb_from_attachment({}) == ""
        assert _thumb_from_attachment({"quizRenderer": {}}) == ""


class TestFindPostRenderers:
    def test_finds_nested(self):
        data = {"contents": {"tabs": [{"content": [{"backstagePostRenderer": {"postId": "p1"}}]}]}}
        out: list = []
        _find_post_renderers(data, out)
        assert out == [{"postId": "p1"}]

    def test_does_not_recurse_into_found_renderer(self):
        inner = {"backstagePostRenderer": {"postId": "inner"}}
        outer = {"backstagePostRenderer": {"postId": "outer", "nested": inner}}
        out: list = []
        _find_post_renderers(outer, out)
        assert out == [{"postId": "outer", "nested": inner}]
