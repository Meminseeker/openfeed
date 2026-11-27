import { useEffect, useState, type ReactNode } from "react";
import { api, setActiveAccount, ApiError } from "./api";
import { useI18n, LanguageSelect } from "./LocaleProvider";
import { ThemeSelect } from "./ThemeProvider";
import { unsubscribeCurrentDevice } from "./Notifications";
export function AuthGate({
  children,
}: {
  children: (username: string, logout: () => void) => ReactNode;
}) {
  const { t, describe } = useI18n();
  const [user, setUser] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [signup, setSignup] = useState(false),
    [claim, setClaim] = useState(false),
    [error, setError] = useState(""),
    // Set when login failed because the username has no account, so the
    // form can offer to create it.
    [missingAccount, setMissingAccount] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("auth/me")
      .then((data) => {
        setActiveAccount(data.user?.id || "");
        setUser(data.user?.username || null);
        setClaim(data.claimRequired);
      })
      .catch((e) => setError(describe(e)))
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
      void unsubscribeCurrentDevice()
        .then(() => api("auth/logout", "POST"))
        .then(() => {
          setUser(null);
          setClaim(false);
        })
        .catch((e) => setError(describe(e)));
    });
  return (
    <main className="auth-page">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setMissingAccount(false);
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
            setError(describe(e));
            setMissingAccount(
              !signup &&
                e instanceof ApiError &&
                !!e.notices?.some((n) => n.code === "auth.noAccount"),
            );
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
            title={t("auth.usernameHint")}
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
        {missingAccount && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              // Keeps the typed username and password for the signup form.
              setSignup(true);
              setError("");
              setMissingAccount(false);
            }}
          >
            {t("auth.createThisAccount")}
          </button>
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
            setMissingAccount(false);
          }}
        >
          {signup ? t("auth.toLogin") : t("auth.toSignup")}
        </button>
        <div className="auth-preferences">
          <LanguageSelect className="auth-language" />
          <ThemeSelect className="auth-theme" />
        </div>
      </form>
    </main>
  );
}
