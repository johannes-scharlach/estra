import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The action row at the bottom of a form sheet. iOS form sheets already
 *  clear the home indicator; Android's don't. With the keyboard up the bottom
 *  inset is 0 and the sheet clips about 24 off its bottom (measured on
 *  device: 24 was flush), so the floor is that plus the gap we want. */
export function SheetActions({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="mt-6 gap-2 px-6"
      style={
        Platform.OS === "android"
          ? { paddingBottom: Math.max(insets.bottom, 48) }
          : undefined
      }
    >
      {children}
    </View>
  );
}
