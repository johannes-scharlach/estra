// Chat reply push (ADR 26). The reply arrives as AI SDK parts, only text and
// the turn state; the push shows it as one plain line.

export type ChatReply = {
  chat_title: string | null;
  reply_parts: {
    type: string;
    text?: string;
    data?: { status?: string; error?: string };
  }[];
};

const MAX_BODY = 180;

export function chatReplyText(reply: ChatReply) {
  const title = reply.chat_title ?? "Your chat";
  const turn = reply.reply_parts.find(
    (part) => part.type === "data-turn",
  )?.data;
  if (turn?.status === "failed") {
    return { title, body: turn.error ?? "The reply couldn't be completed." };
  }
  const text = plain(
    reply.reply_parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n"),
  );
  return { title, body: shorten(text) || "Your reply is ready." };
}

function plain(markdown: string): string {
  return markdown
    .replace(/<[^>]+>/g, " ") // <sketch title="…"> and its closing tag
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their label
    .replace(/^\s*(#+|[-*]|\d+\.)\s+/gm, "") // headings and list markers
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text: string): string {
  if (text.length <= MAX_BODY) return text;
  const cut = text.slice(0, MAX_BODY - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
