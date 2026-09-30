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
- Mix videos, Shorts, and creator-authored community posts in one feed.
- Combine topic, creator, content-type, text-search, and unread filters.
- Save posts for later, mark individual posts or the current filtered result as read, and unfollow creators.
- Persistent local state, explicit refresh, partial-source error reporting, responsive layout, and finite batches of 24 posts. New creators trigger a refresh.

## YouTube ingestion and limits

Uploads come from YouTube's public channel RSS feed (roughly the latest 15 uploads). The public Videos, Shorts, and Posts tabs supplement it, and the Shorts tab classifies matching RSS entries. Only the selected channel tab is inspected; community authors must match the followed channel ID. This prevents viewer posts and sidebar recommendations from entering the feed.

Public-page parsing is best effort and can break when YouTube changes its markup, requires consent, or throttles requests. No private or members-only access is attempted. Refresh failures appear in creator details and the feed. An unavailable optional tab does not discard RSS uploads. A successfully loaded empty tab can mean the channel has no posts.

This is **recent-content tracking, not a complete historical archive**: the first public page is fetched without continuation pagination. Shorts outside RSS often have no publish date; these appear after dated posts with “Date unavailable.” Videos outside RSS and community dates are approximate, derived from YouTube's relative timestamps. Different content types may therefore have imperfect chronological ordering. Short classification outside the first Shorts page may be incomplete. Community attachments currently display a single image; polls, albums, and attached-video playback are not fully rendered. Click through for the complete original content.

All playback opens YouTube in a new tab; YouTube can display its own ads and recommendations there. OpenFeed adds neither. Thumbnail and avatar requests still contact YouTube's image servers. Fonts are bundled locally; there are no analytics, recommendation engines, or auto-playing embeds.

The app is designed for **one person on their own machine**. It has no login or multi-user isolation. Do not expose it publicly without adding authentication, TLS, and deployment hardening. The API rejects cross-origin browser requests.

## Structure

- `src/main.tsx`: feed, creator management, saved posts, filtering
- `src/style.css`: responsive interface
- `src/types.ts`: platform-neutral creator and post models
- `server/index.ts`: local HTTP API and SQLite persistence
- `server/youtube.ts`: public YouTube adapter
- `tests/youtube.test.ts`: channel validation, page parsing, source isolation

The sample channels @dolubatarya and @yatirim101 were used for live validation. Local test data is not committed.
