import type { Post } from "../src/types.ts";
import { initialData } from "./youtube.ts";
import { fetchPublicPage } from "./public-page.ts";

export function videoMetadata(
  html: string,
  videoId: string,
): { published?: string; title?: string } {
  const marker = /(?:var\s+)?ytInitialPlayerResponse\s*=/;
  const match = marker.exec(html);
  if (!match) return {};
  try {
    const player = initialData(
      html.slice(match.index).replace(marker, "var ytInitialData ="),
    );
    if (player.videoDetails?.videoId !== videoId) return {};
    const title =
      typeof player.videoDetails?.title === "string" &&
      player.videoDetails.title.trim()
        ? player.videoDetails.title.trim()
        : undefined;
    let published: string | undefined;
    const value = player.microformat?.playerMicroformatRenderer?.publishDate;
    // Require a real date with a timezone; never promote rounded labels to exact dates.
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ) {
      const date = Date.parse(value);
      if (Number.isFinite(date)) published = new Date(date).toISOString();
    }
    return { published, title };
  } catch {
    /* Unavailable videos remain importable without a precise date. */
    return {};
  }
}

export function videoPublished(
  html: string,
  videoId: string,
): string | undefined {
  return videoMetadata(html, videoId).published;
}

export async function resolveVideoDates(posts: Post[], existing: Post[] = []) {
  const known = new Map(existing.map((p) => [p.id, p]));
  const pending = posts.filter((p) => {
    if (
      (p.platform && p.platform !== "youtube") ||
      !["video", "short"].includes(p.kind) ||
      !/^[\w-]{11}$/.test(p.id)
    )
      return false;
    const old = known.get(p.id);
    if (old?.published && !old.publishedApproximate) {
      p.published = old.published;
      p.publishedApproximate = false;
    }
    if (!p.titleOriginal && old?.titleOriginal && old.title) {
      p.title = old.title;
      p.titleOriginal = true;
    }
    return !p.published || !!p.publishedApproximate || !p.titleOriginal;
  });
  let next = 0;
  let missing = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (next < pending.length) {
        const post = pending[next++];
        const neededDate = !post.published || !!post.publishedApproximate;
        try {
          // Omit Accept-Language so YouTube returns the uploader's original
          // videoDetails.title instead of auto-translating it to English.
          const html = await (
            await fetchPublicPage(
              `https://www.youtube.com/watch?v=${post.id}`,
              { acceptLanguage: null },
            )
          ).text();
          const meta = videoMetadata(html, post.id);
          if (meta.title) {
            post.title = meta.title;
            post.titleOriginal = true;
          }
          if (meta.published) {
            post.published = meta.published;
            post.publishedApproximate = false;
            continue;
          }
        } catch {
          /* Keep the content and retry on the next refresh. */
        }
        if (neededDate) missing++;
      }
    }),
  );
  return missing;
}
