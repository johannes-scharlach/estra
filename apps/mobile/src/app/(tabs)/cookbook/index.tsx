import { Stack, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";
import { useResolveClassNames } from "uniwind";

import { RecipeBrowser } from "@/features/cookbook/recipe-browser";

export default function Cookbook() {
  const color = useResolveClassNames("text-foreground").color;
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/cookbook/import")}
              hitSlop={12}
              accessibilityLabel="Import recipe"
              accessibilityRole="button"
              className="p-2"
            >
              <SymbolView
                name={{ ios: "plus", android: "add" }}
                tintColor={color}
                size={22}
              />
            </Pressable>
          ),
        }}
      />
      <RecipeBrowser onImport={() => router.push("/cookbook/import")} />
    </>
  );
}
