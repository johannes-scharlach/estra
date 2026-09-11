import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, type ColorValue, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { setItemStatus } from "@/db/items";
import type { ListItem } from "@/db/schema";
import {
  alternativesForItem,
  orderedAlternatives,
  type Alternative,
} from "@/features/shop/alternatives";
import { CheckOff } from "@/features/shop/check-off";
import { SwipeItem } from "@/features/shop/swipe-item";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 380;
export const ROW_LAYOUT = LinearTransition.springify()
  .duration(400)
  .dampingRatio(1)
  .reduceMotion(ReduceMotion.System);
// Re-sorting needs readable travel, rather than a spring's front-loaded snap.
const SWAP_LAYOUT = LinearTransition.duration(650)
  .easing(Easing.bezier(0.42, 0, 0.58, 1))
  .reduceMotion(ReduceMotion.System);

export type ShopRow = ListItem & {
  category_name: string | null;
  ingredient_lines: string | null;
};
export type Browse = { options: Alternative[]; selected: Alternative };

export function ShopItemRow({
  item,
  browse,
  highlighted,
  divider,
  onCheck,
  onSwap,
  onOpen,
}: {
  item: ShopRow;
  browse: Browse | undefined;
  highlighted: boolean;
  divider: boolean;
  onCheck: (id: string) => Promise<void>;
  onSwap: (item: ShopRow, direction: 1 | -1) => boolean;
  onOpen: (id: string) => void;
}) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const purchased = item.status === "purchased";
  const { pending, press, release } = useCheckOff(purchased, () =>
    onCheck(item.id),
  );
  const checked = purchased || pending;
  const name = browse ? browse.selected.name : (item.name ?? "");
  const spec = browse ? specOf(browse.selected) : item.spec;
  const options = purchased
    ? []
    : (browse?.options ??
      orderedAlternatives(
        item.name ?? "",
        alternativesForItem(item.name ?? "", item.ingredient_lines),
      ));
  const optionIndex = browse ? browse.options.indexOf(browse.selected) : 0;
  const next = options[optionIndex + 1] ?? null;
  const previous = options[optionIndex - 1] ?? null;

  const restore = () =>
    void setItemStatus(item.id, "active").catch(() =>
      Alert.alert("Couldn't restore item", "Please try again."),
    );
  const swap = (direction: 1 | -1) => !pending && onSwap(item, direction);
  const open = () => onOpen(item.id);
  // Finger down flips the checkbox; a press that fails (moved off, or the
  // list started scrolling) flips it back.
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(20)
    .onBegin(() => {
      if (!purchased) press();
    })
    .onFinalize((_event, success) => {
      if (purchased) {
        if (success) restore();
      } else release(success);
    });

  return (
    <Animated.View
      layout={highlighted ? SWAP_LAYOUT : ROW_LAYOUT}
      style={{ zIndex: highlighted ? 1 : 0 }}
    >
      <View
        className={cn("flex-row items-center pl-3", highlighted && "bg-accent")}
      >
        <SwipeItem
          leading={
            <GestureDetector gesture={tap}>
              <View
                accessible
                onAccessibilityTap={() => {
                  if (purchased) restore();
                  else {
                    press();
                    release(true);
                  }
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${purchased ? "Restore" : "Check off"} ${name}`}
                className="min-h-12 min-w-12 items-center justify-center"
              >
                <SymbolView
                  name={
                    checked
                      ? {
                          ios: "checkmark.circle.fill",
                          android: "check_circle",
                        }
                      : { ios: "circle", android: "radio_button_unchecked" }
                  }
                  tintColor={checked ? primaryColor : mutedColor}
                  size={24}
                />
              </View>
            </GestureDetector>
          }
          name={name}
          next={next}
          previous={previous}
          disabled={checked}
          onSwap={(direction) => Promise.resolve(swap(direction))}
          renderOption={(option) => (
            <IngredientContent
              name={option.name}
              spec={specOf(option)}
              plannedMeal={!!item.planned_meal_id}
              mutedColor={mutedColor}
            />
          )}
          onOpen={open}
        >
          <View
            accessible
            onAccessibilityTap={open}
            accessibilityRole="button"
            accessibilityLabel={`${name}${spec ? `, ${spec}` : ""}`}
            accessibilityHint={
              next || previous
                ? "Swipe left for the next substitute, right for the previous. Tap for details."
                : "Opens item details"
            }
            accessibilityActions={[
              { name: "activate", label: "Open details" },
              ...(next ? [{ name: "next", label: `Use ${next.name}` }] : []),
              ...(previous
                ? [{ name: "previous", label: `Use ${previous.name}` }]
                : []),
            ]}
            onAccessibilityAction={(event) => {
              const action = event.nativeEvent.actionName;
              if (action === "activate") open();
              if (action === "next") swap(1);
              if (action === "previous") swap(-1);
            }}
            className="min-h-12 gap-0.5 px-3 py-3"
          >
            <IngredientContent
              name={name}
              spec={spec}
              plannedMeal={!!item.planned_meal_id}
              mutedColor={mutedColor}
              checked={checked}
            />
          </View>
        </SwipeItem>
      </View>
      {divider ? (
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-[72px] right-0 border-b border-border/60"
        />
      ) : null}
    </Animated.View>
  );
}

function useCheckOff(purchased: boolean, commit: () => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [checkOff] = useState(
    () =>
      new CheckOff(CHECK_DELAY_MS, {
        change: setPending,
        error: () =>
          Alert.alert("Couldn't check off item", "Please try again."),
      }),
  );
  useEffect(() => () => checkOff.dispose(), [checkOff]);
  useEffect(() => checkOff.settle(!purchased), [checkOff, purchased]);
  return {
    pending,
    press: () => checkOff.press(commit),
    release: (onTarget: boolean) => checkOff.release(onTarget),
  };
}

function specOf(option: Alternative) {
  return [option.qtyText, option.prepNote].filter(Boolean).join(", ") || null;
}

function IngredientContent({
  name,
  spec,
  plannedMeal,
  mutedColor,
  checked = false,
}: {
  name: string;
  spec: string | null;
  plannedMeal: boolean;
  mutedColor: ColorValue | undefined;
  checked?: boolean;
}) {
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center gap-2">
        <Text
          className={cn(
            "shrink text-sm font-medium",
            checked && "text-muted-foreground line-through",
          )}
          numberOfLines={1}
        >
          {name}
        </Text>
        {plannedMeal ? (
          <SymbolView
            name={{ ios: "fork.knife", android: "restaurant" }}
            tintColor={mutedColor}
            size={12}
          />
        ) : null}
      </View>
      {spec ? (
        <Text
          variant="muted"
          className={cn("text-xs", checked && "line-through")}
          numberOfLines={1}
        >
          {spec}
        </Text>
      ) : null}
    </View>
  );
}
