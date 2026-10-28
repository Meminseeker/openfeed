import type { Post } from "../src/types.ts";

export const snapshotWarning =
  "X supplies a limited public snapshot, often with older posts; recent posts and a complete timeline are not guaranteed.";
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
      throw new Error("Use an X username or an https://x.com profile URL.");
    value = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  }
  value = value.replace(/^@/, "");
  if (
    !/^[a-zA-Z0-9_]{1,15}$/.test(value) ||
    ["home", "search", "explore", "settings", "i"].includes(value.toLowerCase())
  )
    throw new Error(
      "Enter a valid X username (up to 15 letters, numbers or underscores).",
    );
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
export function parseXTimeline(
  html: string,
  username: string,
  creatorId: string,
  includeReposts = false,
) {
  const match = html.match(
    /<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match)
    throw new Error(
      "X's public timeline is unavailable. Try again later or open the profile on X.",
    );
  let page: any;
  try {
    page = JSON.parse(match[1]).props.pageProps;
  } catch {
    throw new Error("X changed its public timeline format.");
  }
  const entries = page?.timeline?.entries;
  if (!Array.isArray(entries))
    throw new Error(
      "X did not expose this profile's public posts. Private accounts are not supported.",
    );
  const posts = new Map<string, Post>();
  let author: any;
  for (const entry of entries) {
    if (entry.type !== "tweet") continue;
    const t = entry.content?.tweet;
    if (!t || t.user?.screen_name?.toLowerCase() !== username.toLowerCase())
      continue;
    if (t.user.protected)
      throw new Error("Private X accounts are not supported.");
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
    warning: snapshotWarning,
  };
}
export async function syncX(
  input: string,
  creatorId: string,
  sinceId?: string,
  includeReposts = true,
) {
  const username = xUsername(input);
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
    throw new Error(
      `X public timeline unavailable (HTTP ${response.status}). Try again later.`,
    );
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
    if (!response.ok)
      throw new Error(
        `X API request failed (HTTP ${response.status}). Check the bearer token, API access and usage limits.`,
      );
    const json = (await response.json()) as any;
    if (json.errors?.length)
      throw new Error(
        "X API returned incomplete data. Check account availability and API access.",
      );
    return json;
  }
  const profile = (
    await get(
      `users/by/username/${username}?user.fields=protected,profile_image_url`,
    )
  ).data;
  if (!profile?.id || !/^\d+$/.test(profile.id))
    throw new Error("X account was not found.");
  if (profile.protected !== false)
    throw new Error("Private X accounts are not supported.");
  const page = await get(
    `users/${profile.id}/tweets?max_results=30&exclude=${includeReposts ? "replies" : "replies,retweets"}&tweet.fields=created_at,author_id,attachments,note_post,entities,referenced_tweets&expansions=attachments.media_keys&media.fields=url,preview_image_url,variants,type${sinceId && /^\d+$/.test(sinceId) ? `&since_id=${sinceId}` : ""}`,
  );
  if (!Array.isArray(page.data) && page.meta?.result_count !== 0)
    throw new Error("X API did not return a usable timeline.");
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
    warning: page.meta?.next_token
      ? "X refresh is limited to 30 new posts/reposts. Older excess items were skipped to keep costs and volume down."
      : undefined,
  };
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
    post.repost ||
    post.textExpanded ||
    (!post.textTruncated && (post.text?.length || 0) < 200)
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
      }
    : { ...post, textTruncated: true };
}
