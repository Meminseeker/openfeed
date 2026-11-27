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
- Rename creator profiles, assign multiple comma-separated topics, and link their YouTube, X and Instagram accounts. TikTok supports public video import; Patreon syncs member posts with a configured session; LinkedIn imports the few recent posts a public profile shows to logged-out visitors.
- Mix videos, Shorts, and creator-authored community posts in one feed, including multi-image albums, alongside X text, photo, video and GIF posts.
- Set content types to sync independently on each creator/source. Empty selection pauses that source. Existing posts and notes remain available. Other-platform preferences are stored until those integrations are implemented.
- Open posts in a modal with video playback, image carousel, previous/next navigation, and separate copy/open-source actions.
- Write autosaved notes on any item, insert video timestamps, and jump back to timestamped notes. Notes are stored in SQLite, with a browser draft backup for pending/failed saves.
- Combine topic, multiple-creator, platform-specific content-type, text-search, and unread filters. Type controls distinguish YT videos/Shorts/community, X posts/reposts, and IG posts/albums/videos/Reels. The creator checklist follows the selected topic; selections outside that topic are cleared. All creators are selected initially; explicitly unselecting everyone shows no content.
- Save posts for later, mark individual posts or the current filtered result as read, and unfollow creators.
- Persistent local state, explicit refresh, partial-source error reporting, responsive layout, and finite batches of 24 posts. New creators trigger a refresh.
- Use the interface in English or Turkish. See [Languages](#languages).

## YouTube ingestion and limits

Uploads come from YouTube's public channel RSS feed (roughly the latest 15 uploads). Selected public Videos, Shorts, and Posts tabs supplement it. When only one upload type is enabled, only that tab's explicitly classified items are imported; RSS enriches their dates. This prevents disabled Shorts or videos from leaking into the feed. Community-only and paused sources skip RSS entirely. Only the selected channel tab is inspected; community authors must match the followed channel ID. This prevents viewer posts and sidebar recommendations from entering the feed.

Public-page parsing is best effort and can break when YouTube changes its markup, requires consent, or throttles requests. No private or members-only access is attempted. Refresh failures appear in creator details and the feed. RSS failure does not stop selected public tabs from syncing. Unclassified RSS uploads are retained only when both videos and Shorts are enabled. A successfully loaded empty tab can mean the channel has no posts.

This is **recent-content tracking, not a complete historical archive**: the first public page is fetched without continuation pagination. Shorts outside RSS often have no publish date; these appear after dated posts with “Date unavailable.” Videos outside RSS and community dates are approximate, derived from YouTube's relative timestamps. Different content types may therefore have imperfect chronological ordering. Short classification outside the first Shorts page may be incomplete. Community image albums and attached videos are supported. Poll voting and external attachments still require opening the source.

Video playback uses YouTube's privacy-enhanced embed, loaded only when a video is opened in the viewer. Playback starts on user interaction. YouTube can display its own ads, controls, recommendations, and embedding restrictions; OpenFeed does not bypass these. An open-source action is always available if embedding fails. Thumbnail and avatar requests still contact YouTube's image servers. Fonts are bundled locally; OpenFeed has no analytics or recommendation engine.

## X ingestion and limits

Add an X username/profile URL in a creator's details, or select X when adding a creator. Enable **Posts**, then refresh. All authored X content is classified as **Posts** in the content-type filter, including photos and videos. Unchecking Posts pauses that source. Existing notes, read state and saved posts survive refresh. Removing an account stops new imports; existing items remain until the creator is unfollowed.

Without a key, the adapter fetches X's own public syndication timeline server-side. **This is a limited snapshot, not a reliable recent timeline**: X may return popular/older posts and omit recent ones. The live Dolubatarya check returned 100 posts whose newest date was November 2025. The UI reports this coverage warning. No cookies, guest-token workaround or platform login is used. The endpoint is undocumented and can change, be unavailable, or throttle requests. Failed sources report errors independently so YouTube can continue syncing.

For recent posts, set `SOCIALDATA_API_KEY` to an API key from [SocialData](https://socialdata.tools), a paid third-party X data service, then restart the server. It takes precedence over `X_BEARER_TOKEN`. SocialData bills $0.0002 per post returned from a prepaid balance; OpenFeed does not create the account or top it up. The key stays server-side. How refreshes work in this mode:

- **Batched searches.** All of an OpenFeed account's X sources share `(from:a OR from:b …) -filter:replies since_time:…` searches, up to 500 characters each (roughly 20–30 usernames). Sources with reposts enabled are batched separately; the others add `-filter:nativeretweets`. A refresh therefore costs one request per batch, not one per creator, and only new posts are billed.
- **Time bound.** Each batch searches from 10 minutes before the oldest last successful refresh in it, never further back than the retention window. Posts at or before a source's stored cursor are dropped. Up to 10 pages (about 200 posts) are read per batch; beyond that a warning says older posts were skipped.
- **Spaced requests.** SocialData calls are at least 20 seconds apart across the whole server (`SOCIALDATA_MIN_INTERVAL_MS` overrides this). SocialData does not bill the first 3 empty responses per minute, so hourly checks that find nothing new are free. A manual refresh may wait a few seconds per batch.
- **New sources.** A source with no cursor yet is searched alone for its 20 newest posts from the retention window. If that finds nothing, one profile lookup reports a missing or private account.
- **Data.** Responses include full long-post text (no later repair needed), MP4 video variants and repost details. SocialData scrapes X and is not affiliated with it; it can change or stop working. An empty balance shows "SocialData balance is empty" on each X source.
- **Fallback when search fails.** If SocialData's search returns a server error or times out, each affected source reads its own timeline instead (`/twitter/user/<id>/tweets`, up to 3 pages, stopping at already-stored posts), but only if its last successful refresh is at least 6 hours old. Otherwise the source shows when the next fallback is due. A timeline page is billed per post, including posts already stored (about $0.004 a page), so this costs more than search: roughly $10 a month for 20 accounts if search stayed down all month. The numeric X user id is looked up once and saved on the account. Billing and key errors do not fall back.
- **Unchanged:** if the same username is followed by several OpenFeed accounts, each account searches it separately.

Alternatively, set `X_BEARER_TOKEN` in the server environment to an app-only bearer token from your X developer account, then restart the server. This selects the official X API for every X source. API access and usage may incur charges under your X plan; OpenFeed does not obtain a token or subscribe for you. The token stays server-side, never in the browser or database. The adapter checks the profile's protected flag and imports up to 30 posts and reposts per refresh, excluding replies at the API. After the first successful API refresh, a persisted `since_id` cursor requests only newer items. If more than 30 arrive, older excess items are deliberately skipped and a coverage warning appears; there is no paid pagination/backfill. It does not paginate/backfill a complete archive or bypass access restrictions. Authentication/rate-limit failures are surfaced without silently switching to stale snapshots. See [X user posts documentation](https://docs.x.com/x-api/users/get-posts).

All modes accept posts and reposts from the approved account and exclude replies. Reposted text is shown as returned by X and labeled Repost; original-post media/details are not separately fetched, avoiding extra API reads. Embedded quoted-account media are excluded. Protected accounts are rejected. Photos load from X's image servers. MP4 videos stream through a local OpenFeed proxy because X's video CDN rejects localhost referrers. The proxy accepts only stored X video URLs on video.twimg.com, forwards byte ranges for seeking, and sends no browser referrer, cookies or credentials; playback does not call the paid X API. No X timeline widget or recommendations are loaded. Multiple videos have a selector; GIFs loop on user playback. Keyboard seeking, play/pause, notes and timestamps work with native video. Caption tracks generally aren't exposed by X; C reports this when unavailable. Poll voting, cards, quoted-post details and interactions require Open source. Public-page long posts can be truncated by X.

## Instagram ingestion and setup

Add an Instagram username/profile URL to an existing creator, or choose Instagram when creating a profile. Select Posts (photos and albums), Videos, and/or Shorts (Reels). Empty selection pauses fetching. Captions, multi-image albums, carousel video attachments, native video playback and notes use the same feed/viewer as other platforms. Only approved profiles are fetched; Stories, comments, tagged-profile feeds and private accounts are not supported.

The no-key importer reads Instagram's public profile embed without cookies or login. It usually exposes only six recent posts; it does not paginate or backfill. Individual public post embeds supplement video URLs and Reel classification. Collaboration video details may belong to another original author, but enrichment requires an exact shortcode already listed on the approved public profile; private media and unrelated shortcodes are rejected. The item stays associated with the approved creator. Refresh existing Instagram items after updating to populate missing video URLs. The live Dolubatarya check exposed six recent posts, including two albums and a video, with the newest dated October 3, 2026. **Instagram can block requests, require sign-in, or disable embeds.** Blocked profiles show a source error instead of a successful empty refresh. This parser is best effort, not a guarantee of tracking every public post. Parsing never executes Instagram's scripts.

Instagram's image and video links are signed and stop working after a few days (videos sooner than images). Refresh only renews links for the posts still in the profile preview, so older posts, including saved and noted ones, would show broken media. When you open an Instagram post whose links expire within 12 hours, OpenFeed re-reads that post's public embed and stores fresh links. Feed thumbnails of older posts that have not been opened can still appear broken until you open them. Posts that were deleted or made private on Instagram cannot be renewed.

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

## Languages

The interface is available in English and Turkish (Türkçe). On the first visit OpenFeed uses the first browser language it supports (for example `tr-TR` selects Turkish); any other browser language falls back to English. Change the language with the **Language** selector in the sidebar or at the bottom of the login form. The choice is saved in this browser (`localStorage`, key `openfeed.locale`), so it applies before you log in and is not synced to other devices. Dates, relative times, playback-error text and the YouTube player's own controls follow the chosen language.

Messages from the server (sign-in and validation errors, sync warnings and source errors shown on creators, playlist warnings) are translated too. Some text stays in English: details quoted from another service inside such a message (for example an upstream API's own error text), unexpected internal errors, warnings stored before this change until the source next syncs, creator names, topics and post content, and the offline page.

When a login fails because no account has that username, OpenFeed says so and offers to create an account with it; a wrong password for an existing account has its own message.

To add a language, copy `src/locales/en.ts` and the `src/locales/notices-tr/` folder (server messages; English templates are in `src/notices/`), translate every value (keep the `{placeholder}` names), and register them in `dictionaries`, `noticeDictionaries` and `localeNames` in `src/i18n.ts`. `tests/i18n.test.ts` fails if a key or placeholder is missing.

## Structure

- `src/main.tsx`: feed, creator management, saved posts, filtering
- `src/ContentViewer.tsx`: interactive content viewer and keyboard controls
- `src/Notes.tsx`: autosaved notes and timestamp navigation
- `src/i18n.ts`, `src/locales/`: translations and language detection; `src/LocaleProvider.tsx` holds the React context and language selector
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

### LinkedIn

Add LinkedIn as a source, or add it to an existing creator under **Other accounts**, using the profile name or an HTTPS `linkedin.com/in/…` URL (country subdomains such as `tr.linkedin.com` are accepted). Only personal profiles are supported, not company pages. LinkedIn has no API for reading other members' posts, so OpenFeed reads two public, logged-out pages and nothing else: no sign-in, cookies or API key are used.

- **Posts:** the profile page lists about 5 recent posts in its search-engine metadata (schema.org JSON-LD), with full text and exact publication times. It may not include every recent post, and reposts and comments never appear. Hourly refresh can miss posts if someone publishes more than about 5 between refreshes.
- **Media:** for each new post, OpenFeed reads the post's public embed page (`/embed/feed/update/urn:li:activity:<id>`) once to get photos, article previews, and the MP4 video with its poster. These LinkedIn CDN links do not expire, so a post is not fetched again after its media is stored. If the embed fails, the post is kept without media and the next refresh tries again. Posts already older than the retention window are skipped, since they would be discarded anyway.
- **Limits:** LinkedIn can refuse requests (HTTP 999), show a sign-in wall, or stop showing posts to logged-out visitors at any time, especially for cloud servers that send many requests. These responses appear as source errors and existing posts are kept. A missing profile also returns HTTP 999, so OpenFeed cannot tell it apart from a refusal. LinkedIn's User Agreement forbids automated access; this importer reads only public pages and does not bypass sign-in or bot checks.

### Patreon

Add a Patreon creator directly, or add the creator's Patreon name or profile URL (`patreon.com/name` or `patreon.com/cw/name`) to an existing creator, then refresh. OpenFeed resolves the creator's campaign and imports posts from the last retention window (7 days by default) on each manual or hourly refresh. **Unread Patreon posts are kept until you read them**, so falling behind never loses posts; once read, they follow the normal retention rules (saved and noted posts are kept).

Patreon has no official API for reading a creator's posts. OpenFeed reads the same JSON the Patreon website uses. Member-only posts require your browser session:

- `PATREON_SESSION_ID`: the `session_id` cookie value from a browser signed in to Patreon (Developer Tools → Application/Storage → Cookies → `www.patreon.com`).
- `PATREON_OPENFEED_USER`: your OpenFeed username. The session is used **only** for this account; other accounts on the same server see public previews, where member posts appear locked with an Open on Patreon link.

Restart the server after setting them. The cookie stays server-side and is never stored in the database or sent to the browser. It expires when Patreon ends the session (for example after logging out); the creator then shows "Patreon session expired…", and you replace the value and restart. Treat it like a password.

Post text keeps headings, bold/underline/italic, links, lists, quotes and inline images (rendered without executing Patreon HTML). YouTube video posts play in the viewer. Patreon-hosted video/audio, polls, attachments and comments require **Open source**. Patreon image links are signed and expire after about two weeks; opening a post renews them, though card thumbnails of older unread posts may break until then. Patreon is behind Cloudflare and may block requests from datacenter IPs; a block appears as a source error and keeps existing posts.

#### Phone sync (iOS Shortcut)

Patreon blocks most datacenter IPs, including typical cloud servers, even with a valid session. In that case let your phone fetch Patreon and upload the result: the phone uses its own network and Patreon session, and the server never needs `PATREON_SESSION_ID`.

1. In OpenFeed, open the creator → Other accounts → Patreon → **Phone sync setup**. If the server cannot reach Patreon, the panel asks for the creator's campaign ID once: choose **Open Patreon lookup**, copy the number after `"id":` (for example `6460488`), and save it. Then choose **Create phone token** and copy the three values (the token is shown once; creating a new one revokes the old).
2. In the Shortcuts app create a shortcut named `OpenFeed Patreon` with two **Get Contents of URL** actions:
   - **Fetch:** URL = _Patreon URL_; Method `GET`; Header `Cookie` = `session_id=<your Patreon session_id>`.
   - **Upload:** URL = _OpenFeed upload URL_; Method `POST`; Header `Authorization` = the _Authorization header value_; Request Body `File`, set to the first action's **Contents of URL**.
   - Run it once with a **Show Result** action at the end: `{"ok":true,"added":…,"updated":…}` means it worked. Remove that action afterwards.
3. Automation tab → **New Automation → Time of Day** (Repeat Daily, **Run Immediately**, notifications off) → `OpenFeed Patreon`. Add one automation per time you want, for example every 2–3 hours; iOS has no hourly trigger.

Each run downloads about 0.7 MB (the latest 50 posts, roughly 12 days), imports new posts from the retention window and renews text and signed images of existing ones. After the first upload the server stops fetching that Patreon account itself. Upload problems (a blocked phone request, an expired session) appear as the creator's source error. The token can only upload Patreon pages for creators you follow in your own account; posts must belong to that creator's campaign and are re-parsed and sanitized by the server.

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

**Links** imports individual YouTube, X, Instagram, TikTok and LinkedIn content URLs without following their creators. LinkedIn post links (`/posts/…-activity-<id>-…` or `/feed/update/urn:li:activity:<id>`) are read from the public embed page; their date comes from the post ID, which encodes the exact publication time. TikTok short links are resolved only through TikTok-owned hosts. Imported links and playlist items never expire under feed retention, and do not appear in the recent feed unless a followed creator also supplies them. Saved and noted library items remain available in those sidebar sections. Platform access and embedding restrictions still apply; no login walls or private content are bypassed.

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

### Push notifications (Desktop & Mobile PWA)

Enable **Notifications** in the sidebar to receive one summary push notification per hourly background refresh on that device when unmuted creators publish new content. Multiple new items are grouped by creator topic and open directly into OpenFeed (or the matching topic) when tapped. Newly followed sources skip notifications on their first backfill sync, and manual refreshes do not trigger push notifications.

- **Per-device toggle:** notifications are enabled or disabled independently on each browser or installed PWA. Logging out unsubscribes that browser automatically.
- **Per-creator mute:** mute or unmute individual creators from their card on the **Creators** page or inside **Manage creator**.
- **iPhone / iPad:** iOS supports Web Push only for installed Home Screen web apps (Safari → Share → **Add to Home Screen**).
- **VAPID keys:** OpenFeed generates and persists its own VAPID keys automatically in SQLite (`app_settings`), so no external push service or configuration is required. You may optionally supply `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `.env`.

YouTube playlist imports resolve precise publication timestamps from each video's
public watch-page metadata instead of sorting rounded “months ago” estimates.
Existing playlists are corrected on their next manual or hourly refresh. Exact
stored dates are reused, and at most three date lookups run concurrently. Creator
refreshes also resolve missing/approximate video dates for retained content. If
YouTube withholds a video's precise date, the playlist shows a warning and retries
on the next refresh rather than inventing a chronological position.
