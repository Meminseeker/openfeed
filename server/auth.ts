import { AsyncLocalStorage } from "node:async_hooks";
import {
  randomBytes,
  randomUUID,
  scrypt,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { DatabaseSync } from "node:sqlite";
import type { Express } from "express";
const derive = promisify(scrypt);
const context = new AsyncLocalStorage<string>();
export function asOwner<T>(id: string, work: () => T): T {
  return context.run(id, work);
}
export function owner() {
  const id = context.getStore();
  if (!id) throw new Error("Missing account context");
  return id;
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
async function passwordHash(password: string, salt: string) {
  return (await derive(password, salt, 64)) as Buffer;
}
export function initializeAccounts(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);`);
  if (
    !db
      .prepare("PRAGMA table_info(creators)")
      .all()
      .some((r) => r.name === "user_id")
  ) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE creators RENAME TO legacy_creators; ALTER TABLE posts RENAME TO legacy_posts;
      CREATE TABLE creators(user_id TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,id));
      CREATE TABLE posts(user_id TEXT NOT NULL,id TEXT NOT NULL,creator_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,id));
      INSERT INTO creators SELECT 'legacy',id,data FROM legacy_creators;
      INSERT INTO posts SELECT 'legacy',id,creator_id,data FROM legacy_posts;
      DROP TABLE legacy_creators; DROP TABLE legacy_posts; COMMIT;`);
  }
  db.exec(
    "CREATE TABLE IF NOT EXISTS playlists(user_id TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,id))",
  );
}
export function installAuth(app: Express, db: DatabaseSync, secure: boolean) {
  const legacy = () =>
    !!db
      .prepare(
        "SELECT 1 FROM creators WHERE user_id='legacy' UNION ALL SELECT 1 FROM posts WHERE user_id='legacy' LIMIT 1",
      )
      .get();
  // Existing data can only be claimed with a server-side bootstrap secret.
  const setupToken = process.env.OPENFEED_SETUP_TOKEN;
  if (legacy() && !setupToken)
    console.warn(
      "Existing workspace locked: set OPENFEED_SETUP_TOKEN to claim it during signup.",
    );
  const attempts = new Map<string, { count: number; until: number }>();
  app.use("/api/auth", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET") {
      next();
      return;
    }
    const key = req.ip || req.socket.remoteAddress || "local";
    const now = Date.now();
    if (attempts.size > 10000)
      for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
    const a = attempts.get(key);
    if (a && a.until > now && a.count >= 30) {
      res
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
      return;
    }
    attempts.set(
      key,
      a && a.until > now
        ? { ...a, count: a.count + 1 }
        : { count: 1, until: now + 900000 },
    );
    next();
  });
  function session(req: import("express").Request) {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("openfeed_session="))
      ?.slice(17);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
    return db
      .prepare(
        "SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
      )
      .get(digest(token), Date.now()) as
      { id: string; username: string } | undefined;
  }
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: session(req) || null, claimRequired: legacy() }),
  );
  for (const action of ["login", "signup"])
    app.post(`/api/auth/${action}`, async (req, res, next) => {
      try {
        const username = String(req.body?.username || "")
          .trim()
          .toLowerCase();
        const password = req.body?.password;
        if (
          !/^[a-z0-9_.-]{3,40}$/.test(username) ||
          typeof password !== "string" ||
          password.length < 12 ||
          password.length > 128
        ) {
          res.status(400).json({
            error:
              "Use a username of 3–40 letters, numbers, dots, dashes or underscores and a password of 12–128 characters.",
          });
          return;
        }
        let user = db
          .prepare("SELECT * FROM users WHERE username=?")
          .get(username) as
          | { id: string; username: string; salt: string; password: string }
          | undefined;
        if (action === "signup") {
          if (
            legacy() &&
            (!setupToken ||
              typeof req.body.setupToken !== "string" ||
              digest(req.body.setupToken) !== digest(setupToken))
          ) {
            res.status(403).json({
              error:
                "The owner must claim the existing workspace using OPENFEED_SETUP_TOKEN before signup opens.",
            });
            return;
          }
          if (user) {
            res.status(409).json({ error: "That username is already in use." });
            return;
          }
          const salt = randomBytes(16).toString("hex");
          const hash = (await passwordHash(password, salt)).toString("hex");
          user = { id: randomUUID(), username, salt, password: hash };
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare("INSERT INTO users VALUES (?,?,?,?)").run(
              user.id,
              username,
              salt,
              hash,
            );
            if (legacy()) {
              db.prepare(
                "UPDATE creators SET user_id=? WHERE user_id='legacy'",
              ).run(user.id);
              db.prepare(
                "UPDATE posts SET user_id=? WHERE user_id='legacy'",
              ).run(user.id);
            }
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        } else {
          const hash = await passwordHash(
            password,
            user?.salt || "openfeed-dummy-salt",
          );
          if (
            !user ||
            !timingSafeEqual(hash, Buffer.from(user.password, "hex"))
          ) {
            res.status(401).json({ error: "Incorrect username or password." });
            return;
          }
        }
        const token = randomBytes(32).toString("hex");
        const expires = Date.now() + 30 * 86400000;
        db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
        db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
          digest(token),
          user.id,
          expires,
        );
        res.cookie("openfeed_session", token, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 86400000,
        });
        res.json({ user: { id: user.id, username: user.username } });
      } catch (e) {
        next(e);
      }
    });
  app.post("/api/auth/logout", (req, res) => {
    if (
      session(req) &&
      req.headers["x-openfeed-user"] &&
      req.headers["x-openfeed-user"] !== session(req)?.id
    ) {
      res
        .status(409)
        .json({ error: "Your account changed. Reload before logging out." });
      return;
    }
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("openfeed_session="))
      ?.slice(17);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    res.clearCookie("openfeed_session", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    });
    res.json({ ok: true });
  });
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const user = session(req);
    if (!user) {
      res.status(401).json({ error: "Please log in." });
      return;
    }
    if (
      req.headers["x-openfeed-user"] &&
      req.headers["x-openfeed-user"] !== user.id
    ) {
      res
        .status(409)
        .json({ error: "Your account changed. Reload before saving." });
      return;
    }
    context.run(user.id, next);
  });
}
