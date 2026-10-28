import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
test("PWA manifest has standalone icons with real matching PNG dimensions", () => {
  const manifest = JSON.parse(
    readFileSync("public/manifest.webmanifest", "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  for (const icon of manifest.icons) {
    const data = readFileSync(`public${icon.src}`);
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    assert.equal(
      `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,
      icon.sizes,
    );
  }
});
test("service worker ignores API data and media; only navigations get offline fallback", async () => {
  const events: Record<string, Function> = {};
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      location: { origin: "https://feed.test" },
      addEventListener: (name: string, handler: Function) =>
        (events[name] = handler),
    },
    URL,
    fetch: async () => {
      throw new Error("offline");
    },
    caches: { match: async () => "offline-page" },
  });
  for (const request of [
    { url: "https://feed.test/api/state", method: "GET", mode: "cors" },
    { url: "https://feed.test/api/posts/1", method: "PATCH", mode: "cors" },
    { url: "https://media.test/video.mp4", method: "GET", mode: "no-cors" },
  ]) {
    events.fetch({
      request,
      respondWith: () => assert.fail("Private data must not be intercepted"),
    });
  }
  let result: unknown;
  events.fetch({
    request: { url: "https://feed.test/", method: "GET", mode: "navigate" },
    respondWith: (p: Promise<unknown>) => (result = p),
  });
  assert.equal(await result, "offline-page");
});
