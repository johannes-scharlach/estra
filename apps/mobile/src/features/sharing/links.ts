const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Fly page for people without the app (ADR 28). */
export function sharedRecipeUrl(baseUrl: string, variantId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/r/${variantId}`;
}

/** The variant a `magpie://shared/<id>` link opens, if this is one. */
export function sharedVariantId(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path =
      parsed.protocol === "magpie:"
        ? `/${parsed.hostname}${parsed.pathname}`
        : parsed.pathname.replace(/^\/--/, "");
    const id = /^\/shared\/([^/]+)$/.exec(path)?.[1];
    return id && UUID.test(id) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}
