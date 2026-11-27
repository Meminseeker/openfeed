const redirectStatuses = [301, 302, 303, 307, 308];
const retryStatuses = [429, 500, 502, 503, 504];
const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com"];
import {
  notice,
  userError,
  UserError,
  type Notice,
} from "../src/notices/index.ts";

class PageError extends UserError {
  readonly retry: boolean;
  constructor(notices: Notice | Notice[], retry: boolean) {
    super(notices);
    this.name = "PageError";
    this.retry = retry;
  }
}
// Redirects are checked before following them; no cookies or credentials are forwarded.
export async function fetchPublicPage(
  input: string,
  options?: { acceptLanguage?: string | null },
) {
  const original = new URL(input);
  const youtube = youtubeHosts.includes(original.hostname);
  const platform = youtube
    ? "YouTube"
    : original.hostname.includes("instagram")
      ? "Instagram"
      : "TikTok";
  const acceptLanguage =
    options?.acceptLanguage === undefined
      ? "en-US,en;q=0.9"
      : options.acceptLanguage;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let url = original;
      const signal = AbortSignal.timeout(15000);
      for (let hop = 0; hop <= 3; hop++) {
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0",
        };
        if (acceptLanguage) headers["Accept-Language"] = acceptLanguage;
        const r = await fetch(url.href, {
          headers,
          signal,
          redirect: "manual",
        });
        if (redirectStatuses.includes(r.status)) {
          const location = r.headers.get("location");
          await r.body?.cancel();
          if (!location || hop === 3)
            throw new PageError(
              notice("youtube.pageRedirectLoop", { platform }),
              false,
            );
          const next = new URL(location, url);
          const publicTarget = (target: URL) =>
            target.protocol === "https:" &&
            !target.port &&
            !target.username &&
            !target.password &&
            (youtube
              ? youtubeHosts.includes(target.hostname)
              : target.hostname === original.hostname) &&
            target.pathname === original.pathname &&
            ["list", "v", "url"].every(
              (key) =>
                target.searchParams.get(key) === original.searchParams.get(key),
            );
          let consentTarget = false;
          if (
            youtube &&
            next.protocol === "https:" &&
            next.hostname === "consent.youtube.com" &&
            next.pathname === "/m" &&
            !next.port &&
            !next.username &&
            !next.password
          ) {
            try {
              consentTarget = publicTarget(
                new URL(next.searchParams.get("continue") || ""),
              );
            } catch {}
          }
          if (!publicTarget(next) && !consentTarget)
            throw new PageError(
              notice("youtube.pageRedirectedAway", { platform }),
              false,
            );
          url = next;
          continue;
        }
        if (!r.ok) {
          await r.body?.cancel();
          throw new PageError(
            [
              notice("youtube.pageHttpStatus", { platform, status: r.status }),
              notice(
                r.status === 403 || r.status === 429
                  ? "youtube.pageMayBeBlocking"
                  : "youtube.tryAgainLater",
              ),
            ],
            retryStatuses.includes(r.status),
          );
        }
        if (url.hostname === "consent.youtube.com")
          throw new PageError(notice("youtube.consentRequired"), false);
        // Read within the retry boundary: connections can fail during the body too.
        const body = await r.arrayBuffer();
        return new Response(body, { status: r.status, headers: r.headers });
      }
    } catch (error) {
      if (error instanceof PageError && !error.retry) throw error;
      if (attempt === 2) {
        if (error instanceof PageError) throw error;
        const cause = (error as { cause?: { code?: string } })?.cause?.code;
        throw cause && /^[A-Z0-9_]+$/.test(cause)
          ? userError("youtube.pageConnectFailedCode", {
              platform,
              code: cause,
            })
          : userError("youtube.pageConnectFailed", { platform });
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw userError("youtube.pageLoadFailed", { platform });
}
