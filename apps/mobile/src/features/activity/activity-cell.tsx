import { createContext, useContext, useEffect, type ComponentProps } from "react";
import { View, type FlatListProps, type LayoutRectangle } from "react-native";

import type { HouseholdActivity } from "./activities";

export const ActivityCellLayoutContext = createContext<
  (id: string, layout: LayoutRectangle | null) => void
>(() => {});

type CellProps = ComponentProps<NonNullable<FlatListProps<HouseholdActivity>["CellRendererComponent"]>>;

/** The cell's layout is in scroll-content coordinates, unlike its child row. */
export function ActivityCell({ item, children, style, onLayout, onFocusCapture }: CellProps) {
  const report = useContext(ActivityCellLayoutContext);
  useEffect(() => () => report(item.id, null), [item.id, report]);
  return (
    <View
      style={style}
      {...{ onFocusCapture }}
      onLayout={(event) => {
        onLayout?.(event);
        report(item.id, event.nativeEvent.layout);
      }}
    >
      {children}
    </View>
  );
}
