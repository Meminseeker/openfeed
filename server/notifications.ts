import type { Creator, Post } from "../src/types.ts";
import type { PushMessage } from "./push.ts";

export interface NewPostItem {
  post: Post;
  creator: Creator;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function uniqueNames(names: string[], limit: number, locale: string): string {
  const unique = [...new Set(names)];
  if (unique.length <= limit) return unique.join(", ");
  const extra = unique.length - limit;
  const shown = unique.slice(0, limit).join(", ");
  return locale === "tr" ? `${shown} +${extra} diğer` : `${shown} +${extra} more`;
}

// Builds one summary push notification for an hourly background refresh.
// Groups multiple new posts by creator topic (first tag) when topics exist.
export function buildRefreshNotification(
  items: NewPostItem[],
  locale = "en",
): PushMessage | null {
  const eligible = items.filter((item) => !item.creator.notificationsMuted);
  if (!eligible.length) return null;

  const isTr = locale === "tr";
  const count = eligible.length;

  if (count === 1) {
    const { post, creator } = eligible[0];
    const topic = creator.tags[0];
    const title = topic ? `${topic} · ${creator.name}` : creator.name;
    const fallbackBody = isTr
      ? `${creator.name} yeni içerik paylaştı.`
      : `New content from ${creator.name}.`;
    const body = truncate(post.title || post.text || fallbackBody, 140);
    return {
      kind: "feed-refresh",
      title,
      body,
      tag: "openfeed-refresh",
      url: topic ? `/?topic=${encodeURIComponent(topic)}` : "/",
      data: {
        kind: "feed-refresh",
        count: 1,
        topic: topic || null,
      },
    };
  }

  // Group by primary topic (first tag). Creators without tags go under null.
  const groups = new Map<string | null, NewPostItem[]>();
  for (const item of eligible) {
    const key = item.creator.tags[0] || null;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const namedTopics = [...groups.entries()]
    .filter(([key]) => key !== null)
    .sort((a, b) => b[1].length - a[1].length);
  const uncategorized = groups.get(null) || [];

  let body: string;
  let singleTopic: string | null = null;

  if (namedTopics.length > 0) {
    if (namedTopics.length === 1 && uncategorized.length === 0) {
      singleTopic = namedTopics[0][0];
    }
    const maxGroups = 3;
    const parts = namedTopics.slice(0, maxGroups).map(([topic, list]) => {
      const names = uniqueNames(
        list.map((i) => i.creator.name),
        2,
        locale,
      );
      return `${topic} (${list.length}): ${names}`;
    });
    const hiddenTopicCount = Math.max(0, namedTopics.length - maxGroups);
    const otherPostsCount =
      uncategorized.length +
      namedTopics
        .slice(maxGroups)
        .reduce((sum, [, list]) => sum + list.length, 0);
    if (otherPostsCount > 0) {
      parts.push(
        isTr
          ? `Diğer (${otherPostsCount})`
          : hiddenTopicCount > 0
            ? `+${otherPostsCount} more`
            : `Other (${otherPostsCount})`,
      );
    }
    body = truncate(parts.join(" · "), 180);
  } else {
    body = truncate(
      uniqueNames(
        eligible.map((i) => i.creator.name),
        4,
        locale,
      ),
      180,
    );
  }

  const title = isTr
    ? `OpenFeed'de ${count} yeni içerik`
    : `${count} new posts in OpenFeed`;

  return {
    kind: "feed-refresh",
    title,
    body,
    tag: "openfeed-refresh",
    url: singleTopic ? `/?topic=${encodeURIComponent(singleTopic)}` : "/",
    data: {
      kind: "feed-refresh",
      count,
      topic: singleTopic,
    },
  };
}
