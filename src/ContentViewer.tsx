import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
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
import { LinkActions } from "./LinkActions";
export function ContentViewer({
  post,
  creator,
  index,
  total,
  close,
  navigate,
  onNotesSaved,
  onSave,
}: {
  post: Post;
  creator: Creator;
  index: number;
  total: number;
  close: () => void;
  navigate: (delta: number) => void;
  onNotesSaved: (id: string, notes: string) => void;
  onSave: () => void;
}) {
  const dialog = useRef<HTMLElement>(null),
    host = useRef<HTMLDivElement>(null),
    player = useRef<YouTubePlayer | undefined>(undefined),
    touch = useRef<{ x: number; y: number } | undefined>(undefined);
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
  const images = post.images?.length
    ? post.images
    : post.image
      ? [post.image]
      : [];
  const videoId = post.kind === "community" ? post.videoId : post.id;
  const isVideo = !!videoId;
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
    setImageIndex(0);
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
          },
          events: {
            onReady: (event: { target: YouTubePlayer }) => {
              if (cancelled) return;
              player.current = event.target;
              const iframe = event.target.getIframe();
              iframe.title = post.title;
              iframe.setAttribute(
                "referrerpolicy",
                "strict-origin-when-cross-origin",
              );
              setReady(true);
            },
            onStateChange: (event: { data: number }) => {
              if (!cancelled) setPlaying(event.data === 1);
            },
            onError: (event: { data: number }) => {
              if (!cancelled)
                setError(
                  event.data === 101 || event.data === 150
                    ? "This creator has disabled embedded playback. Use Open source to watch on YouTube."
                    : event.data === 100
                      ? "This video is unavailable or private."
                      : `YouTube could not play this video (error ${event.data}). Try again or open the source.`,
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
    if (!ready) return;
    const tick = () => {
      if (player.current) {
        setPosition(player.current.getCurrentTime() || 0);
        setDuration(player.current.getDuration() || 0);
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [ready]);
  const seek = useCallback(
    (seconds: number) => {
      if (player.current && ready)
        player.current.seekTo(Math.max(0, seconds), true);
    },
    [ready],
  );
  const skip = useCallback(
    (delta: number) => {
      const p = player.current;
      if (p && ready)
        p.seekTo(
          seekPosition(p.getCurrentTime(), delta, p.getDuration()),
          true,
        );
    },
    [ready],
  );
  const togglePlay = useCallback(() => {
    const p = player.current;
    if (p && ready) {
      if (p.getPlayerState() === 1) p.pauseVideo();
      else p.playVideo();
    }
  }, [ready]);
  const toggleCaptions = useCallback(() => {
    const p = player.current;
    if (!p || !ready) return;
    // Caption module loading is exposed by some embedded players, but isn't a
    // documented stable toggle API. Native player C remains the reliable fallback.
    if (p.loadModule && p.unloadModule) {
      if (captions) p.unloadModule("captions");
      else p.loadModule("captions");
      setCaptions(!captions);
      setHint(
        "Caption availability depends on the video. Use the player CC button if no captions appear.",
      );
    } else {
      p.getIframe().focus();
      setHint("The player is focused. Press C to toggle its captions.");
    }
  }, [ready, captions]);
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
        if (action === "close") close();
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
  }, [close, navigate, isVideo, skip, slide, togglePlay, toggleCaptions]);
  return (
    <div
      className="viewer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="content-viewer"
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
              <small>
                YouTube ·{" "}
                {post.kind === "community"
                  ? "Community post"
                  : post.kind === "short"
                    ? "Short"
                    : "Video"}
              </small>
            </div>
          </div>
          <div className="viewer-header-actions">
            <LinkActions key={post.id} url={post.url} />
            <button
              aria-label={post.saved ? "Remove from saved" : "Save for later"}
              aria-pressed={post.saved}
              onClick={onSave}
            >
              <Bookmark size={18} fill={post.saved ? "currentColor" : "none"} />
            </button>
            <button aria-label="Close viewer" onClick={close}>
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
                  className={`video-stage ${post.kind === "short" ? "short-stage" : ""}`}
                >
                  <div ref={host} className="youtube-host" />
                  {!ready && !error && (
                    <span className="player-loading">
                      Loading YouTube player…
                    </span>
                  )}
                </div>
                {error ? (
                  <div className="player-error" role="alert">
                    {error}
                    <button onClick={() => setRetry((n) => n + 1)}>
                      Retry player
                    </button>
                  </div>
                ) : (
                  <div className="video-controls">
                    <span className="video-time" aria-label="Playback position">
                      {timestamp(position)} / {timestamp(duration)}
                    </span>
                    <button
                      disabled={!ready}
                      aria-label="Rewind 5 seconds"
                      onClick={() => skip(-5)}
                    >
                      <RotateCcw size={17} />
                      <span>5s</span>
                    </button>
                    <button
                      disabled={!ready}
                      aria-label={playing ? "Pause video" : "Play video"}
                      onClick={togglePlay}
                    >
                      {playing ? <Pause size={17} /> : <Play size={17} />}
                      <span>{playing ? "Pause" : "Play"}</span>
                    </button>
                    <button
                      disabled={!ready}
                      aria-label="Forward 5 seconds"
                      onClick={() => skip(5)}
                    >
                      <RotateCw size={17} />
                      <span>5s</span>
                    </button>
                    <button
                      disabled={!ready}
                      aria-label="Toggle captions"
                      onClick={toggleCaptions}
                    >
                      <Captions size={18} />
                      <span>Captions</span>
                    </button>
                  </div>
                )}
                {hint && (
                  <p className="player-hint" role="status">
                    {hint}
                  </p>
                )}
              </>
            ) : images.length > 0 ? (
              <div className="image-viewer">
                <div
                  className="image-stage"
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
                  {failedImage ? (
                    <div className="image-error">
                      <ImageIcon size={28} />
                      <p>This image couldn't load.</p>
                      <button onClick={() => setFailedImage(false)}>
                        Retry image
                      </button>
                    </div>
                  ) : (
                    <img
                      key={images[imageIndex]}
                      src={images[imageIndex]}
                      alt={`${creator.name}'s post, image ${imageIndex + 1} of ${images.length}`}
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
                        aria-label="Previous image"
                        disabled={imageIndex === 0}
                        onClick={() => slide(-1)}
                      >
                        <ChevronLeft />
                      </button>
                      <button
                        className="image-next"
                        aria-label="Next image"
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
                        aria-label={`Show image ${i + 1}`}
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
            {post.text && <div className="viewer-text">{post.text}</div>}
            <div className="viewer-tags">
              {creator.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
          <Notes
            key={post.id}
            post={post}
            onSaved={onNotesSaved}
            currentTime={
              isVideo && ready
                ? () => player.current?.getCurrentTime() || 0
                : undefined
            }
            seek={isVideo && ready ? seek : undefined}
          />
        </div>
        <footer className="viewer-footer">
          <div className="content-navigation">
            <button
              aria-label="Previous content"
              disabled={index === 0}
              onClick={() => navigate(-1)}
            >
              <ArrowUp size={15} />
              Previous
            </button>
            <span>
              {index + 1} of {total}
            </span>
            <button
              aria-label="Next content"
              disabled={index === total - 1}
              onClick={() => navigate(1)}
            >
              Next
              <ArrowDown size={15} />
            </button>
          </div>
          <div className="shortcut-help">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> content
            </span>
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd> {isVideo ? "seek 5s" : "images"}
            </span>
            {isVideo && (
              <>
                <span>
                  <kbd>Space</kbd> play
                </span>
                <span>
                  <kbd>C</kbd> captions
                </span>
              </>
            )}
            <span>
              <kbd>Esc</kbd> close
            </span>
          </div>
        </footer>
        {isVideo && (
          <div className="iframe-help">
            Click the title to use feed shortcuts. Inside the player, YouTube
            handles its own keys. Shortcuts pause while you type notes.
          </div>
        )}
      </section>
    </div>
  );
}
