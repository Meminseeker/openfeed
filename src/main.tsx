import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Rss,
  Users,
  Bookmark,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Search,
  Check,
  Play,
  SlidersHorizontal,
  X,
  ChevronRight,
  Leaf,
  Menu,
  Trash2,
} from "lucide-react";
import type { State, Creator, Post, Kind } from "./types";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/800.css";
import "./style.css";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: "Request failed" }));
    throw new Error(e.error || "Request failed");
  }
  return r.json();
}
const labels: Record<Kind, string> = {
  video: "Videos",
  short: "Shorts",
  community: "Community",
};
function App() {
  const [state, setState] = useState<State>({ creators: [], posts: [] }),
    [page, setPage] = useState("feed"),
    [tag, setTag] = useState("All topics"),
    [query, setQuery] = useState(""),
    [types, setTypes] = useState<Kind[]>([]),
    [creatorFilter, setCreatorFilter] = useState(""),
    [unread, setUnread] = useState(false),
    [filters, setFilters] = useState(false),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState<Creator | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false),
    [limit, setLimit] = useState(24);
  const load = async () => {
    try {
      setState(await api("state"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(
    () => setLimit(24),
    [page, tag, query, types, creatorFilter, unread],
  );
  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      setState(await api("sync", "POST"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (p: Post, field: "read" | "saved") => {
    try {
      const updated = await api(`posts/${p.id}`, "PATCH", {
        [field]: !p[field],
      });
      setState((s) => ({
        ...s,
        posts: s.posts.map((x) => (x.id === p.id ? updated : x)),
      }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const tags = [...new Set(state.creators.flatMap((c) => c.tags))].sort();
  const visible = state.posts
    .filter((p) => {
      const c = state.creators.find((c) => c.id === p.creatorId);
      return (
        c &&
        (page !== "saved" || p.saved) &&
        (tag === "All topics" || c.tags.includes(tag)) &&
        (!types.length || types.includes(p.kind)) &&
        (!creatorFilter || c.id === creatorFilter) &&
        (!unread || !p.read) &&
        `${p.title} ${p.text || ""} ${c.name}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .sort((a, b) => b.published.localeCompare(a.published));
  const navigate = (p: string) => {
    setPage(p);
    setMobile(false);
    setQuery("");
  };
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("feed");
          }}
        >
          <span className="brand-icon">
            <Rss size={23} />
          </span>
          OpenFeed<span className="brand-dot">.</span>
        </a>
        <div className="workspace">PERSONAL WORKSPACE</div>
        <nav>
          {[
            ["feed", Rss, "Your feed"],
            ["creators", Users, "Creators"],
            ["saved", Bookmark, "Saved for later"],
          ].map(([id, Icon, label]) => (
            <button
              key={id as string}
              className={page === id ? "nav active" : "nav"}
              onClick={() => navigate(id as string)}
            >
              <Icon size={19} />
              {label as string}
              {id === "feed" && (
                <span className="count">
                  {state.posts.filter((p) => !p.read).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="topic-heading">
          YOUR TOPICS <span>{tags.length}</span>
        </div>
        <button
          className={`topic ${tag === "All topics" ? "selected" : ""}`}
          onClick={() => {
            setTag("All topics");
            navigate("feed");
          }}
        >
          <span className="topic-dot all" />
          All topics
        </button>
        {tags.map((t, i) => (
          <button
            key={t}
            className={`topic ${tag === t ? "selected" : ""}`}
            onClick={() => {
              setTag(t);
              navigate("feed");
            }}
          >
            <span className={`topic-dot color-${i % 4}`} />
            {t}
          </button>
        ))}
        <button className="manage-topics" onClick={() => navigate("creators")}>
          <Plus size={15} />
          Manage topics
        </button>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <Leaf size={21} />
            <strong>A little less noise.</strong>
            <p>
              Only the people you choose.
              <br />
              At your own pace.
            </p>
          </div>
          <div className="profile">
            <span>A</span>
            <div>
              My workspace<small>Local · Private by design</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <main>
        <header>
          <button
            className="menu"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            My workspace <ChevronRight size={14} />
            <strong>
              {page === "creators"
                ? "Creators"
                : page === "saved"
                  ? "Saved for later"
                  : "Your feed"}
            </strong>
          </div>
          <div className="header-right">
            <span className="local-badge">
              <span />
              Personal space
            </span>
            <button className="avatar" onClick={() => navigate("creators")}>
              A
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR ATTENTION, YOUR CHOICE</div>
              <h1>
                {page === "creators"
                  ? "Good people. One place."
                  : page === "saved"
                    ? "For a quieter moment."
                    : tag === "All topics"
                      ? "A feed that feels like yours."
                      : `${tag}, on your terms.`}
              </h1>
              <p>
                {page === "creators"
                  ? "Connect the accounts. Follow the person."
                  : page === "saved"
                    ? "The things you wanted to come back to."
                    : "Stay in the loop with the people you follow. Leave the noise behind."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setEditing(null);
                setModal(true);
              }}
            >
              <Plus size={17} />
              Add creator
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {page === "creators" ? (
            <>
              <div className="section-top">
                <h2>
                  Your creators <span>{state.creators.length}</span>
                </h2>
                <span>YouTube is live · More platforms soon</span>
              </div>
              <div className="creator-grid">
                {state.creators.map((c) => (
                  <button
                    key={c.id}
                    className="creator-card"
                    onClick={() => {
                      setEditing(c);
                      setModal(true);
                    }}
                  >
                    <Avatar c={c} />
                    <h3>{c.name}</h3>
                    <p>
                      {c.accounts.length} connected account
                      {c.accounts.length !== 1 ? "s" : ""}
                    </p>
                    <div className="tags">
                      {c.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <small>
                      {c.error ||
                        (c.lastSync
                          ? `Updated ${new Date(c.lastSync).toLocaleString()}`
                          : "Ready to sync")}
                    </small>
                    <span className="edit-link">
                      Manage creator <ArrowUpRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
              {!state.creators.length && !loading && (
                <Empty
                  title="Start with someone you love following."
                  text="Add a YouTube creator, give them a few topics, and make this space your own."
                  action={() => setModal(true)}
                />
              )}
            </>
          ) : (
            <>
              <div className="feed-toolbar">
                <div className="feed-tabs">
                  <button
                    className={!unread ? "active" : ""}
                    onClick={() => setUnread(false)}
                  >
                    All posts <span>{state.posts.length}</span>
                  </button>
                  <button
                    className={unread ? "active" : ""}
                    onClick={() => setUnread(true)}
                  >
                    Unread{" "}
                    <span>{state.posts.filter((p) => !p.read).length}</span>
                  </button>
                </div>
                <div className="tools">
                  <button
                    className={filters ? "filter-on" : ""}
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={16} />
                    Filters
                    {(types.length > 0 || creatorFilter) && (
                      <span className="filter-dot" />
                    )}
                  </button>
                  <button
                    disabled={busy || !state.creators.length}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={16} className={busy ? "spin" : ""} />
                    {busy ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              <div className="topic-chips">
                {["All topics", ...tags].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(t)}
                    className={tag === t ? "active" : ""}
                  >
                    {t}
                  </button>
                ))}
                <label className="search">
                  <Search size={16} />
                  <input
                    placeholder="Search your feed"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              {filters && (
                <div className="filters">
                  <div>
                    <span>Content type</span>
                    {Object.entries(labels).map(([k, v]) => (
                      <button
                        key={k}
                        className={types.includes(k as Kind) ? "selected" : ""}
                        onClick={() =>
                          setTypes(
                            types.includes(k as Kind)
                              ? types.filter((t) => t !== k)
                              : [...types, k as Kind],
                          )
                        }
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <label>
                    Creator{" "}
                    <select
                      value={creatorFilter}
                      onChange={(e) => setCreatorFilter(e.target.value)}
                    >
                      <option value="">All creators</option>
                      {state.creators.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      setTypes([]);
                      setCreatorFilter("");
                      setTag("All topics");
                      setQuery("");
                      setUnread(false);
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
              <div className="feed-info">
                <span>
                  <span className="live-dot" />
                  YouTube{" "}
                  <span className="muted">
                    · Chronological · {visible.length} posts
                  </span>
                </span>
                <button
                  disabled={!visible.some((p) => !p.read)}
                  onClick={async () => {
                    try {
                      await api("read", "POST", {
                        ids: visible.map((p) => p.id),
                      });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Check size={14} />
                  Mark these as read
                </button>
              </div>
              {state.creators.some((c) => c.error) && (
                <div className="warning">
                  Some sources need attention.{" "}
                  <button onClick={() => navigate("creators")}>
                    View creator sync details <ArrowUpRight size={13} />
                  </button>
                </div>
              )}
              {loading ? (
                <div className="empty">Loading your workspace…</div>
              ) : !visible.length ? (
                <Empty
                  title={
                    state.creators.length
                      ? "Nothing here just yet."
                      : "Your feed starts with a person."
                  }
                  text={
                    state.creators.length
                      ? "Refresh to fetch public posts, or adjust your filters."
                      : "Add your first YouTube creator. No recommendations, no endless scroll—just the people you choose."
                  }
                  action={
                    state.creators.length
                      ? () => void refresh()
                      : () => setModal(true)
                  }
                  actionLabel={
                    state.creators.length
                      ? "Refresh feed"
                      : "Add your first creator"
                  }
                />
              ) : (
                <div className="post-grid">
                  {visible.slice(0, limit).map((p) => (
                    <PostCard
                      key={p.id}
                      p={p}
                      c={state.creators.find((c) => c.id === p.creatorId)!}
                      mutate={mutate}
                    />
                  ))}
                </div>
              )}
              {visible.length > limit && (
                <button
                  className="load-more"
                  onClick={() => setLimit(limit + 24)}
                >
                  Show 24 more posts{" "}
                  <span>{visible.length - limit} remaining</span>
                </button>
              )}
              {!!visible.length && visible.length <= limit && (
                <div className="caught-up">
                  <div>
                    <Check size={21} />
                  </div>
                  <h3>
                    {visible.some((p) => !p.read)
                      ? "You've reached the end."
                      : "You're all caught up."}
                  </h3>
                  <p>Go make something. Your feed will be here.</p>
                </div>
              )}
              <div className="source-note">
                Public content only. Recent uploads and available community
                posts. ≈ Approximate date; undated posts appear last. No ads or
                recommendations added by OpenFeed.
              </div>
            </>
          )}
        </div>
      </main>
      {modal && (
        <CreatorModal
          creator={editing}
          close={() => setModal(false)}
          done={async () => {
            setModal(false);
            await load();
            if (!editing) void refresh();
          }}
        />
      )}
    </div>
  );
}
function Avatar({ c }: { c: Creator }) {
  return c.avatar ? (
    <img
      className="creator-avatar"
      src={c.avatar}
      alt=""
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="creator-avatar initials">{c.name.slice(0, 1)}</span>
  );
}
function Empty({
  title,
  text,
  action,
  actionLabel = "Add creator",
}: {
  title: string;
  text: string;
  action: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Rss size={30} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={action}>
        <Plus size={16} />
        {actionLabel}
      </button>
      <div className="empty-promises">
        <span>
          <Check size={14} />
          People you approve
        </span>
        <span>
          <Check size={14} />A finite feed
        </span>
        <span>
          <Check size={14} />
          Your own topics
        </span>
      </div>
    </div>
  );
}
function PostCard({
  p,
  c,
  mutate,
}: {
  p: Post;
  c: Creator;
  mutate: (p: Post, f: "read" | "saved") => Promise<void>;
}) {
  return (
    <article className={`post-card ${p.read ? "read" : ""}`}>
      <div className="post-author">
        <Avatar c={c} />
        <div>
          <strong>{c.name}</strong>
          <small
            title={
              p.publishedApproximate
                ? "Approximate date from YouTube’s relative timestamp"
                : undefined
            }
          >
            {p.publishedApproximate && p.published ? "≈ " : ""}
            {p.published
              ? new Date(p.published).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "Date unavailable"}{" "}
            <span>· YouTube</span>
          </small>
        </div>
        <button
          className={p.saved ? "saved" : ""}
          aria-label={p.saved ? "Remove from saved" : "Save for later"}
          onClick={() => void mutate(p, "saved")}
        >
          <Bookmark size={18} fill={p.saved ? "currentColor" : "none"} />
        </button>
      </div>
      <a
        className="post-link"
        href={p.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          if (!p.read) void mutate(p, "read");
        }}
      >
        {p.image && (
          <div className={`thumbnail ${p.kind}`}>
            <img
              src={p.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {p.kind !== "community" && (
              <span className="play">
                <Play size={20} fill="currentColor" />
              </span>
            )}
            {p.duration && <span className="duration">{p.duration}</span>}
            <span className="kind">
              {p.kind === "short"
                ? "SHORT"
                : p.kind === "community"
                  ? "COMMUNITY"
                  : "VIDEO"}
            </span>
          </div>
        )}
        <div className="post-body">
          <h3>{p.title}</h3>
          {p.text && <p>{p.text}</p>}
          <div className="post-tags">
            {c.tags.slice(0, 3).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </a>
      <div className="post-footer">
        <button onClick={() => void mutate(p, "read")}>
          <Check size={14} />
          {p.read ? "Read" : "Mark as read"}
        </button>
        <a href={p.url} target="_blank" rel="noreferrer">
          Open on YouTube <ArrowUpRight size={14} />
        </a>
      </div>
    </article>
  );
}
function CreatorModal({
  creator,
  close,
  done,
}: {
  creator: Creator | null;
  close: () => void;
  done: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [name, setName] = useState(creator?.name || ""),
    [channel, setChannel] = useState(""),
    [tags, setTags] = useState(creator?.tags.join(", ") || ""),
    [accounts, setAccounts] = useState(
      creator?.accounts.filter((a) => a.platform !== "youtube") || [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
      if (e.key === "Tab") {
        const elements = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, summary",
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [busy, close]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let c = creator;
      if (!c) c = await api("creators", "POST", { channel });
      await api(`creators/${c!.id}`, "PATCH", {
        name: name || c!.name,
        tags: tags.split(","),
        accounts,
      });
      await done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          className="close"
          onClick={close}
          disabled={busy}
          aria-label="Close"
        >
          <X size={21} />
        </button>
        <div className="eyebrow">CURATE YOUR CORNER</div>
        <h2 id="modal-title">
          {creator ? "Meet your creator." : "Someone worth following."}
        </h2>
        <p>One person. All their accounts. Your choice.</p>
        <form onSubmit={submit}>
          {!creator && (
            <label>
              YouTube channel
              <input
                autoFocus
                required
                placeholder="@mkbhd or a YouTube channel URL"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              />
              <small>Public channels only. No sign-in or API key needed.</small>
            </label>
          )}
          <label>
            Display name {creator ? "" : "(optional)"}
            <input
              autoFocus={!!creator}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Use their channel name"
            />
          </label>
          <label>
            Topics
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Technology, Design, Learning"
            />
            <small>
              Separate topics with commas. A creator can belong to several.
            </small>
          </label>
          {creator && (
            <div className="connected">
              <strong>YouTube</strong>
              <span>
                {
                  creator.accounts.find((a) => a.platform === "youtube")
                    ?.username
                }
              </span>
              <small>{creator.error || "Public content sync enabled"}</small>
            </div>
          )}
          <details>
            <summary>
              Other accounts <span>Save now, sync in a future phase</span>
            </summary>
            {["instagram", "x", "tiktok", "patreon"].map((platform) => (
              <label key={platform}>
                {platform === "x"
                  ? "X (Twitter)"
                  : platform[0].toUpperCase() + platform.slice(1)}
                <input
                  value={
                    accounts.find((a) => a.platform === platform)?.username ||
                    ""
                  }
                  placeholder="Username or profile URL"
                  onChange={(e) =>
                    setAccounts([
                      ...accounts.filter((a) => a.platform !== platform),
                      { platform, username: e.target.value },
                    ])
                  }
                />
              </label>
            ))}
          </details>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            {creator && (
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={async () => {
                  if (!confirm) {
                    setConfirm(true);
                    return;
                  }
                  setBusy(true);
                  try {
                    await api(`creators/${creator.id}`, "DELETE");
                    await done();
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={15} />
                {confirm ? "Confirm unfollow & remove posts" : "Unfollow"}
              </button>
            )}
            <button className="primary" disabled={busy} type="submit">
              {busy ? "Saving…" : creator ? "Save changes" : "Follow creator"}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
