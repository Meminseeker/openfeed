import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveChannel, syncChannel } from "./youtube.ts";
import type { Creator, Post } from "../src/types.ts";
const databasePath = process.env.OPENFEED_DB || "data/openfeed.db";
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(
  `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS creators (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, data TEXT NOT NULL);`,
);
const creators = (): Creator[] =>
  db
    .prepare("SELECT data FROM creators")
    .all()
    .map((r) => JSON.parse(r.data as string));
const posts = (): Post[] =>
  db
    .prepare("SELECT data FROM posts")
    .all()
    .map((r) => JSON.parse(r.data as string));
function saveCreator(c: Creator) {
  db.prepare("INSERT OR REPLACE INTO creators VALUES (?,?)").run(
    c.id,
    JSON.stringify(c),
  );
}
function savePost(p: Post) {
  db.prepare("INSERT OR REPLACE INTO posts VALUES (?,?,?)").run(
    p.id,
    p.creatorId,
    JSON.stringify(p),
  );
}
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(req.hostname)) {
    res.status(403).json({ error: "Only local hosts are allowed." });
    return;
  }
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) {
    res.status(403).json({ error: "Cross-origin requests are disabled." });
    return;
  }
  next();
});
app.use(express.json({ limit: "100kb" }));
app.get("/api/state", (_, res) =>
  res.json({ creators: creators(), posts: posts() }),
);
app.post("/api/creators", async (req, res, next) => {
  try {
    const channel = await resolveChannel(String(req.body.channel || ""));
    if (
      creators().some((c) => c.accounts.some((a) => a.channelId === channel.id))
    ) {
      res.status(409).json({ error: "You already follow this channel." });
      return;
    }
    const c: Creator = {
      id: randomUUID(),
      name: channel.name,
      avatar: channel.avatar,
      tags: [],
      accounts: [
        {
          platform: "youtube",
          username: String(req.body.channel),
          channelId: channel.id,
        },
      ],
    };
    saveCreator(c);
    res.json(c);
  } catch (e) {
    next(e);
  }
});
app.patch("/api/creators/:id", (req, res) => {
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
    const youtube = c.accounts.filter((a) => a.platform === "youtube");
    const other = req.body.accounts
      .filter(
        (a: any) =>
          ["instagram", "x", "tiktok", "patreon"].includes(a.platform) &&
          typeof a.username === "string" &&
          a.username.trim(),
      )
      .map((a: any) => ({
        platform: a.platform,
        username: a.username.trim().slice(0, 100),
      }));
    c.accounts = [...youtube, ...other];
  }
  saveCreator(c);
  res.json(c);
});
app.delete("/api/creators/:id", (req, res) => {
  db.prepare("DELETE FROM posts WHERE creator_id=?").run(req.params.id);
  db.prepare("DELETE FROM creators WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
let syncing = false;
app.post("/api/sync", async (_, res) => {
  if (syncing) {
    res.status(409).json({ error: "A refresh is already in progress." });
    return;
  }
  syncing = true;
  try {
    for (const c of creators()) {
      try {
        const channel = c.accounts.find(
          (a) => a.platform === "youtube",
        )?.channelId;
        if (!channel) continue;
        const result = await syncChannel(channel, c.id);
        if (!creators().some((x) => x.id === c.id)) continue;
        const current = creators().find((x) => x.id === c.id)!;
        const old = new Map(posts().map((p) => [p.id, p]));
        for (const p of result.posts) {
          const prev = old.get(p.id);
          const keepDate =
            !!prev?.published && (p.publishedApproximate || !p.published);
          savePost({
            ...p,
            published: keepDate ? prev!.published : p.published,
            publishedApproximate: keepDate
              ? prev!.publishedApproximate
              : p.publishedApproximate,
            read: prev?.read || false,
            saved: prev?.saved || false,
          });
        }
        saveCreator({
          ...current,
          lastSync: new Date().toISOString(),
          error: result.warning || undefined,
        });
      } catch (e) {
        const current = creators().find((x) => x.id === c.id);
        if (current)
          saveCreator({
            ...current,
            error: e instanceof Error ? e.message : "Sync failed",
          });
      }
    }
    res.json({ creators: creators(), posts: posts() });
  } finally {
    syncing = false;
  }
});
app.patch("/api/posts/:id", (req, res) => {
  const p = posts().find((p) => p.id === req.params.id);
  if (!p) {
    res.sendStatus(404);
    return;
  }
  if (typeof req.body.read === "boolean") p.read = req.body.read;
  if (typeof req.body.saved === "boolean") p.saved = req.body.saved;
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
const server = app.listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(
    `OpenFeed is ready at http://localhost:${typeof address === "object" && address ? address.port : port}`,
  );
});
