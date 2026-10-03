# OpenFeed

A calm, personal feed for the creators you choose. Built from scratch with React, TypeScript, Vite, Express, and SQLite.

## Run

Requires **Node.js 24+** and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The server listens on loopback only. No API key, account, or YouTube sign-in is required.

```sh
npm test
npm run build
npm start
```

`npm start` serves the production build. Set `PORT` to change the default port. Run commands from the repository root. The SQLite database is stored in `data/openfeed.db`, ignored by Git. Back up the entire `data/` directory while the server is stopped.

## What works

- Follow a public YouTube channel by @handle, channel ID, or channel URL.
- Rename creator profiles, assign multiple comma-separated topics, and store their Instagram, X, TikTok, and Patreon accounts alongside YouTube. Those platforms are metadata only in this phase.
- Mix videos, Shorts, and creator-authored community posts in one feed, including multi-image albums.
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
- `tests/youtube.test.ts`: channel validation, page parsing, source isolation

The sample channels @dolubatarya and @yatirim101 were used for live validation. Local test data is not committed.
