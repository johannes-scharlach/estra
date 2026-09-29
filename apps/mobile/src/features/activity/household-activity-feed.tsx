import { Link, useRouter } from "expo-router";
import {
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import {
  FlatList,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";

import { useActivities, type HouseholdActivity } from "./activities";
import { ActivityCell, ActivityCellLayoutContext } from "./activity-cell";
import { useActivityVisit } from "./use-activity-visit";

type Props = {
  listId: string | null;
  preview?: boolean;
  children?: ReactNode;
  listRef?: Ref<FlatList<HouseholdActivity>>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/** One native list owns both the Home header and activities below the fold. */
export function HouseholdActivityFeed(props: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return (
    <ActivityFeed key={`${userId}/${props.listId}`} {...props} userId={userId} />
  );
}

function ActivityFeed({
  listId, userId, preview = false, children, listRef, onScroll,
}: Props & { userId: string | null }) {
  const router = useRouter();
  const { activities, isLoading, error } = useActivities(listId, userId, preview);
  const shown = useMemo(
    () => preview ? activities.slice(0, 3) : activities,
    [activities, preview],
  );
  const nativeListRef = useRef<FlatList<HouseholdActivity>>(null);
  useImperativeHandle(listRef, () => nativeListRef.current!);
  const visit = useActivityVisit(shown, listId, userId, nativeListRef);
  const { newIds, markSeen } = visit;

  return (
    <ActivityCellLayoutContext.Provider value={visit.onCellLayout}>
      <FlatList
        ref={nativeListRef}
        data={shown}
        extraData={newIds}
        keyExtractor={(item) => item.id}
        onScroll={(event) => {
          visit.onScroll(event);
          onScroll?.(event);
        }}
        onLayout={visit.onLayout}
        scrollEventThrottle={16}
        className="flex-1 bg-background"
        contentContainerClassName="pb-8 pt-2"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        CellRendererComponent={ActivityCell}
        ListHeaderComponent={
          <>
            {children}
            {preview && (shown.length > 0 || error) ? (
              <View className="mx-4 mb-2 mt-8 flex-row items-center justify-between gap-3">
                <Text className="text-xl font-semibold">Household activity</Text>
                {activities.length > 3 ? (
                  <Link href="/household-activity" asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel="See all household activity"
                      hitSlop={12}
                      className="active:opacity-60"
                    >
                      <Text className="text-link">See all</Text>
                    </Pressable>
                  </Link>
                ) : null}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={!preview || error ? (
          <Text className="mx-4 mt-4 text-muted-foreground" selectable>
            {error
              ? "Could not load household activity."
              : isLoading ? "Loading activity…" : "No household activity yet."}
          </Text>
        ) : null}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              markSeen([item.id]);
              router.push("/household");
            }}
            accessibilityRole="link"
            accessibilityLabel={`${newIds.has(item.id) ? "New. " : ""}${item.actor_name} joined the household. ${new Date(item.occurred_at).toLocaleString()}`}
            className="mx-4 flex-row items-center gap-3 border-b border-border/40 py-3 active:opacity-60"
          >
            <View className={`h-2 w-2 rounded-full ${newIds.has(item.id) ? "bg-primary" : "bg-transparent"}`} />
            <View className="flex-1 gap-1">
              <Text>{item.actor_name} joined the household</Text>
              <Text className="text-sm text-muted-foreground">
                {new Date(item.occurred_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </ActivityCellLayoutContext.Provider>
  );
}
