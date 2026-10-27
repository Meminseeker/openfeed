// Horizontal content gestures must not steal ordinary vertical scrolling.
export function contentSwipe(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) <= 60 || Math.abs(dx) <= Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
