import type { Post } from "../src/types.ts";
import { initialData } from "./youtube.ts";
import { fetchPublicPage } from "./public-page.ts";

export function videoPublished(
  html: string,
  videoId: string,
): string | undefined {
  const marker = /(?:var\s+)?ytInitialPlayerResponse\s*=/;
  const match = marker.exec(html);
  if (!match) return;
  try {
    const player = initialData(
      html.slice(match.index).replace(marker, "var ytInitialData ="),
    );
    if (player.videoDetails?.videoId !== videoId) return;
    const value = player.microformat?.playerMicroformatRenderer?.publishDate;
    // Require a real date with a timezone; never promote rounded labels to exact dates.
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    )
      return;
    const date = Date.parse(value);
    if (Number.isFinite(date)) return new Date(date).toISOString();
  } catch {
    /* Unavailable videos remain importable without a precise date. */
  }
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
    return !p.published || !!p.publishedApproximate;
  });
  let next = 0;
  let missing = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (next < pending.length) {
        const post = pending[next++];
        try {
          const html = await (
            await fetchPublicPage(`https://www.youtube.com/watch?v=${post.id}`)
          ).text();
          const published = videoPublished(html, post.id);
          if (published) {
            post.published = published;
            post.publishedApproximate = false;
            continue;
          }
        } catch {
          /* Keep the content and retry the date on its next refresh. */
        }
        missing++;
      }
    }),
  );
  return missing;
}
