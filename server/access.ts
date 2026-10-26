// Compare against configured origins, never client-controlled forwarding headers.
export function requestAllowed(
  host: string | undefined,
  origin: string | undefined,
  publicOrigin?: string,
) {
  if (!host) return false;
  if (publicOrigin) {
    const configured = new URL(publicOrigin);
    return (
      host === configured.host && (!origin || origin === configured.origin)
    );
  }
  try {
    const local = new URL(`http://${host}`);
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(local.hostname) &&
      (!origin || origin === local.origin)
    );
  } catch {
    return false;
  }
}

export function validatePublicOrigin(value: string | undefined) {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "OPENFEED_PUBLIC_ORIGIN must be an HTTPS origin without a path or credentials.",
    );
  return url.origin;
}
