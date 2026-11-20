import type { Post } from "../src/types.ts";

// LinkedIn has no API for reading another member's posts. Logged-out profile
// pages embed schema.org JSON-LD with a few recent posts, and each post has a
// public embed page with its media. Only those two public pages are read.

type UrnType = "activity" | "ugcPost" | "share";
const HTML_HEADERS = { Accept: "text/html", "User-Agent": "Mozilla/5.0" };

const isLinkedInHost = (host: string) =>
  host === "linkedin.com" || host.endsWith(".linkedin.com");

export function linkedinUsername(input: string) {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !isLinkedInHost(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("Use a LinkedIn profile name or HTTPS profile URL.");
    if (/^\/(company|school|showcase)\//.test(url.pathname))
      throw new Error(
        "Only personal LinkedIn profiles (linkedin.com/in/…) are supported.",
      );
    const slug = url.pathname.match(/^\/in\/([^/]+)\/?$/)?.[1];
    if (!slug)
      throw new Error("Use a LinkedIn profile URL, not a post or other page.");
    value = slug;
  }
  try {
    value = normalizeSlug(decodeURIComponent(value));
  } catch {
    throw new Error("Enter a valid LinkedIn profile name.");
  }
  // Validate the stored form: lowercasing can add combining marks (İ → i̇).
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N}_-]{2,99}$/u.test(value))
    throw new Error(
      "Enter a valid LinkedIn profile name (the part after linkedin.com/in/).",
    );
  return value;
}
const normalizeSlug = (value: string) => value.normalize("NFC").toLowerCase();

function profileSlug(url: unknown) {
  if (typeof url !== "string") return;
  try {
    const u = new URL(url);
    const slug = isLinkedInHost(u.hostname)
      ? u.pathname.match(/^\/in\/([^/]+)\/?$/)?.[1]
      : undefined;
    return slug ? normalizeSlug(decodeURIComponent(slug)) : undefined;
  } catch {}
}

// Media must come from LinkedIn's media CDN (not static.licdn.com UI icons).
export function linkedinMedia(value: unknown) {
  if (typeof value !== "string") return;
  try {
    const u = new URL(value);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      ["media.licdn.com", "dms.licdn.com"].includes(u.hostname)
    )
      return u.href;
  } catch {}
}

// Post URLs look like /posts/<slug>_<words>-activity-<id>-<hash> or
// /feed/update/urn:li:activity:<id>. The id is the embed page's key.
export function linkedinPostRef(url: string) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    !isLinkedInHost(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    return;
  let path: string;
  try {
    path = decodeURIComponent(u.pathname);
  } catch {
    return;
  }
  const m =
    path.match(
      /^\/posts\/[^/]*-(activity|ugcPost|share)-(\d{15,22})(?:-[\w-]*)?\/?$/,
    ) ||
    path.match(
      /^\/feed\/update\/urn:li:(activity|ugcPost|share):(\d{15,22})\/?$/,
    );
  if (!m) return;
  return {
    type: m[1] as UrnType,
    id: m[2],
    url: path.startsWith("/posts/")
      ? `https://www.linkedin.com${u.pathname}`
      : `https://www.linkedin.com/feed/update/urn:li:${m[1]}:${m[2]}/`,
  };
}

// LinkedIn ids carry Unix milliseconds in their upper bits.
export function linkedinIdDate(id: string, now = Date.now()) {
  const ms = Number(BigInt(id) >> 22n);
  return ms >= Date.UTC(2010, 0, 1) && ms <= now + 86400000
    ? new Date(ms).toISOString()
    : "";
}

const titleFrom = (text: string, fallback = "LinkedIn post") =>
  text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 160) || fallback;

function jsonLd(html: string) {
  const values: unknown[] = [];
  for (const m of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      values.push(JSON.parse(m[1]));
    } catch {}
  }
  return values;
}

export function parseLinkedInProfile(
  html: string,
  input: string,
  creatorId: string,
  now = Date.now(),
) {
  const username = linkedinUsername(input);
  const posts = new Map<string, Post>();
  let person: any;
  function walk(value: any, depth = 0) {
    if (!value || typeof value !== "object" || depth > 30) return;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, depth + 1);
      return;
    }
    const type = value["@type"];
    // Post authors are bare Person stubs; prefer the profile node with a photo.
    if (
      type === "Person" &&
      profileSlug(value.url) === username &&
      value.name &&
      (!person || (!person.image && value.image))
    )
      person = value;
    if (
      (type === "DiscussionForumPosting" || type === "SocialMediaPosting") &&
      profileSlug(value.author?.url) === username
    ) {
      const link =
        typeof value.url === "string"
          ? value.url
          : typeof value.mainEntityOfPage === "string"
            ? value.mainEntityOfPage
            : value.mainEntityOfPage?.["@id"];
      let ref: ReturnType<typeof linkedinPostRef>;
      try {
        ref = typeof link === "string" ? linkedinPostRef(link) : undefined;
      } catch {}
      if (ref) {
        const text = typeof value.text === "string" ? value.text.trim() : "";
        const date = new Date(value.datePublished);
        const image = linkedinMedia(
          typeof value.image === "string" ? value.image : value.image?.url,
        );
        posts.set(`linkedin:${ref.id}`, {
          id: `linkedin:${ref.id}`,
          creatorId,
          platform: "linkedin",
          sourceUsername: username,
          title: titleFrom(
            text,
            (typeof value.headline === "string" && value.headline.trim()) ||
              "LinkedIn post",
          ),
          text,
          image,
          url: ref.url,
          kind: "post",
          published:
            typeof value.datePublished === "string" &&
            Number.isFinite(date.getTime())
              ? date.toISOString()
              : linkedinIdDate(ref.id, now),
          read: false,
          saved: false,
        });
      }
    }
    for (const child of Object.values(value)) walk(child, depth + 1);
  }
  for (const value of jsonLd(html)) walk(value);
  if (!person && !posts.size)
    throw new Error(
      "LinkedIn did not return a public profile. The profile may be private, hidden from logged-out visitors, or blocked for this server. Existing posts are kept.",
    );
  return {
    posts: [...posts.values()],
    name: typeof person?.name === "string" ? person.name : undefined,
    avatar: linkedinMedia(
      typeof person?.image === "string"
        ? person.image
        : person?.image?.contentUrl,
    ),
    warning:
      "LinkedIn shows logged-out visitors only a few recent posts (usually 5); reposts and comments are not included.",
  };
}

function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39|nbsp);/gi,
    (entity, code: string) => {
      const lower = code.toLowerCase();
      if (lower.startsWith("#x"))
        return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith("#"))
        return String.fromCodePoint(parseInt(lower.slice(1), 10));
      return (
        (
          {
            amp: "&",
            lt: "<",
            gt: ">",
            quot: '"',
            apos: "'",
            nbsp: " ",
          } as Record<string, string>
        )[lower] ?? entity
      );
    },
  );
}
const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decodeEntities(m[1]) : undefined;
};

// Reads one post's embed page: media for synced posts, everything for links.
export function parseLinkedInEmbed(html: string) {
  const images: string[] = [];
  const photoList = html.match(
    /<ul\b[^>]*data-test-id="feed-images-content"[^>]*>[\s\S]*?<\/ul>/,
  )?.[0];
  for (const tag of photoList?.match(/<img\b[^>]*>/g) || []) {
    const src = linkedinMedia(attr(tag, "data-delayed-url"));
    if (src && !images.includes(src)) images.push(src);
  }
  const videos: NonNullable<Post["videos"]> = [];
  const videoTag = html.match(/<video\b[^>]*data-sources="[^"]*"[^>]*>/)?.[0];
  if (videoTag) {
    let sources: any[] = [];
    try {
      sources = JSON.parse(attr(videoTag, "data-sources") || "[]");
    } catch {}
    const best = sources
      .filter((s) => s?.type === "video/mp4" && linkedinMedia(s.src))
      .sort(
        (a, b) =>
          (Number(b["data-bitrate"]) || 0) - (Number(a["data-bitrate"]) || 0),
      )[0];
    if (best)
      videos.push({
        url: linkedinMedia(best.src)!,
        poster: linkedinMedia(attr(videoTag, "data-poster-url")),
      });
  }
  // Stay inside the link card so a card without a preview takes no other image.
  const articleImg = html
    .match(/<a\b[^>]*data-test-id="article-content"[^>]*>[\s\S]*?<\/a>/)?.[0]
    .match(/<img\b[^>]*>/)?.[0];
  const articleImage = articleImg
    ? linkedinMedia(attr(articleImg, "data-delayed-url"))
    : undefined;
  const commentary = html.match(
    /data-test-id="main-feed-activity-embed-card__commentary"[^>]*>([\s\S]*?)<\/p>/,
  )?.[1];
  const actor =
    html.match(
      /<a\b[^>]*data-tracking-control-name="public_post_embed_feed-actor-name"[^>]*>([\s\S]*?)<\/a>/,
    ) ||
    html.match(
      /<a\b[^>]*href="[^"]*public_post_embed_feed-actor-name[^"]*"[^>]*>([\s\S]*?)<\/a>/,
    );
  const avatarTag = html.match(
    /<a\b[^>]*public_post_embed_feed-actor-image[^>]*>[\s\S]*?(<div\b[^>]*data-delayed-url="[^"]*"[^>]*>)/,
  )?.[1];
  return {
    activityId: html.match(
      /data-activity-urn="urn:li:activity:(\d{15,22})"/,
    )?.[1],
    // A known-empty list marks a checked post, so sync does not refetch it.
    images:
      images.length || videos.length || !articleImage ? images : [articleImage],
    videos: videos.length ? videos : undefined,
    image: images[0] || videos[0]?.poster || articleImage,
    text:
      commentary === undefined
        ? undefined
        : decodeEntities(
            commentary.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
          ).trim(),
    name: actor
      ? decodeEntities(actor[1].replace(/<[^>]+>/g, "")).trim() || undefined
      : undefined,
    authorSlug: profileSlug(
      actor ? attr(actor[0], "href")?.split("?")[0] : undefined,
    ),
    avatar: avatarTag
      ? linkedinMedia(attr(avatarTag, "data-delayed-url"))
      : undefined,
  };
}

async function fetchEmbed(type: UrnType, id: string) {
  const response = await fetch(
    `https://www.linkedin.com/embed/feed/update/urn:li:${type}:${id}`,
    { headers: HTML_HEADERS, signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      response.status === 404
        ? "LinkedIn did not expose this post. It may be private, deleted, or visible to members only."
        : `LinkedIn returned HTTP ${response.status} for this post.`,
    );
  }
  const html = await response.text();
  if (!html.includes("data-activity-urn="))
    throw new Error("LinkedIn did not return a public post embed.");
  return parseLinkedInEmbed(html);
}

const MAX_EMBEDS_PER_SYNC = 10;

export async function syncLinkedIn(
  input: string,
  creatorId: string,
  existing: ReadonlyMap<string, Post> = new Map(),
  since = 0,
) {
  const username = linkedinUsername(input);
  const response = await fetch(
    `https://www.linkedin.com/in/${encodeURIComponent(username)}/`,
    { headers: HTML_HEADERS, signal: AbortSignal.timeout(20000) },
  );
  const final = response.url ? new URL(response.url) : undefined;
  if (
    final &&
    (!isLinkedInHost(final.hostname) ||
      /^\/(authwall|login|checkpoint|signup|uas)\b/.test(final.pathname))
  ) {
    await response.body?.cancel();
    throw new Error(
      "LinkedIn asked for sign-in instead of showing the public profile. It may be limiting this server; existing posts are kept.",
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      response.status === 404
        ? "LinkedIn profile not found."
        : response.status === 999 || response.status === 429
          ? `LinkedIn refused the request (HTTP ${response.status}). The profile may not exist, or LinkedIn is limiting requests from this server. Existing posts are kept.`
          : `LinkedIn refresh failed (HTTP ${response.status}). Existing posts are kept.`,
    );
  }
  const result = parseLinkedInProfile(
    await response.text(),
    username,
    creatorId,
  );
  let embeds = 0;
  for (const post of result.posts) {
    const previous = existing.get(post.id);
    // Embed media links do not expire, so a post is enriched once.
    if (previous?.images !== undefined) {
      post.images = previous.images;
      post.videos = previous.videos;
      post.image = previous.image ?? post.image;
      continue;
    }
    // Posts outside retention are discarded after sync; don't fetch their media.
    if (post.published && Date.parse(post.published) < since) continue;
    if (embeds >= MAX_EMBEDS_PER_SYNC) continue;
    embeds++;
    const ref = linkedinPostRef(post.url)!;
    try {
      const media = await fetchEmbed(ref.type, ref.id);
      post.videos = media.videos;
      post.image = media.image ?? post.image;
      // Keep the viewer in step with the card when only JSON-LD had an image.
      post.images =
        media.images.length || media.videos || !post.image
          ? media.images
          : [post.image];
    } catch {
      // Media is optional; the next refresh tries this post again.
    }
  }
  return {
    posts: result.posts,
    avatar: result.avatar,
    name: result.name,
    warning: result.warning,
  };
}

// Single post import for the Links page.
export async function fetchLinkedInPost(url: string, creatorId: string) {
  const ref = linkedinPostRef(url);
  if (!ref) throw new Error("Paste a LinkedIn post link.");
  const embed = await fetchEmbed(ref.type, ref.id);
  const text = embed.text || "";
  // ugcPost/share links name the same post by another id; sync uses the activity id.
  const id = embed.activityId || ref.id;
  const post: Post = {
    id: `linkedin:${id}`,
    creatorId,
    platform: "linkedin",
    sourceUsername: embed.authorSlug,
    title: titleFrom(text),
    text,
    images: embed.images,
    videos: embed.videos,
    image: embed.image,
    url: ref.url,
    kind: "post",
    published:
      embed.activityId || ref.type === "activity" ? linkedinIdDate(id) : "",
    read: false,
    saved: false,
    libraryOnly: true,
  };
  return { post, name: embed.name || embed.authorSlug || "LinkedIn" };
}
