// Only a generic offline page is cached. Feed data, notes, authenticated HTML,
// API responses and third-party media always use the network.
const CACHE = "openfeed-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add("/offline.html")),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("openfeed-offline-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match("/offline.html")),
  );
});
self.addEventListener("push", (event) => {
  let payload = {
    title: "OpenFeed",
    body: "New content is available.",
    tag: "openfeed",
    url: "/",
    data: {},
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    const text = event.data?.text();
    if (text) payload.body = text;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "OpenFeed", {
      body: payload.body || "",
      icon: "/icons/app-192.png",
      badge: "/icons/app-192.png",
      tag: payload.tag || "openfeed",
      data: {
        url: typeof payload.url === "string" ? payload.url : "/",
        ...(payload.data && typeof payload.data === "object"
          ? payload.data
          : {}),
      },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/";
  const targetUrl = new URL(rawUrl, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (new URL(client.url).origin === self.location.origin) {
            return client
              .focus()
              .then((focused) =>
                focused && "navigate" in focused && client.url !== targetUrl
                  ? focused.navigate(targetUrl)
                  : focused,
              );
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
