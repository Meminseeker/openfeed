import {
  ContentOptions,
  sortContents,
  type ReadStatus,
  type ContentOrder,
} from "./ContentOptions";
import { AuthGate } from "./AuthGate";
import { LibraryView } from "./LibraryView";
import { postLabel } from "./post-label";
import {
  matchesFeedFilters,
  timeRanges,
  inTimeRange,
  selectedCreators,
  type TimeRange,
} from "./feed-filters";
import { InstallApp } from "./InstallApp";
import { relativeTime } from "./relative-time";
import {
  contentFilters,
  contentFilterKey,
  topicCreators,
} from "./feed-filters";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Rss,
  Users,
  Bookmark,
  NotebookPen,
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
  Lock,
} from "lucide-react";
import type { State, Creator, Post, Kind, Account, SyncType } from "./types";
import { enabledTypes, sourceTypes, syncLabels } from "./types";
import { api } from "./api";
import { ContentViewer } from "./ContentViewer";
import { LinkActions } from "./LinkActions";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/800.css";
import "./style.css";
function App({ username, logout }: { username: string; logout: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const [state, setState] = useState<State>({ creators: [], posts: [] }),
    [page, setPage] = useState("feed"),
    [tag, setTag] = useState("All topics"),
    [query, setQuery] = useState(""),
    [types, setTypes] = useState<string[]>([]),
    [creatorFilter, setCreatorFilter] = useState<string[] | null>(null),
    [timeRange, setTimeRange] = useState<TimeRange>("All"),
    [removedPost, setRemovedPost] = useState<Post | null>(null),
    [readStatus, setReadStatus] = useState<ReadStatus>("all"),
    [order, setOrder] = useState<ContentOrder>("newest"),
    [filters, setFilters] = useState(false),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState<Creator | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false),
    [limit, setLimit] = useState(24),
    [viewerIds, setViewerIds] = useState<string[]>([]),
    [viewerIndex, setViewerIndex] = useState(0);
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
    const timer = setInterval(() => void load(), 60000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  useEffect(
    () => setLimit(24),
    [page, tag, query, types, creatorFilter, readStatus, order, timeRange],
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
  const followed = state.creators.filter((c) => !c.libraryOnly);
  const tags = [...new Set(followed.flatMap((c) => c.tags))].sort();
  const eligibleCreators = topicCreators(followed, tag);
  useEffect(() => {
    setCreatorFilter(null);
  }, [tag]);
  const selection = selectedCreators(creatorFilter, eligibleCreators);
  const unreadInTopic = (topic: string) =>
    state.posts.filter(
      (p) =>
        !p.libraryOnly &&
        !p.read &&
        inTimeRange(p, timeRange) &&
        state.creators.some(
          (c) =>
            c.id === p.creatorId &&
            (topic === "All topics" || c.tags.includes(topic)),
        ),
    ).length;
  const removePost = async (post: Post) => {
    try {
      await api(`posts/${encodeURIComponent(post.id)}`, "DELETE");
      setState((s) => ({
        ...s,
        posts: s.posts.filter((p) => p.id !== post.id),
      }));
      setRemovedPost(post);
      setViewerIds([]);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const feedSelection = {
    page,
    tag,
    query,
    types,
    selection,
    timeRange,
    unread: false,
    readStatus,
    allCreators: creatorFilter === null,
  };
  const visible = sortContents(
    state.posts.filter((p) =>
      matchesFeedFilters(p, state.creators, feedSelection),
    ),
    order,
  );
  const viewPost = (p: Post) => {
    setViewerIds(visible.map((item) => item.id));
    setViewerIndex(visible.findIndex((item) => item.id === p.id));
    if (!p.read) void mutate(p, "read");
  };
  const viewerPost = state.posts.find((p) => p.id === viewerIds[viewerIndex]);
  useEffect(() => {
    if (
      viewerPost?.platform !== "patreon" &&
      (viewerPost?.platform !== "x" ||
        (viewerPost.textExpanded && viewerPost.textVersion === 2))
    )
      return;
    const id = viewerPost.id;
    void api(`posts/${encodeURIComponent(id)}/detail`)
      .then((detail) => {
        setState((s) => ({
          ...s,
          posts: s.posts.map((item) =>
            item.id === id && detail.platform === "patreon"
              ? {
                  ...item,
                  title: detail.title,
                  text: detail.text,
                  blocks: detail.blocks,
                  locked: detail.locked,
                  image: detail.image,
                  videoId: detail.videoId,
                }
              : item.id === id
                ? {
                    ...item,
                    text: detail.text,
                    title: detail.title,
                    textTruncated: detail.textTruncated,
                    textExpanded: detail.textExpanded,
                    textVersion: detail.textVersion,
                  }
                : item,
          ),
        }));
      })
      .catch(() => {});
  }, [viewerPost?.id]);
  const moveViewer = (delta: number) => {
    const index = viewerIndex + delta;
    if (index < 0 || index >= viewerIds.length) return;
    setViewerIndex(index);
    const p = state.posts.find((p) => p.id === viewerIds[index]);
    if (p && !p.read) void mutate(p, "read");
  };
  const navigate = (p: string) => {
    setPage(p);
    setMobile(false);
    setQuery("");
  };
  return (
    <div className="app">
      <aside
        inert={!!viewerPost || modal}
        className={mobile ? "sidebar open" : "sidebar"}
      >
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
            ["noted", NotebookPen, "Noted down"],
            ["playlists", Play, "Playlists"],
            ["links", ArrowUpRight, "Links"],
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
                  {state.posts.filter((p) => !p.libraryOnly && !p.read).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <InstallApp />
        <button className="nav" onClick={logout}>
          Log out · {username}
        </button>
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
            <span>{username.slice(0, 1).toUpperCase()}</span>
            <div>
              {username}
              <small>Your personal workspace</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <main inert={!!viewerPost || modal}>
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
                  : page === "noted"
                    ? "Noted down"
                    : page === "playlists"
                      ? "Playlists"
                      : page === "links"
                        ? "Links"
                        : "Your feed"}
            </strong>
          </div>
          <div className="header-right">
            <span className="local-badge">
              <span />
              Personal space
            </span>
            <button className="avatar" onClick={() => navigate("creators")}>
              {username.slice(0, 1).toUpperCase()}
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
                    : page === "noted"
                      ? "Noted down."
                      : page === "playlists"
                        ? "One collection at a time."
                        : page === "links"
                          ? "A place for the links you find."
                          : tag === "All topics"
                            ? "A feed that feels like yours."
                            : `${tag}, on your terms.`}
              </h1>
              <p>
                {page === "creators"
                  ? "Connect the accounts. Follow the person."
                  : page === "saved"
                    ? "The things you wanted to come back to."
                    : page === "noted"
                      ? "The content you have written notes on."
                      : page === "playlists"
                        ? "Your collections, ready when you are."
                        : page === "links"
                          ? "Keep what catches your attention."
                          : "Stay in the loop with the people you follow. Leave the noise behind."}
              </p>
            </div>
            {!["links", "playlists"].includes(page) && (
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
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {["playlists", "links"].includes(page) ? (
            <LibraryView
              page={page}
              state={state}
              update={setState}
              open={(post, items) => {
                setViewerIds(items.map((p) => p.id));
                setViewerIndex(items.findIndex((p) => p.id === post.id));
                if (!post.read) void mutate(post, "read");
              }}
              render={(p, open) => (
                <PostCard
                  key={p.id}
                  p={p}
                  c={state.creators.find((c) => c.id === p.creatorId)!}
                  mutate={mutate}
                  remove={() => void removePost(p)}
                  open={open}
                />
              )}
            />
          ) : page === "creators" ? (
            <>
              <div className="section-top">
                <h2>
                  Your creators <span>{followed.length}</span>
                </h2>
                <span>YouTube, X, Instagram & TikTok</span>
              </div>
              <div className="creator-grid">
                {followed.map((c) => (
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
              {!followed.length && !loading && (
                <Empty
                  title="Start with someone you love following."
                  text="Add a YouTube, X, Instagram or TikTok creator, give them a few topics, and make this space your own."
                  action={() => setModal(true)}
                />
              )}
            </>
          ) : (
            <>
              <div className="feed-toolbar">
                <ContentOptions
                  unreadCount={unreadInTopic(tag)}
                  status={readStatus}
                  setStatus={setReadStatus}
                  order={order}
                  setOrder={setOrder}
                />
                <div className="tools">
                  <button
                    className={filters ? "filter-on" : ""}
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={16} />
                    Filters
                    {(types.length > 0 || creatorFilter !== null) && (
                      <span className="filter-dot" />
                    )}
                  </button>
                  <button
                    disabled={busy || !followed.length}
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
                    {t} <span className="unread-count">{unreadInTopic(t)}</span>
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
              <div
                className="time-filters"
                role="group"
                aria-label="Publication time"
              >
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    aria-pressed={timeRange === range}
                    title={
                      range === "1w+"
                        ? "Older than one week"
                        : range === "All"
                          ? "Any time"
                          : `Within the last ${range}`
                    }
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
              {removedPost && (
                <div className="removed-notice" role="status">
                  Content removed.{" "}
                  <button
                    onClick={async () => {
                      try {
                        await api(
                          `posts/${encodeURIComponent(removedPost.id)}`,
                          "PATCH",
                          { removed: false },
                        );
                        setRemovedPost(null);
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}
              {filters && (
                <div className="filters">
                  <div>
                    <span>Content type</span>
                    {contentFilters.map(([k, v]) => (
                      <button
                        key={k}
                        aria-pressed={types.includes(k)}
                        className={types.includes(k) ? "selected" : ""}
                        onClick={() =>
                          setTypes(
                            types.includes(k)
                              ? types.filter((t) => t !== k)
                              : [...types, k],
                          )
                        }
                      >
                        {v}{" "}
                        <span className="count">
                          {
                            state.posts.filter(
                              (p) =>
                                !p.read &&
                                contentFilterKey(p) === k &&
                                matchesFeedFilters(
                                  p,
                                  state.creators,
                                  { ...feedSelection, readStatus: "all" },
                                  true,
                                ),
                            ).length
                          }
                        </span>
                      </button>
                    ))}
                  </div>
                  <fieldset className="creator-filters">
                    <legend>
                      Creators {tag !== "All topics" && <small>in {tag}</small>}
                    </legend>
                    <button
                      type="button"
                      aria-pressed={
                        selection.length === eligibleCreators.length
                      }
                      className={
                        selection.length === eligibleCreators.length
                          ? "selected"
                          : ""
                      }
                      onClick={() => setCreatorFilter(null)}
                    >
                      All creators in this topic
                    </button>
                    <button type="button" onClick={() => setCreatorFilter([])}>
                      Unselect all creators
                    </button>
                    <div className="creator-options">
                      {eligibleCreators.map((c) => (
                        <label key={c.id}>
                          <input
                            type="checkbox"
                            checked={selection.includes(c.id)}
                            onChange={() =>
                              setCreatorFilter(
                                selection.includes(c.id)
                                  ? selection.filter((id) => id !== c.id)
                                  : [...selection, c.id],
                              )
                            }
                          />
                          {c.name}
                        </label>
                      ))}
                      {!eligibleCreators.length && (
                        <small>No creators in this topic.</small>
                      )}
                    </div>
                    <small>Uncheck any creators you want to exclude.</small>
                  </fieldset>
                  <button
                    onClick={() => {
                      setTypes([]);
                      setCreatorFilter(null);
                      setTimeRange("All");
                      setTag("All topics");
                      setQuery("");
                      setReadStatus("all");
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
              <div className="feed-info">
                <span>
                  <span className="live-dot" />
                  Your sources <span className="muted">· Chronological</span>
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
                    followed.length
                      ? "Nothing here just yet."
                      : "Your feed starts with a person."
                  }
                  text={
                    followed.length
                      ? "Refresh to fetch public posts, or adjust your filters."
                      : "Add your first creator. No recommendations, no endless scroll—just the people you choose."
                  }
                  action={
                    followed.length
                      ? () => void refresh()
                      : () => setModal(true)
                  }
                  actionLabel={
                    followed.length ? "Refresh feed" : "Add your first creator"
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
                      remove={() => void removePost(p)}
                      open={() => viewPost(p)}
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
                Public content only. YouTube uploads and community posts, plus
                available X, Instagram and TikTok posts. X public snapshots can
                omit recent posts. ≈ Approximate date; undated posts appear
                last. No ads or recommendations added by OpenFeed.
              </div>
            </>
          )}
        </div>
      </main>
      {viewerPost && (
        <ContentViewer
          post={viewerPost}
          creator={state.creators.find((c) => c.id === viewerPost.creatorId)!}
          index={viewerIndex}
          total={viewerIds.length}
          close={() => setViewerIds([])}
          navigate={moveViewer}
          onNotesSaved={(id, notes) =>
            setState((s) => ({
              ...s,
              posts: s.posts.map((p) => (p.id === id ? { ...p, notes } : p)),
            }))
          }
          onSave={() => void mutate(viewerPost, "saved")}
          onRemove={() => void removePost(viewerPost)}
        />
      )}
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
  remove,
  p,
  c,
  mutate,
  open,
}: {
  open: () => void;
  remove: () => void;
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
                ? p.platform === "tiktok"
                  ? "Approximate date from the TikTok video ID"
                  : "Approximate date from YouTube’s relative timestamp"
                : p.published
                  ? new Date(p.published).toLocaleString()
                  : undefined
            }
          >
            {p.publishedApproximate && p.published ? "≈ " : ""}
            {relativeTime(p.published)}{" "}
            <span className="post-type">· {postLabel(p)}</span>
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
      <button
        type="button"
        className="post-link"
        aria-label={`View ${p.title}`}
        onClick={open}
      >
        {(p.images?.[0] || p.image) && (
          <div className={`thumbnail ${p.kind}`}>
            <img
              src={p.images?.[0] || p.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {(p.kind === "video" ||
              p.kind === "short" ||
              !!p.videos?.length ||
              (p.platform === "patreon" && !!p.videoId)) && (
              <span className="play">
                <Play size={20} fill="currentColor" />
              </span>
            )}
            {p.images && p.images.length > 1 && (
              <span className="album-count">{p.images.length} images</span>
            )}
            {p.duration && <span className="duration">{p.duration}</span>}
            {p.locked && (
              <span className="locked-badge">
                <Lock size={13} /> Locked
              </span>
            )}
            <span className="kind">{postLabel(p)}</span>
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
      </button>
      <div className="post-footer">
        <button onClick={() => void mutate(p, "read")}>
          <Check size={14} />
          {p.read ? "Read" : "Mark as read"}
        </button>
        <LinkActions url={p.url} compact />
        <button
          aria-label="Remove content"
          title="Remove from feed"
          onClick={remove}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
function SyncChoices({
  account,
  change,
}: {
  account: Account;
  change: (types: SyncType[]) => void;
}) {
  const selected = enabledTypes(account);
  return (
    <fieldset className="sync-choices">
      <legend>
        Content to sync from{" "}
        {account.platform === "youtube"
          ? "YouTube"
          : account.platform === "x"
            ? "X"
            : account.platform === "patreon"
              ? "Patreon"
              : account.platform}
      </legend>
      {(sourceTypes[account.platform] || []).map((kind) => (
        <label key={kind}>
          <input
            type="checkbox"
            checked={selected.includes(kind)}
            onChange={() =>
              change(
                selected.includes(kind)
                  ? selected.filter((k) => k !== kind)
                  : [...selected, kind],
              )
            }
          />
          {account.platform === "instagram" && kind === "short"
            ? "Reels"
            : syncLabels[kind]}
        </label>
      ))}
      {!selected.length && (
        <span className="sync-paused">Sync paused for this source</span>
      )}
    </fieldset>
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
    [platform, setPlatform] = useState("youtube"),
    [tags, setTags] = useState(creator?.tags.join(", ") || ""),
    [accounts, setAccounts] = useState<Account[]>(
      creator?.accounts || [
        {
          platform: "youtube",
          username: "",
          syncTypes: ["video", "short", "community"],
        },
      ],
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
            "button:not(:disabled), input, select, summary",
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
      if (!c) c = await api("creators", "POST", { channel, platform });
      await api(`creators/${c!.id}`, "PATCH", {
        name: name || c!.name,
        tags: tags.split(","),
        accounts: !creator
          ? accounts.map((a) =>
              a.platform === platform
                ? { ...a, username: c!.accounts[0].username }
                : a,
            )
          : accounts,
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
              Source
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setChannel("");
                  setAccounts([
                    {
                      platform: e.target.value,
                      username: "",
                      syncTypes:
                        e.target.value === "tiktok"
                          ? ["video"]
                          : e.target.value === "x" ||
                              e.target.value === "patreon"
                            ? ["post"]
                            : e.target.value === "instagram"
                              ? ["post", "video", "short"]
                              : ["video", "short", "community"],
                    },
                  ]);
                }}
              >
                <option value="youtube">YouTube</option>
                <option value="x">X (Twitter)</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="patreon">Patreon</option>
              </select>
              {platform === "x"
                ? "X account"
                : platform === "instagram"
                  ? "Instagram account"
                  : platform === "tiktok"
                    ? "TikTok account"
                    : platform === "patreon"
                      ? "Patreon creator"
                      : "YouTube channel"}
              <input
                autoFocus
                required
                placeholder={
                  platform === "x"
                    ? "@username or an X profile URL"
                    : platform === "instagram"
                      ? "@username or an Instagram profile URL"
                      : platform === "tiktok"
                        ? "@username or a TikTok profile URL"
                        : platform === "patreon"
                          ? "Creator name or a Patreon profile URL"
                          : "@mkbhd or a YouTube channel URL"
                }
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              />
              <small>
                {platform === "patreon"
                  ? "Member posts use the server's Patreon session; other accounts see public previews."
                  : platform === "instagram" || platform === "tiktok"
                    ? "Public accounts only. The platform may block access; see source details below."
                    : "Public channels only. No sign-in or API key needed."}
              </small>
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
          {creator &&
            !creator.accounts.some((a) => a.platform === "youtube") && (
              <label>
                YouTube channel (optional)
                <input
                  value={
                    accounts.find((a) => a.platform === "youtube")?.username ||
                    ""
                  }
                  placeholder="@handle or a YouTube channel URL"
                  onChange={(e) =>
                    setAccounts([
                      ...accounts.filter((a) => a.platform !== "youtube"),
                      { platform: "youtube", username: e.target.value },
                    ])
                  }
                />
              </label>
            )}
          {accounts.some((a) => a.platform === "youtube") && (
            <div className="source-settings">
              <div className="source-heading">
                <strong>YouTube</strong>
                <span>Public content</span>
              </div>
              <small>
                {accounts.find((a) => a.platform === "youtube")?.username}
              </small>
              <SyncChoices
                account={accounts.find((a) => a.platform === "youtube")!}
                change={(syncTypes) =>
                  setAccounts(
                    accounts.map((a) =>
                      a.platform === "youtube" ? { ...a, syncTypes } : a,
                    ),
                  )
                }
              />
              <small>
                {accounts.find((a) => a.platform === "youtube")?.error ||
                  "Choose what to fetch. Existing posts and notes are kept."}
              </small>
            </div>
          )}
          <div className="source-settings">
            <div className="source-heading">
              <strong>X (Twitter)</strong>
              <span>Public content</span>
            </div>
            {!(!creator && platform === "x") && (
              <label>
                X username or profile URL
                <input
                  value={
                    accounts.find((a) => a.platform === "x")?.username || ""
                  }
                  placeholder="@username or https://x.com/username"
                  onChange={(e) =>
                    setAccounts([
                      ...accounts.filter((a) => a.platform !== "x"),
                      {
                        ...accounts.find((a) => a.platform === "x"),
                        platform: "x",
                        username: e.target.value,
                      },
                    ])
                  }
                />
              </label>
            )}
            {(accounts.find((a) => a.platform === "x")?.username ||
              platform === "x") && (
              <SyncChoices
                account={
                  accounts.find((a) => a.platform === "x") || {
                    platform: "x",
                    username: "",
                  }
                }
                change={(syncTypes) =>
                  setAccounts(
                    accounts.map((a) =>
                      a.platform === "x" ? { ...a, syncTypes } : a,
                    ),
                  )
                }
              />
            )}
            <small>
              {accounts.find((a) => a.platform === "x")?.error ||
                "Limited public snapshot: X may return older posts and omit recent ones. No sign-in needed."}
            </small>
          </div>
          <div className="source-settings">
            <div className="source-heading">
              <strong>Instagram</strong>
              <span>Public content</span>
            </div>
            {!(!creator && platform === "instagram") && (
              <label>
                Instagram username or profile URL
                <input
                  value={
                    accounts.find((a) => a.platform === "instagram")
                      ?.username || ""
                  }
                  placeholder="@username or https://instagram.com/username/"
                  onChange={(e) =>
                    setAccounts([
                      ...accounts.filter((a) => a.platform !== "instagram"),
                      {
                        ...accounts.find((a) => a.platform === "instagram"),
                        platform: "instagram",
                        username: e.target.value,
                      },
                    ])
                  }
                />
              </label>
            )}
            {(accounts.find((a) => a.platform === "instagram")?.username ||
              platform === "instagram") && (
              <SyncChoices
                account={
                  accounts.find((a) => a.platform === "instagram") || {
                    platform: "instagram",
                    username: "",
                  }
                }
                change={(syncTypes) =>
                  setAccounts(
                    accounts.map((a) =>
                      a.platform === "instagram" ? { ...a, syncTypes } : a,
                    ),
                  )
                }
              />
            )}
            <small>
              {accounts.find((a) => a.platform === "instagram")?.error ||
                "No login needed. Public profile embeds show a small recent preview, usually 6 posts. Posts includes albums; Shorts includes Reels. Some profiles disable embeds."}
            </small>
          </div>
          <details>
            <summary>
              Other accounts <span>TikTok · Patreon</span>
            </summary>
            {["tiktok", "patreon"].map((platform) => {
              const account = accounts.find((a) => a.platform === platform) || {
                platform,
                username: "",
              };
              const update = (patch: Partial<Account>) =>
                setAccounts([
                  ...accounts.filter((a) => a.platform !== platform),
                  { ...account, ...patch },
                ]);
              return (
                <div className="planned-source" key={platform}>
                  <label>
                    {platform === "x"
                      ? "X (Twitter)"
                      : platform[0].toUpperCase() + platform.slice(1)}
                    <input
                      value={account.username}
                      placeholder="Username or profile URL"
                      onChange={(e) => update({ username: e.target.value })}
                    />
                  </label>
                  {account.username.trim() && (
                    <>
                      <SyncChoices
                        account={account}
                        change={(syncTypes) => update({ syncTypes })}
                      />
                      <small>
                        {account.error ||
                          (platform === "tiktok"
                            ? "Public videos sync on refresh. TikTok may restrict access."
                            : "Posts from the last few days sync on refresh. Unread posts stay until you read them.")}
                      </small>
                    </>
                  )}
                </div>
              );
            })}
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
createRoot(document.getElementById("root")!).render(
  <AuthGate>
    {(username, logout) => <App username={username} logout={logout} />}
  </AuthGate>,
);
