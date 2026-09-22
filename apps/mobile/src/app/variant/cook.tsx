import { useQuery } from "@powersync/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/close-button";

import { Text } from "@/components/ui/text";
import type { Variant } from "@/db/schema";
import { parseVariant } from "@/db/variants";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Cook mode: one step per screen, snap-paged horizontally. The tonal backdrop
 * matches the recipe hero so the mode feels like the same place, deeper in.
 * The variant screen stays mounted underneath, so its keep-awake persists.
 */
export default function CookMode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();

  const { data: variants, isLoading } = useQuery<Variant>(
    "SELECT * FROM variants WHERE id = ? LIMIT 1",
    [id ?? ""],
  );
  const variant = variants[0];
  const parsed = useMemo(() => {
    if (!variant) return null;
    try {
      return parseVariant(variant);
    } catch {
      return null;
    }
  }, [variant]);
  const steps = useMemo(() => parsed?.instructions ?? [], [parsed]);

  const [page, setPage] = useState(0);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) {
      setPage(next);
    }
  }

  const colors = tonalPair(id ?? "", scheme === "dark");

  return (
    <View className="flex-1">
      <LinearGradient
        colors={colors}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ flex: 1 }}
      >
        {!isLoading && steps.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text variant="muted" className="text-center">
              No steps for this recipe.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
          >
            {steps.map((step, idx) => (
              <ScrollView
                key={idx}
                style={{ width }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  flexGrow: 1,
                  gap: 24,
                  paddingHorizontal: 32,
                  paddingTop: insets.top + 88,
                  paddingBottom: insets.bottom + 120,
                }}
              >
                <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/60">
                  Step {idx + 1} of {steps.length}
                </Text>
                {step.name ? (
                  <Text className="text-3xl font-bold tracking-tight">
                    {step.name}
                  </Text>
                ) : null}
                {step.ingredients?.length ? (
                  <View className="flex-row flex-wrap gap-2">
                    {step.ingredients.map((ing) => (
                      <View
                        key={ing}
                        className="rounded-full border border-foreground/25 px-3 py-1"
                      >
                        <Text className="text-sm">{ing}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text className="text-xl leading-relaxed">{step.text}</Text>
                {step.tip ? (
                  <Text className="text-base italic text-foreground/70">
                    Tip: {step.tip}
                  </Text>
                ) : null}
              </ScrollView>
            ))}
          </ScrollView>
        )}

        <View style={{ position: "absolute", top: insets.top + 12, right: 16 }}>
          <CloseButton onPress={() => router.back()} />
        </View>

        {steps.length > 1 ? (
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + 24,
              left: 0,
              right: 0,
            }}
            className="flex-row items-center justify-center gap-2"
          >
            {steps.map((_, i) => (
              <View
                key={i}
                className={`size-2 rounded-full ${i === page ? "bg-foreground" : "bg-foreground/30"}`}
              />
            ))}
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}
