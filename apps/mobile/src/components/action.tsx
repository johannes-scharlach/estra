// Full-width capsule actions. PrimaryAction is the screen's one prominent
// action; Action is the quieter glass one. iOS gets Liquid Glass
// (action.ios.tsx); elsewhere the platform's own filled button.
import { Button, Host, Text } from "@expo/ui";
import { useResolveClassNames } from "uniwind";

import {
  ACTION_HEIGHT,
  type ActionProps,
} from "./action-shared";

export function PrimaryAction({
  label,
  onPress,
  disabled = false,
}: ActionProps) {
  const primary = useResolveClassNames("bg-primary").backgroundColor;
  const onPrimary = useResolveClassNames("text-primary-foreground").color;
  return (
    <Host
      matchContents
      seedColor={typeof primary === "string" ? primary : undefined}
    >
      <Button
        onPress={onPress}
        disabled={disabled}
        style={{ height: ACTION_HEIGHT, borderRadius: ACTION_HEIGHT / 2 }}
      >
        <Text
          textStyle={{
            fontSize: 17,
            fontWeight: "600",
            color: typeof onPrimary === "string" ? onPrimary : undefined,
          }}
        >
          {label}
        </Text>
      </Button>
    </Host>
  );
}

export function Action({
  label,
  onPress,
  disabled = false,
}: ActionProps) {
  const secondary = useResolveClassNames("bg-secondary").backgroundColor;
  const onSecondary = useResolveClassNames("text-secondary-foreground").color;
  return (
    <Host
      matchContents
      seedColor={typeof secondary === "string" ? secondary : undefined}
    >
      <Button
        onPress={onPress}
        disabled={disabled}
        style={{ height: ACTION_HEIGHT, borderRadius: ACTION_HEIGHT / 2 }}
      >
        <Text
          textStyle={{
            fontSize: 17,
            fontWeight: "600",
            color: typeof onSecondary === "string" ? onSecondary : undefined,
          }}
        >
          {label}
        </Text>
      </Button>
    </Host>
  );
}
