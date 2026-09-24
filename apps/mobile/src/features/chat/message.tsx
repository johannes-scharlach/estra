import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { Markdown } from "./markdown";
import { MessageMenu } from "./message-menu";
import { imageParts } from "./image-attachment";
import { messageText, type Parts } from "./stream";
import { parseSegments, readableMessage, type Idea } from "./tags";
import { recipeResults } from "./recipe-results";
import { RecipeResultView } from "./recipe-result";

const CHEVRON_ICON = {
  ios: "chevron.right",
  android: "chevron_right",
  web: "chevron_right",
} as const;

export function UserMessage({ parts }: { parts: Parts }) {
  const text = messageText(parts);
  const images = imageParts(parts);
  return (
    <View className="mx-5 items-end gap-2">
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
        <View className="max-w-[80%]">
          <MessageMenu text={text}>
            <View className="rounded-2xl rounded-br-none bg-primary px-4 py-2.5">
              <Text className="text-base leading-6 text-primary-foreground">
                {text}
              </Text>
            </View>
          </MessageMenu>
        </View>
      ) : null}
    </View>
  );
}

/** Ideas do have an action — tap to hear more — so they are cards. Same
 *  deck as Home's quick ideas: full-bleed, peek at the next card, snap
 *  through them. The deck stays in the transcript after a pick. */
function Ideas({
  ideas,
  onPick,
}: {
  ideas: Idea[];
  onPick: (idea: Idea) => void;
}) {
  const chevron = useResolveClassNames("text-muted-foreground").color;
  const { width: windowWidth } = useWindowDimensions();
  // First card sits at the px-5 inset; what follows is a 12pt gap and a
  // 12pt sliver of the next card — enough to see there is more, not
  // enough to read. The last card ends flush instead of trailing into
  // empty row.
  const cardWidth = windowWidth - 44;
  const gap = 12;

  const [page, setPage] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const pageRef = useRef(0);
  const clamped = Math.min(page, Math.max(ideas.length - 1, 0));

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + gap));
    if (next !== pageRef.current) {
      pageRef.current = next;
      setPage(next);
    }
  }

  function measure(h: number) {
    setMaxHeight((m) => Math.max(m, h));
  }

  return (
    <View className="my-2 gap-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={onScrollEnd}
        snapToInterval={cardWidth + gap}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerClassName="gap-3 px-5"
      >
        {ideas.map((idea, i) => (
          <View key={`${i}-${idea.title}`} style={{ width: cardWidth }}>
            <Pressable
              onPress={() => {
                if (!idea.title) return;
                onPick(idea);
              }}
              onLayout={(e) => measure(e.nativeEvent.layout.height)}
              style={maxHeight ? { minHeight: maxHeight } : undefined}
              className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 active:bg-accent"
            >
              <View className="flex-1 gap-1">
                <Text className="text-base font-semibold leading-snug">
                  {idea.title || "…"}
                </Text>
                {idea.body ? (
                  // pointerEvents none: the markdown view is a native text
                  // view whose own tap recognizer swallows touches — without
                  // this the card only responds on its title.
                  <View pointerEvents="none">
                    <Markdown
                      text={idea.body}
                      size="small"
                      selectable={false}
                    />
                  </View>
                ) : null}
              </View>
              <View className="size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                <SymbolView
                  name={CHEVRON_ICON}
                  tintColor={chevron}
                  size={13}
                  weight="semibold"
                />
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {ideas.length > 1 ? (
        <View className="flex-row items-center justify-center gap-2">
          <View className="flex-row gap-1">
            {ideas.map((_, i) => (
              <View
                key={i}
                className={cn(
                  "size-1.5 rounded-full",
                  i === clamped ? "bg-foreground" : "bg-foreground/25",
                )}
              />
            ))}
          </View>
          <Text
            variant="muted"
            className="text-xs"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {clamped + 1} of {ideas.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** A Sketch is a page, not a card: no container, just type. The writing has
 *  to carry the taste of the dish. One deliberate exception to "nothing is
 *  tappable": the commit button, the form-based save & plan (ADR 9). */
function Sketch({
  title,
  body,
  streaming,
  onSavePlan,
}: {
  title: string;
  body: string;
  streaming: boolean;
  onSavePlan?: (title: string) => void;
}) {
  return (
    <View className="mx-5 my-3 gap-3">
      {title ? (
        <Text className="text-3xl font-semibold leading-tight tracking-tight">
          {title}
        </Text>
      ) : null}
      {body ? (
        <Markdown
          text={body}
          size="page"
          streaming={streaming}
          selectable={false}
        />
      ) : null}
      {onSavePlan && title ? (
        <Pressable
          onPress={() => {
            onSavePlan(title);
          }}
          accessibilityRole="button"
          className="mt-1 flex-row items-center justify-center rounded-full border border-border bg-card py-2.5 active:bg-accent"
        >
          <Text className="text-sm font-semibold">Save &amp; plan</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AssistantMessage({
  parts,
  streaming = false,
  onIdea,
  onSavePlan,
  showRecipeResults = false,
}: {
  parts: Parts;
  streaming?: boolean;
  onIdea: (idea: Idea) => void;
  onSavePlan?: (title: string) => void;
  showRecipeResults?: boolean;
}) {
  const text = messageText(parts);
  const segments = useMemo(() => parseSegments(text), [text]);
  const results = showRecipeResults ? recipeResults(parts) : [];
  if (!text && !results.length) return null;
  return (
    <MessageMenu text={streaming ? "" : readableMessage(text)}>
      <View>
        {segments.map((seg, i) => {
          const last = i === segments.length - 1;
          switch (seg.type) {
            case "markdown":
              // mx-5 rather than a padded ancestor: the ideas deck is full-bleed.
              return (
                <View key={i} className="mx-5">
                  <Markdown
                    text={seg.text}
                    streaming={streaming && last}
                    selectable={false}
                  />
                </View>
              );
            case "ideas":
              return <Ideas key={i} ideas={seg.ideas} onPick={onIdea} />;
            case "sketch":
              return (
                <Sketch
                  key={i}
                  title={seg.title}
                  body={seg.body}
                  streaming={streaming && last}
                  onSavePlan={streaming ? undefined : onSavePlan}
                />
              );
          }
        })}
        {results.map((result) => (
          <RecipeResultView key={result.variantId} result={result} />
        ))}
      </View>
    </MessageMenu>
  );
}
