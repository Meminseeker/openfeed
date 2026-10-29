const redirectStatuses = [301, 302, 303, 307, 308];
const retryStatuses = [429, 500, 502, 503, 504];
const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com"];
class PageError extends Error {
  readonly retry: boolean;
  constructor(message: string, retry: boolean) {
    super(message);
    this.retry = retry;
  }
}
// Redirects are checked before following them; no cookies or credentials are forwarded.
export async function fetchPublicPage(input: string) {
  const original = new URL(input);
  const youtube = youtubeHosts.includes(original.hostname);
  const platform = youtube
    ? "YouTube"
    : original.hostname.includes("instagram")
      ? "Instagram"
      : "TikTok";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let url = original;
      const signal = AbortSignal.timeout(15000);
      for (let hop = 0; hop <= 3; hop++) {
        const r = await fetch(url.href, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal,
          redirect: "manual",
        });
        if (redirectStatuses.includes(r.status)) {
          const location = r.headers.get("location");
          await r.body?.cancel();
          if (!location || hop === 3)
            throw new PageError(
              `${platform} returned an incomplete or looping redirect. Try again later.`,
              false,
            );
          const next = new URL(location, url);
          if (
            next.protocol !== "https:" ||
            next.port ||
            next.username ||
            next.password ||
            !(youtube
              ? youtubeHosts.includes(next.hostname)
              : next.hostname === original.hostname) ||
            (original.pathname === "/playlist" &&
              (next.pathname !== "/playlist" ||
                next.searchParams.get("list") !==
                  original.searchParams.get("list")))
          )
            throw new PageError(
              `${platform} redirected away from the requested public content. It may require consent or sign-in.`,
              false,
            );
          url = next;
          continue;
        }
        if (!r.ok) {
          await r.body?.cancel();
          throw new PageError(
            `${platform} returned HTTP ${r.status}. ${r.status === 403 || r.status === 429 ? "It may be blocking or limiting requests from this server." : "Try again later."}`,
            retryStatuses.includes(r.status),
          );
        }
        // Read within the retry boundary: connections can fail during the body too.
        const body = await r.arrayBuffer();
        return new Response(body, { status: r.status, headers: r.headers });
      }
    } catch (error) {
      if (error instanceof PageError && !error.retry) throw error;
      if (attempt === 2) {
        if (error instanceof PageError) throw error;
        const cause = (error as { cause?: { code?: string } })?.cause?.code;
        const detail = cause && /^[A-Z0-9_]+$/.test(cause) ? ` (${cause})` : "";
        throw new Error(
          `Could not connect to ${platform} from the OpenFeed server after 3 attempts${detail}. Check the server's outbound network/DNS access and try again.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error(`${platform} could not be loaded.`);
}
