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

## Cloud deployment

See [the deployment guide](docs/deployment.md) for Docker Compose, DigitalOcean sizing, HTTPS and password protection at `openfeed.meminseeker.com`, data migration, backups, and manual updates. Friends sign up for separate workspaces.

## What works

- Follow a public YouTube channel or X account by @handle or profile URL (YouTube channel IDs also work).
- Rename creator profiles, assign multiple comma-separated topics, and link their YouTube, X and Instagram accounts. TikTok supports public video import; Patreon syncs member posts with a configured session.
- Mix videos, Shorts, and creator-authored community posts in one feed, including multi-image albums, alongside X text, photo, video and GIF posts.
- Set content types to sync independently on each creator/source. Empty selection pauses that source. Existing posts and notes remain available. Other-platform preferences are stored until those integrations are implemented.
- Open posts in a modal with video playback, image carousel, previous/next navigation, and separate copy/open-source actions.
- Write autosaved notes on any item, insert video timestamps, and jump back to timestamped notes. Notes are stored in SQLite, with a browser draft backup for pending/failed saves.
- Combine topic, multiple-creator, platform-specific content-type, text-search, and unread filters. Type controls distinguish YT videos/Shorts/community, X posts/reposts, and IG posts/albums/videos/Reels. The creator checklist follows the selected topic; selections outside that topic are cleared. All creators are selected initially; explicitly unselecting everyone shows no content.
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

Both modes accept posts and reposts from the approved account and exclude replies. Reposted text is shown as returned by X and labeled Repost; original-post media/details are not separately fetched, avoiding extra API reads. Embedded quoted-account media are excluded. Protected accounts are rejected. Photos load from X's image servers. MP4 videos stream through a local OpenFeed proxy because X's video CDN rejects localhost referrers. The proxy accepts only stored X video URLs on video.twimg.com, forwards byte ranges for seeking, and sends no browser referrer, cookies or credentials; playback does not call the paid X API. No X timeline widget or recommendations are loaded. Multiple videos have a selector; GIFs loop on user playback. Keyboard seeking, play/pause, notes and timestamps work with native video. Caption tracks generally aren't exposed by X; C reports this when unavailable. Poll voting, cards, quoted-post details and interactions require Open source. Public-page long posts can be truncated by X.

## Instagram ingestion and setup

Add an Instagram username/profile URL to an existing creator, or choose Instagram when creating a profile. Select Posts (photos and albums), Videos, and/or Shorts (Reels). Empty selection pauses fetching. Captions, multi-image albums, carousel video attachments, native video playback and notes use the same feed/viewer as other platforms. Only approved profiles are fetched; Stories, comments, tagged-profile feeds and private accounts are not supported.

The no-key importer reads Instagram's public profile embed without cookies or login. It usually exposes only six recent posts; it does not paginate or backfill. Individual public post embeds supplement video URLs and Reel classification. Collaboration video details may belong to another original author, but enrichment requires an exact shortcode already listed on the approved public profile; private media and unrelated shortcodes are rejected. The item stays associated with the approved creator. Refresh existing Instagram items after updating to populate missing video URLs. The live Dolubatarya check exposed six recent posts, including two albums and a video, with the newest dated October 3, 2026. **Instagram can block requests, require sign-in, or disable embeds.** Blocked profiles show a source error instead of a successful empty refresh. This parser is best effort, not a guarantee of tracking every public post. Parsing never executes Instagram's scripts.

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

The app has individual signup/login accounts. Each account owns its creators, posts, read state, notes, playlists and links. Passwords are salted with scrypt; sessions use expiring HttpOnly cookies and are revoked on logout. Local runs listen on loopback; cloud deployments use HTTPS through Caddy. Follow [the deployment guide](docs/deployment.md), including the existing-workspace claim procedure, before upgrading. The API rejects unapproved hosts and cross-origin requests.

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

### Feed retention, notes and mobile viewing

Development takes place on `dev`; `main` is reserved for explicitly requested releases/merges.

The **Noted down** sidebar category shows posts with nonempty notes. Feed dates use elapsed time and update every minute; hover over a date for its exact timestamp.

Unsaved posts without notes are removed after **7 days**, at startup, hourly, and after refresh. Set `OPENFEED_RETENTION_DAYS` to a positive number to change this window. Saved posts, annotated posts, playlist items, pasted links, and posts with unknown dates are retained. Refresh skips expired items so old source posts do not refill the database.

On phones the viewer fills the screen, with larger controls and notes collapsed by default. Tap **Notes** below the media to expand them. Swipe left/right on the title, text, or footer to move between content items. Image albums retain their own image swipe gesture; embedded players handle touches themselves. Previous/Next buttons remain available below the content.

### TikTok

Add TikTok directly or edit an existing creator's TikTok account using a username or HTTPS profile URL. Existing linked TikTok accounts participate in refresh automatically unless syncing is paused. The official creator embed supplies up to 10 recent videos (with profile JSON as a fallback); the viewer uses TikTok's [official embed player](https://developers.tiktok.com/docs/en/embed-player).

Embed video dates are estimated from their IDs because the embed omits publication timestamps. TikTok may return an access challenge, an empty profile payload, or require sign-in. These responses surface as source errors without removing previously imported content. This importer does not bypass challenges or guarantee a complete timeline. The player includes an Open source fallback; playback controls inside the TikTok iframe are managed by TikTok.

### Patreon

Add a Patreon creator directly, or add the creator's Patreon name or profile URL (`patreon.com/name` or `patreon.com/cw/name`) to an existing creator, then refresh. OpenFeed resolves the creator's campaign and imports posts from the last retention window (7 days by default) on each manual or hourly refresh. **Unread Patreon posts are kept until you read them**, so falling behind never loses posts; once read, they follow the normal retention rules (saved and noted posts are kept).

Patreon has no official API for reading a creator's posts. OpenFeed reads the same JSON the Patreon website uses. Member-only posts require your browser session:

- `PATREON_SESSION_ID`: the `session_id` cookie value from a browser signed in to Patreon (Developer Tools → Application/Storage → Cookies → `www.patreon.com`).
- `PATREON_OPENFEED_USER`: your OpenFeed username. The session is used **only** for this account; other accounts on the same server see public previews, where member posts appear locked with an Open on Patreon link.

Restart the server after setting them. The cookie stays server-side and is never stored in the database or sent to the browser. It expires when Patreon ends the session (for example after logging out); the creator then shows "Patreon session expired…", and you replace the value and restart. Treat it like a password.

Post text keeps headings, bold/underline/italic, links, lists, quotes and inline images (rendered without executing Patreon HTML). YouTube video posts play in the viewer. Patreon-hosted video/audio, polls, attachments and comments require **Open source**. Patreon image links are signed and expire after about two weeks; opening a post renews them, though card thumbnails of older unread posts may break until then. Patreon is behind Cloudflare and may block requests from datacenter IPs; a block appears as a source error and keeps existing posts.

### Install on your phone

Open the HTTPS site, then choose **Install app** in OpenFeed or your browser. On iPhone/iPad use Safari → Share → Add to Home Screen. The app opens in its own window with an OpenFeed icon. Installation uses the same individual login as the website. The manifest and app icons are public so phone installers can retrieve them. If an older installation still shows “O”, remove that home-screen shortcut and install it again after deployment. Network access is required for the feed, syncing, media and saving notes; the offline page explains how to reconnect. The service worker caches only that generic offline page, never feed data or notes. Local note drafts retain their existing behavior.

### Feed and playback controls

- Creator checkboxes start checked. **All creators in this topic** checks everyone; uncheck one or more to exclude them. **Unselect all creators** clears the selection and shows no posts.
- Time buttons show items within the last 1, 2, 3, 5 or 7 days. **1w+** means older than seven days; **All** includes undated content. Topic badges show unread items within the selected time window. Content-type badges count unread items matching the selected topic, creators, time range, search and saved/noted section; they ignore the type selection itself so you can compare types.
- Remove content with its trash button. **Undo** restores it with saved status and notes intact. A hidden record is retained so refreshing does not bring removed items back.
- X source settings distinguish posts and reposts. New accounts sync posts only. Changing these choices affects subsequent imports and resets the X API cursor so newly enabled types can be fetched.
- X posts are checked when opened, including short previews, reposts and previously repaired posts. The canonical public X page is supplemented by the public [FxEmbed status API](https://docs.fxembed.com/api/introduction/), with exact status-ID validation and a five-minute cache. Only the public status ID is sent to FxEmbed; no account credentials or notes are sent. Full text is preserved on later syncs. If the sources cannot supply it, a known shortened preview is labeled and the source link remains available.
- Image and video fullscreen buttons expand the media; browsers without the Fullscreen API use an expanded in-app view. Playback-speed buttons use the rates supported by the player.
- TikTok prefers the native video URL supplied by the public embed, enabling speed and seek controls. If that URL expires or fails, the official iframe is used with play/pause and seek controls. TikTok's documented iframe API does not expose playback speed, so speed buttons are unavailable in that fallback.

### Playlists and Links

**Playlists** imports public or unlisted YouTube playlists, including older videos. Select a playlist to view it in its original order; refresh it to discover changes. Both classic and modern YouTube cards and continuation pages are supported (up to 21 pages per import). Partial imports show a warning. Private, deleted or unplayable items cannot be imported. Removing a playlist preserves items also stored as links, saved for later, noted, or belonging to another playlist.

**Links** imports individual YouTube, X, Instagram and TikTok content URLs without following their creators. TikTok short links are resolved only through TikTok-owned hosts. Imported links and playlist items never expire under feed retention, and do not appear in the recent feed unless a followed creator also supplies them. Saved and noted library items remain available in those sidebar sections. Platform access and embedding restrictions still apply; no login walls or private content are bypassed.

Usernames are case-insensitive, 3–40 letters/numbers/dots/dashes/underscores. Passwords are 12–128 characters. Signup is open after the existing workspace is claimed; password-reset email is not implemented. Browser note drafts are scoped by account. Log out on shared devices.

Pasted library URLs are cleaned in the input field and before import: only the video or playlist identifier is retained; sharing/tracking parameters and fragments are removed. Public-page imports retry transient connection, response-body and HTTP failures up to three times. Redirects are checked before following them, and playlist redirects must retain the same playlist ID. Connection failures identify the platform and, when available, the network error code; persistent failures on a deployed server require checking its outbound network/DNS access or upstream restrictions.

YouTube regional redirects through `consent.youtube.com/m` are allowed only when their `continue` URL identifies the exact requested public content, and the return redirect is checked again. The importer follows the automatic redirect only; it sends no consent cookies, submits no forms, and reports an error if YouTube requires an interactive choice.

Content views support All posts, Unread, and Read filters and newest/oldest sorting.
Links use their first addition date, recorded for newly added links. Items without
known dates (including older links and some YouTube playlist videos) appear last
in their original order. Re-importing a link keeps its original addition date.

The server refreshes each account's creator sources and playlists every hour while
running, even with the browser closed. Refreshes are serialized across accounts;
source failures do not stop other accounts. The first automatic run is one hour
after server startup. Open apps check for updated state every minute and on focus.

YouTube playlist imports resolve precise publication timestamps from each video's
public watch-page metadata instead of sorting rounded “months ago” estimates.
Existing playlists are corrected on their next manual or hourly refresh. Exact
stored dates are reused, and at most three date lookups run concurrently. Creator
refreshes also resolve missing/approximate video dates for retained content. If
YouTube withholds a video's precise date, the playlist shows a warning and retries
on the next refresh rather than inventing a chronological position.
