import type { Post } from "../src/types.ts";

export function retentionDays(value = process.env.OPENFEED_RETENTION_DAYS) {
  const days = Number(value ?? 90);
  if (!Number.isFinite(days) || days < 1)
    throw new Error("OPENFEED_RETENTION_DAYS must be a positive number.");
  return days;
}
export function expiredPost(post: Post, days: number, now = Date.now()) {
  const published = Date.parse(post.published);
  return (
    !post.removed &&
    !post.saved &&
    !post.notes?.trim() &&
    Number.isFinite(published) &&
    published < now - days * 86400000
  );
}
