import type { Notice } from "./notices/index.ts";
// A failed request. `message` is the server's English text; `notices`, when
// present, let the UI show it in the chosen language (see errorText).
export class ApiError extends Error {
  notices?: Notice[];
  status: number;
  constructor(message: string, status: number, notices?: Notice[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.notices = notices;
  }
}
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
    const e = await r.json().catch(() => ({}));
    throw new ApiError(
      typeof e.error === "string" && e.error ? e.error : "Request failed",
      r.status,
      Array.isArray(e.notices) && e.notices.length ? e.notices : undefined,
    );
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
