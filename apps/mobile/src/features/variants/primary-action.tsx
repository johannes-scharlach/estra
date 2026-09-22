// Primary action for recipes and planning. iOS gets the prominent Liquid
// Glass capsule (primary-action.ios.tsx); elsewhere the platform's own
// filled button.
import { Button, Host, Text } from "@expo/ui";
import { useResolveClassNames } from "uniwind";

import {
  ACTION_HEIGHT,
  type PrimaryActionProps,
} from "./primary-action-shared";

export function PrimaryAction({
  label,
  onPress,
  disabled = false,
}: PrimaryActionProps) {
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
