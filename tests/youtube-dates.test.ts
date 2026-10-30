import { test } from "node:test";
import assert from "node:assert/strict";
import { videoPublished, resolveVideoDates } from "../server/youtube-dates.ts";
import { sortContents } from "../src/ContentOptions.tsx";
import type { Post } from "../src/types.ts";
const html = (id: string, date: string) =>
  `var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { videoId: id, title: 'A title with }; and " braces' }, microformat: { playerMicroformatRenderer: { publishDate: date } } })};`;
const post = (id: string, date = "2026-01-30T00:00:00Z") =>
  ({ id, kind: "video", published: date, publishedApproximate: true }) as Post;

test("extracts the matching video's precise publication timestamp, not related video metadata", () => {
  assert.equal(
    videoPublished(
      html("X4pYE34BlYI", "2026-01-17T05:00:56-08:00"),
      "X4pYE34BlYI",
    ),
    "2026-01-17T13:00:56.000Z",
  );
  assert.equal(
    videoPublished(
      html("X4pYE34BlYI", "2026-01-17T05:00:56-08:00"),
      "D8SuE6ZTaYc",
    ),
    undefined,
  );
  for (const date of ["9 months ago", "2026-01-17", "invalid"])
    assert.equal(
      videoPublished(html("X4pYE34BlYI", date), "X4pYE34BlYI"),
      undefined,
    );
  assert.equal(videoPublished("sign in required", "X4pYE34BlYI"), undefined);
});
test("resolves same-age videos into chronological order and reuses exact stored dates", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const id = new URL(String(input)).searchParams.get("v")!;
    calls.push(id);
    return new Response(
      html(
        id,
        id === "X4pYE34BlYI" ? "2026-01-17T13:00:56Z" : "2026-01-10T13:00:56Z",
      ),
    );
  };
  try {
    const posts = [post("i-t1mcefZwE"), post("X4pYE34BlYI")];
    assert.equal(await resolveVideoDates(posts), 0);
    assert.deepEqual(
      sortContents(posts, "newest").map((p) => p.id),
      ["X4pYE34BlYI", "i-t1mcefZwE"],
    );
    assert.deepEqual(
      sortContents(posts, "oldest").map((p) => p.id),
      ["i-t1mcefZwE", "X4pYE34BlYI"],
    );
    const refreshed = [post("i-t1mcefZwE", ""), post("X4pYE34BlYI")];
    await resolveVideoDates(refreshed, posts);
    assert.equal(calls.length, 2);
    assert.equal(refreshed[1].publishedApproximate, false);
    assert.equal(refreshed[1].published, posts[1].published);
  } finally {
    globalThis.fetch = original;
  }
});
test("unavailable precise dates preserve content and remain retryable", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable");
  try {
    const posts = [post("X4pYE34BlYI")];
    const before = posts[0].published;
    assert.equal(await resolveVideoDates(posts), 1);
    assert.equal(posts[0].published, before);
    assert.equal(posts[0].publishedApproximate, true);
  } finally {
    globalThis.fetch = original;
  }
});
