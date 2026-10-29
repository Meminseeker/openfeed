import { importLink, importPlaylist } from "./library.ts";
import { initializeAccounts, installAuth, owner } from "./auth.ts";
import { syncTikTok, tiktokUsername } from "./tiktok.ts";
import { expiredPost, retentionDays } from "./retention.ts";
import { xVideoUrl, streamXVideo } from "./media.ts";
import { syncInstagram, instagramUsername } from "./instagram.ts";
import { syncX, xUsername, expandXPost } from "./x.ts";
import express from "express";
import { requestAllowed, validatePublicOrigin } from "./access.ts";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveChannel, syncChannel } from "./youtube.ts";
import type { Creator, Post, Kind } from "../src/types.ts";
import { enabledTypes, sourceTypes } from "../src/types.ts";
function validSyncTypes(platform: string, value: unknown) {
  if (
    !Array.isArray(value) ||
    !value.every((v) => sourceTypes[platform]?.includes(v))
  )
    throw new Error("Invalid content types for this source.");
  return [...new Set(value)];
}
const databasePath = process.env.OPENFEED_DB || "data/openfeed.db";
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(
  `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS creators (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, data TEXT NOT NULL);`,
);
initializeAccounts(db);
const creators = (): Creator[] =>
  db
    .prepare("SELECT data FROM creators WHERE user_id=?")
    .all(owner())
    .map((r) => JSON.parse(r.data as string));
const posts = (): Post[] =>
  db
    .prepare("SELECT data FROM posts WHERE user_id=?")
    .all(owner())
    .map((r) => JSON.parse(r.data as string));
function saveCreator(c: Creator) {
  db.prepare("INSERT OR REPLACE INTO creators VALUES (?,?,?)").run(
    owner(),
    c.id,
    JSON.stringify(c),
  );
}
function savePost(p: Post) {
  db.prepare("INSERT OR REPLACE INTO posts VALUES (?,?,?,?)").run(
    owner(),
    p.id,
    p.creatorId,
    JSON.stringify(p),
  );
}
const retention = retentionDays();
function prunePosts(userId?: string) {
  const remove = db.prepare("DELETE FROM posts WHERE user_id=? AND id=?");
  for (const row of db
    .prepare(
      "SELECT user_id,id,data FROM posts WHERE user_id != 'legacy'" +
        (userId ? " AND user_id=?" : ""),
    )
    .all(...(userId ? [userId] : [])))
    if (expiredPost(JSON.parse(row.data as string), retention))
      remove.run(row.user_id, row.id);
}
prunePosts();
const cleanupTimer = setInterval(prunePosts, 60 * 60 * 1000);
cleanupTimer.unref();
const app = express();
app.disable("x-powered-by");
const publicOrigin = validatePublicOrigin(process.env.OPENFEED_PUBLIC_ORIGIN);
// Production is reachable only through the single Caddy proxy (no published app port).
if (publicOrigin) app.set("trust proxy", 1);
app.use((req, res, next) => {
  if (!requestAllowed(req.headers.host, req.headers.origin, publicOrigin)) {
    res.status(403).json({ error: "Host or origin is not allowed." });
    return;
  }
  next();
});
app.get("/healthz", (_, res) => {
  db.prepare("SELECT 1").get();
  res.json({ ok: true });
});
app.use(express.json({ limit: "100kb" }));
installAuth(app, db, !!publicOrigin);
function state() {
  return {
    creators: creators(),
    posts: posts().filter((p) => !p.removed),
    playlists: db
      .prepare("SELECT data FROM playlists WHERE user_id=?")
      .all(owner())
      .map((r) => JSON.parse(r.data as string)),
  };
}
app.get("/api/state", (_, res) => {
  prunePosts(owner());
  res.json(state());
});
function storeLibraryPost(p: Post, linked: boolean, playlistId?: string) {
  const row = db
    .prepare("SELECT data FROM posts WHERE user_id=? AND id=?")
    .get(owner(), p.id);
  const previous: Post | undefined = row
    ? JSON.parse(row.data as string)
    : undefined;
  savePost({
    ...previous,
    ...p,
    creatorId: previous?.creatorId || p.creatorId,
    libraryOnly: previous ? !!previous.libraryOnly : true,
    read: previous?.read || false,
    saved: previous?.saved || false,
    notes: previous?.notes,
    published: p.published || previous?.published || "",
    ...(previous?.textExpanded &&
    (previous.text?.length || 0) > (p.text?.length || 0)
      ? {
          text: previous.text,
          title: previous.title,
          textExpanded: true,
          textVersion: previous.textVersion,
          textTruncated: false,
        }
      : {}),
    removed: false,
    linked: linked || previous?.linked,
    playlistIds: [
      ...new Set([
        ...(previous?.playlistIds || []),
        ...(playlistId ? [playlistId] : []),
      ]),
    ],
  });
}
app.post("/api/links", async (req, res) => {
  const { post, name } = await importLink(String(req.body?.url || ""));
  post.creatorId = `library:${post.platform}:${post.sourceUsername || name}`;
  if (!creators().some((c) => c.id === post.creatorId))
    saveCreator({
      id: post.creatorId,
      name,
      avatar: "",
      tags: [],
      accounts: [],
      libraryOnly: true,
    });
  storeLibraryPost(post, true);
  res.json(state());
});
function removePlaylistMembership(p: Post, id: string) {
  p.playlistIds = p.playlistIds?.filter((value) => value !== id);
  if (
    p.libraryOnly &&
    !p.playlistIds?.length &&
    !p.linked &&
    !p.saved &&
    !p.notes?.trim()
  )
    db.prepare("DELETE FROM posts WHERE user_id=? AND id=?").run(owner(), p.id);
  else savePost(p);
}
app.post("/api/playlists", async (req, res) => {
  const result = await importPlaylist(String(req.body?.url || ""));
  const oldRow = db
    .prepare("SELECT data FROM playlists WHERE user_id=? AND id=?")
    .get(owner(), result.playlist.id);
  const oldIds: string[] = oldRow
    ? JSON.parse(oldRow.data as string).postIds
    : [];
  if (result.playlist.warning)
    result.playlist.postIds = [
      ...new Set([...result.playlist.postIds, ...oldIds]),
    ];
  db.exec("BEGIN IMMEDIATE");
  try {
    saveCreator({
      id: `playlist:${result.playlist.id}`,
      name: result.playlist.title,
      avatar: "",
      tags: [],
      accounts: [],
      libraryOnly: true,
    });
    for (const p of result.posts)
      storeLibraryPost(p, false, result.playlist.id);
    if (!result.playlist.warning)
      for (const p of posts())
        if (
          p.playlistIds?.includes(result.playlist.id) &&
          !result.playlist.postIds.includes(p.id)
        )
          removePlaylistMembership(p, result.playlist.id);
    db.prepare("INSERT OR REPLACE INTO playlists VALUES (?,?,?)").run(
      owner(),
      result.playlist.id,
      JSON.stringify(result.playlist),
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  res.json(state());
});
app.delete("/api/playlists/:id", (req, res) => {
  db.prepare("DELETE FROM playlists WHERE user_id=? AND id=?").run(
    owner(),
    req.params.id,
  );
  for (const p of posts())
    if (p.playlistIds?.includes(req.params.id))
      removePlaylistMembership(p, req.params.id);
  res.json(state());
});
app.post("/api/creators", async (req, res, next) => {
  try {
    const platform = ["x", "instagram", "tiktok"].includes(req.body.platform)
      ? req.body.platform
      : "youtube";
    const input = String(req.body.channel || "");
    const channel =
      platform === "youtube" ? await resolveChannel(input) : undefined;
    const username =
      platform === "x"
        ? xUsername(input)
        : platform === "tiktok"
          ? tiktokUsername(input)
          : platform === "instagram"
            ? instagramUsername(input)
            : input;
    if (
      creators().some((c) =>
        c.accounts.some((a) =>
          platform === "youtube"
            ? a.channelId === channel!.id
            : a.platform === platform &&
              (platform === "x"
                ? xUsername(a.username)
                : platform === "tiktok"
                  ? tiktokUsername(a.username)
                  : instagramUsername(a.username)
              ).toLowerCase() === username.toLowerCase(),
        ),
      )
    ) {
      res.status(409).json({ error: "You already follow this account." });
      return;
    }
    const c: Creator = {
      id: randomUUID(),
      name: channel?.name || username,
      avatar: channel?.avatar || "",
      tags: [],
      accounts: [{ platform, username, channelId: channel?.id }],
    };
    saveCreator(c);
    res.json(c);
  } catch (e) {
    next(e);
  }
});
app.patch("/api/creators/:id", async (req, res) => {
  const c = creators().find((c) => c.id === req.params.id);
  if (!c) {
    res.sendStatus(404);
    return;
  }
  if (typeof req.body.name === "string" && req.body.name.trim())
    c.name = req.body.name.trim().slice(0, 100);
  if (Array.isArray(req.body.tags))
    c.tags = [
      ...new Set<string>(
        req.body.tags
          .filter((t: any) => typeof t === "string")
          .map((t: string) => t.trim().slice(0, 40))
          .filter(Boolean),
      ),
    ].slice(0, 20);
  if (Array.isArray(req.body.accounts)) {
    const youtube = c.accounts
      .filter((a) => a.platform === "youtube")
      .map((a) => {
        const input = req.body.accounts.find(
          (v: any) => v.platform === "youtube",
        );
        return input?.syncTypes !== undefined
          ? { ...a, syncTypes: validSyncTypes("youtube", input.syncTypes) }
          : a;
      });
    const newYoutube = req.body.accounts.find(
      (a: any) =>
        a.platform === "youtube" &&
        typeof a.username === "string" &&
        a.username.trim(),
    );
    if (!youtube.length && newYoutube) {
      const resolved = await resolveChannel(newYoutube.username);
      if (
        creators().some(
          (other) =>
            other.id !== c.id &&
            other.accounts.some((a) => a.channelId === resolved.id),
        )
      )
        throw new Error(
          "You already follow this YouTube account under another creator.",
        );
      youtube.push({
        platform: "youtube",
        username: newYoutube.username,
        channelId: resolved.id,
        syncTypes:
          newYoutube.syncTypes !== undefined
            ? validSyncTypes("youtube", newYoutube.syncTypes)
            : undefined,
      });
    }
    for (const a of req.body.accounts.filter(
      (a: any) =>
        ["x", "instagram", "tiktok"].includes(a.platform) &&
        typeof a.username === "string" &&
        a.username.trim(),
    )) {
      const normalize =
        a.platform === "x"
          ? xUsername
          : a.platform === "tiktok"
            ? tiktokUsername
            : instagramUsername;
      const username = normalize(a.username);
      if (
        creators().some(
          (other) =>
            other.id !== c.id &&
            other.accounts.some(
              (old) =>
                old.platform === a.platform &&
                normalize(old.username).toLowerCase() ===
                  username.toLowerCase(),
            ),
        )
      )
        throw new Error(
          "You already follow this account under another creator.",
        );
    }
    const other = req.body.accounts
      .filter(
        (a: any) =>
          ["instagram", "x", "tiktok", "patreon"].includes(a.platform) &&
          typeof a.username === "string" &&
          a.username.trim(),
      )
      .map((a: any) => ({
        ...c.accounts.find(
          (old) =>
            old.platform === a.platform &&
            (["x", "instagram", "tiktok"].includes(a.platform)
              ? (a.platform === "x"
                  ? xUsername(old.username)
                  : a.platform === "tiktok"
                    ? tiktokUsername(old.username)
                    : instagramUsername(old.username)
                ).toLowerCase() ===
                (a.platform === "x"
                  ? xUsername(a.username)
                  : a.platform === "tiktok"
                    ? tiktokUsername(a.username)
                    : instagramUsername(a.username)
                ).toLowerCase()
              : old.username === a.username.trim()),
        ),
        platform: a.platform,
        username:
          a.platform === "x"
            ? xUsername(a.username)
            : a.platform === "tiktok"
              ? tiktokUsername(a.username)
              : a.platform === "instagram"
                ? instagramUsername(a.username)
                : a.username.trim().slice(0, 100),
        syncTypes:
          a.syncTypes !== undefined
            ? validSyncTypes(a.platform, a.syncTypes)
            : undefined,
      }));
    for (const account of other) {
      const previous = c.accounts.find(
        (a) =>
          a.platform === account.platform &&
          (a.platform === "x"
            ? xUsername(a.username)
            : a.username
          ).toLowerCase() === account.username.toLowerCase(),
      );
      if (
        account.platform === "x" &&
        previous &&
        JSON.stringify(enabledTypes(previous)) !==
          JSON.stringify(enabledTypes(account))
      )
        account.xSinceId = undefined;
    }
    c.accounts = [...youtube, ...other];
  }
  saveCreator(c);
  res.json(c);
});
app.delete("/api/creators/:id", (req, res) => {
  for (const p of posts().filter((p) => p.creatorId === req.params.id)) {
    if (p.linked || p.playlistIds?.length) {
      const id = `library:retained:${req.params.id}`;
      const c = creators().find((c) => c.id === req.params.id);
      if (c) saveCreator({ ...c, id, accounts: [], libraryOnly: true });
      savePost({ ...p, creatorId: id, libraryOnly: true });
    } else
      db.prepare("DELETE FROM posts WHERE user_id=? AND id=?").run(
        owner(),
        p.id,
      );
  }
  db.prepare("DELETE FROM creators WHERE user_id=? AND id=?").run(
    owner(),
    req.params.id,
  );
  res.json({ ok: true });
});
const syncing = new Set<string>();
app.post("/api/sync", async (_, res) => {
  if (syncing.has(owner())) {
    res.status(409).json({ error: "A refresh is already in progress." });
    return;
  }
  syncing.add(owner());
  try {
    for (const c of creators()) {
      for (const account of c.accounts.filter((a) =>
        ["youtube", "x", "instagram", "tiktok"].includes(a.platform),
      )) {
        if (!enabledTypes(account).length) continue;
        const sameSource = (a: Creator["accounts"][number]) =>
          a.platform === account.platform &&
          (a.platform === "youtube"
            ? a.channelId === account.channelId
            : a.username === account.username);
        try {
          const result =
            account.platform === "tiktok"
              ? await syncTikTok(account.username, c.id)
              : account.platform === "x"
                ? await syncX(
                    account.username,
                    c.id,
                    account.xSinceId,
                    enabledTypes(account).includes("repost"),
                  )
                : account.platform === "instagram"
                  ? await syncInstagram(
                      account.username,
                      c.id,
                      enabledTypes(account),
                    )
                  : await syncChannel(
                      account.channelId!,
                      c.id,
                      enabledTypes(account) as Kind[],
                    );
          const current = creators().find((x) => x.id === c.id);
          const source = current?.accounts.find(sameSource);
          if (!current || !source || !enabledTypes(source).length) continue;
          const old = new Map(posts().map((p) => [p.id, p]));
          for (const p of result.posts) {
            if (
              !enabledTypes(source).includes(
                p.platform === "x" && p.repost ? "repost" : p.kind,
              )
            )
              continue;
            const prev = old.get(p.id);
            const keepDate =
              !!prev?.published && (p.publishedApproximate || !p.published);
            const updated: Post = {
              ...p,
              published: keepDate ? prev!.published : p.published,
              publishedApproximate: keepDate
                ? prev!.publishedApproximate
                : p.publishedApproximate,
              read: prev?.read || false,
              saved: prev?.saved || false,
              notes: prev?.notes || "",
              removed: prev?.removed,
              linked: prev?.linked,
              playlistIds: prev?.playlistIds,
              ...(prev?.textExpanded &&
              (prev.text?.length || 0) >= (p.text?.length || 0)
                ? {
                    text: prev.text,
                    title: prev.title,
                    textExpanded: true,
                    textVersion: prev.textVersion,
                    textTruncated: false,
                  }
                : {}),
            };
            if (!expiredPost(updated, retention)) savePost(updated);
          }
          if ("newestId" in result && typeof result.newestId === "string")
            source.xSinceId = result.newestId;
          source.lastSync = new Date().toISOString();
          source.error = result.warning || undefined;
          if (!current.avatar && "avatar" in result)
            current.avatar = String(result.avatar || "");
          current.lastSync = source.lastSync;
          current.error =
            current.accounts
              .map((a) =>
                a.error
                  ? `${a.platform === "x" ? "X" : a.platform === "instagram" ? "Instagram" : a.platform === "tiktok" ? "TikTok" : "YouTube"}: ${a.error}`
                  : "",
              )
              .filter(Boolean)
              .join(" · ") || undefined;
          saveCreator(current);
        } catch (e) {
          const current = creators().find((x) => x.id === c.id);
          const source = current?.accounts.find(sameSource);
          if (current && source) {
            source.error = e instanceof Error ? e.message : "Sync failed";
            current.error = current.accounts
              .map((a) =>
                a.error
                  ? `${a.platform === "x" ? "X" : a.platform === "instagram" ? "Instagram" : a.platform === "tiktok" ? "TikTok" : "YouTube"}: ${a.error}`
                  : "",
              )
              .filter(Boolean)
              .join(" · ");
            saveCreator(current);
          }
        }
      }
    }
    prunePosts(owner());
    res.json(state());
  } finally {
    syncing.delete(owner());
  }
});
app.get("/api/posts/:id/video/:index", async (req, res) => {
  const row = db
    .prepare("SELECT data FROM posts WHERE user_id=? AND id = ?")
    .get(owner(), req.params.id);
  const url = xVideoUrl(
    row ? JSON.parse(row.data as string) : undefined,
    req.params.index,
  );
  if (!url) {
    res.status(404).json({ error: "Video not found." });
    return;
  }
  await streamXVideo(req, res, url);
});
app.get("/api/posts/:id/detail", async (req, res) => {
  const post = posts().find((p) => p.id === req.params.id && !p.removed);
  if (!post) {
    res.sendStatus(404);
    return;
  }
  const expanded = await expandXPost(post);
  const current = posts().find((p) => p.id === post.id);
  if (!current || current.removed) {
    res.sendStatus(404);
    return;
  }
  const updated = {
    ...current,
    text: expanded.text,
    title: expanded.title,
    textTruncated: expanded.textTruncated,
    textExpanded: expanded.textExpanded,
    textVersion: expanded.textVersion,
  };
  savePost(updated);
  res.json(updated);
});
app.delete("/api/posts/:id", (req, res) => {
  const post = posts().find((p) => p.id === req.params.id);
  if (!post) {
    res.sendStatus(404);
    return;
  }
  savePost({ ...post, removed: true });
  res.json({ ok: true });
});
app.patch("/api/posts/:id", (req, res) => {
  const p = posts().find((p) => p.id === req.params.id);
  if (!p) {
    res.sendStatus(404);
    return;
  }
  if (typeof req.body.removed === "boolean") p.removed = req.body.removed;
  if (typeof req.body.read === "boolean") p.read = req.body.read;
  if (typeof req.body.saved === "boolean") p.saved = req.body.saved;
  if (req.body.notes !== undefined) {
    if (typeof req.body.notes !== "string" || req.body.notes.length > 50000) {
      res
        .status(400)
        .json({ error: "Notes must be text of at most 50,000 characters." });
      return;
    }
    p.notes = req.body.notes;
  }
  savePost(p);
  res.json(p);
});
app.post("/api/read", (req, res) => {
  const ids = new Set(Array.isArray(req.body.ids) ? req.body.ids : []);
  for (const p of posts()) if (ids.has(p.id)) savePost({ ...p, read: true });
  res.json({ ok: true });
});
app.use("/api", (_, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use((err: any, _req: any, res: any, _next: any) =>
  res.status(400).json({ error: err.message || "Request failed" }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, process.env.HOST || "127.0.0.1", () => {
  const address = server.address();
  console.log(
    `OpenFeed is ready at http://localhost:${typeof address === "object" && address ? address.port : port}`,
  );
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    clearInterval(cleanupTimer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 25_000).unref();
  });
}
