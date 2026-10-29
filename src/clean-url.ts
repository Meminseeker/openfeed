// Keep only the parameters that identify the requested content, never sharing tags.
export function cleanPastedUrl(
  input: string,
  kind: "content" | "playlist" = "content",
) {
  const value = input.trim();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return value;
    const host = url.hostname;
    const youtube = [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
    ].includes(host);
    const supported =
      youtube ||
      [
        "youtu.be",
        "x.com",
        "www.x.com",
        "twitter.com",
        "www.twitter.com",
        "instagram.com",
        "www.instagram.com",
        "m.instagram.com",
        "tiktok.com",
        "www.tiktok.com",
        "m.tiktok.com",
        "vm.tiktok.com",
        "vt.tiktok.com",
      ].includes(host);
    if (!supported) return value;
    const key = youtube ? (kind === "playlist" ? "list" : "v") : undefined;
    const id = key ? url.searchParams.get(key) : null;
    url.search = "";
    url.hash = "";
    if (key && id) url.searchParams.set(key, id);
    return url.href;
  } catch {
    return value;
  }
}
