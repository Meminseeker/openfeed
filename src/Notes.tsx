import { useState, useRef, useEffect } from "react";
import { StickyNote, Clock, Save } from "lucide-react";
import { writeNotes } from "./api";
import { timestamp, noteTimestamps } from "./viewer-shortcuts";
import type { Post } from "./types";
function localDraft(id: string) {
  try {
    return localStorage.getItem(`openfeed.notes.${id}`);
  } catch {
    return null;
  }
}
function storeDraft(id: string, text: string) {
  try {
    localStorage.setItem(`openfeed.notes.${id}`, text);
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
  const [draft, setDraft] = useState(
      () => localDraft(post.id) ?? post.notes ?? "",
    ),
    [status, setStatus] = useState("Saved"),
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
      setStatus("Saving…");
      setError("");
    }
    try {
      await writeNotes(post.id, snapshot);
      saved.current = snapshot;
      callback.current(post.id, snapshot);
      if (localDraft(post.id) === snapshot) {
        try {
          localStorage.removeItem(`openfeed.notes.${post.id}`);
        } catch {}
      }
      if (mounted.current && latest.current === snapshot) setStatus("Saved");
    } catch (e) {
      if (mounted.current) {
        setStatus("Unsaved");
        setError((e as Error).message + " Your draft is kept in this browser.");
      }
    } finally {
      pending.current--;
    }
  };
  const change = (value: string) => {
    value = value.slice(0, 50000);
    latest.current = value;
    setDraft(value);
    storeDraft(post.id, value);
    setStatus("Unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  };
  useEffect(() => {
    mounted.current = true;
    if (latest.current !== saved.current) {
      setStatus("Unsaved");
      timer.current = setTimeout(() => void flush(), 600);
    }
    const unloading = () => storeDraft(post.id, latest.current);
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
        <h3>Your notes</h3>
        <span role="status">{status}</span>
      </div>
      <p>A thought, a question, something to keep.</p>
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
          Add current timestamp
        </button>
      )}
      <textarea
        aria-label="Content notes"
        maxLength={50000}
        value={draft}
        onChange={(e) => change(e.target.value)}
        placeholder="What stood out to you?"
        spellCheck
      />
      <div className="notes-bottom">
        <small>
          Autosaved locally · {draft.length.toLocaleString()}/50,000
        </small>
        <button onClick={() => void flush()}>
          <Save size={14} />
          Save now
        </button>
      </div>
      {error && (
        <div className="note-error" role="alert">
          {error}
        </div>
      )}
      {seek && noteTimestamps(draft).length > 0 && (
        <div className="note-jumps">
          <small>JUMP TO A NOTE</small>
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
