import { useRouter } from "expo-router";
import { Linking } from "react-native";
import { EnrichedMarkdownText, type MarkdownStyle } from "react-native-enriched-markdown";
import { useResolveClassNames } from "uniwind";

const APP_SCHEME = "estra://";

type Size = "body" | "small" | "page";

/**
 * Three reading sizes: chat text, the small line under an idea title, and
 * the page treatment a Sketch gets — same face, more room to breathe.
 */
const SIZES: Record<Size, { font: number; line: number; gap: number }> = {
  body: { font: 17, line: 24, gap: 12 },
  small: { font: 15, line: 21, gap: 8 },
  page: { font: 17, line: 27, gap: 16 },
};

export function Markdown({
  text,
  size = "body",
  streaming = false,
}: {
  text: string;
  size?: Size;
  streaming?: boolean;
}) {
  const router = useRouter();
  const foreground = String(useResolveClassNames("text-foreground").color);
  const muted = String(useResolveClassNames("text-muted-foreground").color);
  const primary = String(useResolveClassNames("text-primary").color);
  const s = SIZES[size];

  const style: MarkdownStyle = {
    paragraph: { fontSize: s.font, lineHeight: s.line, color: foreground, marginBottom: s.gap },
    h1: { fontSize: s.font + 6, lineHeight: s.line + 6, color: foreground, fontWeight: "600", marginTop: s.gap, marginBottom: s.gap / 2 },
    h2: { fontSize: s.font + 4, lineHeight: s.line + 4, color: foreground, fontWeight: "600", marginTop: s.gap, marginBottom: s.gap / 2 },
    h3: { fontSize: s.font + 2, lineHeight: s.line + 2, color: foreground, fontWeight: "600", marginTop: s.gap, marginBottom: s.gap / 2 },
    list: { fontSize: s.font, lineHeight: s.line, color: foreground, bulletColor: muted, marginBottom: s.gap },
    strong: { color: foreground, fontWeight: "bold" },
    em: { color: foreground },
    link: { color: primary },
    blockquote: { fontSize: s.font, lineHeight: s.line, color: muted, borderColor: muted },
  };

  return (
    <EnrichedMarkdownText
      markdown={text}
      markdownStyle={style}
      streamingAnimation={streaming}
      onLinkPress={({ url }) => {
        // The cook links saved recipes as estra://variant/<id>.
        if (url.startsWith(APP_SCHEME)) router.push(`/${url.slice(APP_SCHEME.length)}` as never);
        else void Linking.openURL(url);
      }}
      allowTrailingMargin={false}
      selectable
    />
  );
}
