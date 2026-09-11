import { List } from "@expo/ui/swift-ui";
import { scrollContentBackground } from "@expo/ui/swift-ui/modifiers";
import type { PropsWithChildren } from "react";

export function MoreList({ children }: PropsWithChildren) {
  return <List modifiers={[scrollContentBackground("hidden")]}>{children}</List>;
}
