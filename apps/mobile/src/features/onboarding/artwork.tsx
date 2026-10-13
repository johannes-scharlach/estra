import { Image } from "expo-image";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import type { CookingProfile } from "@magpie/profile";
import { equipmentOptions, pantryOptions, freshOptions } from "@magpie/profile";

// Every ID has a production brief in art/README.md. Delivered assets are
// wired in below with transparent background; remaining ones render clean placeholders.
export type ArtworkId =
  | "welcome-market-find"
  | `equipment-${keyof typeof equipmentOptions}`
  | `pantry-${keyof typeof pantryOptions}`
  | `fresh-${keyof typeof freshOptions}`;

const deliveredAssets: Partial<Record<ArtworkId, number>> = {
  "welcome-market-find": require("./art/welcome-market-find.png"),
  "equipment-oven": require("./art/equipment-oven.png"),
  "equipment-stove": require("./art/equipment-stove.png"),
  "equipment-microwave": require("./art/equipment-microwave.png"),
  "equipment-slow-cooker": require("./art/equipment-slow-cooker.png"),
};

export function Artwork({ id, hero = false }: { id: ArtworkId; hero?: boolean }) {
  const asset = deliveredAssets[id];
  if (asset) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className="items-center justify-center overflow-hidden"
        style={{ aspectRatio: hero ? 1.5 : 1, width: "100%" }}
      >
        <Image
          source={asset}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
        />
      </View>
    );
  }
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/50 px-2"
      style={{ aspectRatio: hero ? 1.5 : 1, width: "100%", borderCurve: "continuous" }}
    >
      <Text className={hero ? "text-center text-sm text-muted-foreground" : "text-center text-[10px] leading-3.5 text-muted-foreground"}>
        {id}
      </Text>
    </View>
  );
}

/** Recognition at signup: the user's actual selections, rather than a summary to read. */
export function KitchenArtwork({ profile }: { profile: CookingProfile }) {
  const ids: ArtworkId[] = [
    ...Object.keys(pantryOptions).filter((key) => profile.pantry[key] === true).slice(0, 2).map((key) => `pantry-${key}` as ArtworkId),
    ...Object.keys(freshOptions).filter((key) => profile.fresh_ingredients[key] === true).slice(0, 2).map((key) => `fresh-${key}` as ArtworkId),
    ...Object.keys(equipmentOptions).filter((key) => profile.kitchen_equipment[key] === true).slice(0, 1).map((key) => `equipment-${key}` as ArtworkId),
  ].slice(0, 4);
  if (!ids.length) return null;
  return (
    <View className="flex-row items-center gap-2" accessible accessibilityRole="image" accessibilityLabel="Your selected kitchen equipment and ingredients">
      {ids.map((id) => <View className="flex-1" key={id}><Artwork id={id} /></View>)}
    </View>
  );
}
