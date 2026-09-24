import { Column, LazyColumn, ListItem, Text } from "@expo/ui/jetpack-compose";
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { useResolveClassNames } from "uniwind";

export type SettingsRowProps = {
  title: string;
  detail?: string;
  onPress?: () => void;
  /** Runs in place and can't be undone lightly, like signing out. */
  destructive?: boolean;
};
type Position = "only" | "first" | "middle" | "last";

// Our own Material "connected list" rather than @expo/ui's FieldGroup: its
// sections wrap every row in a ListItem, so a ListItem row nests inside
// another and gets two backgrounds and double padding.
export function SettingsList({ children }: { children: ReactNode }) {
  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: 24 }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: 16 }}
    >
      {children}
    </LazyColumn>
  );
}

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const muted = color(useResolveClassNames("text-muted-foreground").color);
  const rows = Children.toArray(children).filter(
    isValidElement,
  ) as ReactElement<RowProps>[];
  return (
    <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[fillMaxWidth()]}>
      <Text
        color={muted}
        style={{ typography: "titleSmall" }}
        modifiers={[padding(16, 0, 16, 8)]}
      >
        {title}
      </Text>
      {rows.map((row, i) =>
        cloneElement(row, { position: position(i, rows.length) }),
      )}
    </Column>
  );
}

type RowProps = SettingsRowProps & { position?: Position };

export function SettingsRow({
  title,
  detail,
  onPress,
  destructive,
  position = "only",
}: RowProps) {
  const card = color(useResolveClassNames("bg-card").backgroundColor);
  const foreground = color(useResolveClassNames("text-foreground").color);
  const muted = color(useResolveClassNames("text-muted-foreground").color);
  const red = color(useResolveClassNames("text-destructive").color);
  return (
    <ListItem
      colors={{ containerColor: card }}
      modifiers={[
        fillMaxWidth(),
        // Clip first so the ripple stays inside the rounded shape.
        clip(Shapes.RoundedCorner(radii(position))),
        ...(onPress ? [clickable(onPress)] : []),
      ]}
    >
      <ListItem.HeadlineContent>
        <Text color={destructive ? red : foreground}>{title}</Text>
      </ListItem.HeadlineContent>
      {detail ? (
        <ListItem.SupportingContent>
          <Text color={muted}>{detail}</Text>
        </ListItem.SupportingContent>
      ) : null}
    </ListItem>
  );
}

function color(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function position(index: number, count: number): Position {
  if (count === 1) return "only";
  if (index === 0) return "first";
  return index === count - 1 ? "last" : "middle";
}

function radii(p: Position) {
  const top = p === "only" || p === "first" ? 20 : 4;
  const bottom = p === "only" || p === "last" ? 20 : 4;
  return {
    topStart: top,
    topEnd: top,
    bottomStart: bottom,
    bottomEnd: bottom,
  };
}
