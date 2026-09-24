// Full-width capsule actions. PrimaryAction is the screen's one prominent
// action; Action is the quieter glass one. iOS gets Liquid Glass
// (action.ios.tsx); elsewhere the platform's own filled button.
import { Host } from "@expo/ui";
import { Button, FilledTonalButton, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, height } from "@expo/ui/jetpack-compose/modifiers";
import { useResolveClassNames } from "uniwind";

import { ACTION_HEIGHT, type ActionProps } from "./action-shared";

const LABEL_STYLE = { fontSize: 17, fontWeight: "600" } as const;
const MODIFIERS = [fillMaxWidth(), height(ACTION_HEIGHT)];

function color(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

// Our tokens, not a seeded scheme: a seed turns the dark-mode primary
// into Material's own tone, and the label loses contrast on it.
export function PrimaryAction({
  label,
  onPress,
  disabled = false,
}: ActionProps) {
  const primary = color(useResolveClassNames("bg-primary").backgroundColor);
  const onPrimary = color(
    useResolveClassNames("text-primary-foreground").color,
  );
  return (
    // Fixed height, width from the parent: full width, as on iOS.
    <Host style={{ height: ACTION_HEIGHT }}>
      <Button
        onClick={onPress}
        enabled={!disabled}
        colors={{ containerColor: primary, contentColor: onPrimary }}
        modifiers={MODIFIERS}
      >
        <Text style={LABEL_STYLE}>{label}</Text>
      </Button>
    </Host>
  );
}

// Tonal, seeded from primary: the same treatment as the onboarding back
// button, so Material picks a container and label that read in both modes.
export function Action({ label, onPress, disabled = false }: ActionProps) {
  const primary = color(useResolveClassNames("bg-primary").backgroundColor);
  return (
    <Host style={{ height: ACTION_HEIGHT }} seedColor={primary}>
      <FilledTonalButton
        onClick={onPress}
        enabled={!disabled}
        modifiers={MODIFIERS}
      >
        <Text style={LABEL_STYLE}>{label}</Text>
      </FilledTonalButton>
    </Host>
  );
}
