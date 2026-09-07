import { useQuery } from "@powersync/react";
import { Link, Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import type { Chat, List } from "@/db/schema";
import { MONTH_SHORT, WEEKDAY_LONG } from "@/features/meals/slots";

const X_ICON = { ios: "xmark", android: "close", web: "close" } as const;

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 7) return WEEKDAY_LONG[d.getDay()] ?? "";
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** Past conversations for this list, newest first. On iOS picking one closes
 *  the sheet and starts the chat on the main stack; Android has no sheet, so
 *  it's a plain push and back returns here. Same move as ideas.tsx. */
export default function ChatHistorySheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  const { data: lists } = useQuery<List>(
    "SELECT * FROM lists ORDER BY created_at LIMIT 1",
  );
  const list = lists[0] ?? null;
  const { data: chats } = useQuery<Chat>(
    list
      ? "SELECT * FROM chats WHERE list_id = ? ORDER BY updated_at DESC"
      : "SELECT * FROM chats WHERE 0",
    list ? [list.id] : [],
  );

  return (
    <>
      <Stack.Screen
        options={{
          ...(Platform.OS === "ios" && {
            headerRight: () => (
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                className="size-8 items-center justify-center rounded-full bg-muted"
              >
                <SymbolView name={X_ICON} tintColor={mutedColor} size={15} />
              </Pressable>
            ),
          }),
        }}
      />
      {chats.length ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="divide-y divide-border/40 border-t border-border/40">
            {chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                dismissTo={Platform.OS === "ios"}
                asChild
              >
                <Pressable className="flex-row items-center gap-4 px-6 py-3 active:bg-accent">
                  <Text className="flex-1 font-medium" numberOfLines={2}>
                    {chat.title ?? "New chat"}
                  </Text>
                  <Text variant="muted">{when(chat.updated_at)}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="px-6 pt-4">
          <Text variant="muted" className="text-sm">
            No chats yet.
          </Text>
        </View>
      )}
    </>
  );
}
