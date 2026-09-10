import { MenuView } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Recipe = { id: string; name: string; totalTime: string | null };

type Props = {
  title: string;
  /** Planned recipe, or null when the slot is still open. */
  recipe: (Recipe & { servings: number | null }) | null;
  contenders: Recipe[];
  onPlan: (recipe: Recipe) => void;
  onEditPortions: () => void;
  onChange: () => void;
  onSkip: () => void;
  onMove: () => void;
  /** Open slot's × — hides the slot behind "+ Select …". */
  onHide: () => void;
  onImport: () => void;
  onCookbook: () => void;
};

const X_ICON = { ios: "xmark", android: "close" } as const;
const CHECK_ICON = {
  ios: "checkmark",
  android: "check",
} as const;
const MENU_ICON = {
  ios: "ellipsis",
  android: "more_horiz",
} as const;

/**
 * One meal slot of a day. Planned: a card (tap to view, … for actions).
 * Open: a full-bleed horizontal carousel of contenders plus Import / cookbook.
 * Handles its own horizontal padding so the carousel scrolls edge to edge.
 */
export function MealSection({
  title,
  recipe,
  contenders,
  onPlan,
  onEditPortions,
  onChange,
  onSkip,
  onMove,
  onHide,
  onImport,
  onCookbook,
}: Props) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  const dark = useColorScheme() === "dark";

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-6">
        <Text className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {recipe ? title : `Select ${title.toLowerCase()}`}
        </Text>
        {recipe ? (
          <View className="flex-row items-center gap-1">
            <SymbolView name={CHECK_ICON} tintColor={muted} size={12} />
            <Text className="text-xs text-muted-foreground">Planned</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hide ${title.toLowerCase()} choices`}
            hitSlop={12}
            onPress={onHide}
          >
            <SymbolView name={X_ICON} tintColor={muted} size={14} />
          </Pressable>
        )}
      </View>

      {recipe ? (
        <View className="px-6">
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            <Link
              href={{ pathname: "/variant/[id]", params: { id: recipe.id } }}
              asChild
            >
              <Pressable>
                {/* Same tonalPair as the cookbook row and hero — one identity per recipe. */}
                <View className="h-36">
                  <LinearGradient
                    colors={tonalPair(recipe.id, dark)}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={{ flex: 1 }}
                  />
                  <View className="absolute bottom-3 left-3 right-3 flex-row flex-wrap items-end justify-between gap-2">
                    {recipe.totalTime ? (
                      <Text className="rounded-full bg-background/50 mix-blend-hard-light px-2.5 py-1 text-xs font-medium">
                        {recipe.totalTime}
                      </Text>
                    ) : null}
                    {recipe.servings != null ? (
                      <Text className="ml-auto rounded-full bg-background/50 mix-blend-hard-light px-2.5 py-1 text-xs font-medium">
                        {recipe.servings}{" "}
                        {recipe.servings === 1 ? "serving" : "servings"}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View className="p-4">
                  <Text className="text-lg font-semibold">{recipe.name}</Text>
                </View>
              </Pressable>
            </Link>
            <MenuView
              key={recipe.id}
              style={{ position: "absolute", right: 6, top: 6 }}
              actions={[
                {
                  id: "portions",
                  title: `${recipe.servings ?? 2} ${recipe.servings === 1 ? "portion" : "portions"}`,
                  image: "person.2",
                },
                {
                  id: "change",
                  title: "Choose another meal",
                  image: "arrow.triangle.2.circlepath",
                },
                {
                  id: "move",
                  title: "Move to…",
                  image: "arrow.right",
                },
                {
                  id: "remove-section",
                  title: "",
                  displayInline: true,
                  subactions: [
                    {
                      id: "remove",
                      title: "Remove from plan",
                      image: "calendar.badge.minus",
                      attributes: { destructive: true },
                    },
                  ],
                },
              ]}
              onPressAction={({ nativeEvent: { event } }) => {
                if (event === "portions") onEditPortions();
                else if (event === "change") onChange();
                else if (event === "move") onMove();
                else if (event === "remove") onSkip();
              }}
            >
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Actions for ${recipe.name}`}
                style={{
                  width: 48,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-background/80">
                  <SymbolView name={MENU_ICON} tintColor={muted} size={16} />
                </View>
              </View>
            </MenuView>
          </View>
        </View>
      ) : (
        <View className="gap-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          >
            {contenders.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${c.name} for ${title.toLowerCase()}`}
                onPress={() => onPlan(c)}
                className="w-40 overflow-hidden rounded-xl border border-border bg-card"
              >
                <View className="h-24">
                  <LinearGradient
                    colors={tonalPair(c.id, dark)}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={{ flex: 1 }}
                  />
                  {c.totalTime ? (
                    <Text className="absolute bottom-2 left-2 max-w-[90%] rounded-full bg-background/50 mix-blend-hard-light px-2.5 py-1 text-xs font-medium">
                      {c.totalTime}
                    </Text>
                  ) : null}
                </View>
                <View className="p-3">
                  <Text
                    numberOfLines={2}
                    className="min-h-10 text-sm font-medium leading-5"
                  >
                    {c.name}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View className="flex-row gap-3 px-6">
            <Button variant="outline" className="flex-1" onPress={onImport}>
              <Text>Import</Text>
            </Button>
            <Button variant="outline" className="flex-1" onPress={onCookbook}>
              <Text>From cookbook</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
