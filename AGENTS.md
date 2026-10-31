# Repository workflow

- Make development changes on `dev`. Keep `main` pristine unless the user explicitly requests a merge or release there.
- Commit completed, verified changes in coherent commits when appropriate.
- Before committing, run `npm test` and `npm run build` from the repo root. Both must pass. There is no CI and no linter, so these two commands are the only gates.
- Keep `README.md` current when user-visible behaviour changes. It documents behaviour and limits for each platform, and later sessions rely on it.

# Codebase guide

This section exists so a new session does not have to re-explore the repo. Line numbers are approximate; search for the named symbol if one has drifted. Update this section when you change architecture, schema, routes, or conventions.

## What it is

OpenFeed is a personal feed reader. It follows chosen creators on YouTube, X, Instagram and TikTok by scraping public pages, with optional official APIs for X and Instagram, and on Patreon through the web app's JSON API using the owner's session cookie. It also supports saved links and YouTube playlists, notes with timestamps, and read/saved state. Each account has its own isolated workspace.

- **Stack:** React 19 + Vite 7 SPA (`src/`), an Express 5 server (`server/`), and SQLite through the built-in `node:sqlite` `DatabaseSync` (synchronous; no ORM). The only runtime dependencies are express, fast-xml-parser, lucide-react, react/react-dom and @fontsource fonts.
- **Single port:** in dev, `server/index.ts` mounts Vite in middleware mode. In production it serves `dist/` with an SPA fallback (`app.get("/{*path}")`, Express 5 syntax).
- **Deployment:** Docker Compose runs the app and Caddy (TLS) at `openfeed.meminseeker.com`. See `docs/deployment.md`. The README has user-facing behaviour and platform limits.

## Commands (run from the repo root)

| Command                          | What it does                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | `tsx server/index.ts`. Serves the app on http://localhost:3000 (loopback). Vite HMR uses its own default WebSocket port, 24678, because no `hmr.server` is configured.                                                                                                                                                                                                |
| `npm start`                      | `NODE_ENV=production tsx …`. This still runs under **tsx**, so it does not reproduce the Docker runtime. To check the real production runtime, run `npm run build && NODE_ENV=production node server/index.ts`, or the production-runtime test.                                                                                                                       |
| `npm test`                       | `tsx --test tests/*.test.ts`. 75 tests, about 2.5 s, all offline.                                                                                                                                                                                                                                                                                                     |
| `npx tsx --test tests/x.test.ts` | Runs a single file. Add `--test-name-pattern="regex"` to filter by test name.                                                                                                                                                                                                                                                                                         |
| `npm run build`                  | `tsc --noEmit && vite build`. `tsc` type-checks `src`, `server`, `tests` and `vite.config.ts`.                                                                                                                                                                                                                                                                        |
| `npm run format`                 | Prettier with default settings (no config file): double quotes, semicolons, 2 spaces, trailing commas, 80 columns. **This script reformats `tests/fixtures/x-long-*.html` (there is no `.prettierignore`), and tests depend on those files' exact bytes.** Restore them afterwards with `git checkout tests/fixtures`, or run Prettier only on the files you changed. |

The DB lives at `data/openfeed.db` (gitignored; override with `OPENFEED_DB`). `data/` may contain the user's real local data. Do not delete it.

## Critical constraint: production runs TypeScript natively

The production image runs `node server/index.ts` with Node 24 type stripping. There is no tsx or transpiler. Dev uses tsx, which is more lenient, so breakage only shows up in production. Everything reachable from `server/index.ts` must follow these rules:

- **Use only erasable syntax.** No `enum`, `namespace`, constructor parameter properties, or `import x = require`. `server/public-page.ts` (`PageError`) shows the pattern: declare the field, then assign it in the constructor.
- **Relative imports need an explicit `.ts` extension**, e.g. `../src/types.ts`. Frontend files import without extensions (`./types`). Don't copy that style into `server/`.
- **Type-only imports need `import type`**, or the inline `type` modifier.
- **The server may import only `src/types.ts` and `src/clean-url.ts` from `src/`.** These are the only `src` files the Dockerfile copies into the runtime image (`COPY src/types.ts src/clean-url.ts ./src/`). To share another file, add it to that line. Keep shared files free of DOM and JSX.
- **No dev dependencies at runtime.** `npm prune --omit=dev` removes tsx, vite and typescript from the image.
- `tests/production-runtime.test.ts` checks these rules. It boots `server/index.ts` with plain `node`, `NODE_ENV=production` and no tsx, then expects `/healthz` to return 200 and an unauthenticated `/api/state` to return 401.

## Layout

```
server/
  index.ts         Boot, DB, all API routes, sync orchestration, merge rules (~720 lines)
  auth.ts          users/sessions, schema migration, legacy claim, AsyncLocalStorage owner(), rate limit
  access.ts        Host/Origin allowlist (requestAllowed, validatePublicOrigin)
  library.ts       Single-link import (contentUrl/importLink/resolveSharedUrl) + YouTube playlists
  refresh.ts       hourlyRefresh(): serial per-user ticks, overlap-skipping
  retention.ts     retentionDays(), expiredPost()
  media.ts         X video proxy (video.twimg.com only, Range passthrough)
  public-page.ts   fetchPublicPage(): retrying fetch with redirect validation and YouTube consent handling
  youtube.ts       resolveChannel, syncChannel (RSS + channel tabs), initialData, publicPosts
  youtube-dates.ts videoPublished, resolveVideoDates (precise dates from watch pages, 3 concurrent)
  x.ts             syncX (syndication or official API v2), parseXTimeline, expandXPost, fetchXStatus (FxEmbed)
  instagram.ts     syncInstagram (public embed or Meta Business Discovery), instagramPosts
  tiktok.ts        syncTikTok (creator embed, then profile JSON fallback)
  patreon.ts       syncPatreon, resolvePatreonCampaign, patreonDoc (TipTap → RichBlock), fetchPatreonPost
src/
  main.tsx         App: all state, sidebar, feed/creators/saved/noted pages, PostCard, CreatorModal (~1400 lines)
  ContentViewer.tsx Modal viewer: YouTube iframe API, native <video>, TikTok iframe, image carousel, shortcuts, swipe, fullscreen
  Notes.tsx        Autosaved notes with localStorage drafts and timestamp insertion and jumps
  LibraryView.tsx  Playlists and Links pages
  LinkActions.tsx  Copy-link / Open-source buttons (PostCard + viewer)
  RichText.tsx     Renders sanitized RichBlock[] (Patreon bodies) as React elements
  AuthGate.tsx     Login/signup/claim gate; renders App once authenticated
  api.ts           fetch wrapper (X-OpenFeed-User header, 401 → logout event), writeNotes serializer
  types.ts         Shared models (SERVER IMPORTS THIS)
  clean-url.ts     cleanPastedUrl (SERVER IMPORTS THIS)
  feed-filters.ts  Filtering logic (pure, tested)
  ContentOptions.tsx Read-status tabs + sort; exports sortContents (tested)
  viewer-shortcuts.ts / viewer-swipe.ts / relative-time.ts / post-label.ts   Pure helpers (tested)
  youtube-player.ts Singleton loader for the YouTube iframe API
  pwa.ts, InstallApp.tsx  Service worker registration (prod only) and install prompt
  style.css        All styles: global plain CSS, about 2200 lines
public/            sw.js (caches only offline.html), manifest, icons, offline.html
tests/             node:test files + fixtures/
```

## Data model (`src/types.ts`)

- `Kind = "video" | "short" | "community" | "post"`; `SyncType = Kind | "repost"`.
- `sourceTypes` lists the allowed sync types per platform:
  - youtube: video, short, community
  - x: post, repost
  - instagram: post, video, short (Reels are stored as `short`)
  - tiktok: video
  - patreon: post
- `enabledTypes(account)` returns `account.syncTypes`. If that is unset, **X defaults to `["post"]`** and every other platform gets all of its types. An empty array pauses the source.
- `Account` fields: `{platform, username, channelId?, syncTypes?, xSinceId?, lastSync?, error?}`.
- `Creator` fields: `{id, name, tags[], accounts[], avatar, lastSync?, error?, libraryOnly?}`.
- `Post` fields:
  - Content: `id, creatorId, title, text?, image?, images?, videos?[{url,poster?,loop?}], videoId?, platform?, sourceUsername?, url, kind, published (ISO or ""), publishedApproximate?, duration?, repost?`.
  - User state: `read, saved, notes?, removed?` (soft delete/tombstone).
  - Library: `libraryOnly?, linked?, linkedAt?, playlistIds?`.
  - X text expansion: `textTruncated?, textExpanded?, textVersion?`.
- `State` is `{creators, posts, playlists?}`, the shape `GET /api/state` returns. `Playlist` is `{id, title, url, postIds[], warning?}`.

**ID conventions:**

- **YouTube detection:** a post is YouTube if `!post.platform || post.platform === "youtube"`. Check for both forms.
  - Channel-sync posts have no `platform` field.
  - Link and playlist imports set `platform: "youtube"`.
  - Either way, the id is the bare 11-char video id, or the raw community post id.
- Other platforms use `x:<id>`, `instagram:<shortcode>` and `tiktok:<numericId>`. A new adapter must never produce bare 11-char ids, because the viewer and `youtube-dates.ts` use that shape to detect YouTube.
- Creator ids:
  - followed creators: a UUID
  - imported links: `library:<platform>:<user>`
  - posts kept from an unfollowed creator: `library:retained:<oldId>`
  - playlists: `playlist:<id>`

## Database (SQLite, schema in `server/auth.ts` `initializeAccounts`)

Each table stores JSON blobs keyed by owner, with primary keys only and no secondary indexes:

- `users(id, username UNIQUE, salt, password)`. The password is an scrypt hash in hex.
- `sessions(token, user_id, expires)`. `token` is the sha256 of the cookie value; `expires` is in epoch ms.
- `creators(user_id, id, data)`, where `data` is the JSON `Creator`.
- `posts(user_id, id, creator_id, data)`. `creator_id` is written but no query reads it; all filtering happens in JS.
- `playlists(user_id, id, data)`.

Migration and schema rules:

- **There is no migration framework or version table.** Schema changes use `CREATE TABLE IF NOT EXISTS` plus `PRAGMA table_info` feature detection.
- `index.ts` first creates the old single-user tables. `initializeAccounts` then rebuilds them with `user_id` inside one `BEGIN IMMEDIATE` and tags existing rows `user_id='legacy'`.
- **Inserts use positional `VALUES (?,?,?)`.** Adding a column means updating every insert.
- **Prefer adding fields to the JSON `data`** over new columns. Older rows simply lack the field, so treat new fields as optional.
- **Legacy claim:** while rows with `user_id='legacy'` exist, signup requires `OPENFEED_SETUP_TOKEN`. The first such signup reassigns the legacy rows to the new user.
- Every `/api/state` call and most mutations load the owner's whole table and parse it in memory. Small scale is assumed.

## Server request pipeline (`server/index.ts`)

The boot sequence:

1. Open the DB in WAL mode and run the migrations.
2. Prune posts now, then every hour.
3. Apply the host/origin check to **all** requests, `/healthz` included. Any other host or origin gets 403.
   - Local mode accepts only `localhost`, `127.0.0.1` and `[::1]`.
   - With `OPENFEED_PUBLIC_ORIGIN` set (an https origin), only that exact Host and Origin are accepted, and `trust proxy` is set to 1.
4. Register `GET /healthz`.
5. Parse JSON bodies (100kb limit).
6. Mount `installAuth`.
7. Register the `/api` routes.
8. Add a 404 handler for unmatched `/api` paths. It sits behind the session gate, so a request without a session gets 401, not 404.
9. Add the global error handler.
10. Serve the static build in production, or mount Vite in dev.
11. Listen on `HOST` (default 127.0.0.1) and `PORT` (default 3000), then print `http://localhost:<port>`. Tests parse that line.

**Errors:**

- For validation, route handlers usually `throw new Error("user-facing message")`. Express 5 forwards async rejections, and the global handler turns every thrown error into **400 `{error: message}`**, upstream and network failures included.
- Some routes set the status themselves:
  - 409 for a duplicate creator or a sync already in progress.
  - Auth responses of 401, 403 and 429.
  - `res.sendStatus(404)` for an unknown post or creator. This sends plain text with no JSON body.
- The client reads `body.error` and falls back to "Request failed".

**Auth (`server/auth.ts`):**

- `openfeed_session` cookie: HttpOnly, SameSite=Lax, a fixed 30-day expiry. `secure` is set only when a public origin is configured.
- Usernames match `^[a-z0-9_.-]{3,40}$` after lowercasing. Passwords are 12–128 characters.
- Rate limit: 30 non-GET requests per IP per 15 minutes on `/api/auth/*`, then 429. The counter lives in memory.
- Per-request owner scoping uses `AsyncLocalStorage`. Data helpers call `owner()`, which throws outside a request. **Background code must wrap its work in `asOwner(userId, fn)`.**
- If the client sends `X-OpenFeed-User` and it differs from the session user, the server returns 409. This catches account switches in another tab.

### Routes

All `/api/*` routes except `/api/auth/*` require a session. What a route returns varies:

- **Full `State`:** sync, links, and both playlist routes.
- **The single entity:** creators POST and PATCH return the Creator; post PATCH returns the Post.
- **`{ok:true}`:** creator DELETE, post DELETE, and read.

| Route                                                    | Purpose                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /healthz`                                           | `{ok:true}`                                                                                                                                                                                                                                                                                                                                                           |
| `GET /api/auth/me`                                       | `{user\|null, claimRequired}`                                                                                                                                                                                                                                                                                                                                         |
| `POST /api/auth/{login,signup,logout}`                   | Login, signup and logout. Signup takes `setupToken` when a legacy claim is pending.                                                                                                                                                                                                                                                                                   |
| `GET /api/state`                                         | Prunes expired posts, then returns `{creators, posts (not removed), playlists}`.                                                                                                                                                                                                                                                                                      |
| `POST /api/sync`                                         | Manual refresh of all of the owner's sources. 409 if a sync is already running for this owner.                                                                                                                                                                                                                                                                        |
| `POST /api/creators {platform, channel}`                 | Follow a creator. YouTube resolves the channel over the network; other platforms only validate the username. 409 if the creator is a duplicate.                                                                                                                                                                                                                       |
| `PATCH /api/creators/:id {name?, tags?, accounts?}`      | Edit a creator. Name: 100 characters max. Tags: up to 20, each 40 characters max. `accounts` **replaces** all non-YouTube accounts. The existing YouTube account is always kept (only its `syncTypes` can change); a YouTube account is added only if the creator has none. `syncTypes` is validated against `sourceTypes`. Changing X `syncTypes` resets `xSinceId`. |
| `DELETE /api/creators/:id`                               | Unfollow. Linked or playlist posts move to `library:retained:<id>`; the rest are deleted.                                                                                                                                                                                                                                                                             |
| `PATCH /api/posts/:id {read?, saved?, notes?, removed?}` | Returns the updated Post. Notes are limited to 50,000 characters.                                                                                                                                                                                                                                                                                                     |
| `DELETE /api/posts/:id`                                  | Soft delete (`removed:true`). The tombstone stops refresh from re-adding the post.                                                                                                                                                                                                                                                                                    |
| `POST /api/read {ids}`                                   | Bulk mark as read.                                                                                                                                                                                                                                                                                                                                                    |
| `GET /api/posts/:id/detail`                              | X long-text repair via `expandXPost`.                                                                                                                                                                                                                                                                                                                                 |
| `GET /api/posts/:id/video/:index`                        | X video proxy.                                                                                                                                                                                                                                                                                                                                                        |
| `POST /api/links {url}`                                  | Import a single piece of content.                                                                                                                                                                                                                                                                                                                                     |
| `POST /api/playlists {url}`                              | Import or refresh a YouTube playlist.                                                                                                                                                                                                                                                                                                                                 |
| `DELETE /api/playlists/:id`                              | Remove a playlist.                                                                                                                                                                                                                                                                                                                                                    |

## Sync and merge rules

**`syncContents()`** (in `index.ts`):

- A per-owner lock prevents concurrent syncs for the same account.
- Accounts are processed one at a time, dispatched by platform:
  - YouTube: `syncChannel(channelId, creatorId, types)`, followed by `resolveVideoDates` for posts that are kept or not yet expired.
  - X: `syncX(username, creatorId, xSinceId, includeReposts)`.
  - Instagram: `syncInstagram(username, creatorId, types)`.
  - TikTok: `syncTikTok(username, creatorId)`.
  - Patreon: `syncPatreon(username, campaignId, creatorId, {useSession, since})`. A missing `campaignId` is resolved and saved on the account.
  - Accounts with no enabled types are skipped.
- Adapters return `{posts, warning?, avatar?, newestId?}`.
  - `warning` is written to `account.error` and shown in the UI, even when the sync succeeded. X public mode always sets a coverage warning.
  - The avatar is filled in only if the creator has none.
  - `newestId` becomes `xSinceId`.
- After the network await, the creator and account are re-read. If either was deleted or disabled in the meantime, the result is discarded.
- **Merge rules:**
  - Posts are dropped unless their type is enabled. X reposts are checked against `"repost"`.
  - User state is preserved: `read, saved, notes, removed, linked, linkedAt, playlistIds`.
  - An approximate or empty incoming date never overwrites a stored date.
  - Longer expanded X text is kept.
  - Expired posts are never inserted.
- A failure on one account becomes that account's `error`. `creator.error` joins all of them as `"Platform: msg · …"`.

**Hourly refresh** (`refresh.ts` plus `index.ts`):

- The first run is one hour after boot; nothing runs at startup.
- Users are processed one at a time. For each user it calls `asOwner(id, …)` and runs `syncContents` plus `refreshPlaylist(url, existingOnly=true)` for every playlist.
- Overlapping ticks are skipped, and an error for one user does not stop the others.

**Retention** (`retention.ts`):

- `OPENFEED_RETENTION_DAYS` defaults to 7 and must be at least 1. It is read once at boot.
- A post expires only if it is not `libraryOnly`, `linked`, in a playlist, `removed`, `saved` or annotated with notes, **and** has a parsable date older than N days.
- Undated posts never expire.
- **Unread Patreon posts never expire**; once read they follow the rule above.

**Library** is split across two files.

In `library.ts`:

- `contentUrl` allowlists HTTPS YouTube, X, Instagram and TikTok content URLs.
- `resolveSharedUrl` follows only TikTok short links, and only to `*.tiktok.com` hosts.
- `importLink` imports a single piece of content.
- `importPlaylist` scrapes the first page, then makes up to 20 continuation POSTs to `youtubei/v1/browse`. A partial import becomes `playlist.warning`.

In `index.ts`:

- `storeLibraryPost` merges an incoming post into the stored one. It preserves the user flags, unions `playlistIds`, and clears `removed` unless told to keep it.
- `refreshPlaylist` re-imports a playlist.
- `removePlaylistMembership` runs both when a playlist is deleted and when a refresh (without a warning) drops a post from it.
  - It hard-deletes a post only if the post is `libraryOnly` and is not linked, saved, noted, or in another playlist.
  - Otherwise it only removes the playlist id from the post.

## Platform adapters: shared contract and quirks

- **No page scripts run.** JSON is pulled out of `<script>` tags with brace-depth scanners (`initialData` in `youtube.ts`, `instagramPageData`), then searched with a recursive `walk`.
- **Validate before storing.**
  - Username validators throw user-facing errors.
    - `xUsername`, `instagramUsername` and `tiktokUsername` reject foreign hosts, ports, credentials and reserved paths.
    - `channelPath` (YouTube) checks only the hostname and the path shape.
  - Some media URLs are allowlisted by host:
    - X: `pbs.twimg.com` and `video.twimg.com`.
    - Instagram: `*.cdninstagram.com` and `*.fbcdn.net`.
    - TikTok video: `tiktokcdn.com`, `tiktokcdn-us.com` and `tiktok.com`.
  - TikTok covers and YouTube community images are checked only for https with no credentials.
- **Fetching:**
  - **Sync adapters** use plain global `fetch` with timeouts and default redirect handling.
  - **`fetchPublicPage`** (`public-page.ts`) adds retries: 3 attempts in total, with 250/500 ms backoff, on 429, 5xx and network errors. Each attempt has a 15 s timeout. It also adds validated manual redirects, including YouTube `consent.youtube.com/m`, which is accepted only if its `continue` URL matches. Only `youtube-dates.ts` and `library.ts` use it.
  - **Call `fetch` and read `process.env` at call time**, never at import time. Tests swap `globalThis.fetch` and env vars per test.
- **Optional official APIs:** they are selected by env vars and never fall back silently to public scraping.
  - X: `X_BEARER_TOKEN`.
  - Instagram: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` and `INSTAGRAM_GRAPH_VERSION`, all three together.
- **YouTube:**
  - RSS (about 15 items) gives exact dates. The channel tabs `/videos`, `/shorts` and `/posts` give the classification.
  - Leftover RSS entries are kept only when both video and short are enabled.
  - Community posts must be authored by the channel itself.
  - Relative dates such as "3 weeks ago" become `publishedApproximate:true`. `resolveVideoDates` later fetches each watch page for the exact ISO `publishDate`.
- **X:**
  - Without a token, data comes from the syndication timeline (`__NEXT_DATA__`). With a token, the official v2 API is used; the response is re-serialized into the same fake `__NEXT_DATA__` shape so `parseXTimeline` handles both paths.
  - `expandXPost` repairs truncated text. It uses the canonical X page `<h1>` plus FxEmbed (`api.fxtwitter.com`) and keeps a 5-minute in-memory cache.
- **Instagram:** the public profile embed gives about 6 posts. Video items among the first 6 media items are enriched one at a time through `/p/<code>/embed/captioned/`.
- **Patreon** (`patreon.ts`):
  - There is no official API. It uses `www.patreon.com/api/campaigns?filter[vanity]=` (campaign id, name, avatar) and `/api/posts?filter[campaign_id]=…&sort=-published_at` (JSON:API, `links.next` paging).
  - Pages of 20 are fetched until a post is older than the retention window, with a cap of 10 pages.
  - The body is `content_json_string` (TipTap JSON). `patreonDoc` turns it into `Post.blocks` (`RichBlock[]` in `types.ts`) plus plain `text`. It allowlists image hosts (`*.patreonusercontent.com`) and link protocols (http/https).
  - `Cookie: session_id=$PATREON_SESSION_ID` is sent **only** when `patreonSessionAllowed()` in `index.ts` is true, i.e. when the request owner's username equals `PATREON_OPENFEED_USER`. Other accounts get public data: `current_user_can_view:false` makes the post `locked: true`, with no blocks.
  - An invalid cookie still returns HTTP 200 with locked posts. That is the only sign of an expired session, and it produces a warning.
  - Ids are `patreon:<postId>` and `kind` is always `"post"`. For a YouTube `embed.url`, `videoId` is set and the viewer plays it with the YouTube player.
  - Image URLs are signed and expire in about 2 weeks. When a Patreon post is opened, the viewer calls `GET /api/posts/:id/detail`, which re-fetches the post (5-min cache) and renews `blocks` and `image`.
- **TikTok:**
  - The creator embed gives up to 10 videos, with dates estimated as `BigInt(id) >> 32n` (marked approximate).
  - Profile JSON is the fallback.
  - A WAF block or private account is an error, not an empty success.
  - Sync types are ignored; every item is `kind:"video"`.

### Adding a platform

There is no registry. The platform list is hardcoded in several places:

1. `src/types.ts`: add the platform to `sourceTypes` and the `Post.platform` union. If the platform introduces a new kind, also update the `Kind`/`SyncType` unions and `syncLabels`, which is keyed by type.
2. `server/<p>.ts`: export `<p>Username()` and `sync<P>()`. Posts need ids of the form `<p>:<id>`, plus `platform`, `sourceUsername`, `read:false` and `saved:false`.
3. `server/index.ts`: update
   - the `usernames` normalizer map and `platformLabels` near the top,
   - the platform allowlists in `POST /api/creators` and `PATCH /api/creators/:id` (including PATCH's `other` list),
   - the platform filter and the dispatch ternary in `syncContents`.

   **Missing one of these fails silently:** POST turns an unknown platform into `"youtube"`, and the dispatch's final `else` calls `syncChannel`.

4. `server/library.ts`: `contentUrl` and `importLink`, if single links should work. Also add the hosts to `src/clean-url.ts`.
5. Frontend:
   - `feed-filters.ts` `contentFilters`
   - `post-label.ts`
   - `CreatorModal` in `main.tsx`: the source `<option>`, a section, and the default `syncTypes` (these duplicate `enabledTypes`)
   - in `main.tsx`: the `SyncChoices` legend and the PostCard approximate-date tooltip
   - the viewer render chain in `ContentViewer.tsx` (`videoId`/`isVideo` logic, the media branch, each control callback) and the image-carousel condition
6. Tests: add `tests/<p>.test.ts` with fixtures. If the integration flow needs the platform, add a branch to `tests/fixtures/youtube-fetch.ts`.

## Frontend architecture

- **There is no router, context or store.** `App` in `main.tsx` holds everything in `useState`.
  - `page` is one of `"feed" | "creators" | "saved" | "noted" | "playlists" | "links"` and is not reflected in the URL.
  - To add a page, add it to the nav array and to the breadcrumb, h1 and subtitle ternaries.
- **Server sync:** `load()` replaces the whole state from `GET state`. It runs on mount, every 60 s, and on window focus.
  - Mutations either replace the state with the returned `State`, or swap in the returned `Post`. Nothing is optimistic.
  - Opening a post in the viewer marks it read.
  - X posts lazily call `posts/:id/detail` unless `textExpanded && textVersion === 2`. To force a re-fetch, bump the hardcoded `2` in all four places together: `src/main.tsx` (the check), `server/x.ts` (the skip check and the producer), and `server/library.ts`.
- **`api.ts` (`api(path, method, body)`):**
  - Prefixes `/api/` and sends the `X-OpenFeed-User` header once an account is set.
  - A 401 on a path other than `auth/` dispatches the `openfeed:logout` window event, which `AuthGate` listens for.
  - On failure it throws `Error(body.error || "Request failed")`. On success it parses the body as JSON, so successful responses must be JSON.
- **Filters:** `feed-filters.ts` `matchesFeedFilters` covers page, topic, type, creators, time range, read status and search.
  - `"All topics"` is a sentinel string.
  - `creatorFilter === null` means all creators.
  - Content-type keys are `platform:kind`.
  - The feed paginates in batches of 24.
- **Viewer (`ContentViewer.tsx`):** stays mounted across posts; effects reset its state on `post.id` changes.
  - Media is picked in this order:
    1. Native `<video>`. X videos go through `/api/posts/:id/video/:i`.
    2. The TikTok iframe, only when no native video is available and `videoId` is numeric.
    3. The YouTube player, loaded by `youtube-player.ts` from youtube-nocookie.
  - Control callbacks:
    - Play, seek and skip check TikTok, then native, then YouTube.
    - Speed and captions check native, then YouTube; TikTok has neither.
  - The keyboard map lives in `viewer-shortcuts.ts`, which ignores editable targets and modifier keys. **The footer legend is written by hand; keep it in sync.**
- **Notes (`Notes.tsx`):**
  - Drafts are stored in localStorage under `openfeed.notes.<accountId>.<postId>` as raw text.
  - Autosave runs 600 ms after typing stops. `writeNotes` serializes PATCHes per account and post.
  - A local draft takes priority over the server value until the save succeeds.
- **PWA:** the service worker registers only in production. `public/sw.js` caches **only** `offline.html` (cache `openfeed-offline-v1`; bump the name when that page changes) and never touches `/api` or media. `tests/pwa.test.ts` checks this and the manifest icon sizes.
- **Styling:**
  - One global `style.css` with short kebab-case semantic class names and state classes such as `.active` and `.read`.
  - Colors are hardcoded hex values (a green and cream palette), with no CSS variables and no dark mode.
  - The main breakpoints are 1500 (min-width), 1150, 760 (the sidebar becomes a drawer) and 450 px. Component-level breakpoints also exist at 950, 650 and 600 px.
  - Fonts are DM Sans and Manrope, served locally via @fontsource.
- Icons come from `lucide-react`. Images use `referrerPolicy="no-referrer"`. Buttons carry `aria-label`, and toggles use `aria-pressed`.

## Tests

- Tests use `node:test` and `node:assert/strict` as flat `test("behavioural sentence", …)` calls, with no describe blocks or hooks.
- **Network:** tests swap `globalThis.fetch` and restore it in `try/finally`. They assert on exact URLs, redirect modes and missing credentials, and they expect blocked or private sources to reject.
- **Env:** tests save, set and restore `process.env` keys.
- **Time:** pure functions take an optional `now` argument.
- **Integration tests** (`integration.test.ts`, `accounts-library.test.ts`) spawn the real server:
  - The command is `node --import tsx --import ./tests/fixtures/youtube-fetch.ts server/index.ts`, with a temp `OPENFEED_DB`, `PORT=0` and `NODE_ENV=production`, so the server serves `dist/`.
  - `integration.test.ts` blanks the X and Instagram token variables. `accounts-library.test.ts` does not, so tokens set in your shell leak into it.
  - That preload fakes every upstream host the flow touches. Any URL it doesn't handle goes to the real network, so add a branch there when you add a new endpoint.
  - They cover signup, the legacy claim, creator CRUD, sync, read/save/notes/remove, cross-origin 403, persistence across restart, per-account isolation (404 on other users' ids, 409 on an `X-OpenFeed-User` mismatch), and SSRF rejection.
- Frontend logic is tested only through pure modules (`feed-filters`, `ContentOptions.sortContents`, `viewer-shortcuts`, `viewer-swipe`, `relative-time`, `api.writeNotes`). Put new UI logic in small pure `.ts` modules so it can be tested.
- Tests use relative paths, so run them from the repo root.

## Environment variables

| Variable                                                                 | Default            | Purpose                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                                                   | 3000               | Listen port                                                                                                                                                                           |
| `HOST`                                                                   | 127.0.0.1          | Listen host (0.0.0.0 in Docker)                                                                                                                                                       |
| `NODE_ENV`                                                               |                    | `production` serves `dist/`; anything else mounts Vite                                                                                                                                |
| `OPENFEED_DB`                                                            | `data/openfeed.db` | SQLite path                                                                                                                                                                           |
| `OPENFEED_PUBLIC_ORIGIN`                                                 |                    | `https://host`. Enables cloud mode: exact host/origin check, secure cookie, trust proxy 1. Under Compose it is derived from `OPENFEED_DOMAIN`, so setting it in `.env` has no effect. |
| `OPENFEED_DOMAIN`, `ACME_EMAIL`                                          |                    | Compose/Caddy only. Both are required by `compose.yaml`.                                                                                                                              |
| `OPENFEED_RETENTION_DAYS`                                                | 7                  | Feed post retention, in days. Unset means 7, but set-but-empty makes boot throw.                                                                                                      |
| `OPENFEED_SETUP_TOKEN`                                                   |                    | Required to claim a pre-accounts (legacy) workspace                                                                                                                                   |
| `X_BEARER_TOKEN`                                                         |                    | Switches every X source to the official API                                                                                                                                           |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`, `INSTAGRAM_GRAPH_VERSION` |                    | Meta Business Discovery; all three are required together                                                                                                                              |
| `PATREON_SESSION_ID`, `PATREON_OPENFEED_USER`                            |                    | Patreon `session_id` cookie, used only for the OpenFeed user named by `PATREON_OPENFEED_USER`. Others get locked previews.                                                            |

## Known rough edges

These are not bugs to fix unasked; they are context.

- **Scale:** state is loaded in full and filtered in JS on every request, and the client polls every 60 s. This is fine for personal scale.
- **Error status codes:** every thrown error is a 400, including upstream failures.
- **Duplicated platform knowledge:** platform lists appear in several places, and the default `syncTypes` in `CreatorModal` duplicate `enabledTypes`.
- **Unencoded post id:** `mutate()` in `main.tsx` builds `posts/${p.id}` without `encodeURIComponent`, unlike other call sites.
- **Undefined CSS variable:** `style.css` uses `var(--border)`, which is never defined.
- **Extension-less test imports:** `tests/notes.test.ts` and `tests/viewer.test.ts` import `../src/...` without extensions. This works under tsx only; don't copy it into server code.
- **A missing creator can crash rendering:** in `App`, the PostCard and ContentViewer call sites look up the creator with `state.creators.find(...)!`.
  - The feed, saved and noted pages are protected, because `matchesFeedFilters` drops posts whose creator is missing.
  - The Playlists and Links pages, and the viewer opened from them, are not.
