import { useFocusEffect } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  AppState,
  Keyboard,
  useWindowDimensions,
  type FlatList,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ActivityVisit,
  visibleActivityIds,
  type ActivityCellLayout,
} from "./activity-visit";
import { markActivitiesSeen, type HouseholdActivity } from "./activities";

/** Native visibility and lifecycle are inputs; ActivityVisit owns the rules. */
export function useActivityVisit(
  activities: readonly HouseholdActivity[],
  listId: string | null,
  userId: string | null,
  listRef: RefObject<FlatList<HouseholdActivity> | null>,
) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [visit] = useState(() => new ActivityVisit());
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const rows = useRef(activities);
  const cells = useRef(new Map<string, ActivityCellLayout>());
  const frame = useRef<{ top: number; height: number } | null>(null);
  const offset = useRef(0);
  const bounds = useRef({ top: 0, bottom: 0 });
  const focused = useRef(false);
  const foreground = useRef(AppState.currentState === "active");
  const windowFocused = useRef(true);
  const keyboardOpen = useRef(Keyboard.isVisible());
  const pending = useRef(new Set<string>());
  const retryAfter = useRef(0);

  const markSeen = useCallback((ids: readonly string[]) => {
    if (!listId || !userId) return;
    const fresh = ids.filter((id) => !pending.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => pending.current.add(id));
    void markActivitiesSeen(fresh, listId, userId)
      .catch((error: unknown) => {
        retryAfter.current = Date.now() + 5000;
        console.error("Could not mark household activity seen", error);
      })
      .finally(() => fresh.forEach((id) => pending.current.delete(id)));
  }, [listId, userId]);

  const check = useCallback(() => {
    const now = Date.now();
    const viewport = frame.current;
    const visibleIds = viewport && !keyboardOpen.current && windowFocused.current
      ? visibleActivityIds([...cells.current.values()], {
          top: offset.current + Math.max(0, bounds.current.top - viewport.top),
          bottom: offset.current + Math.min(
            viewport.height,
            bounds.current.bottom - viewport.top,
          ),
        })
      : [];
    const result = visit.update({
      activities: rows.current,
      visibleIds,
      active: focused.current && foreground.current,
    }, now);
    setNewIds((previous) =>
      previous.size === result.newIds.size &&
      [...previous].every((id) => result.newIds.has(id))
        ? previous
        : result.newIds,
    );
    if (now >= retryAfter.current) markSeen(result.seenIds);
  }, [visit, markSeen]);

  const measureViewport = useCallback(() => {
    // FlatList's TS declaration omits the host measurement methods even though
    // getNativeScrollRef returns the underlying native scroll view.
    const native = listRef.current?.getNativeScrollRef() as
      | Pick<View, "measureInWindow">
      | null;
    native?.measureInWindow((_x, y, _width, measuredHeight) => {
      frame.current = { top: y, height: measuredHeight };
      check();
    });
  }, [listRef, check]);

  const onLayout = useCallback(() => {
    frame.current = null;
    check();
    measureViewport();
  }, [check, measureViewport]);

  useEffect(() => {
    // On iOS NativeTabs supplies its own safe-area provider, including the
    // tab bar. Intersect with the measured frame rather than subtracting twice
    // when Android/navigation already lays the scroll view inside these bounds.
    bounds.current = {
      top: Math.max(headerHeight, insets.top),
      bottom: height - insets.bottom,
    };
    onLayout();
  }, [headerHeight, insets.top, insets.bottom, height, width, onLayout]);

  useEffect(() => {
    rows.current = activities;
    check();
  }, [activities, check]);

  useEffect(() => {
    // Android can keep a route mounted while another route is focused. Keep
    // window focus current across those visits so returning never inherits a
    // missed notification-shade blur/focus event.
    const blur = AppState.addEventListener("blur", () => {
      windowFocused.current = false;
      check();
    });
    const focus = AppState.addEventListener("focus", () => {
      windowFocused.current = true;
      check();
    });
    return () => {
      blur.remove();
      focus.remove();
    };
  }, [check]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    foreground.current = AppState.currentState === "active";
    keyboardOpen.current = Keyboard.isVisible();
    measureViewport();
    check();
    const timer = setInterval(check, 250);
    const appState = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active";
      check();
    });
    const keyboardShow = Keyboard.addListener("keyboardDidShow", () => {
      keyboardOpen.current = true;
      check();
    });
    const keyboardHide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpen.current = false;
      check();
    });
    return () => {
      focused.current = false;
      clearInterval(timer);
      appState.remove();
      keyboardShow.remove();
      keyboardHide.remove();
      check();
    };
  }, [check, measureViewport]));

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    check();
  }, [check]);

  const onCellLayout = useCallback((id: string, layout: LayoutRectangle | null) => {
    if (layout) cells.current.set(id, { id, top: layout.y, height: layout.height });
    else cells.current.delete(id);
    check();
  }, [check]);

  return { newIds, markSeen, onScroll, onLayout, onCellLayout };
}
