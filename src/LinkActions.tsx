import { useState } from "react";
import { Copy, Check, ArrowUpRight } from "lucide-react";
export function LinkActions({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false),
    [fallback, setFallback] = useState(false);
  return (
    <span className={`link-actions ${compact ? "compact" : ""}`}>
      <button
        type="button"
        title="Copy source link"
        aria-label="Copy source link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setFallback(false);
          } catch {
            setFallback(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? "Copied" : "Copy link"}</span>
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="Open source in a new tab"
      >
        <ArrowUpRight size={14} />
        <span>Open source</span>
      </a>
      {fallback && (
        <label className="copy-fallback">
          Copy this link
          <input
            aria-label="Source link"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </label>
      )}
    </span>
  );
}
