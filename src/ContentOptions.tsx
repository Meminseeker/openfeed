import type { Post } from "./types";
import { useI18n } from "./LocaleProvider";
export type ReadStatus = "all" | "unread" | "read";
export type ContentOrder = "newest" | "oldest";
export function sortContents(
  posts: Post[],
  order: ContentOrder,
  links = false,
) {
  const time = (p: Post) =>
    Date.parse((links ? p.linkedAt : p.published) || "") || 0;
  return [...posts].sort((a, b) => {
    const left = time(a),
      right = time(b);
    if (!left || !right) return left === right ? 0 : !left ? 1 : -1;
    return (order === "newest" ? -1 : 1) * (left - right);
  });
}
export function ContentOptions({
  status,
  setStatus,
  order,
  setOrder,
  unreadCount,
}: {
  unreadCount?: number;
  status: ReadStatus;
  setStatus: (value: ReadStatus) => void;
  order: ContentOrder;
  setOrder: (value: ContentOrder) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="content-options">
      <div className="feed-tabs" aria-label={t("status.label")}>
        {(["all", "unread", "read"] as const).map((value) => (
          <button
            key={value}
            className={status === value ? "active" : ""}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {t(`status.${value}`)}
            {value === "unread" && unreadCount !== undefined && (
              <span>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>
      <select
        aria-label={t("order.label")}
        value={order}
        onChange={(e) => setOrder(e.target.value as ContentOrder)}
      >
        <option value="newest">{t("order.newest")}</option>
        <option value="oldest">{t("order.oldest")}</option>
      </select>
    </div>
  );
}
