export async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: "Request failed" }));
    throw new Error(e.error || "Request failed");
  }
  return r.json();
}
// All note writes for an item are serialized, including when the viewer is reopened.
const writes = new Map<string, Promise<unknown>>();
export function writeNotes(id: string, notes: string): Promise<void> {
  const request = (writes.get(id) || Promise.resolve())
    .catch(() => {})
    .then(() => api(`posts/${encodeURIComponent(id)}`, "PATCH", { notes }));
  writes.set(id, request);
  void request
    .finally(() => {
      if (writes.get(id) === request) writes.delete(id);
    })
    .catch(() => {});
  return request.then(() => {});
}
