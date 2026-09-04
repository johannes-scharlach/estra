/**
 * ADR 9: the model writes Markdown and wraps the two blocks the app reacts
 * to in tags — `<ideas>` holding `<idea title="…">` blocks, and
 * `<sketch title="…">`. Everything else is plain Markdown. This splits a
 * message into those segments; unclosed tags (mid-stream) run to the end.
 */
export type Idea = { title: string; body: string };

export type Segment =
  | { type: "markdown"; text: string }
  | { type: "ideas"; ideas: Idea[] }
  | { type: "sketch"; title: string; body: string };

const BLOCK_OPEN = /<(ideas|sketch)(\s[^>]*)?>/g;
const IDEA = /<idea(\s[^>]*)?>([\s\S]*?)(?:<\/idea>|(?=<idea[\s>])|$)/g;
const STRAY_TAG = /<\/?(?:ideas|idea|sketch)\b[^>]*>/g;
// A tag that has started arriving but has no ">" yet, at the very end.
const PARTIAL_TAG = /<\/?[a-z]+(?:\s[^>]*)?$/i;

function attr(attrs: string | undefined, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`).exec(attrs ?? "");
  return (m?.[1] ?? "").trim();
}

function parseIdeas(body: string): Idea[] {
  const ideas: Idea[] = [];
  let lastEnd = 0;
  for (const m of body.matchAll(IDEA)) {
    const title = attr(m[1], "title");
    const text = (m[2] ?? "").trim();
    if (title || text) ideas.push({ title, body: text });
    lastEnd = m.index + m[0].length;
  }
  // A trailing tag that hasn't finished arriving still gets its card:
  // titled if the title made it, "…" (in the renderer) if it didn't.
  const partial = /<idea\b[^>]*$/.exec(body.slice(lastEnd));
  if (partial) {
    const title = /title="([^"]*)"/.exec(partial[0])?.[1]?.trim() ?? "";
    ideas.push({ title, body: "" });
  }
  return ideas;
}

export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];

  function pushMarkdown(raw: string, last: boolean) {
    let clean = raw.replace(STRAY_TAG, "");
    if (last) clean = clean.replace(PARTIAL_TAG, "");
    clean = clean.trim();
    if (clean) segments.push({ type: "markdown", text: clean });
  }

  let pos = 0;
  for (;;) {
    BLOCK_OPEN.lastIndex = pos;
    const m = BLOCK_OPEN.exec(text);
    if (!m) break;

    pushMarkdown(text.slice(pos, m.index), false);

    const tag = m[1] as "ideas" | "sketch";
    const bodyStart = m.index + m[0].length;
    const closeTag = `</${tag}>`;
    const close = text.indexOf(closeTag, bodyStart);
    const body = close === -1 ? text.slice(bodyStart) : text.slice(bodyStart, close);

    if (tag === "ideas") {
      const ideas = parseIdeas(body);
      if (ideas.length) segments.push({ type: "ideas", ideas });
    } else {
      segments.push({ type: "sketch", title: attr(m[2], "title"), body: body.trim() });
    }

    pos = close === -1 ? text.length : close + closeTag.length;
  }
  pushMarkdown(text.slice(pos), true);

  return segments;
}

/** The latest Sketch title in a message, if it has one. */
export function sketchTitle(text: string): string | null {
  const m = /<sketch\s+title="([^"]+)"/.exec(text);
  return m?.[1]?.trim() || null;
}
