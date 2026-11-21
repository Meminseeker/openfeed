import { postLabel } from "./post-label";
import { relativeTime } from "./relative-time";
import { contentSwipe } from "./viewer-swipe";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Maximize,
  Minimize,
  Trash2,
  NotebookPen,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Captions,
  RotateCcw,
  RotateCw,
  Bookmark,
  Image as ImageIcon,
} from "lucide-react";
import type { Post, Creator } from "./types";
import { loadYouTube, type YouTubePlayer } from "./youtube-player";
import { viewerShortcut, seekPosition, timestamp } from "./viewer-shortcuts";
import { Notes } from "./Notes";
import { RichText } from "./RichText";
import { LinkActions } from "./LinkActions";
import { useI18n } from "./LocaleProvider";
export function ContentViewer({
  post,
  creator,
  index,
  total,
  close,
  navigate,
  onNotesSaved,
  onSave,
  onRemove,
}: {
  post: Post;
  creator: Creator;
  index: number;
  total: number;
  close: () => void;
  navigate: (delta: number) => void;
  onNotesSaved: (id: string, notes: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { t, locale } = useI18n();
  const dialog = useRef<HTMLElement>(null),
    host = useRef<HTMLDivElement>(null),
    native = useRef<HTMLVideoElement>(null),
    player = useRef<YouTubePlayer | undefined>(undefined),
    touch = useRef<{ x: number; y: number } | undefined>(undefined);
  const videoStage = useRef<HTMLDivElement>(null);
  const imageStage = useRef<HTMLDivElement>(null);
  const tikTok = useRef<HTMLIFrameElement>(null);
  const [embedFallback, setEmbedFallback] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [rates, setRates] = useState<number[]>([0.5, 0.75, 1, 1.25, 1.5, 2]);
  const [expanded, setExpanded] = useState<"video" | "image" | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const contentTouch = useRef<{ x: number; y: number } | undefined>(undefined);
  const [imageIndex, setImageIndex] = useState(0),
    [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false),
    [captions, setCaptions] = useState(false),
    [error, setError] = useState(""),
    [hint, setHint] = useState(""),
    [retry, setRetry] = useState(0),
    [failedImage, setFailedImage] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0);
  const images =
    post.images !== undefined ? post.images : post.image ? [post.image] : [];
  const [videoIndex, setVideoIndex] = useState(0);
  const videoId =
    post.platform === "patreon"
      ? post.videoId
      : post.platform === "tiktok" ||
          post.platform === "x" ||
          post.platform === "instagram" ||
          post.kind === "post"
        ? undefined
        : post.kind === "community"
          ? post.videoId
          : post.id;
  const nativeVideo = embedFallback ? undefined : post.videos?.[videoIndex];
  const isTikTok =
    post.platform === "tiktok" &&
    !nativeVideo &&
    /^\d+$/.test(post.videoId || "");
  const isVideo = !!videoId || !!nativeVideo || isTikTok;
  const messageTikTok = useCallback((type: string, value?: number) => {
    tikTok.current?.contentWindow?.postMessage(
      { type, value, "x-tiktok-player": true },
      "https://www.tiktok.com",
    );
  }, []);
  const fullscreen = async (type: "video" | "image") => {
    if (expanded) {
      setExpanded(null);
      if (document.fullscreenElement)
        await document.exitFullscreen().catch(() => {});
      return;
    }
    const element = type === "video" ? videoStage.current : imageStage.current;
    setExpanded(type);
    try {
      await element?.requestFullscreen?.();
    } catch {
      /* Expanded view remains available on iOS. */
    }
  };
  useEffect(() => {
    const changed = () => {
      if (!document.fullscreenElement) setExpanded(null);
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!isTikTok) return;
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.tiktok.com" ||
        event.source !== tikTok.current?.contentWindow ||
        !event.data?.["x-tiktok-player"]
      )
        return;
      const { type, value } = event.data;
      if (type === "onPlayerReady") setReady(true);
      if (type === "onStateChange") {
        setPlaying(value === 1);
        setReady(true);
      }
      if (
        type === "onCurrentTime" &&
        Number.isFinite(value?.currentTime) &&
        Number.isFinite(value?.duration)
      ) {
        setPosition(value.currentTime);
        setDuration(value.duration);
      }
      if (type === "onPlayerError") setError(t("viewer.tiktokError"));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [isTikTok, post.id]);
  useEffect(() => {
    setEmbedFallback(false);
    setExpanded(null);
  }, [post.id]);
  const changeSpeed = (rate: number) => {
    if (native.current) {
      native.current.playbackRate = rate;
      setSpeed(native.current.playbackRate);
    } else if (player.current) player.current.setPlaybackRate(rate);
  };
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      focus?.focus();
    };
  }, []);
  useEffect(() => {
    contentTouch.current = undefined;
    setImageIndex(0);
    setVideoIndex(0);
    setSpeed(1);
    setRates([0.5, 0.75, 1, 1.25, 1.5, 2]);
    setPosition(0);
    setDuration(0);
    setFailedImage(false);
    setReady(false);
    setPlaying(false);
    setCaptions(false);
    setError("");
    setHint("");
    if (!videoId || !host.current) return;
    let cancelled = false;
    const mount = document.createElement("div");
    host.current.replaceChildren(mount);
    let instance: YouTubePlayer | undefined;
    void loadYouTube()
      .then((YT) => {
        if (cancelled) return;
        instance = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars: {
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
            autoplay: 0,
            fs: 1,
            hl: locale,
          },
          events: {
            onReady: (event: { target: YouTubePlayer }) => {
              if (cancelled) return;
              player.current = event.target;
              const iframe = event.target.getIframe();
              iframe.title = post.title;
              iframe.allowFullscreen = true;
              iframe.allow =
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
              setRates(event.target.getAvailablePlaybackRates());
              iframe.setAttribute(
                "referrerpolicy",
                "strict-origin-when-cross-origin",
              );
              setReady(true);
            },
            onPlaybackRateChange: (event: { data: number }) =>
              setSpeed(event.data),
            onStateChange: (event: { data: number }) => {
              if (!cancelled) setPlaying(event.data === 1);
            },
            onError: (event: { data: number }) => {
              if (!cancelled)
                setError(
                  event.data === 101 || event.data === 150
                    ? t("viewer.embedDisabled")
                    : event.data === 100
                      ? t("viewer.unavailable")
                      : t("viewer.youtubeError", { code: event.data }),
                );
            },
          },
        });
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
      player.current = undefined;
      instance?.destroy();
    };
  }, [post.id, videoId, retry]);
  useEffect(() => {
    if (!ready || isTikTok) return;
    const tick = () => {
      if (native.current) {
        setPosition(native.current.currentTime || 0);
        setDuration(native.current.duration || 0);
      } else if (player.current) {
        setPosition(player.current.getCurrentTime() || 0);
        setDuration(player.current.getDuration() || 0);
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [ready, isTikTok]);
  const seek = useCallback(
    (seconds: number) => {
      if (isTikTok) {
        messageTikTok("seekTo", seekPosition(0, seconds, duration));
        return;
      }
      if (native.current && ready)
        native.current.currentTime = seekPosition(
          0,
          seconds,
          native.current.duration,
        );
      else if (player.current && ready)
        player.current.seekTo(Math.max(0, seconds), true);
    },
    [ready, isTikTok, duration, messageTikTok],
  );
  const skip = useCallback(
    (delta: number) => {
      if (isTikTok) {
        messageTikTok("seekTo", seekPosition(position, delta, duration));
        return;
      }
      if (native.current && ready) {
        native.current.currentTime = seekPosition(
          native.current.currentTime,
          delta,
          native.current.duration,
        );
        return;
      }
      const p = player.current;
      if (p && ready)
        p.seekTo(
          seekPosition(p.getCurrentTime(), delta, p.getDuration()),
          true,
        );
    },
    [ready, isTikTok, position, duration, messageTikTok],
  );
  const togglePlay = useCallback(() => {
    if (isTikTok) {
      messageTikTok(playing ? "pause" : "play");
      return;
    }
    if (native.current && ready) {
      if (native.current.paused)
        void native.current
          .play()
          .catch(() => setHint(t("viewer.playButtonHint")));
      else native.current.pause();
      return;
    }
    const p = player.current;
    if (p && ready) {
      if (p.getPlayerState() === 1) p.pauseVideo();
      else p.playVideo();
    }
  }, [ready, isTikTok, playing, messageTikTok, t]);
  const toggleCaptions = useCallback(() => {
    if (native.current) {
      const tracks = Array.from(native.current.textTracks);
      if (!tracks.length) {
        setHint(t("viewer.noCaptions"));
        return;
      }
      tracks.forEach((t) => (t.mode = captions ? "disabled" : "showing"));
      setCaptions(!captions);
      return;
    }
    const p = player.current;
    if (!p || !ready) return;
    // Caption module loading is exposed by some embedded players, but isn't a
    // documented stable toggle API. Native player C remains the reliable fallback.
    if (p.loadModule && p.unloadModule) {
      if (captions) p.unloadModule("captions");
      else p.loadModule("captions");
      setCaptions(!captions);
      setHint(t("viewer.captionsHint"));
    } else {
      p.getIframe().focus();
      setHint(t("viewer.playerFocused"));
    }
  }, [ready, captions, t]);
  const slide = useCallback(
    (delta: number) => {
      setFailedImage(false);
      setImageIndex((i) => Math.max(0, Math.min(images.length - 1, i + delta)));
    },
    [images.length],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const target = e.target as HTMLElement;
      const editable =
        target?.matches("input,textarea,select") || !!target?.isContentEditable;
      const action = viewerShortcut(
        e.key,
        editable,
        e.ctrlKey || e.metaKey || e.altKey,
      );
      if (action) {
        if (e.key === " " && target?.closest("button,a,summary")) return;
        e.preventDefault();
        if (action === "close") {
          if (expanded) {
            setExpanded(null);
            if (document.fullscreenElement) void document.exitFullscreen();
          } else close();
        }
        if (action === "previous") navigate(-1);
        if (action === "next") navigate(1);
        if (action === "back") isVideo ? skip(-5) : slide(-1);
        if (action === "forward") isVideo ? skip(5) : slide(1);
        if (action === "play" && isVideo) togglePlay();
        if (action === "captions" && isVideo) toggleCaptions();
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],textarea,input,iframe,[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
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
  }, [
    close,
    navigate,
    isVideo,
    skip,
    slide,
    togglePlay,
    toggleCaptions,
    expanded,
  ]);
  return (
    <div
      className="viewer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className={`content-viewer ${notesOpen ? "notes-open" : ""}`}
        onTouchStart={(e) => {
          contentTouch.current = undefined;
          if (
            e.touches.length !== 1 ||
            (e.target as HTMLElement).closest(
              "button, a, input, textarea, select, video, iframe, .image-stage, .image-thumbs, .notes-panel",
            )
          )
            return;
          contentTouch.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        }}
        onTouchCancel={() => {
          contentTouch.current = undefined;
        }}
        onTouchEnd={(e) => {
          const start = contentTouch.current;
          contentTouch.current = undefined;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          const delta = contentSwipe(dx, dy);
          if (delta) navigate(delta);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-title"
        ref={dialog}
        tabIndex={-1}
      >
        <header className="viewer-header">
          <div className="viewer-author">
            {creator.avatar && (
              <img src={creator.avatar} alt="" referrerPolicy="no-referrer" />
            )}
            <div>
              <strong>{creator.name}</strong>
              <small
                title={
                  post.published
                    ? new Date(post.published).toLocaleString(locale)
                    : undefined
                }
              >
                {postLabel(post, locale)} ·{" "}
                {post.publishedApproximate ? "≈ " : ""}
                {relativeTime(post.published, Date.now(), locale)}
              </small>
            </div>
          </div>
          <div className="viewer-header-actions">
            <LinkActions key={post.id} url={post.url} />
            <button
              aria-label={post.saved ? t("post.unsave") : t("post.save")}
              aria-pressed={post.saved}
              onClick={onSave}
            >
              <Bookmark size={18} fill={post.saved ? "currentColor" : "none"} />
            </button>
            <button aria-label={t("post.remove")} onClick={onRemove}>
              <Trash2 size={18} />
            </button>
            <button aria-label={t("viewer.close")} onClick={close}>
              <X size={22} />
            </button>
          </div>
        </header>
        <div className="viewer-layout">
          <div className="viewer-content">
            <h2 id="viewer-title" tabIndex={0}>
              {post.title}
            </h2>
            {isVideo ? (
              <>
                <div
                  ref={videoStage}
                  className={`video-stage ${post.kind === "short" || post.platform === "tiktok" ? "short-stage" : ""} ${expanded === "video" ? "media-expanded" : ""}`}
                >
                  <button
                    className="media-fullscreen"
                    aria-label={
                      expanded === "video"
                        ? t("viewer.exitFullscreen")
                        : t("viewer.fullscreenVideo")
                    }
                    onClick={() => void fullscreen("video")}
                  >
                    {expanded === "video" ? <Minimize /> : <Maximize />}
                  </button>
                  {isTikTok ? (
                    <iframe
                      ref={tikTok}
                      key={`${post.id}:${retry}`}
                      title={post.title}
                      className="tiktok-frame"
                      src={`https://www.tiktok.com/player/v1/${post.videoId}?autoplay=0&rel=0`}
                      allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : nativeVideo ? (
                    <video
                      key={nativeVideo.url}
                      ref={native}
                      src={
                        post.platform === "x"
                          ? `/api/posts/${encodeURIComponent(post.id)}/video/${videoIndex}`
                          : nativeVideo.url
                      }
                      poster={nativeVideo.poster}
                      controls
                      playsInline
                      preload="metadata"
                      loop={nativeVideo.loop}
                      muted={nativeVideo.loop}
                      onLoadedMetadata={() => {
                        setSpeed(native.current?.playbackRate || 1);
                        setReady(true);
                        setError("");
                      }}
                      onRateChange={(e) =>
                        setSpeed(e.currentTarget.playbackRate)
                      }
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onEnded={() => setPlaying(false)}
                      onError={() => {
                        if (post.platform === "tiktok") {
                          setEmbedFallback(true);
                          setReady(false);
                          setHint(t("viewer.tiktokFallback"));
                        } else setError(t("viewer.videoError"));
                      }}
                    />
                  ) : (
                    <div ref={host} className="youtube-host" />
                  )}
                  {(post.videos?.length || 0) > 1 && (
                    <select
                      aria-label={t("viewer.selectVideo")}
                      value={videoIndex}
                      onChange={(e) => {
                        setVideoIndex(Number(e.target.value));
                        setReady(false);
                        setPlaying(false);
                        setError("");
                      }}
                    >
                      {post.videos!.map((v, i) => (
                        <option key={v.url} value={i}>
                          {t("viewer.videoN", { n: i + 1 })}
                        </option>
                      ))}
                    </select>
                  )}
                  {!ready && !error && (
                    <span className="player-loading">
                      {t("viewer.loadingVideo")}
                    </span>
                  )}
                </div>
                {error ? (
                  <div className="player-error" role="alert">
                    {error}
                    <button
                      onClick={() => {
                        native.current?.load();
                        setError("");
                        setRetry((n) => n + 1);
                      }}
                    >
                      {t("viewer.retryPlayer")}
                    </button>
                  </div>
                ) : (
                  <div className="video-controls">
                    <span
                      className="video-time"
                      aria-label={t("viewer.position")}
                    >
                      {timestamp(position)} / {timestamp(duration)}
                    </span>
                    <button
                      disabled={!ready}
                      aria-label={t("viewer.rewind")}
                      onClick={() => skip(-5)}
                    >
                      <RotateCcw size={17} />
                      <span>5s</span>
                    </button>
                    <button
                      disabled={!ready}
                      aria-label={
                        playing ? t("viewer.pauseVideo") : t("viewer.playVideo")
                      }
                      onClick={togglePlay}
                    >
                      {playing ? <Pause size={17} /> : <Play size={17} />}
                      <span>
                        {playing ? t("viewer.pause") : t("viewer.play")}
                      </span>
                    </button>
                    <button
                      disabled={!ready}
                      aria-label={t("viewer.forward")}
                      onClick={() => skip(5)}
                    >
                      <RotateCw size={17} />
                      <span>5s</span>
                    </button>
                    <button
                      disabled={!ready}
                      aria-label={t("viewer.toggleCaptions")}
                      hidden={isTikTok}
                      onClick={toggleCaptions}
                    >
                      <Captions size={18} />
                      <span>{t("viewer.captions")}</span>
                    </button>
                    {!isTikTok && (
                      <div
                        className="speed-controls"
                        role="group"
                        aria-label={t("viewer.speed")}
                      >
                        {rates.map((rate) => (
                          <button
                            key={rate}
                            disabled={!ready}
                            aria-pressed={speed === rate}
                            onClick={() => changeSpeed(rate)}
                          >
                            {rate}×
                          </button>
                        ))}
                      </div>
                    )}
                    {isTikTok && <small>{t("viewer.tiktokSpeed")}</small>}
                  </div>
                )}
                {hint && (
                  <p className="player-hint" role="status">
                    {hint}
                  </p>
                )}
              </>
            ) : null}
            {post.platform !== "tiktok" &&
            post.platform !== "patreon" &&
            images.length > 0 &&
            (!isVideo || (!!post.platform && post.platform !== "youtube")) ? (
              <div className="image-viewer">
                <div
                  ref={imageStage}
                  className={`image-stage ${expanded === "image" ? "media-expanded" : ""}`}
                  onTouchStart={(e) => {
                    touch.current = {
                      x: e.changedTouches[0].clientX,
                      y: e.changedTouches[0].clientY,
                    };
                  }}
                  onTouchEnd={(e) => {
                    const start = touch.current;
                    touch.current = undefined;
                    if (!start) return;
                    const dx = e.changedTouches[0].clientX - start.x,
                      dy = e.changedTouches[0].clientY - start.y;
                    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4)
                      slide(dx < 0 ? 1 : -1);
                  }}
                >
                  <button
                    className="media-fullscreen"
                    aria-label={
                      expanded === "image"
                        ? t("viewer.exitFullscreen")
                        : t("viewer.fullscreenImage")
                    }
                    onClick={() => void fullscreen("image")}
                  >
                    {expanded === "image" ? <Minimize /> : <Maximize />}
                  </button>
                  {failedImage ? (
                    <div className="image-error">
                      <ImageIcon size={28} />
                      <p>{t("viewer.imageError")}</p>
                      <button onClick={() => setFailedImage(false)}>
                        {t("viewer.retryImage")}
                      </button>
                    </div>
                  ) : (
                    <img
                      key={images[imageIndex]}
                      src={images[imageIndex]}
                      alt={t("viewer.imageAlt", {
                        name: creator.name,
                        n: imageIndex + 1,
                        total: images.length,
                      })}
                      referrerPolicy="no-referrer"
                      onError={() => setFailedImage(true)}
                    />
                  )}
                  <span className="image-counter" aria-live="polite">
                    {imageIndex + 1} / {images.length}
                  </span>
                  {images.length > 1 && (
                    <>
                      <button
                        className="image-prev"
                        aria-label={t("viewer.previousImage")}
                        disabled={imageIndex === 0}
                        onClick={() => slide(-1)}
                      >
                        <ChevronLeft />
                      </button>
                      <button
                        className="image-next"
                        aria-label={t("viewer.nextImage")}
                        disabled={imageIndex === images.length - 1}
                        onClick={() => slide(1)}
                      >
                        <ChevronRight />
                      </button>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="image-thumbs">
                    {images.map((src, i) => (
                      <button
                        key={src}
                        aria-label={t("viewer.showImage", { n: i + 1 })}
                        aria-pressed={i === imageIndex}
                        onClick={() => {
                          setImageIndex(i);
                          setFailedImage(false);
                        }}
                      >
                        <img
                          src={src}
                          alt=""
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {post.platform === "instagram" &&
              ["video", "short"].includes(post.kind) &&
              !post.videos?.length && (
                <p className="player-hint">{t("viewer.instagramNoVideo")}</p>
              )}
            <button
              className="mobile-notes-toggle"
              aria-expanded={notesOpen}
              aria-controls="viewer-notes"
              onClick={() => setNotesOpen((open) => !open)}
            >
              <NotebookPen size={18} />{" "}
              {notesOpen ? t("viewer.hideNotes") : t("viewer.notes")}
              {post.notes?.trim() ? " •" : ""}
            </button>
            {post.textTruncated && (
              <p className="player-hint">
                {t("viewer.xTruncated")}{" "}
                <a href={post.url} target="_blank" rel="noreferrer">
                  {t("viewer.xReadFull")}
                </a>
                .
              </p>
            )}
            {post.locked && (
              <p className="player-hint">
                {t("viewer.locked")}{" "}
                <a href={post.url} target="_blank" rel="noreferrer">
                  {t("viewer.openPatreon")}
                </a>
                .
              </p>
            )}
            {post.blocks?.length ? (
              <RichText blocks={post.blocks} />
            ) : (
              post.text && <div className="viewer-text">{post.text}</div>
            )}
            <div className="viewer-tags">
              {creator.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
          <div id="viewer-notes" className="viewer-notes">
            <Notes
              key={post.id}
              post={post}
              onSaved={onNotesSaved}
              currentTime={
                isVideo && ready
                  ? () =>
                      (isTikTok ? position : native.current?.currentTime) ||
                      player.current?.getCurrentTime() ||
                      0
                  : undefined
              }
              seek={isVideo && ready ? seek : undefined}
            />
          </div>
        </div>
        <footer className="viewer-footer">
          <span className="swipe-hint">{t("viewer.swipe")}</span>
          <div className="content-navigation">
            <button
              aria-label={t("viewer.previousContent")}
              disabled={index === 0}
              onClick={() => navigate(-1)}
            >
              <ArrowUp size={15} />
              {t("viewer.previous")}
            </button>
            <span>{t("viewer.count", { n: index + 1, total })}</span>
            <button
              aria-label={t("viewer.nextContent")}
              disabled={index === total - 1}
              onClick={() => navigate(1)}
            >
              {t("viewer.next")}
              <ArrowDown size={15} />
            </button>
          </div>
          <div className="shortcut-help">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> {t("viewer.keyContent")}
            </span>
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd>{" "}
              {isVideo ? t("viewer.keySeek") : t("viewer.keyImages")}
            </span>
            {isVideo && (
              <>
                <span>
                  <kbd>{t("viewer.keySpace")}</kbd> {t("viewer.keyPlay")}
                </span>
                <span>
                  <kbd>C</kbd> {t("viewer.keyCaptions")}
                </span>
              </>
            )}
            <span>
              <kbd>Esc</kbd> {t("viewer.keyClose")}
            </span>
          </div>
        </footer>
        {!!videoId && (
          <div className="iframe-help">{t("viewer.iframeHelp")}</div>
        )}
      </section>
    </div>
  );
}
