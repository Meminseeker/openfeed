import type { Creator, Post } from "./types";
export const contentFilters = [
  ["youtube:video", "YT videos"],
  ["youtube:short", "YT Shorts"],
  ["youtube:community", "YT community"],
  ["x:post", "X posts / reposts"],
  ["instagram:post", "IG posts / albums"],
  ["instagram:video", "IG videos"],
  ["instagram:short", "IG Reels"],
] as const;
export function contentFilterKey(post: Post) {
  return `${post.platform || "youtube"}:${post.kind}`;
}
export function topicCreators(creators: Creator[], topic: string) {
  return creators.filter(
    (c) => topic === "All topics" || c.tags.includes(topic),
  );
}
export function eligibleSelection(selection: string[], creators: Creator[]) {
  const ids = new Set(creators.map((c) => c.id));
  return selection.filter((id) => ids.has(id));
}
