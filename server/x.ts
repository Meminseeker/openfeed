import type { Post } from "../src/types.ts";
import {
  notice,
  noticesText,
  userError,
  type Notice,
} from "../src/notices/index.ts";

const snapshotNotices: Notice[] = [notice("x.snapshotLimited")];
export const snapshotWarning = noticesText(snapshotNotices);
export function xUsername(input: string): string {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
        url.hostname,
      ) ||
      url.username ||
      url.password ||
      url.port
    )
      throw userError("x.invalidProfileUrl");
    value = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  }
  value = value.replace(/^@/, "");
  if (
    !/^[a-zA-Z0-9_]{1,15}$/.test(value) ||
    ["home", "search", "explore", "settings", "i"].includes(value.toLowerCase())
  )
    throw userError("x.invalidUsername");
  return value;
}
function mediaUrl(value: unknown, host: string): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === host &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {}
}
// A warning as English text plus the notices it was built from; an empty
// list clears both.
function warningFields(notices: Notice[]) {
  return notices.length
    ? { warning: noticesText(notices), warningNotices: notices }
    : { warning: undefined, warningNotices: undefined };
}
export function parseXTimeline(
  html: string,
  username: string,
  creatorId: string,
  includeReposts = false,
) {
  const match = html.match(
    /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) throw userError("x.timelineUnavailable");
  let page: any;
  try {
    page = JSON.parse(match[1]).props.pageProps;
  } catch {
    throw userError("x.timelineFormatChanged");
  }
  const entries = page?.timeline?.entries;
  if (!Array.isArray(entries)) throw userError("x.timelineHidden");
  const posts = new Map<string, Post>();
  let author: any;
  for (const entry of entries) {
    if (entry.type !== "tweet") continue;
    const t = entry.content?.tweet;
    if (!t || t.user?.screen_name?.toLowerCase() !== username.toLowerCase())
      continue;
    if (t.user.protected) throw userError("x.privateAccount");
    author = t.user;
    if (t.in_reply_to_status_id_str || t.in_reply_to_status_id) continue;
    const repost = !!(
      t.retweeted_status ||
      t.retweeted_status_id_str ||
      /^RT @/.test(t.full_text || t.text || "")
    );
    if (
      !includeReposts &&
      (t.retweeted_status ||
        t.retweeted_status_id_str ||
        /^RT @/.test(t.full_text || t.text || ""))
    )
      continue;
    if (!/^\d+$/.test(t.id_str || "")) continue;
    const date = new Date(t.created_at);
    if (!Number.isFinite(date.getTime())) continue;
    const media = t.extended_entities?.media || t.entities?.media || [];
    const images: string[] = [],
      videos: NonNullable<Post["videos"]> = [];
    for (const m of media) {
      const image = mediaUrl(m.media_url_https, "pbs.twimg.com");
      if (m.type === "photo" && image) images.push(image);
      if (["video", "animated_gif"].includes(m.type)) {
        const variants = (m.video_info?.variants || [])
          .filter(
            (v: any) =>
              v.content_type === "video/mp4" &&
              mediaUrl(v.url, "video.twimg.com"),
          )
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
        if (variants[0])
          videos.push({
            url: variants[0].url,
            poster: image,
            loop: m.type === "animated_gif",
          });
      }
    }
    let text: string =
      t.note_tweet?.note_tweet_results?.result?.text ||
      t.note_tweet?.text ||
      t.extended_tweet?.full_text ||
      t.full_text ||
      t.text ||
      "";
    for (const m of media) if (m.url) text = text.replaceAll(m.url, "");
    for (const link of t.entities?.urls || [])
      if (link.url && typeof link.expanded_url === "string")
        text = text.replaceAll(link.url, link.expanded_url);
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    const id = `x:${t.id_str}`;
    posts.set(id, {
      id,
      creatorId,
      platform: "x",
      repost,
      sourceUsername: username,
      title: text.split("\n")[0]?.slice(0, 160) || "X post",
      text,
      textTruncated: !!(
        t.truncated ||
        (t.note_tweet &&
          !t.note_tweet?.note_tweet_results?.result?.text &&
          !t.note_tweet?.text) ||
        /(?:…|\.\.\.)$/.test(text)
      ),
      images,
      image: images[0] || videos[0]?.poster,
      videos,
      url: `https://x.com/${username}/status/${t.id_str}`,
      kind: "post",
      published: date.toISOString(),
      read: false,
      saved: false,
    });
  }
  return {
    posts: [...posts.values()],
    name: author?.name || username,
    avatar: mediaUrl(author?.profile_image_url_https, "pbs.twimg.com") || "",
    warning: snapshotWarning as string | undefined,
    warningNotices: snapshotNotices as Notice[] | undefined,
  };
}
export async function syncX(
  input: string,
  creatorId: string,
  sinceId?: string,
  includeReposts = true,
) {
  const username = xUsername(input);
  if (socialDataEnabled()) {
    const result = (
      await syncXSources([{ username, sinceId, includeReposts }])
    ).get(xSourceKey(username, includeReposts));
    if (!result || result instanceof Error)
      throw result || userError("x.refreshFailed");
    return {
      ...result,
      posts: result.posts.map((p) => ({ ...p, creatorId })),
    };
  }
  if (process.env.X_BEARER_TOKEN)
    return syncOfficialX(
      username,
      creatorId,
      process.env.X_BEARER_TOKEN,
      sinceId,
      includeReposts,
    );
  const response = await fetch(
    `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`,
    {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw userError("x.publicTimelineHttp", { status: response.status });
  return parseXTimeline(
    await response.text(),
    username,
    creatorId,
    includeReposts,
  );
}

// App-only official API access still excludes protected profiles.
async function syncOfficialX(
  username: string,
  creatorId: string,
  token: string,
  sinceId?: string,
  includeReposts = true,
) {
  async function get(path: string) {
    const response = await fetch(`https://api.x.com/2/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw userError("x.apiHttp", { status: response.status });
    const json = (await response.json()) as any;
    if (json.errors?.length) throw userError("x.apiIncomplete");
    return json;
  }
  const profile = (
    await get(
      `users/by/username/${username}?user.fields=protected,profile_image_url`,
    )
  ).data;
  if (!profile?.id || !/^\d+$/.test(profile.id))
    throw userError("x.accountNotFound");
  if (profile.protected !== false) throw userError("x.privateAccount");
  const page = await get(
    `users/${profile.id}/tweets?max_results=30&exclude=${includeReposts ? "replies" : "replies,retweets"}&tweet.fields=created_at,author_id,attachments,note_post,entities,referenced_tweets&expansions=attachments.media_keys&media.fields=url,preview_image_url,variants,type${sinceId && /^\d+$/.test(sinceId) ? `&since_id=${sinceId}` : ""}`,
  );
  if (!Array.isArray(page.data) && page.meta?.result_count !== 0)
    throw userError("x.apiNoTimeline");
  const media = new Map(
    (page.includes?.media || []).map((m: any) => [m.media_key, m]),
  );
  const entries = (page.data || [])
    .filter(
      (t: any) =>
        t.author_id === profile.id &&
        !(t.referenced_tweets || []).some((r: any) => r.type === "replied_to"),
    )
    .map((t: any) => ({
      type: "tweet",
      content: {
        tweet: {
          id_str: t.id,
          retweeted_status_id_str: (t.referenced_tweets || []).find(
            (r: any) => r.type === "retweeted",
          )?.id,
          created_at: t.created_at,
          full_text: t.note_post?.text || t.text,
          entities: t.note_post?.entities || t.entities,
          user: {
            screen_name: username,
            protected: false,
            name: profile.name,
            profile_image_url_https: profile.profile_image_url,
          },
          extended_entities: {
            media: (t.attachments?.media_keys || []).map((key: string) => {
              const m = media.get(key) as any;
              return m
                ? {
                    type: m.type,
                    media_url_https: m.url || m.preview_image_url,
                    video_info: { variants: m.variants },
                  }
                : {};
            }),
          },
        },
      },
    }));
  const result = parseXTimeline(
    `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { timeline: { entries } } } }).replaceAll("<", "\\u003c")}</script>`,
    username,
    creatorId,
    includeReposts,
  );
  const ids = (page.data || [])
    .map((t: any) => t.id)
    .filter((id: any) => typeof id === "string" && /^\d+$/.test(id));
  const newestId = ids.reduce(
    (latest: string | undefined, id: string) =>
      !latest || BigInt(id) > BigInt(latest) ? id : latest,
    sinceId,
  );
  return {
    newestId,
    ...result,
    name: profile.name || username,
    avatar: mediaUrl(profile.profile_image_url, "pbs.twimg.com") || "",
    ...warningFields(page.meta?.next_token ? [notice("x.apiLimited")] : []),
  };
}

// SocialData (socialdata.tools) is a paid third-party X data service. Several
// accounts share one `(from:a OR from:b)` search, bounded by `since_time`, so a
// refresh costs one request per batch instead of one per account.
export function socialDataEnabled() {
  return !!process.env.SOCIALDATA_API_KEY?.trim();
}
export type XSource = {
  username: string;
  sinceId?: string;
  // Last successful refresh (ISO); bounds the next search.
  checkedAt?: string;
  includeReposts: boolean;
  // Cached numeric X user id, needed only by the timeline fallback.
  userId?: string;
};
export type XSyncResult = Omit<
  ReturnType<typeof parseXTimeline>,
  "warning" | "warningNotices"
> & {
  warning?: string;
  warningNotices?: Notice[];
  newestId?: string;
  userId?: string;
};
export const xSourceKey = (username: string, includeReposts: boolean) =>
  `${username.toLowerCase()}|${includeReposts ? "reposts" : "posts"}`;

const socialDataQueryLimit = 500;
const socialDataMaxPages = 10;
// Re-read posts from shortly before the last refresh, in case search indexing lagged.
const socialDataOverlapMs = 10 * 60 * 1000;
let socialDataNextSlot = 0;
// When search fails, each account's own timeline is read instead, but at most
// once per this interval: timeline pages are billed per post, even old ones.
const socialDataFallbackMs = 6 * 60 * 60 * 1000;
const socialDataFallbackPages = 3;

// Requests are spaced (20 s by default, so at most 3 per minute). SocialData
// does not bill the first 3 empty responses per minute, so quiet hourly checks
// stay free.
// Timeline pages are rarely empty, so they skip the spacing.
async function socialData(path: string, spaced = true): Promise<any> {
  if (spaced) {
    const gap = Number(process.env.SOCIALDATA_MIN_INTERVAL_MS ?? 20000);
    const interval = Number.isFinite(gap) && gap >= 0 ? gap : 20000;
    const now = Date.now();
    const slot = Math.max(now, socialDataNextSlot);
    socialDataNextSlot = slot + interval;
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
  }
  const response = await fetch(`https://api.socialdata.tools${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.SOCIALDATA_API_KEY?.trim()}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (response.status === 404) return null;
  if (response.status === 402) throw userError("x.socialDataBalance");
  if (response.status === 401 || response.status === 403)
    throw userError("x.socialDataKey");
  if (!response.ok)
    throw Object.assign(
      userError("x.socialDataHttp", { status: response.status }),
      { status: response.status },
    );
  return response.json();
}
// Upstream failures (5xx, timeouts, network) can be worked around; billing and
// key errors cannot.
function socialDataOutage(error: unknown) {
  const status = (error as { status?: number })?.status;
  if (status !== undefined) return status >= 500;
  const name = (error as { name?: string })?.name;
  return (
    name === "TypeError" || name === "TimeoutError" || name === "AbortError"
  );
}

// X ids are snowflakes: the top bits are milliseconds since 2010-11-04.
function snowflakeTime(id?: string) {
  if (!id || !/^\d+$/.test(id)) return;
  return Number(BigInt(id) >> 22n) + 1288834974657;
}

async function searchSocialData(query: string, maxPages: number) {
  const tweets: any[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const json = await socialData(
      `/twitter/search?type=Latest&query=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    const batch = Array.isArray(json?.tweets) ? json.tweets : [];
    tweets.push(...batch);
    cursor = typeof json?.next_cursor === "string" ? json.next_cursor : "";
    if (!batch.length || !cursor) return { tweets, complete: true };
  }
  return { tweets, complete: false };
}

function socialDataResult(
  tweets: any[],
  source: XSource,
  complete: boolean,
): XSyncResult {
  const since =
    source.sinceId && /^\d+$/.test(source.sinceId)
      ? BigInt(source.sinceId)
      : 0n;
  const own = tweets.filter(
    (t) =>
      t?.user?.screen_name?.toLowerCase() === source.username.toLowerCase() &&
      /^\d+$/.test(t.id_str || "") &&
      BigInt(t.id_str) > since,
  );
  const entries = own.map((t) => ({
    type: "tweet",
    content: {
      tweet: { ...t, created_at: t.tweet_created_at ?? t.created_at },
    },
  }));
  const result = parseXTimeline(
    `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { timeline: { entries } } } }).replaceAll("<", "\\u003c")}</script>`,
    source.username,
    "",
    source.includeReposts,
  );
  const newestId = own.reduce(
    (latest: string | undefined, t: any) =>
      !latest || BigInt(t.id_str) > BigInt(latest) ? t.id_str : latest,
    source.sinceId,
  );
  return {
    ...result,
    // SocialData returns the full text of long posts; skip the lazy repair.
    posts: result.posts.map((p) =>
      p.textTruncated ? p : { ...p, textExpanded: true, textVersion: 2 },
    ),
    newestId,
    ...warningFields(complete ? [] : [notice("x.socialDataSkipped")]),
  };
}

// Reads one account's own timeline when search is failing. Runs only when the
// account's last successful refresh is at least 6 hours old.
async function socialDataFallback(
  source: XSource,
  searchError: unknown,
  now: number,
): Promise<XSyncResult | Error> {
  if (!socialDataOutage(searchError)) return searchError as Error;
  const last = Date.parse(source.checkedAt || "");
  if (Number.isFinite(last) && now - last < socialDataFallbackMs)
    return userError("x.socialDataFallbackWait", {
      time: new Date(last + socialDataFallbackMs).toISOString().slice(11, 16),
    });
  try {
    let userId = source.userId;
    if (!userId || !/^\d+$/.test(userId)) {
      const user = await socialData(`/twitter/user/${source.username}`, false);
      if (!user) throw userError("x.accountNotFound");
      if (user.protected) throw userError("x.privateAccount");
      userId = String(user.id_str || "");
      if (!/^\d+$/.test(userId)) throw userError("x.socialDataNoUserId");
    }
    const since =
      source.sinceId && /^\d+$/.test(source.sinceId)
        ? BigInt(source.sinceId)
        : undefined;
    const tweets: any[] = [];
    let cursor = "";
    let complete = false;
    for (let page = 0; page < socialDataFallbackPages; page++) {
      const json = await socialData(
        `/twitter/user/${userId}/tweets${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        false,
      );
      const batch = Array.isArray(json?.tweets) ? json.tweets : [];
      tweets.push(...batch);
      cursor = typeof json?.next_cursor === "string" ? json.next_cursor : "";
      // Stop once the page reaches posts already stored (pinned posts aside).
      const reachedKnown =
        since === undefined ||
        batch.some(
          (t: any) =>
            !t.is_pinned &&
            /^\d+$/.test(t.id_str || "") &&
            BigInt(t.id_str) <= since,
        );
      if (!batch.length || !cursor || reachedKnown) {
        complete = true;
        break;
      }
    }
    const result = socialDataResult(tweets, source, complete);
    return {
      ...result,
      userId,
      ...warningFields([
        notice("x.socialDataFallbackUsed"),
        ...(result.warningNotices || []),
      ]),
    };
  } catch (error) {
    return error as Error;
  }
}

// Fetches every source with as few searches as possible. Returns a result or an
// Error per xSourceKey, so one failing batch never affects another.
export async function syncXSources(
  sources: XSource[],
  now = Date.now(),
  retentionDays = 7,
): Promise<Map<string, XSyncResult | Error>> {
  const results = new Map<string, XSyncResult | Error>();
  const floor = now - retentionDays * 86400000;
  const unique = new Map<string, XSource & { from: number }>();
  for (const source of sources) {
    let username: string;
    try {
      username = xUsername(source.username);
    } catch (error) {
      results.set(
        xSourceKey(source.username, source.includeReposts),
        error as Error,
      );
      continue;
    }
    const key = xSourceKey(username, source.includeReposts);
    if (unique.has(key)) continue;
    const last = Date.parse(source.checkedAt || "");
    const checked = Number.isFinite(last)
      ? last
      : snowflakeTime(source.sinceId);
    unique.set(key, {
      ...source,
      username,
      from: Math.max(floor, (checked ?? floor) - socialDataOverlapMs),
    });
  }
  const suffix = (includeReposts: boolean, from: number) =>
    ` -filter:replies${includeReposts ? "" : " -filter:nativeretweets"} since_time:${Math.floor(from / 1000)}`;

  // Never-synced accounts (no cursor yet) are searched alone, one page, so a
  // wrong or private username is reported instead of silently returning nothing.
  for (const [key, source] of unique) {
    if (source.sinceId) continue;
    unique.delete(key);
    try {
      const { tweets } = await searchSocialData(
        `from:${source.username}${suffix(source.includeReposts, floor)}`,
        1,
      );
      if (!tweets.length) {
        const user = await socialData(`/twitter/user/${source.username}`);
        if (!user) throw userError("x.accountNotFound");
        if (user.protected) throw userError("x.privateAccount");
      }
      results.set(key, socialDataResult(tweets, source, true));
    } catch (error) {
      results.set(key, await socialDataFallback(source, error, now));
    }
  }

  // Group the rest into OR queries under the length limit. Sorting by start
  // time keeps accounts checked at similar times together, so a batch rarely
  // re-reads much from accounts that were checked more recently.
  for (const includeReposts of [false, true]) {
    const pending = [...unique.entries()]
      .filter(([, s]) => s.includeReposts === includeReposts)
      .sort(([, a], [, b]) => a.from - b.from);
    while (pending.length) {
      const batch = [pending.shift()!];
      const query = () =>
        `(${batch.map(([, s]) => `from:${s.username}`).join(" OR ")})${suffix(includeReposts, batch[0][1].from)}`;
      while (pending.length) {
        batch.push(pending[0]);
        if (query().length > socialDataQueryLimit) {
          batch.pop();
          break;
        }
        pending.shift();
      }
      try {
        const { tweets, complete } = await searchSocialData(
          query(),
          socialDataMaxPages,
        );
        for (const [key, source] of batch) {
          try {
            results.set(key, socialDataResult(tweets, source, complete));
          } catch (error) {
            results.set(key, error as Error);
          }
        }
      } catch (error) {
        for (const [key, source] of batch)
          results.set(key, await socialDataFallback(source, error, now));
      }
    }
  }
  return results;
}

function decodeText(text: string) {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, entity: string) => {
      if (entity.startsWith("#")) {
        const code =
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : Number(entity.slice(1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      }
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<
          string,
          string
        >
      )[entity.toLowerCase()];
    },
  );
}
// Only accept text from the canonical page for this exact stored post.
export function parseXPostText(html: string, post: Pick<Post, "url" | "text">) {
  const canonical = html.match(
    /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
  )?.[1];
  if (!canonical || decodeText(canonical) !== post.url) return;
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (!heading) return;
  const text = decodeText(
    heading.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, ""),
  );
  const full = text.match(/ on X: "([\s\S]*)"$/)?.[1];
  if (
    !full ||
    /(?:…|\.\.\.)$/.test(full.trim()) ||
    full.length < (post.text?.length || 0)
  )
    return;
  return full;
}
const textRequests = new Map<string, { until: number; text?: string }>();
export async function expandXPost(post: Post) {
  if (
    post.platform !== "x" ||
    (post.textExpanded === true && post.textVersion === 2)
  )
    return post;
  if (!/^https:\/\/x\.com\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/.test(post.url))
    return post;
  const cached = textRequests.get(post.id);
  let text = cached && cached.until > Date.now() ? cached.text : undefined;
  if (!cached || cached.until <= Date.now()) {
    try {
      const r = await fetch(post.url, {
        headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) text = parseXPostText(await r.text(), post);
    } catch {}
    try {
      const status = await fetchXStatus(post.url);
      if (
        typeof status.text === "string" &&
        status.text.length >= (text || post.text || "").length
      )
        text = status.text;
    } catch {}
    if (textRequests.size > 500) textRequests.clear();
    textRequests.set(post.id, { until: Date.now() + 300000, text });
  }
  return text
    ? {
        ...post,
        text,
        title: text.split("\n")[0].slice(0, 160),
        textTruncated: false,
        textExpanded: true,
        textVersion: 2,
      }
    : {
        ...post,
        textTruncated:
          post.textTruncated || /(?:…|\.\.\.)$/.test(post.text || ""),
      };
}

// Public fallback: validate the exact status ID; never send cookies or credentials.
export async function fetchXStatus(url: string): Promise<any> {
  const id = new URL(url).pathname.match(/\/status\/(\d+)$/)?.[1];
  if (!id) throw userError("x.invalidPostUrl");
  const r = await fetch(`https://api.fxtwitter.com/status/${id}`, {
    headers: { "User-Agent": "OpenFeed/1.0 (public post reader)" },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!r.ok) throw userError("x.postUnavailable");
  const data = (await r.json()) as any;
  if (
    data.code !== 200 ||
    data.tweet?.id !== id ||
    typeof data.tweet.text !== "string" ||
    data.tweet.author?.protected
  )
    throw userError("x.postNotReturned");
  return data.tweet;
}
