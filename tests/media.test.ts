import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { xVideoUrl, streamXVideo } from "../server/media.ts";
import type { Post } from "../src/types.ts";

test("video proxy accepts only stored X CDN videos", () => {
  const post = {
    platform: "x",
    videos: [{ url: "https://video.twimg.com/a.mp4" }],
  } as Post;
  assert.equal(xVideoUrl(post, "0"), post.videos![0].url);
  for (const url of [
    "https://evil.test/a.mp4",
    "http://video.twimg.com/a",
    "https://video.twimg.com:444/a",
    "https://user@video.twimg.com/a",
  ]) {
    assert.equal(xVideoUrl({ ...post, videos: [{ url }] }, "0"), undefined);
  }
  assert.equal(xVideoUrl({ ...post, platform: "instagram" }, "0"), undefined);
  assert.equal(xVideoUrl(post, "-1"), undefined);
  assert.equal(xVideoUrl(post, "1"), undefined);
});

test("video streaming preserves ranges and HEAD without forwarding browser credentials", async () => {
  const original = globalThis.fetch;
  const app = express();
  app.get("/video", (req, res) =>
    streamXVideo(req, res, "https://video.twimg.com/a.mp4"),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const endpoint = `http://127.0.0.1:${address.port}/video`;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith(endpoint)) return original(input, init);
    calls++;
    assert.deepEqual(init?.headers, { Range: "bytes=0-2" });
    assert.equal(init?.redirect, "error");
    return new Response(init?.method === "HEAD" ? null : "abc", {
      status: 206,
      headers: {
        "content-type": "video/mp4",
        "content-length": "3",
        "content-range": "bytes 0-2/10",
        "accept-ranges": "bytes",
        "set-cookie": "secret=1",
      },
    });
  };
  try {
    const response = await fetch(endpoint, {
      headers: {
        Range: "bytes=0-2",
        Referer: "http://localhost:3000/",
        Cookie: "secret=1",
        Authorization: "secret",
      },
    });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 0-2/10");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(await response.text(), "abc");
    const head = await fetch(endpoint, {
      method: "HEAD",
      headers: { Range: "bytes=0-2" },
    });
    assert.equal(head.status, 206);
    assert.equal(await head.text(), "");
    const bad = await fetch(endpoint, { headers: { Range: "bytes=0-1,3-4" } });
    assert.equal(bad.status, 400);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
