import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { api } from "./api";
import { useI18n } from "./LocaleProvider";

function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as { standalone?: boolean }).standalone)
  );
}

async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

// Called before logout so a shared browser does not keep receiving push
// notifications for the signed-out account.
export async function unsubscribeCurrentDevice(): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  )
    return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await api("push/subscribe", "DELETE", { endpoint: sub.endpoint }).catch(
      () => {},
    );
    await sub.unsubscribe().catch(() => {});
  } catch {
    // Best effort on logout.
  }
}

export function NotificationToggle() {
  const { t, locale, describe } = useI18n();
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState("");

  useEffect(() => {
    const hasPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!hasPush) {
      if (isIosDevice() && !isStandalone()) setIosNeedsInstall(true);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (!sub || cancelled) return;
        const status = await api(
          `push/status?endpoint=${encodeURIComponent(sub.endpoint)}`,
        );
        if (cancelled) return;
        if (status.subscribed) {
          setEnabled(true);
          // Keep stored device locale in sync with the active UI language.
          const json = sub.toJSON();
          if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
            void api("push/subscribe", "POST", {
              endpoint: json.endpoint,
              keys: json.keys,
              locale,
            }).catch(() => {});
          }
        }
      } catch {
        // Ignore initial probe failures.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (iosNeedsInstall) {
    return (
      <div className="notifications-control">
        <button
          type="button"
          className="nav"
          onClick={() =>
            setHelp(help ? "" : t("notifications.iosInstallHelp"))
          }
        >
          <BellOff size={19} />
          {t("notifications.off")}
        </button>
        {help && <p className="notifications-help">{help}</p>}
      </div>
    );
  }

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    setHelp("");
    try {
      if (enabled) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await api("push/subscribe", "DELETE", { endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        setEnabled(false);
        return;
      }

      const nextPermission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setHelp(
          nextPermission === "denied"
            ? t("notifications.deniedHelp")
            : t("notifications.permissionNeeded"),
        );
        return;
      }

      const reg = await getOrRegisterServiceWorker();
      await navigator.serviceWorker.ready;
      const { publicKey } = await api("push/vapid-key");
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const json = sub.toJSON();
      await api("push/subscribe", "POST", {
        endpoint: json.endpoint,
        keys: json.keys,
        locale,
      });
      setEnabled(true);
    } catch (e) {
      setHelp(describe(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notifications-control">
      <button
        type="button"
        className={enabled ? "nav active" : "nav"}
        disabled={busy}
        aria-pressed={enabled}
        onClick={() => void toggle()}
      >
        {enabled ? <Bell size={19} /> : <BellOff size={19} />}
        {busy
          ? t("notifications.updating")
          : enabled
            ? t("notifications.on")
            : permission === "denied"
              ? t("notifications.blocked")
              : t("notifications.off")}
      </button>
      {help && <p className="notifications-help">{help}</p>}
    </div>
  );
}
