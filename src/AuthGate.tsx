import { useEffect, useState, type ReactNode } from "react";
import { api, setActiveAccount } from "./api";
import { useI18n, LanguageSelect } from "./LocaleProvider";
export function AuthGate({
  children,
}: {
  children: (username: string, logout: () => void) => ReactNode;
}) {
  const { t } = useI18n();
  const [user, setUser] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [signup, setSignup] = useState(false),
    [claim, setClaim] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("auth/me")
      .then((data) => {
        setActiveAccount(data.user?.id || "");
        setUser(data.user?.username || null);
        setClaim(data.claimRequired);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener("openfeed:logout", expired);
    return () => window.removeEventListener("openfeed:logout", expired);
  }, []);
  if (loading) return <div className="empty">{t("app.opening")}</div>;
  if (user)
    return children(user, () => {
      void api("auth/logout", "POST")
        .then(() => {
          setUser(null);
          setClaim(false);
        })
        .catch((e) => setError(e.message));
    });
  return (
    <main className="auth-page">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(e.currentTarget);
          try {
            const data = await api(
              `auth/${signup ? "signup" : "login"}`,
              "POST",
              {
                username: form.get("username"),
                password: form.get("password"),
                setupToken: form.get("setupToken"),
              },
            );
            setActiveAccount(data.user.id);
            setUser(data.user.username);
            setClaim(false);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <img src="/icons/app-192.png" width="64" height="64" alt="" />
        <h1>OpenFeed</h1>
        <p>{signup ? t("auth.signupIntro") : t("auth.loginIntro")}</p>
        <label>
          {t("auth.username")}
          <input
            name="username"
            autoComplete="username"
            required
            pattern="[A-Za-z0-9_.-]{3,40}"
            minLength={3}
            maxLength={40}
          />
        </label>
        <label>
          {t("auth.password")}
          <input
            type="password"
            name="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <small>{t("auth.passwordHint")}</small>
        {signup && claim && (
          <label>
            {t("auth.setupToken")}
            <input
              name="setupToken"
              type="password"
              autoComplete="off"
              required
            />
            <small>{t("auth.setupTokenHint")}</small>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? t("auth.wait")
            : signup
              ? t("auth.createAccount")
              : t("auth.login")}
        </button>
        <button
          type="button"
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
        >
          {signup ? t("auth.toLogin") : t("auth.toSignup")}
        </button>
        <LanguageSelect className="auth-language" />
      </form>
    </main>
  );
}
