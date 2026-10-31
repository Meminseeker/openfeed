import { useState } from "react";
import { Copy, Check, Smartphone } from "lucide-react";
import { api } from "./api";

interface PhoneSyncInfo {
  enabled: boolean;
  token?: string;
  creators: {
    name: string;
    username: string;
    campaignId?: string;
    lastSync?: string;
    lookupUrl?: string;
    patreonUrl?: string;
    importUrl?: string;
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
    [error, setError] = useState(""),
    [campaignId, setCampaignId] = useState("");
  const run = async (path: string, method = "GET", body?: unknown) => {
    setBusy(true);
    setError("");
    try {
      const next: PhoneSyncInfo = await api(path, method, body);
      // The token is returned only once; keep it visible after later updates.
      setInfo((prev) => ({ ...next, token: next.token ?? prev?.token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load phone sync.");
    } finally {
      setBusy(false);
    }
  };
  const load = (create: boolean) =>
    run("patreon/phone-sync", create ? "POST" : "GET");
  const saveCampaign = () =>
    run("patreon/campaign", "PUT", { username, campaignId });
  const creator = info?.creators.find(
    (c) => c.username.toLowerCase() === username.trim().toLowerCase(),
  );
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
      ) : !creator.campaignId || !creator.patreonUrl || !creator.importUrl ? (
        <>
          <p>
            The server cannot reach Patreon to look up this creator, so enter
            the campaign ID once. Open the lookup in a browser and copy the
            number after <code>"id":</code>.
          </p>
          {creator.lookupUrl && (
            <a href={creator.lookupUrl} target="_blank" rel="noreferrer">
              Open Patreon lookup
            </a>
          )}
          <label className="copy-field">
            <span>Patreon campaign ID</span>
            <span>
              <input
                inputMode="numeric"
                placeholder="e.g. 6460488"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void saveCampaign();
                }}
              />
            </span>
          </label>
          <button
            type="button"
            disabled={busy || !/^\d+$/.test(campaignId)}
            onClick={() => void saveCampaign()}
          >
            Save campaign ID
          </button>
        </>
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
