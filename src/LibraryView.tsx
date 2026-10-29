import { cleanPastedUrl } from "./clean-url";
import { useState, useEffect, type ReactNode } from "react";
import type { State, Post } from "./types";
import { api } from "./api";
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
  const [selected, setSelected] = useState<string | null>(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [limit, setLimit] = useState(24);
  useEffect(() => setLimit(24), [page, selected]);
  const playlist = state.playlists?.find((p) => p.id === selected);
  const items =
    page === "links"
      ? state.posts.filter((p) => p.linked)
      : playlist?.postIds
          .map((id) => state.posts.find((p) => p.id === id))
          .filter((p): p is Post => !!p) || [];
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
      <h2>{page === "playlists" ? "Your playlists" : "Your links"}</h2>
      <p>
        {page === "playlists"
          ? "Add a YouTube playlist and watch it at your own pace."
          : "Paste a YouTube, X, Instagram or TikTok content link."}{" "}
        Items here are kept regardless of age.
      </p>
      <form
        className="library-add"
        onSubmit={(e) => {
          e.preventDefault();
          void add(url);
        }}
      >
        <input
          aria-label={page === "playlists" ? "Playlist link" : "Content link"}
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
            ? "Importing…"
            : "Add " + (page === "playlists" ? "playlist" : "link")}
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
              {p.title} <small>{p.postIds.length} videos</small>
            </button>
          ))}
        </div>
      )}
      {page === "playlists" && playlist && (
        <div className="section-top">
          <h3>{playlist.title}</h3>
          <button disabled={busy} onClick={() => void add(playlist.url)}>
            Refresh playlist
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
            Remove playlist
          </button>
        </div>
      )}
      {page === "playlists" && playlist?.warning && (
        <p className="warning">{playlist.warning}</p>
      )}
      <div className="post-grid">
        {items.slice(0, limit).map((p) => render(p, () => open(p, items)))}
      </div>
      {items.length > limit && (
        <button className="load-more" onClick={() => setLimit(limit + 24)}>
          Show more · {items.length - limit} remaining
        </button>
      )}
      {!items.length && (
        <div className="empty">
          {page === "playlists"
            ? "Add or select a playlist to see its videos."
            : "Links you add will appear here."}
        </div>
      )}
    </section>
  );
}
