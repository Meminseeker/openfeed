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
            X_BEARER_TOKEN: "",
            INSTAGRAM_ACCESS_TOKEN: "",
            INSTAGRAM_USER_ID: "",
            PATREON_SESSION_ID: "fixture-session",
            PATREON_OPENFEED_USER: "Alice",
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
    for (const user of [a, b])
      await call("creators", user.cookie, "POST", {
        platform: "patreon",
        channel: "https://www.patreon.com/cw/TestCreator",
      });
    await call("sync", a.cookie, "POST");
    await call("sync", b.cookie, "POST");
    const memberPost = (await call("state", a.cookie)).posts.find(
      (p: any) => p.id === "patreon:900",
    );
    assert.equal(memberPost.locked, undefined);
    assert.equal(memberPost.text, "Member text");
    assert.deepEqual(memberPost.blocks, [
      { type: "paragraph", spans: [{ text: "Member text" }] },
    ]);
    const bobState = await call("state", b.cookie);
    const preview = bobState.posts.find((p: any) => p.id === "patreon:900");
    assert.equal(preview.locked, true, "the session is used only for Alice");
    assert.equal(preview.text, "");
    assert.match(
      bobState.creators.find((c: any) => c.accounts[0].platform === "patreon")
        .error,
      /public Patreon previews/,
    );
    assert.equal(
      (await call("posts/patreon:900/detail", b.cookie)).locked,
      true,
    );
    assert.equal(
      (await call("posts/patreon:900/detail", a.cookie)).text,
      "Member text",
    );
    // Phone shortcut import: bob uploads a page his phone fetched from Patreon.
    const phone = await call("patreon/phone-sync", b.cookie, "POST");
    assert.match(phone.token, /^[a-f0-9]{64}$/);
    assert.equal(phone.creators[0].importUrl.startsWith(base), true);
    assert.match(phone.creators[0].patreonUrl, /include=campaign/);
    const upload = (body: string, token = phone.token, campaign = "6460488") =>
      fetch(`${base}/api/patreon/import?campaign=${campaign}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
    const phonePost = (id: string, campaign: string, published: string) => ({
      id,
      type: "post",
      relationships: { campaign: { data: { id: campaign, type: "campaign" } } },
      attributes: {
        title: `Phone ${id}`,
        content_json_string: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Fetched on the phone" }],
            },
          ],
        }),
        published_at: published,
        url: `https://www.patreon.com/posts/phone-${id}`,
        current_user_can_view: true,
        was_posted_by_campaign_owner: true,
      },
    });
    const page = JSON.stringify({
      data: [
        phonePost("901", "6460488", new Date().toISOString()),
        phonePost("902", "999", new Date().toISOString()),
        phonePost("903", "6460488", "2020-01-01T00:00:00Z"),
      ],
    });
    assert.equal((await upload(page, "0".repeat(64))).status, 401);
    assert.equal((await upload(page, phone.token, "123")).status, 404);
    const imported = await upload(page);
    assert.equal(imported.status, 200);
    assert.deepEqual(await imported.json(), { ok: true, added: 1, updated: 0 });
    let phoneState = await call("state", b.cookie);
    const phoneItem = phoneState.posts.find((p: any) => p.id === "patreon:901");
    assert.equal(phoneItem.text, "Fetched on the phone");
    assert.equal(phoneItem.locked, undefined);
    assert.ok(
      !phoneState.posts.some((p: any) =>
        ["patreon:902", "patreon:903"].includes(p.id),
      ),
      "other campaigns and posts outside the retention window are skipped",
    );
    assert.equal(
      (await call("posts/patreon:901/detail", b.cookie)).text,
      "Fetched on the phone",
    );
    await call("posts/patreon:901", b.cookie, "PATCH", { read: true });
    assert.deepEqual(await (await upload(page)).json(), {
      ok: true,
      added: 0,
      updated: 1,
    });
    assert.equal(
      (await call("state", b.cookie)).posts.find(
        (p: any) => p.id === "patreon:901",
      ).read,
      true,
    );
    const blocked = await upload("<html>Just a moment...</html>");
    assert.equal(blocked.status, 400);
    phoneState = await call("state", b.cookie);
    assert.match(
      phoneState.creators.find((c: any) => c.accounts[0].platform === "patreon")
        .error,
      /Patreon: The phone sent no Patreon data/,
    );
    // A phone-synced account is no longer fetched by the (blocked) server.
    await call("sync", b.cookie, "POST");
    assert.match(
      (await call("state", b.cookie)).creators.find(
        (c: any) => c.accounts[0].platform === "patreon",
      ).error,
      /phone sent no Patreon data/,
    );
    const replaced = await call("patreon/phone-sync", b.cookie, "POST");
    assert.equal((await upload(page)).status, 401, "old token is revoked");
    assert.equal((await upload(page, replaced.token)).status, 200);
    assert.ok(
      !(await call("state", a.cookie)).posts.some(
        (p: any) => p.id === "patreon:901",
      ),
      "a token imports only into its own account, even for a shared campaign",
    );
    // When Patreon blocks the server, the creator is still saved and the
    // campaign ID is entered manually for phone sync.
    const blockedCreator = await call("creators", b.cookie, "POST", {
      platform: "patreon",
      channel: "BlockedCreator",
    });
    assert.equal(blockedCreator.accounts[0].campaignId, undefined);
    assert.match(blockedCreator.error, /Enter the campaign ID/);
    let blockedInfo = (
      await call("patreon/phone-sync", b.cookie)
    ).creators.find((x: any) => x.username === "blockedcreator");
    assert.equal(blockedInfo.patreonUrl, undefined);
    assert.match(blockedInfo.lookupUrl, /filter%5Bvanity%5D=blockedcreator/);
    await call(`creators/${blockedCreator.id}`, b.cookie, "PATCH", {
      tags: ["Finance"],
      accounts: [{ platform: "patreon", username: "blockedcreator" }],
    });
    for (const campaignId of ["abc", "6460488"])
      assert.equal(
        (
          await request("/api/patreon/campaign", b.cookie, "PUT", {
            username: "blockedcreator",
            campaignId,
          })
        ).status,
        400,
        campaignId,
      );
    blockedInfo = (
      await call("patreon/campaign", b.cookie, "PUT", {
        username: "BlockedCreator",
        campaignId: "7777",
      })
    ).creators.find((x: any) => x.username === "blockedcreator");
    assert.match(blockedInfo.patreonUrl, /campaign_id%5D=7777/);
    assert.match(blockedInfo.importUrl, /campaign=7777$/);
    assert.ok(
      !(await call("state", b.cookie)).creators
        .find((x: any) => x.id === blockedCreator.id)
        .error?.includes("Enter the campaign ID"),
    );
    const vanityPage = (vanity: string) =>
      JSON.stringify({
        data: [phonePost("950", "7777", new Date().toISOString())],
        included: [{ id: "7777", type: "campaign", attributes: { vanity } }],
      });
    const wrong = await upload(
      vanityPage("someoneelse"),
      replaced.token,
      "7777",
    );
    assert.equal(wrong.status, 400);
    assert.match(
      (await wrong.json()).error,
      /belongs to Patreon creator someoneelse/,
    );
    assert.deepEqual(
      await (
        await upload(vanityPage("blockedcreator"), replaced.token, "7777")
      ).json(),
      { ok: true, added: 1, updated: 0 },
    );
    await call(`creators/${c.id}`, b.cookie, "DELETE");
    await call("read", b.cookie, "POST", { ids: ["x:123"] });
    assert.equal(
      (await call("state", a.cookie)).posts.find((p: any) => p.id === "x:123")
        .notes,
      "Alice private note",
    );
    assert.equal(
      (await call("state", a.cookie)).posts.find((p: any) => p.id === "x:123")
        .read,
      false,
    );
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
