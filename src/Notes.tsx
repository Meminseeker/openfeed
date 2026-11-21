import { useState, useRef, useEffect } from "react";
import { StickyNote, Clock, Save } from "lucide-react";
import { writeNotes, activeAccount } from "./api";
import { timestamp, noteTimestamps } from "./viewer-shortcuts";
import type { Post } from "./types";
import { useI18n } from "./LocaleProvider";
function localDraft(id: string) {
  try {
    return localStorage.getItem(id);
  } catch {
    return null;
  }
}
function storeDraft(id: string, text: string) {
  try {
    localStorage.setItem(id, text);
  } catch {}
}
export function Notes({
  post,
  onSaved,
  currentTime,
  seek,
}: {
  post: Post;
  onSaved: (id: string, notes: string) => void;
  currentTime?: () => number;
  seek?: (seconds: number) => void;
}) {
  const { t, locale, describe } = useI18n();
  const account = useRef(activeAccount()).current;
  const draftKey = useRef(
    `openfeed.notes.${activeAccount()}.${post.id}`,
  ).current;
  const [draft, setDraft] = useState(
      () => localDraft(draftKey) ?? post.notes ?? "",
    ),
    [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved"),
    [error, setError] = useState("");
  const latest = useRef(draft),
    saved = useRef(post.notes ?? ""),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    mounted = useRef(true),
    pending = useRef(0),
    callback = useRef(onSaved);
  callback.current = onSaved;
  const flush = async () => {
    clearTimeout(timer.current);
    const snapshot = latest.current;
    if (snapshot === saved.current && pending.current === 0) return;
    pending.current++;
    if (mounted.current) {
      setStatus("saving");
      setError("");
    }
    try {
      await writeNotes(post.id, snapshot, account);
      saved.current = snapshot;
      callback.current(post.id, snapshot);
      if (localDraft(draftKey) === snapshot) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
      }
      if (mounted.current && latest.current === snapshot) setStatus("saved");
    } catch (e) {
      if (mounted.current) {
        setStatus("unsaved");
        setError(t("notes.draftKept", { message: describe(e) }));
      }
    } finally {
      pending.current--;
    }
  };
  const change = (value: string) => {
    value = value.slice(0, 50000);
    latest.current = value;
    setDraft(value);
    storeDraft(draftKey, value);
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  };
  useEffect(() => {
    mounted.current = true;
    if (latest.current !== saved.current) {
      setStatus("unsaved");
      timer.current = setTimeout(() => void flush(), 600);
    }
    const unloading = () => storeDraft(draftKey, latest.current);
    window.addEventListener("pagehide", unloading);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", unloading);
      clearTimeout(timer.current);
      void flush();
    };
  }, [post.id]);
  return (
    <aside className="notes-panel">
      <div className="notes-heading">
        <StickyNote size={17} />
        <h3>{t("notes.heading")}</h3>
        <span role="status">{t(`notes.${status}`)}</span>
      </div>
      <p>{t("notes.intro")}</p>
      {currentTime && (
        <button
          className="timestamp-button"
          onClick={() =>
            change(
              `${latest.current}${latest.current && !latest.current.endsWith("\n") ? "\n" : ""}[${timestamp(currentTime())}] `,
            )
          }
        >
          <Clock size={14} />
          {t("notes.addTimestamp")}
        </button>
      )}
      <textarea
        aria-label={t("notes.label")}
        maxLength={50000}
        value={draft}
        onChange={(e) => change(e.target.value)}
        placeholder={t("notes.placeholder")}
        spellCheck
      />
      <div className="notes-bottom">
        <small>
          {t("notes.autosaved", {
            count: draft.length.toLocaleString(locale),
            max: (50000).toLocaleString(locale),
          })}
        </small>
        <button onClick={() => void flush()}>
          <Save size={14} />
          {t("notes.saveNow")}
        </button>
      </div>
      {error && (
        <div className="note-error" role="alert">
          {error}
        </div>
      )}
      {seek && noteTimestamps(draft).length > 0 && (
        <div className="note-jumps">
          <small>{t("notes.jump")}</small>
          {noteTimestamps(draft).map((t) => (
            <button key={t.label} onClick={() => seek(t.seconds)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
