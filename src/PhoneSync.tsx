import { useState } from "react";
import { Copy, Check, Smartphone } from "lucide-react";
import { api } from "./api";

interface PhoneSyncInfo {
  enabled: boolean;
  token?: string;
  creators: {
    name: string;
    username: string;
    lastSync?: string;
    patreonUrl: string;
    importUrl: string;
  }[];
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <label className="copy-field">
      <span>{label}</span>
      <span>
        <input readOnly value={value} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            } catch {}
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </span>
    </label>
  );
}

// Setup values for the iOS Shortcut that fetches Patreon on the phone and
// uploads the raw page to OpenFeed.
export function PhoneSync({ username }: { username: string }) {
  const [info, setInfo] = useState<PhoneSyncInfo>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async (create: boolean) => {
    setBusy(true);
    setError("");
    try {
      setInfo(
        await api("patreon/phone-sync", create ? "POST" : "GET", undefined),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load phone sync.");
    } finally {
      setBusy(false);
    }
  };
  const creator = info?.creators.find((c) => c.username === username);
  if (!info)
    return (
      <button
        type="button"
        className="phone-sync-open"
        disabled={busy}
        onClick={() => void load(false)}
      >
        <Smartphone size={15} /> Phone sync setup
      </button>
    );
  return (
    <div className="phone-sync">
      {!creator ? (
        <p>Save this creator first, then reopen phone sync setup.</p>
      ) : (
        <>
          <p>
            {creator.lastSync
              ? `Last phone upload: ${new Date(creator.lastSync).toLocaleString()}.`
              : "No phone upload yet."}{" "}
            The shortcut downloads the latest Patreon posts with your phone's
            session and uploads them here.
          </p>
          <CopyField label="1 · Patreon URL" value={creator.patreonUrl} />
          <CopyField
            label="2 · OpenFeed upload URL"
            value={creator.importUrl}
          />
          {info.token ? (
            <CopyField
              label="3 · Authorization header value (shown once)"
              value={`Bearer ${info.token}`}
            />
          ) : (
            <p>
              {info.enabled
                ? "A phone token already exists. Creating a new one replaces it."
                : "Create a token for the shortcut's Authorization header."}
            </p>
          )}
          {!info.token && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void load(true)}
            >
              {info.enabled ? "Replace phone token" : "Create phone token"}
            </button>
          )}
        </>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
