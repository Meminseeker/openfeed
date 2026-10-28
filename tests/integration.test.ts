import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
test("API persists creator tags, linked accounts, saved/read states; isolates origins and cascades unfollow", async () => {
  const dir = mkdtempSync(join(tmpdir(), "openfeed-test-")),
    path = join(dir, "test.db");
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE creators(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE posts(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL,data TEXT NOT NULL)",
  );
  const c = {
    id: "test-creator",
    name: "Test Creator",
    tags: [],
    accounts: [
      {
        platform: "youtube",
        username: "@test",
        channelId: "UCLRYyGAoqR26MpjAmbrG6oQ",
        syncTypes: ["video", "short"],
      },
    ],
    avatar: "",
  };
  const p = {
    id: "test-post",
    creatorId: c.id,
    title: "Test",
    url: "https://youtube.com/watch?v=test",
    kind: "video",
    published: new Date().toISOString(),
    read: false,
    saved: false,
  };
  db.prepare("INSERT INTO creators VALUES (?,?)").run(c.id, JSON.stringify(c));
  db.prepare("INSERT INTO posts VALUES (?,?,?)").run(
    p.id,
    c.id,
    JSON.stringify(p),
  );
  for (const patch of [
    { id: "expired" },
    { id: "saved-old", saved: true },
    { id: "noted-old", notes: "Keep this annotation" },
  ]) {
    const old = { ...p, published: "2000-01-01T00:00:00Z", ...patch };
    db.prepare("INSERT INTO posts VALUES (?,?,?)").run(
      old.id,
      c.id,
      JSON.stringify(old),
    );
  }
  db.close();
  let proc: ChildProcess;
  let base = "";
  const start = () =>
    new Promise<void>((resolve, reject) => {
      proc = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          "--import",
          "./tests/fixtures/youtube-fetch.ts",
          "server/index.ts",
        ],
        {
          env: {
            ...process.env,
            X_BEARER_TOKEN: "",
            INSTAGRAM_ACCESS_TOKEN: "",
            INSTAGRAM_USER_ID: "",
            NODE_ENV: "production",
            PORT: "0",
            OPENFEED_DB: path,
            OPENFEED_RETENTION_DAYS: "90",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const timer = setTimeout(
        () => reject(new Error("Server did not start")),
        10000,
      );
      proc.stdout!.on("data", (chunk) => {
        const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
        if (match) {
          base = `http://127.0.0.1:${match[1]}`;
          clearTimeout(timer);
          resolve();
        }
      });
      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  const stop = () =>
    new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
      proc.kill();
    });
  const call = async (path: string, method = "GET", body?: unknown) => {
    const res = await fetch(`${base}/api/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert.ok(res.ok, `${method} ${path}: ${res.status}`);
    return res.json();
  };
  try {
    await start();
    const initial = await call("state");
    assert.ok(!initial.posts.some((p: any) => p.id === "expired"));
    assert.ok(initial.posts.some((p: any) => p.id === "saved-old"));
    assert.ok(initial.posts.some((p: any) => p.id === "noted-old"));
    const tt = await call("creators", "POST", {
      platform: "tiktok",
      channel: "https://www.tiktok.com/@Dolubatarya",
    });
    await call("sync", "POST");
    const ttState = await call("state");
    assert.equal(
      ttState.posts.find((p: any) => p.platform === "tiktok").creatorId,
      tt.id,
    );
    await call(`creators/${tt.id}`, "DELETE");
    await call("creators/test-creator", "PATCH", {
      tags: [" Technology ", "Technology", "News"],
      accounts: [
        {
          platform: "youtube",
          username: "@test",
          syncTypes: ["video", "short"],
        },
        { platform: "x", username: "@test", syncTypes: ["post"] },
      ],
    });
    await call("posts/test-post", "PATCH", {
      saved: true,
      notes: "[1:01] A useful idea",
    });
    await call("sync", "POST");
    let synced = await call("state");
    assert.ok(synced.posts.every((p: any) => p.kind !== "community"));
    assert.equal(
      synced.posts.find((p: any) => p.id === "test-post").notes,
      "[1:01] A useful idea",
    );
    assert.equal(
      synced.posts.find((p: any) => p.id === "x:123").creatorId,
      "test-creator",
    );
    await call("posts/x:123", "PATCH", { saved: true, notes: "X note" });
    const fullX = await call("posts/x:123/detail");
    assert.equal(fullX.textExpanded, true);
    assert.match(fullX.text, /Complete public post/);
    await call("sync", "POST");
    const afterRefresh = (await call("state")).posts.find(
      (p: any) => p.id === "x:123",
    );
    assert.equal(afterRefresh.text, fullX.text);
    assert.equal(afterRefresh.notes, "X note");
    await call("posts/x:123", "DELETE");
    await call("sync", "POST");
    assert.ok(!(await call("state")).posts.some((p: any) => p.id === "x:123"));
    await call("posts/x:123", "PATCH", { removed: false });
    const restored = (await call("state")).posts.find(
      (p: any) => p.id === "x:123",
    );
    assert.equal(restored.saved, true);
    assert.equal(restored.notes, "X note");
    await call("creators/test-creator", "PATCH", {
      accounts: [
        { platform: "youtube", syncTypes: ["community"] },
        { platform: "x", username: "@test", syncTypes: ["post"] },
      ],
    });
    await call("sync", "POST");
    synced = await call("state");
    assert.deepEqual(
      synced.posts.find((p: any) => p.id === "test-community").images,
      ["https://example.com/one.jpg", "https://example.com/two.jpg"],
    );
    assert.equal(
      synced.posts.find((p: any) => p.id === "x:123").notes,
      "X note",
    );
    const xCreator = await call("creators", "POST", {
      platform: "x",
      channel: "https://x.com/Another",
    });
    assert.equal(xCreator.accounts[0].username, "Another");
    await call(`creators/${xCreator.id}`, "PATCH", {
      accounts: [{ platform: "x", username: "Another", syncTypes: [] }],
    });
    await call("sync", "POST");
    assert.ok(
      !(await call("state")).posts.some(
        (p: any) => p.creatorId === xCreator.id,
      ),
    );
    await call(`creators/${xCreator.id}`, "DELETE");
    const bad = await fetch(`${base}/api/creators/test-creator`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accounts: [{ platform: "youtube", syncTypes: ["post"] }],
      }),
    });
    assert.equal(bad.status, 400);
    await call("read", "POST", { ids: ["test-post"] });
    assert.equal(
      (
        await fetch(`${base}/api/read`, {
          method: "POST",
          headers: {
            Origin: "https://evil.test",
            "Content-Type": "application/json",
          },
          body: '{"ids":[]}',
        })
      ).status,
      403,
    );
    await stop();
    await start();
    const state = await call("state");
    assert.deepEqual(state.creators[0].tags, ["Technology", "News"]);
    assert.equal(state.creators[0].accounts.length, 2);
    const persisted = state.posts.find((p: any) => p.id === "test-post");
    assert.equal(persisted.saved, true);
    assert.equal(persisted.read, true);
    assert.equal(persisted.notes, "[1:01] A useful idea");
    assert.deepEqual(state.creators[0].accounts[0].syncTypes, ["community"]);
    assert.deepEqual(state.creators[0].accounts[1].syncTypes, ["post"]);
    const ig = await call("creators", "POST", {
      platform: "instagram",
      channel: "https://instagram.com/testig/",
    });
    await call(`creators/${ig.id}`, "PATCH", {
      accounts: [
        { platform: "instagram", username: "@testig", syncTypes: ["post"] },
      ],
    });
    await call("sync", "POST");
    let igPost = (await call("state")).posts.find(
      (p: any) => p.creatorId === ig.id,
    );
    assert.equal(igPost.platform, "instagram");
    assert.equal(igPost.images.length, 2);
    await call(`posts/${igPost.id}`, "PATCH", {
      notes: "An Instagram note",
      saved: true,
    });
    await call(`creators/${ig.id}`, "PATCH", {
      accounts: [{ platform: "instagram", username: "testig", syncTypes: [] }],
    });
    await call("sync", "POST");
    igPost = (await call("state")).posts.find(
      (p: any) => p.creatorId === ig.id,
    );
    assert.equal(igPost.notes, "An Instagram note");
    assert.equal(igPost.saved, true);
    const duplicate = await fetch(`${base}/api/creators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "instagram", channel: "@TESTIG" }),
    });
    assert.equal(duplicate.status, 409);
    await call(`creators/${ig.id}`, "DELETE");
    await call("creators/test-creator", "DELETE");
    assert.deepEqual(await call("state"), { creators: [], posts: [] });
  } finally {
    if (proc! && proc.exitCode === null) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
