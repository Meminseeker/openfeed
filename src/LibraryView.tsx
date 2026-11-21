import {
  ContentOptions,
  sortContents,
  type ReadStatus,
  type ContentOrder,
} from "./ContentOptions";
import { cleanPastedUrl } from "./clean-url";
import { useState, useEffect, type ReactNode } from "react";
import type { State, Post } from "./types";
import { api } from "./api";
import { useI18n } from "./LocaleProvider";
export function LibraryView({
  page,
  state,
  update,
  open,
  render,
}: {
  page: string;
  state: State;
  update: (state: State) => void;
  open: (p: Post, items: Post[]) => void;
  render: (p: Post, open: () => void) => ReactNode;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [status, setStatus] = useState<ReadStatus>("all");
  const [order, setOrder] = useState<ContentOrder>("newest");
  const [limit, setLimit] = useState(24);
  useEffect(() => setLimit(24), [page, selected, status, order]);
  const playlist = state.playlists?.find((p) => p.id === selected);
  const sourceItems =
    page === "links"
      ? state.posts.filter((p) => p.linked)
      : playlist?.postIds
          .map((id) => state.posts.find((p) => p.id === id))
          .filter((p): p is Post => !!p) || [];
  const items = sortContents(
    sourceItems.filter(
      (p) => status === "all" || (status === "read" ? p.read : !p.read),
    ),
    order,
    page === "links",
  );
  async function add(input: string) {
    input = cleanPastedUrl(
      input,
      page === "playlists" ? "playlist" : "content",
    );
    setUrl(input);
    setBusy(true);
    setError("");
    try {
      const data = await api(page, "POST", { url: input });
      update(data);
      setUrl("");
      if (page === "playlists")
        setSelected(new URL(input).searchParams.get("list"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="library">
      <h2>
        {page === "playlists"
          ? t("library.playlistsHeading")
          : t("library.linksHeading")}
      </h2>
      <p>
        {page === "playlists"
          ? t("library.playlistsIntro")
          : t("library.linksIntro")}{" "}
        {t("library.kept")}
      </p>
      <form
        className="library-add"
        onSubmit={(e) => {
          e.preventDefault();
          void add(url);
        }}
      >
        <input
          aria-label={
            page === "playlists"
              ? t("library.playlistLink")
              : t("library.contentLink")
          }
          type="url"
          required
          value={url}
          placeholder="https://…"
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() =>
            setUrl(
              cleanPastedUrl(
                url,
                page === "playlists" ? "playlist" : "content",
              ),
            )
          }
          onPaste={(e) => {
            const value = e.clipboardData.getData("text").trim();
            if (/^https:\/\//i.test(value)) {
              e.preventDefault();
              setUrl(
                cleanPastedUrl(
                  value,
                  page === "playlists" ? "playlist" : "content",
                ),
              );
            }
          }}
        />
        <button className="primary" disabled={busy}>
          {busy
            ? t("library.importing")
            : page === "playlists"
              ? t("library.addPlaylist")
              : t("library.addLink")}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {page === "playlists" && (
        <div className="playlist-list">
          {state.playlists?.map((p) => (
            <button
              key={p.id}
              className={p.id === selected ? "selected" : ""}
              onClick={() => setSelected(p.id)}
            >
              {p.title}{" "}
              <small>{t("library.videos", { count: p.postIds.length })}</small>
            </button>
          ))}
        </div>
      )}
      {page === "playlists" && playlist && (
        <div className="section-top">
          <h3>{playlist.title}</h3>
          <button disabled={busy} onClick={() => void add(playlist.url)}>
            {t("library.refreshPlaylist")}
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              try {
                update(
                  await api(
                    `playlists/${encodeURIComponent(playlist.id)}`,
                    "DELETE",
                  ),
                );
                setSelected(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("library.removePlaylist")}
          </button>
        </div>
      )}
      {page === "playlists" && playlist?.warning && (
        <p className="warning">{playlist.warning}</p>
      )}
      <ContentOptions
        unreadCount={sourceItems.filter((p) => !p.read).length}
        status={status}
        setStatus={setStatus}
        order={order}
        setOrder={setOrder}
      />
      {items.some((p) => !(page === "links" ? p.linkedAt : p.published)) && (
        <p className="muted">
          {page === "links"
            ? t("library.undatedLinks")
            : t("library.undatedPlaylist")}
        </p>
      )}
      <div className="post-grid">
        {items.slice(0, limit).map((p) => render(p, () => open(p, items)))}
      </div>
      {items.length > limit && (
        <button className="load-more" onClick={() => setLimit(limit + 24)}>
          {t("library.showMore", { count: items.length - limit })}
        </button>
      )}
      {!items.length && (
        <div className="empty">
          {page === "playlists"
            ? playlist
              ? t("library.noMatch")
              : t("library.selectPlaylist")
            : t("library.emptyLinks")}
        </div>
      )}
    </section>
  );
}
