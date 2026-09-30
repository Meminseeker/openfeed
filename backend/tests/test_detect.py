import pytest

from app.services.detect import DetectionError, detect


@pytest.mark.parametrize(
    "raw, platform, handle",
    [
        ("https://www.youtube.com/@veritasium", "youtube", "@veritasium"),
        ("https://www.youtube.com/channel/UCHnyfMqiRRG1u-2MsSQLbXA", "youtube", "UCHnyfMqiRRG1u-2MsSQLbXA"),
        ("https://www.youtube.com/c/SomeChannel", "youtube", "SomeChannel"),
        ("https://youtube.com/user/someuser", "youtube", "someuser"),
        ("https://www.tiktok.com/@nba", "tiktok", "nba"),
        ("https://x.com/elonmusk", "x", "elonmusk"),
        ("https://twitter.com/elonmusk", "x", "elonmusk"),
        ("https://www.instagram.com/natgeo/", "instagram", "natgeo"),
        ("yt:@mkbhd", "youtube", "@mkbhd"),
        ("tiktok:@nba", "tiktok", "nba"),
        ("twitter:jack", "x", "jack"),
        ("ig:natgeo", "instagram", "natgeo"),
    ],
)
def test_detect_valid(raw, platform, handle):
    d = detect(raw)
    assert d.platform == platform
    assert d.handle == handle
    assert d.profile_url.startswith("http")


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "justahandle",
        "https://www.youtube.com/watch?v=abc123",  # video page, not channel
        "https://www.tiktok.com/discover/something",
        "https://x.com/home",
        "https://x.com/notavalidhandle!",
        "https://instagram.com/p/abc123/",  # post, not profile
        "https://www.reddit.com/r/python",
        "ftp://youtube.com/@x",
    ],
)
def test_detect_invalid(raw):
    with pytest.raises(DetectionError):
        detect(raw)
