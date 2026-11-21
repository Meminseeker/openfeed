import { useState } from "react";
import { Copy, Check, Smartphone } from "lucide-react";
import { api } from "./api";
import { useI18n } from "./LocaleProvider";

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
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <label className="copy-field">
      <span>{label}</span>
      <span>
        <input readOnly value={value} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          aria-label={t("phone.copy", { label })}
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
  const { t, locale, describe } = useI18n();
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
      setError(e instanceof Error ? describe(e) : t("phone.loadError"));
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
        <Smartphone size={15} /> {t("phone.setup")}
      </button>
    );
  return (
    <div className="phone-sync">
      {!creator ? (
        <p>{t("phone.saveFirst")}</p>
      ) : !creator.campaignId || !creator.patreonUrl || !creator.importUrl ? (
        <>
          <p>
            {t("phone.lookupIntro")} <code>"id":</code>.
          </p>
          {creator.lookupUrl && (
            <a href={creator.lookupUrl} target="_blank" rel="noreferrer">
              {t("phone.openLookup")}
            </a>
          )}
          <label className="copy-field">
            <span>{t("phone.campaignId")}</span>
            <span>
              <input
                inputMode="numeric"
                placeholder={t("phone.campaignPlaceholder")}
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
            {t("phone.saveCampaign")}
          </button>
        </>
      ) : (
        <>
          <p>
            {creator.lastSync
              ? t("phone.lastUpload", {
                  date: new Date(creator.lastSync).toLocaleString(locale),
                })
              : t("phone.noUpload")}{" "}
            {t("phone.explain")}
          </p>
          <CopyField label={t("phone.patreonUrl")} value={creator.patreonUrl} />
          <CopyField label={t("phone.uploadUrl")} value={creator.importUrl} />
          {info.token ? (
            <CopyField
              label={t("phone.header")}
              value={`Bearer ${info.token}`}
            />
          ) : (
            <p>
              {info.enabled ? t("phone.tokenExists") : t("phone.tokenCreate")}
            </p>
          )}
          {!info.token && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void load(true)}
            >
              {info.enabled ? t("phone.replaceToken") : t("phone.createToken")}
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
