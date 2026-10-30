import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPublicPage } from "../server/public-page.ts";
import { importPlaylist } from "../server/library.ts";
import { cleanPastedUrl } from "../src/clean-url.ts";
test("pasted links retain identifiers and strip sharing parameters and fragments", () => {
  assert.equal(
    cleanPastedUrl("https://youtu.be/M4TB50FtID4?si=J8c0mFT87wp9YFoe"),
    "https://youtu.be/M4TB50FtID4",
  );
  assert.equal(
    cleanPastedUrl(
      "https://www.youtube.com/watch?v=M4TB50FtID4&si=tag&list=PLother&utm_source=chat#tracking",
    ),
    "https://www.youtube.com/watch?v=M4TB50FtID4",
  );
  assert.equal(
    cleanPastedUrl(
      "https://youtube.com/playlist?list=PL0gMcF5aNgrPlva_HNnUZgst-oICYDmSW&si=tag",
      "playlist",
    ),
    "https://youtube.com/playlist?list=PL0gMcF5aNgrPlva_HNnUZgst-oICYDmSW",
  );
  for (const url of [
    "https://x.com/test/status/123",
    "https://instagram.com/reel/ABC/",
    "https://www.tiktok.com/@creator/video/123",
    "https://vm.tiktok.com/abc/",
  ])
    assert.equal(cleanPastedUrl(url + "?si=tag&utm_source=chat#tracking"), url);
  assert.equal(
    cleanPastedUrl("https://example.com/?necessary=true"),
    "https://example.com/?necessary=true",
  );
});
test("playlist import retries a failed connection and follows a validated YouTube redirect", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  const clean =
    "https://www.youtube.com/playlist?list=PL0gMcF5aNgrPlva_HNnUZgst-oICYDmSW";
  globalThis.fetch = async (input, init) => {
    requests.push(String(input));
    assert.equal(init?.redirect, "manual");
    if (String(input).includes("/watch?v="))
      return new Response(
        'var ytInitialPlayerResponse = {"videoDetails":{"videoId":"M4TB50FtID4"},"microformat":{"playerMicroformatRenderer":{"publishDate":"2026-01-17T13:00:56Z"}}};',
      );
    if (requests.length === 1) throw new TypeError("fetch failed");
    if (requests.length === 2)
      return new Response(null, {
        status: 302,
        headers: { location: clean + "&hl=en" },
      });
    return new Response(
      "var ytInitialData = " +
        JSON.stringify({
          metadata: { playlistMetadataRenderer: { title: "Example playlist" } },
          contents: {
            playlistVideoRenderer: {
              videoId: "M4TB50FtID4",
              title: { simpleText: "Video" },
            },
          },
        }) +
        ";",
    );
  };
  try {
    const r = await importPlaylist(clean + "&si=tracking");
    assert.equal(r.posts.length, 1);
    assert.equal(r.playlist.url, clean);
    assert.deepEqual(requests, [
      clean,
      clean,
      clean + "&hl=en",
      "https://www.youtube.com/watch?v=M4TB50FtID4",
    ]);
    assert.equal(r.posts[0].published, "2026-01-17T13:00:56.000Z");
    assert.equal(r.playlist.warning, undefined);
  } finally {
    globalThis.fetch = original;
  }
});
test("redirects cannot leave YouTube or silently substitute another playlist", async () => {
  const original = globalThis.fetch;
  try {
    for (const location of [
      "http://127.0.0.1/private",
      "https://youtube.com.evil.test/playlist",
      "https://www.youtube.com/playlist?list=OTHER",
      "https://consent.youtube.com/",
    ]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response(null, { status: 302, headers: { location } });
      };
      await assert.rejects(
        fetchPublicPage("https://www.youtube.com/playlist?list=PLtest123456"),
        /redirected away/,
      );
      assert.equal(calls, 1);
    }
  } finally {
    globalThis.fetch = original;
  }
});
test("network failures get bounded retries and a diagnostic instead of fetch failed", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
  };
  try {
    await assert.rejects(
      fetchPublicPage("https://www.youtube.com/playlist?list=PLtest123456"),
      /YouTube.*3 attempts.*ENOTFOUND/,
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = original;
  }
});
test("transient HTTP and interrupted response bodies are retried", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response("", { status: 503 });
    if (calls === 2)
      return new Response(
        new ReadableStream({
          start(c) {
            c.error(new Error("connection reset"));
          },
        }),
      );
    return new Response("complete");
  };
  try {
    assert.equal(
      await (
        await fetchPublicPage(
          "https://www.youtube.com/playlist?list=PLtest123456",
        )
      ).text(),
      "complete",
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = original;
  }
});

test("YouTube regional consent redirect returns to the exact playlist without cookies or form submission", async () => {
  const original = globalThis.fetch;
  const url = "https://www.youtube.com/playlist?list=PLtest123456";
  const consent =
    "https://consent.youtube.com/m?continue=" +
    encodeURIComponent(url + "&cbrd=1") +
    "&gl=DE";
  const seen: string[] = [];
  globalThis.fetch = async (input, init) => {
    seen.push(String(input));
    assert.equal(init?.method, undefined);
    assert.equal((init?.headers as Record<string, string>)?.Cookie, undefined);
    if (seen.length === 1)
      return new Response(null, {
        status: 302,
        headers: { location: consent },
      });
    if (seen.length === 2)
      return new Response(null, {
        status: 303,
        headers: { location: url + "&cbrd=1&ucbcb=1" },
      });
    return new Response("public playlist");
  };
  try {
    assert.equal(await (await fetchPublicPage(url)).text(), "public playlist");
    assert.deepEqual(seen, [url, consent, url + "&cbrd=1&ucbcb=1"]);
  } finally {
    globalThis.fetch = original;
  }
});

test("consent redirects cannot swap playlists, leak to other hosts or accept an interactive consent form", async () => {
  const original = globalThis.fetch;
  const url = "https://www.youtube.com/playlist?list=PLtest123456";
  try {
    for (const target of [
      "https://www.youtube.com/playlist?list=OTHER",
      "https://evil.test/playlist?list=PLtest123456",
      "http://www.youtube.com/playlist?list=PLtest123456",
      "https://user:pass@www.youtube.com/playlist?list=PLtest123456",
    ]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response(null, {
          status: 302,
          headers: {
            location:
              "https://consent.youtube.com/m?continue=" +
              encodeURIComponent(target),
          },
        });
      };
      await assert.rejects(fetchPublicPage(url), /redirected away/);
      assert.equal(calls, 1);
    }
    let calls = 0;
    globalThis.fetch = async () =>
      ++calls === 1
        ? new Response(null, {
            status: 302,
            headers: {
              location:
                "https://consent.youtube.com/m?continue=" +
                encodeURIComponent(url),
            },
          })
        : new Response("<form>Consent choices</form>");
    await assert.rejects(fetchPublicPage(url), /interactive consent/);
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () =>
      new Response(null, {
        status: 302,
        headers: {
          location:
            ++calls === 1
              ? "https://consent.youtube.com/m?continue=" +
                encodeURIComponent(url)
              : "https://www.youtube.com/playlist?list=OTHER",
        },
      });
    await assert.rejects(fetchPublicPage(url), /redirected away/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
