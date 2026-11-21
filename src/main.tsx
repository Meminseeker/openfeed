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
import { enabledTypes, sourceTypes } from "./types";
import { api } from "./api";
import { useI18n, LanguageSelect, I18nProvider } from "./LocaleProvider";
import { PhoneSync } from "./PhoneSync";
import { ContentViewer } from "./ContentViewer";
import { LinkActions } from "./LinkActions";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/800.css";
import "./style.css";
type PageName = "feed" | "creators" | "saved" | "noted" | "playlists" | "links";
function App({ username, logout }: { username: string; logout: () => void }) {
  const { t, locale } = useI18n();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const [state, setState] = useState<State>({ creators: [], posts: [] }),
    [page, setPage] = useState<PageName>("feed"),
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
      viewerPost?.platform !== "instagram" &&
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
            item.id === id && detail.platform === "instagram"
              ? {
                  ...item,
                  image: detail.image,
                  images: detail.images,
                  videos: detail.videos,
                }
              : item.id === id && detail.platform === "patreon"
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
  const navigate = (p: PageName) => {
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
        <div className="workspace">{t("sidebar.workspace")}</div>
        <nav>
          {(
            [
              ["feed", Rss],
              ["creators", Users],
              ["saved", Bookmark],
              ["noted", NotebookPen],
              ["playlists", Play],
              ["links", ArrowUpRight],
            ] as const
          ).map(([id, Icon]) => (
            <button
              key={id}
              className={page === id ? "nav active" : "nav"}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {t(`nav.${id}`)}
              {id === "feed" && (
                <span className="count">
                  {state.posts.filter((p) => !p.libraryOnly && !p.read).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <InstallApp />
        <LanguageSelect className="sidebar-language" />
        <button className="nav" onClick={logout}>
          {t("sidebar.logout", { username })}
        </button>
        <div className="topic-heading">
          {t("sidebar.topics")} <span>{tags.length}</span>
        </div>
        <button
          className={`topic ${tag === "All topics" ? "selected" : ""}`}
          onClick={() => {
            setTag("All topics");
            navigate("feed");
          }}
        >
          <span className="topic-dot all" />
          {t("topics.all")}
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
          {t("sidebar.manageTopics")}
        </button>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <Leaf size={21} />
            <strong>{t("sidebar.quietTitle")}</strong>
            <p>
              {t("sidebar.quietLine1")}
              <br />
              {t("sidebar.quietLine2")}
            </p>
          </div>
          <div className="profile">
            <span>{username.slice(0, 1).toUpperCase()}</span>
            <div>
              {username}
              <small>{t("sidebar.profileCaption")}</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <main inert={!!viewerPost || modal}>
        <header>
          <button
            className="menu"
            aria-label={t("header.toggleNav")}
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            {t("header.workspace")} <ChevronRight size={14} />
            <strong>{t(`nav.${page}`)}</strong>
          </div>
          <div className="header-right">
            <span className="local-badge">
              <span />
              {t("header.personalSpace")}
            </span>
            <button className="avatar" onClick={() => navigate("creators")}>
              {username.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{t("page.eyebrow")}</div>
              <h1>
                {page === "feed" && tag !== "All topics"
                  ? t("page.feed.topicTitle", { topic: tag })
                  : t(`page.${page}.title`)}
              </h1>
              <p>{t(`page.${page}.subtitle`)}</p>
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
                {t("action.addCreator")}
              </button>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                onClick={() => setError("")}
                aria-label={t("action.dismissError")}
              >
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
                  {t("creators.heading")} <span>{followed.length}</span>
                </h2>
                <span>{t("creators.platforms")}</span>
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
                      {t("creators.accounts", { count: c.accounts.length })}
                    </p>
                    <div className="tags">
                      {c.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <small>
                      {c.error ||
                        (c.lastSync
                          ? t("creators.updated", {
                              date: new Date(c.lastSync).toLocaleString(locale),
                            })
                          : t("creators.ready"))}
                    </small>
                    <span className="edit-link">
                      {t("creators.manage")} <ArrowUpRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
              {!followed.length && !loading && (
                <Empty
                  title={t("creators.emptyTitle")}
                  text={t("creators.emptyText")}
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
                    {t("feed.filters")}
                    {(types.length > 0 || creatorFilter !== null) && (
                      <span className="filter-dot" />
                    )}
                  </button>
                  <button
                    disabled={busy || !followed.length}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={16} className={busy ? "spin" : ""} />
                    {busy ? t("feed.refreshing") : t("feed.refresh")}
                  </button>
                </div>
              </div>
              <div className="topic-chips">
                {["All topics", ...tags].map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setTag(topic)}
                    className={tag === topic ? "active" : ""}
                  >
                    {topic === "All topics" ? t("topics.all") : topic}{" "}
                    <span className="unread-count">{unreadInTopic(topic)}</span>
                  </button>
                ))}
                <label className="search">
                  <Search size={16} />
                  <input
                    placeholder={t("feed.search")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div
                className="time-filters"
                role="group"
                aria-label={t("feed.publicationTime")}
              >
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    aria-pressed={timeRange === range}
                    title={
                      range === "1w+"
                        ? t("time.olderThanWeek")
                        : range === "All"
                          ? t("time.anyTime")
                          : t("time.within", { range: t(`time.${range}`) })
                    }
                    onClick={() => setTimeRange(range)}
                  >
                    {t(`time.${range}`)}
                  </button>
                ))}
              </div>
              {removedPost && (
                <div className="removed-notice" role="status">
                  {t("feed.removed")}{" "}
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
                    {t("feed.undo")}
                  </button>
                </div>
              )}
              {filters && (
                <div className="filters">
                  <div>
                    <span>{t("filters.contentType")}</span>
                    {contentFilters.map((k) => (
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
                        {t(`filter.${k}`)}{" "}
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
                      {t("filters.creators")}{" "}
                      {tag !== "All topics" && (
                        <small>{t("filters.inTopic", { topic: tag })}</small>
                      )}
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
                      {t("filters.allCreators")}
                    </button>
                    <button type="button" onClick={() => setCreatorFilter([])}>
                      {t("filters.noCreators")}
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
                        <small>{t("filters.noCreatorsInTopic")}</small>
                      )}
                    </div>
                    <small>{t("filters.uncheckHint")}</small>
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
                    {t("filters.reset")}
                  </button>
                </div>
              )}
              <div className="feed-info">
                <span>
                  <span className="live-dot" />
                  {t("feed.sources")}{" "}
                  <span className="muted">{t("feed.chronological")}</span>
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
                  {t("feed.markRead")}
                </button>
              </div>
              {state.creators.some((c) => c.error) && (
                <div className="warning">
                  {t("feed.attention")}{" "}
                  <button onClick={() => navigate("creators")}>
                    {t("feed.syncDetails")} <ArrowUpRight size={13} />
                  </button>
                </div>
              )}
              {loading ? (
                <div className="empty">{t("feed.loading")}</div>
              ) : !visible.length ? (
                <Empty
                  title={
                    followed.length
                      ? t("feed.emptyTitle")
                      : t("feed.startTitle")
                  }
                  text={
                    followed.length ? t("feed.emptyText") : t("feed.startText")
                  }
                  action={
                    followed.length
                      ? () => void refresh()
                      : () => setModal(true)
                  }
                  actionLabel={
                    followed.length
                      ? t("feed.emptyAction")
                      : t("feed.startAction")
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
                  {t("feed.showMore")}{" "}
                  <span>
                    {t("feed.remaining", { count: visible.length - limit })}
                  </span>
                </button>
              )}
              {!!visible.length && visible.length <= limit && (
                <div className="caught-up">
                  <div>
                    <Check size={21} />
                  </div>
                  <h3>
                    {visible.some((p) => !p.read)
                      ? t("feed.end")
                      : t("feed.caughtUp")}
                  </h3>
                  <p>{t("feed.goMake")}</p>
                </div>
              )}
              <div className="source-note">{t("feed.sourceNote")}</div>
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
  actionLabel,
}: {
  title: string;
  text: string;
  action: () => void;
  actionLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <span className="empty-icon">
        <Rss size={30} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={action}>
        <Plus size={16} />
        {actionLabel ?? t("action.addCreator")}
      </button>
      <div className="empty-promises">
        <span>
          <Check size={14} />
          {t("empty.promiseApproved")}
        </span>
        <span>
          <Check size={14} />
          {t("empty.promiseFinite")}
        </span>
        <span>
          <Check size={14} />
          {t("empty.promiseTopics")}
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
  const { t, locale } = useI18n();
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
                  ? t("post.dateTikTok")
                  : t("post.dateYouTube")
                : p.published
                  ? new Date(p.published).toLocaleString(locale)
                  : undefined
            }
          >
            {p.publishedApproximate && p.published ? "≈ " : ""}
            {relativeTime(p.published, Date.now(), locale)}{" "}
            <span className="post-type">· {postLabel(p, locale)}</span>
          </small>
        </div>
        <button
          className={p.saved ? "saved" : ""}
          aria-label={p.saved ? t("post.unsave") : t("post.save")}
          onClick={() => void mutate(p, "saved")}
        >
          <Bookmark size={18} fill={p.saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button
        type="button"
        className="post-link"
        aria-label={t("post.view", { title: p.title })}
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
              <span className="album-count">
                {t("post.images", { count: p.images.length })}
              </span>
            )}
            {p.duration && <span className="duration">{p.duration}</span>}
            {p.locked && (
              <span className="locked-badge">
                <Lock size={13} /> {t("post.locked")}
              </span>
            )}
            <span className="kind">{postLabel(p, locale)}</span>
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
          {p.read ? t("post.isRead") : t("post.markRead")}
        </button>
        <LinkActions url={p.url} compact />
        <button
          aria-label={t("post.remove")}
          title={t("post.removeTitle")}
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
  const { t } = useI18n();
  const selected = enabledTypes(account);
  return (
    <fieldset className="sync-choices">
      <legend>
        {t("sync.from", {
          platform:
            account.platform === "youtube"
              ? "YouTube"
              : account.platform === "x"
                ? "X"
                : account.platform === "patreon"
                  ? "Patreon"
                  : account.platform === "linkedin"
                    ? "LinkedIn"
                    : account.platform,
        })}
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
            ? t("sync.reels")
            : t(`sync.${kind}`)}
        </label>
      ))}
      {!selected.length && (
        <span className="sync-paused">{t("sync.paused")}</span>
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
  const { t } = useI18n();
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
  const modalPlatform = (
    ["x", "instagram", "tiktok", "patreon", "linkedin"].includes(platform)
      ? platform
      : "youtube"
  ) as "x" | "instagram" | "tiktok" | "patreon" | "linkedin" | "youtube";
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
          aria-label={t("modal.close")}
        >
          <X size={21} />
        </button>
        <div className="eyebrow">{t("modal.eyebrow")}</div>
        <h2 id="modal-title">
          {creator ? t("modal.editTitle") : t("modal.newTitle")}
        </h2>
        <p>{t("modal.intro")}</p>
        <form onSubmit={submit}>
          {!creator && (
            <label>
              {t("modal.source")}
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
                              e.target.value === "patreon" ||
                              e.target.value === "linkedin"
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
                <option value="linkedin">LinkedIn</option>
              </select>
              {t(`modal.account.${modalPlatform}`)}
              <input
                autoFocus
                required
                placeholder={
                  modalPlatform === "linkedin"
                    ? "https://www.linkedin.com/in/name/"
                    : t(`modal.placeholder.${modalPlatform}`)
                }
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              />
              <small>
                {platform === "patreon"
                  ? t("modal.hint.patreon")
                  : platform === "instagram" ||
                      platform === "tiktok" ||
                      platform === "linkedin"
                    ? t("modal.hint.public")
                    : t("modal.hint.youtube")}
              </small>
            </label>
          )}
          <label>
            {t("modal.displayName")} {creator ? "" : t("modal.optional")}
            <input
              autoFocus={!!creator}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("modal.displayNamePlaceholder")}
            />
          </label>
          <label>
            {t("modal.topics")}
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t("modal.topicsPlaceholder")}
            />
            <small>{t("modal.topicsHint")}</small>
          </label>
          {creator &&
            !creator.accounts.some((a) => a.platform === "youtube") && (
              <label>
                {t("modal.youtubeOptional")}
                <input
                  value={
                    accounts.find((a) => a.platform === "youtube")?.username ||
                    ""
                  }
                  placeholder={t("modal.youtubePlaceholder")}
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
                <span>{t("modal.publicContent")}</span>
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
                  t("modal.youtubeHint")}
              </small>
            </div>
          )}
          <div className="source-settings">
            <div className="source-heading">
              <strong>X (Twitter)</strong>
              <span>{t("modal.publicContent")}</span>
            </div>
            {!(!creator && platform === "x") && (
              <label>
                {t("modal.xLabel")}
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
                t("modal.xHint")}
            </small>
          </div>
          <div className="source-settings">
            <div className="source-heading">
              <strong>Instagram</strong>
              <span>{t("modal.publicContent")}</span>
            </div>
            {!(!creator && platform === "instagram") && (
              <label>
                {t("modal.instagramLabel")}
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
                t("modal.instagramHint")}
            </small>
          </div>
          <details>
            <summary>
              {t("modal.otherAccounts")}{" "}
              <span>TikTok · Patreon · LinkedIn</span>
            </summary>
            {["tiktok", "patreon", "linkedin"].map((platform) => {
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
                    {platform === "linkedin"
                      ? "LinkedIn"
                      : platform[0].toUpperCase() + platform.slice(1)}
                    <input
                      value={account.username}
                      placeholder={t("modal.otherPlaceholder")}
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
                            ? t("modal.tiktokHint")
                            : platform === "linkedin"
                              ? t("modal.linkedinHint")
                              : account.phoneSync
                                ? t("modal.patreonPhoneHint")
                                : t("modal.patreonHint"))}
                      </small>
                      {platform === "patreon" && creator && (
                        <PhoneSync username={account.username} />
                      )}
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
                {confirm ? t("modal.confirmUnfollow") : t("modal.unfollow")}
              </button>
            )}
            <button className="primary" disabled={busy} type="submit">
              {busy
                ? t("modal.saving")
                : creator
                  ? t("modal.save")
                  : t("modal.follow")}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <AuthGate>
      {(username, logout) => <App username={username} logout={logout} />}
    </AuthGate>
  </I18nProvider>,
);
