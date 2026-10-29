import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
test("accounts isolate all content paths, library imports survive retention, sessions revoke", async () => {
  const dir = mkdtempSync(join(tmpdir(), "openfeed-accounts-")),
    path = join(dir, "db.sqlite");
  let proc: ChildProcess | undefined;
  try {
    let base = "";
    await new Promise<void>((resolve, reject) => {
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
            NODE_ENV: "production",
            PORT: "0",
            OPENFEED_DB: path,
            OPENFEED_PUBLIC_ORIGIN: "",
            OPENFEED_RETENTION_DAYS: "7",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const timer = setTimeout(
        () => reject(new Error("Server did not start")),
        10000,
      );
      proc.stdout!.on("data", (chunk) => {
        const m = String(chunk).match(/http:\/\/localhost:(\d+)/);
        if (m) {
          base = `http://127.0.0.1:${m[1]}`;
          clearTimeout(timer);
          resolve();
        }
      });
      proc.on("error", reject);
    });
    const request = (
      path: string,
      cookie = "",
      method = "GET",
      body?: unknown,
      extra: Record<string, string> = {},
    ) =>
      fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    assert.equal((await request("/api/state")).status, 401);
    for (const path of [
      "/manifest.webmanifest",
      "/icons/app-192.png",
      "/icons/app-512.png",
      "/icons/app-180.png",
    ])
      assert.equal((await request(path)).status, 200);
    const signup = async (username: string) => {
      const r = await request("/api/auth/signup", "", "POST", {
        username,
        password: "a-good-test-password",
      });
      assert.equal(r.status, 200);
      assert.match(r.headers.get("set-cookie")!, /HttpOnly/);
      assert.match(r.headers.get("set-cookie")!, /SameSite=Lax/i);
      return {
        cookie: r.headers.get("set-cookie")!.split(";")[0],
        user: (await r.json()).user,
      };
    };
    const a = await signup("alice"),
      b = await signup("bob");
    assert.equal(
      (
        await request("/api/auth/login", "", "POST", {
          username: "alice",
          password: "not-the-right-password",
        })
      ).status,
      401,
    );
    const call = async (
      path: string,
      cookie: string,
      method = "GET",
      body?: unknown,
    ) => {
      const r = await request("/api/" + path, cookie, method, body);
      assert.equal(r.status, 200, `${method} ${path}`);
      return r.json();
    };
    const c = await call("creators", a.cookie, "POST", {
      platform: "x",
      channel: "test",
    });
    await call("sync", a.cookie, "POST");
    await call("posts/x:123", a.cookie, "PATCH", {
      notes: "Alice private note",
      saved: true,
    });
    assert.deepEqual(await call("state", b.cookie), {
      creators: [],
      posts: [],
      playlists: [],
    });
    for (const [path, method, body] of [
      [`creators/${c.id}`, "PATCH", { name: "attack" }],
      ["posts/x:123", "PATCH", { notes: "attack" }],
      ["posts/x:123", "DELETE", undefined],
      ["posts/x:123/detail", "GET", undefined],
      ["posts/x:123/video/0", "GET", undefined],
    ] as const)
      assert.equal(
        (await request("/api/" + path, b.cookie, method, body)).status,
        404,
        path,
      );
    await call(`creators/${c.id}`, b.cookie, "DELETE");
    await call("read", b.cookie, "POST", { ids: ["x:123"] });
    assert.equal(
      (await call("state", a.cookie)).posts[0].notes,
      "Alice private note",
    );
    assert.equal((await call("state", a.cookie)).posts[0].read, false);
    await call("creators", b.cookie, "POST", {
      platform: "x",
      channel: "test",
    });
    await call("sync", b.cookie, "POST");
    assert.equal((await call("state", b.cookie)).posts[0].saved, false);
    assert.equal(
      (
        await request(
          "/api/posts/x:123",
          b.cookie,
          "PATCH",
          { notes: "stale tab" },
          { "X-OpenFeed-User": a.user.id },
        )
      ).status,
      409,
    );
    const linkedFeed = await call("links", a.cookie, "POST", {
      url: "https://x.com/test/status/123",
    });
    assert.equal(
      linkedFeed.posts.find((p: any) => p.id === "x:123").libraryOnly,
      false,
    );
    assert.equal(
      linkedFeed.posts.find((p: any) => p.id === "x:123").notes,
      "Alice private note",
    );
    let state = await call("playlists", a.cookie, "POST", {
      url: "https://youtube.com/playlist?list=PLfixture123456",
    });
    assert.equal(state.playlists[0].postIds.length, 2);
    assert.equal(state.posts.filter((p: any) => p.libraryOnly).length, 2);
    assert.equal((await call("state", b.cookie)).playlists.length, 0);
    state = await call("links", a.cookie, "POST", {
      url: "https://youtu.be/abcdefghijk",
    });
    assert.equal(
      state.posts.filter((p: any) => p.id === "abcdefghijk").length,
      1,
    );
    assert.equal(
      state.posts.find((p: any) => p.id === "abcdefghijk").linked,
      true,
    );
    const db = new DatabaseSync(path);
    const row = db
      .prepare("SELECT data FROM posts WHERE user_id=? AND id=?")
      .get(a.user.id, "abcdefghijk")!;
    db.prepare("UPDATE posts SET data=? WHERE user_id=? AND id=?").run(
      JSON.stringify({
        ...JSON.parse(String(row.data)),
        published: "2000-01-01T00:00:00Z",
      }),
      a.user.id,
      "abcdefghijk",
    );
    const hashes = db.prepare("SELECT password FROM users").all();
    assert.ok(hashes.every((r) => r.password !== "a-good-test-password"));
    assert.equal(new Set(hashes.map((r) => r.password)).size, 2);
    assert.ok(
      db
        .prepare("SELECT token FROM sessions")
        .all()
        .every((r) => !a.cookie.includes(String(r.token))),
    );
    db.close();
    state = await call("state", a.cookie);
    assert.ok(state.posts.some((p: any) => p.id === "abcdefghijk"));
    await call("playlists/PLfixture123456", b.cookie, "DELETE");
    assert.equal((await call("state", a.cookie)).playlists.length, 1);
    state = await call("playlists/PLfixture123456", a.cookie, "DELETE");
    assert.equal(state.playlists.length, 0);
    assert.ok(state.posts.some((p: any) => p.id === "abcdefghijk"));
    assert.ok(!state.posts.some((p: any) => p.id === "lmnopqrstuv"));
    for (const url of [
      "http://127.0.0.1/private",
      "https://youtube.com.evil.test/watch?v=abcdefghijk",
      "https://user:pass@youtube.com/watch?v=abcdefghijk",
    ])
      assert.equal(
        (await request("/api/links", a.cookie, "POST", { url })).status,
        400,
      );
    await call("auth/logout", a.cookie, "POST");
    assert.equal((await request("/api/state", a.cookie)).status, 401);
    assert.equal((await request("/api/state", b.cookie)).status, 200);
    const login = await request("/api/auth/login", "", "POST", {
      username: "ALICE",
      password: "a-good-test-password",
    });
    assert.equal(login.status, 200);
  } finally {
    if (proc && proc.exitCode === null) {
      const p = proc;
      await new Promise<void>((resolve) => {
        p.once("exit", () => resolve());
        p.kill();
      });
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
