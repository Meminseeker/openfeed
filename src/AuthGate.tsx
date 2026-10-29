import { useEffect, useState, type ReactNode } from "react";
import { api, setActiveAccount } from "./api";
export function AuthGate({
  children,
}: {
  children: (username: string, logout: () => void) => ReactNode;
}) {
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
  if (loading) return <div className="empty">Opening OpenFeed…</div>;
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
        <p>
          {signup
            ? "A personal space for the content you choose."
            : "Welcome back to your personal feed."}
        </p>
        <label>
          Username
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
          Password
          <input
            type="password"
            name="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <small>At least 12 characters.</small>
        {signup && claim && (
          <label>
            Workspace setup token
            <input
              name="setupToken"
              type="password"
              autoComplete="off"
              required
            />
            <small>
              Use OPENFEED_SETUP_TOKEN from your server configuration to claim
              the existing workspace.
            </small>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
        >
          {signup ? "Already have an account? Log in" : "Create an account"}
        </button>
      </form>
    </main>
  );
}
