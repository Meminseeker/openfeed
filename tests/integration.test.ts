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
    published: "2026-09-30T00:00:00Z",
    read: false,
    saved: false,
  };
  db.prepare("INSERT INTO creators VALUES (?,?)").run(c.id, JSON.stringify(c));
  db.prepare("INSERT INTO posts VALUES (?,?,?)").run(
    p.id,
    c.id,
    JSON.stringify(p),
  );
  db.close();
  let proc: ChildProcess;
  let base = "";
  const start = () =>
    new Promise<void>((resolve, reject) => {
      proc = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: "0",
          OPENFEED_DB: path,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
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
    await call("creators/test-creator", "PATCH", {
      tags: [" Technology ", "Technology", "News"],
      accounts: [{ platform: "x", username: "@test" }],
    });
    await call("posts/test-post", "PATCH", { saved: true });
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
    assert.equal(state.posts[0].saved, true);
    assert.equal(state.posts[0].read, true);
    await call("creators/test-creator", "DELETE");
    assert.deepEqual(await call("state"), { creators: [], posts: [] });
  } finally {
    if (proc! && proc.exitCode === null) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
