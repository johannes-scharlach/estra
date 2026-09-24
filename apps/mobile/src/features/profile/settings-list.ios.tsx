import { FieldGroup, ListItem } from "@expo/ui";
import { Image, Text } from "@expo/ui/swift-ui";
import {
  foregroundStyle,
  scrollContentBackground,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import { useResolveClassNames } from "uniwind";

import type { SettingsRowProps } from "./settings-list";

// SwiftUI Form paints its own grouped grey; hide it so the screen's cream
// shows through between the white rows.
export function SettingsList({ children }: { children: ReactNode }) {
  return (
    <FieldGroup modifiers={[scrollContentBackground("hidden")]}>
      {children}
    </FieldGroup>
  );
}

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return <FieldGroup.Section title={title}>{children}</FieldGroup.Section>;
}

export function SettingsRow({
  title,
  detail,
  onPress,
  destructive,
}: SettingsRowProps) {
  const red = useResolveClassNames("text-destructive").color;
  // A chevron means "opens more"; a destructive action runs in place.
  const chevron = onPress && !destructive;
  return (
    <ListItem
      supportingText={detail}
      onPress={onPress}
      trailing={
        chevron ? (
          <Image
            systemName="chevron.right"
            size={13}
            modifiers={[
              foregroundStyle({ type: "hierarchical", style: "tertiary" }),
            ]}
          />
        ) : undefined
      }
    >
      {destructive && typeof red === "string" ? (
        <Text modifiers={[foregroundStyle(red)]}>{title}</Text>
      ) : (
        title
      )}
    </ListItem>
  );
}
