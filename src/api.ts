let account = "";
export const activeAccount = () => account;
export function setActiveAccount(id: string) {
  account = id;
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  expectedAccount = account,
) {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(expectedAccount ? { "X-OpenFeed-User": expectedAccount } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (
    r.status === 401 &&
    !path.startsWith("auth/") &&
    typeof window !== "undefined"
  )
    window.dispatchEvent(new Event("openfeed:logout"));
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: "Request failed" }));
    throw new Error(e.error || "Request failed");
  }
  return r.json();
}
// All note writes for an item are serialized, including when the viewer is reopened.
const writes = new Map<string, Promise<unknown>>();
export function writeNotes(
  id: string,
  notes: string,
  expectedAccount = account,
): Promise<void> {
  const key = `${expectedAccount}:${id}`;
  const request = (writes.get(key) || Promise.resolve())
    .catch(() => {})
    .then(() =>
      api(
        `posts/${encodeURIComponent(id)}`,
        "PATCH",
        { notes },
        expectedAccount,
      ),
    );
  writes.set(key, request);
  void request
    .finally(() => {
      if (writes.get(key) === request) writes.delete(key);
    })
    .catch(() => {});
  return request.then(() => {});
}
