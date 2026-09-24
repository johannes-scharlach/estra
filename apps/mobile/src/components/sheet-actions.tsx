import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The action row at the bottom of a form sheet. iOS form sheets already
 *  clear the home indicator; Android's don't. */
export function SheetActions({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="mt-6 gap-2 px-6"
      style={
        Platform.OS === "android"
          ? { paddingBottom: Math.max(insets.bottom, 12) }
          : undefined
      }
    >
      {children}
    </View>
  );
}
