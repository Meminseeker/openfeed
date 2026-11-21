import { useState } from "react";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import { useI18n } from "./LocaleProvider";
export function LinkActions({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false),
    [fallback, setFallback] = useState(false);
  return (
    <span className={`link-actions ${compact ? "compact" : ""}`}>
      <button
        type="button"
        title={t("link.copyTitle")}
        aria-label={t("link.copyTitle")}
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
        <span>{copied ? t("link.copied") : t("link.copy")}</span>
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={t("link.openTitle")}
      >
        <ArrowUpRight size={14} />
        <span>{t("link.open")}</span>
      </a>
      {fallback && (
        <label className="copy-fallback">
          {t("link.copyThis")}
          <input
            aria-label={t("link.source")}
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
