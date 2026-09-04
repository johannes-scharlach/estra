import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

import { Markdown } from "./markdown";
import { imageParts } from "./photo";
import { messageText, runningTool, type Parts } from "./stream";
import { parseSegments, type Idea } from "./tags";

const CHEVRON_ICON = { ios: "chevron.right", android: "chevron_right", web: "chevron_right" } as const;

export function UserMessage({ parts }: { parts: Parts }) {
  const text = messageText(parts);
  const images = imageParts(parts);
  return (
    <View className="items-end gap-2">
      {images.map((img) => (
        <Image
          key={img.url}
          source={{ uri: img.url }}
          contentFit="cover"
          transition={150}
          style={{ width: 200, height: 200, borderRadius: 16 }}
        />
      ))}
      {text ? (
        <View className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5">
          <Text className="text-base leading-6 text-primary-foreground">{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Ideas do have an action — tap to hear more — so they are cards. Vertical,
 *  because choosing between four directions wants all four on screen. */
function Ideas({ ideas, onPick }: { ideas: Idea[]; onPick: (idea: Idea) => void }) {
  const chevron = useResolveClassNames("text-muted-foreground").color;
  return (
    <View className="my-2 gap-2">
      {ideas.map((idea, i) => (
        <Pressable
          key={`${i}-${idea.title}`}
          onPress={() => {
            void Haptics.selectionAsync();
            onPick(idea);
          }}
          disabled={!idea.title}
          className="flex-row items-center gap-3 rounded-2xl bg-secondary px-4 py-3 active:bg-accent"
        >
          <View className="flex-1 gap-1">
            <Text className="text-base font-semibold leading-snug">{idea.title || "…"}</Text>
            {idea.body ? <Markdown text={idea.body} size="small" /> : null}
          </View>
          <SymbolView name={CHEVRON_ICON} tintColor={chevron} size={14} />
        </Pressable>
      ))}
    </View>
  );
}

/** A Sketch is a page, not a card: no container, just type. The writing has
 *  to carry the taste of the dish. Nothing here is tappable (ADR 9). */
function Sketch({ title, body, streaming }: { title: string; body: string; streaming: boolean }) {
  return (
    <View className="my-3 gap-3">
      {title ? (
        <Text className="text-3xl font-semibold leading-tight tracking-tight">{title}</Text>
      ) : null}
      {body ? <Markdown text={body} size="page" streaming={streaming} /> : null}
    </View>
  );
}

const TOOL_LABEL: Record<string, string> = {
  addToCookbook: "Writing the recipe…",
  updateRecipe: "Rewriting the recipe…",
  searchSavedRecipes: "Checking your cookbook…",
};

export function AssistantMessage({
  parts,
  streaming = false,
  onIdea,
}: {
  parts: Parts;
  streaming?: boolean;
  onIdea: (idea: Idea) => void;
}) {
  const text = messageText(parts);
  const segments = useMemo(() => parseSegments(text), [text]);
  const tool = streaming ? runningTool(parts) : null;
  return (
    <View>
      {segments.map((seg, i) => {
        const last = i === segments.length - 1;
        switch (seg.type) {
          case "markdown":
            return <Markdown key={i} text={seg.text} streaming={streaming && last} />;
          case "ideas":
            return <Ideas key={i} ideas={seg.ideas} onPick={onIdea} />;
          case "sketch":
            return <Sketch key={i} title={seg.title} body={seg.body} streaming={streaming && last} />;
        }
      })}
      {tool ? (
        <Text variant="muted" className="mt-2 text-base">
          {TOOL_LABEL[tool] ?? "Working…"}
        </Text>
      ) : null}
    </View>
  );
}
