# OpenFeed

A calm, personal feed for the creators you choose. Built from scratch with React, TypeScript, Vite, Express, and SQLite.

## Run

Requires **Node.js 24+** and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The server listens on loopback only. No API key or platform sign-in is required for public-page mode.

```sh
npm test
npm run build
npm start
```

`npm start` serves the production build. Set `PORT` to change the default port. Run commands from the repository root. The SQLite database is stored in `data/openfeed.db`, ignored by Git. Back up the entire `data/` directory while the server is stopped.

## What works

- Follow a public YouTube channel or X account by @handle or profile URL (YouTube channel IDs also work).
- Rename creator profiles, assign multiple comma-separated topics, and link their YouTube, X and Instagram accounts. TikTok and Patreon remain metadata only.
- Mix videos, Shorts, and creator-authored community posts in one feed, including multi-image albums, alongside X text, photo, video and GIF posts.
- Set content types to sync independently on each creator/source. Empty selection pauses that source. Existing posts and notes remain available. Other-platform preferences are stored until those integrations are implemented.
- Open posts in a modal with video playback, image carousel, previous/next navigation, and separate copy/open-source actions.
- Write autosaved notes on any item, insert video timestamps, and jump back to timestamped notes. Notes are stored in SQLite, with a browser draft backup for pending/failed saves.
- Combine topic, creator, content-type, text-search, and unread filters.
- Save posts for later, mark individual posts or the current filtered result as read, and unfollow creators.
- Persistent local state, explicit refresh, partial-source error reporting, responsive layout, and finite batches of 24 posts. New creators trigger a refresh.

## YouTube ingestion and limits

Uploads come from YouTube's public channel RSS feed (roughly the latest 15 uploads). Selected public Videos, Shorts, and Posts tabs supplement it. When only one upload type is enabled, only that tab's explicitly classified items are imported; RSS enriches their dates. This prevents disabled Shorts or videos from leaking into the feed. Community-only and paused sources skip RSS entirely. Only the selected channel tab is inspected; community authors must match the followed channel ID. This prevents viewer posts and sidebar recommendations from entering the feed.

Public-page parsing is best effort and can break when YouTube changes its markup, requires consent, or throttles requests. No private or members-only access is attempted. Refresh failures appear in creator details and the feed. RSS failure does not stop selected public tabs from syncing. Unclassified RSS uploads are retained only when both videos and Shorts are enabled. A successfully loaded empty tab can mean the channel has no posts.

This is **recent-content tracking, not a complete historical archive**: the first public page is fetched without continuation pagination. Shorts outside RSS often have no publish date; these appear after dated posts with “Date unavailable.” Videos outside RSS and community dates are approximate, derived from YouTube's relative timestamps. Different content types may therefore have imperfect chronological ordering. Short classification outside the first Shorts page may be incomplete. Community image albums and attached videos are supported. Poll voting and external attachments still require opening the source.

Video playback uses YouTube's privacy-enhanced embed, loaded only when a video is opened in the viewer. Playback starts on user interaction. YouTube can display its own ads, controls, recommendations, and embedding restrictions; OpenFeed does not bypass these. An open-source action is always available if embedding fails. Thumbnail and avatar requests still contact YouTube's image servers. Fonts are bundled locally; OpenFeed has no analytics or recommendation engine.

## X ingestion and limits

Add an X username/profile URL in a creator's details, or select X when adding a creator. Enable **Posts**, then refresh. All authored X content is classified as **Posts** in the content-type filter, including photos and videos. Unchecking Posts pauses that source. Existing notes, read state and saved posts survive refresh. Removing an account stops new imports; existing items remain until the creator is unfollowed.

Without a key, the adapter fetches X's own public syndication timeline server-side. **This is a limited snapshot, not a reliable recent timeline**: X may return popular/older posts and omit recent ones. The live Dolubatarya check returned 100 posts whose newest date was November 2025. The UI reports this coverage warning. No cookies, guest-token workaround or platform login is used. The endpoint is undocumented and can change, be unavailable, or throttle requests. Failed sources report errors independently so YouTube can continue syncing.

For recent posts, optionally set `X_BEARER_TOKEN` in the server environment to an app-only bearer token from your X developer account, then restart the server. This selects the official X API for every X source. API access and usage may incur charges under your X plan; OpenFeed does not obtain a token or subscribe for you. The token stays server-side, never in the browser or database. The adapter checks the profile's protected flag and imports up to 30 posts and reposts per refresh, excluding replies at the API. After the first successful API refresh, a persisted `since_id` cursor requests only newer items. If more than 30 arrive, older excess items are deliberately skipped and a coverage warning appears; there is no paid pagination/backfill. It does not paginate/backfill a complete archive or bypass access restrictions. Authentication/rate-limit failures are surfaced without silently switching to stale snapshots. See [X user posts documentation](https://docs.x.com/x-api/users/get-posts).

Both modes accept posts and reposts from the approved account and exclude replies. Reposted text is shown as returned by X and labeled Repost; original-post media/details are not separately fetched, avoiding extra API reads. Embedded quoted-account media are excluded. Protected accounts are rejected. Photos and the highest available MP4 variant play directly from X's image/video servers in the viewer, with no X timeline widget or recommendations. Multiple videos have a selector; GIFs loop on user playback. Keyboard seeking, play/pause, notes and timestamps work with native video. Caption tracks generally aren't exposed by X; C reports this when unavailable. Poll voting, cards, quoted-post details and interactions require Open source. Public-page long posts can be truncated by X.

## Instagram ingestion and setup

Add an Instagram username/profile URL to an existing creator, or choose Instagram when creating a profile. Select Posts (photos and albums), Videos, and/or Shorts (Reels). Empty selection pauses fetching. Captions, multi-image albums, carousel video attachments, native video playback and notes use the same feed/viewer as other platforms. Only approved profiles are fetched; Stories, comments, tagged-profile feeds and private accounts are not supported.

The no-key importer reads Instagram's public profile embed without cookies or login. It usually exposes only six recent posts; it does not paginate or backfill. Individual public post embeds supplement video URLs and Reel classification. The live Dolubatarya check exposed six recent posts, including two albums and a video, with the newest dated October 3, 2026. **Instagram can block requests, require sign-in, or disable embeds.** Blocked profiles show a source error instead of a successful empty refresh. This parser is best effort, not a guarantee of tracking every public post. Parsing never executes Instagram's scripts.

For supported public Business/Creator accounts, configure Meta Business Discovery with these server environment variables:

- `INSTAGRAM_ACCESS_TOKEN`: a Meta access token with the required Business Discovery permissions.
- `INSTAGRAM_USER_ID`: the ID of your own professional Instagram account connected through Facebook Login (not the followed creator's ID).
- `INSTAGRAM_GRAPH_VERSION`: the Graph API version configured for your Meta app, such as `v24.0`.

Restart the server after setting them. Tokens are sent only in server request headers, never stored in the database or exposed to the browser. A partial configuration reports an error. API errors never fall back silently to public pages. See [Meta's official Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) and [Business Discovery reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery).

Official mode imports the latest 30 media items in one request, without archive pagination or additional per-post requests. Content-type filters are applied locally to the returned media. This is a bounded recent snapshot, not an incremental cursor API: refresh can return previously imported items, whose notes/read/saved state are preserved. Media IDs use the canonical post shortcode so switching between public and API modes does not duplicate posts. Instagram CDN media URLs expire; refreshing may renew them. Images and videos contact Meta's CDN directly when displayed. Public-mode live ingestion was verified against Dolubatarya. Optional API verification requires a valid Meta configuration; automated tests use offline fixtures.

## Viewer shortcuts and notes

- **↑ / ↓:** previous / next content in the filtered feed, retaining its order even as items become read.
- **← / →:** rewind / advance video by 5 seconds, or previous / next image.
- **Space / K:** play / pause video.
- **C:** request caption toggle. Caption module toggling depends on the embedded player's capabilities; if unavailable, focus moves to the player, where native C / CC controls are available.
- **Esc:** close the viewer (outside text entry).

Feed shortcuts work while focus is outside the cross-origin YouTube frame. Inside it, YouTube handles its own shortcuts, which may differ. Click the content title to restore feed shortcuts. Inputs, textareas, composition input, and Ctrl/Alt/Meta shortcuts are left alone, so typing notes never changes content or seeks a video.

Notes autosave after 600 ms and flush when switching content or closing. Writes are serialized per item; failed or pending drafts stay in the browser and are retried on reopening. The **Save now** action retries explicitly. Notes persist through refresh and server restart. **Add current timestamp** inserts a marker such as `[1:23]`; timestamp buttons below the notes seek back to that point. Notes have a 50,000-character limit.

The app is designed for **one person on their own machine**. It has no login or multi-user isolation. Do not expose it publicly without adding authentication, TLS, and deployment hardening. The API rejects cross-origin browser requests.

## Structure

- `src/main.tsx`: feed, creator management, saved posts, filtering
- `src/ContentViewer.tsx`: interactive content viewer and keyboard controls
- `src/Notes.tsx`: autosaved notes and timestamp navigation
- `src/style.css`: responsive interface
- `src/types.ts`: platform-neutral creator and post models
- `server/index.ts`: local HTTP API and SQLite persistence
- `server/youtube.ts`: public YouTube adapter
- `server/x.ts`: public snapshot and optional official API X adapters
- `tests/youtube.test.ts`: channel validation, page parsing, source isolation

The sample channels @dolubatarya and @yatirim101 were used for live validation. Local test data is not committed.
