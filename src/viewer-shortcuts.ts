export type ViewerAction =
  "previous" | "next" | "back" | "forward" | "play" | "captions" | "close";
export function viewerShortcut(
  key: string,
  editable: boolean,
  modified: boolean,
): ViewerAction | undefined {
  if (modified || editable) return;
  return (
    {
      ArrowUp: "previous",
      ArrowDown: "next",
      ArrowLeft: "back",
      ArrowRight: "forward",
      " ": "play",
      k: "play",
      K: "play",
      c: "captions",
      C: "captions",
      Escape: "close",
    } as Record<string, ViewerAction>
  )[key];
}
export function seekPosition(current: number, delta: number, duration: number) {
  return Math.min(
    Math.max(0, current + delta),
    duration > 0 ? duration : Infinity,
  );
}
export function timestamp(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function noteTimestamps(notes: string) {
  return [...new Set(notes.match(/\[\d{1,3}:\d{2}(?::\d{2})?\]/g) || [])]
    .slice(0, 100)
    .map((label) => ({
      label,
      seconds: label
        .slice(1, -1)
        .split(":")
        .reduce((total, part) => total * 60 + Number(part), 0),
    }));
}
