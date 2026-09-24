/** Only invitation routes may interrupt setup or the active household. */
export function invitationCode(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path = parsed.protocol === "estra:"
      ? `/${parsed.hostname}${parsed.pathname}`
      : parsed.pathname.replace(/^\/--/, "");
    if (path === "/join") return parsed.searchParams.get("code") || "invalid";
    const match = /^\/join\/([^/]+)$/.exec(path);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function invitationUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/join/${encodeURIComponent(code)}`;
}
