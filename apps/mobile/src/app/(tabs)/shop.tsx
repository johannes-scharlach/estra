import { useQuery, useStatus } from "@powersync/react";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { addItem, setItemStatus } from "@/db/items";
import { useAuth } from "@/db/provider";
import type { List, ListItem } from "@/db/schema";
import { powersync } from "@/db/system";

export default function Shop() {
  const { session } = useAuth();
  const status = useStatus();
  const { data: lists, isLoading } = useQuery<List>(
    "SELECT * FROM lists ORDER BY created_at",
  );

  if (isLoading)
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );

  const list = lists[0];

  if (!list) {
    return (
      <Centered>
        <Text>No lists yet.</Text>
        <Button onPress={() => void createList("Home", session?.user.id)}>
          <Text>Create one</Text>
        </Button>
      </Centered>
    );
  }

  return <ListScreen list={list} connected={status.connected} />;
}

function ListScreen({ list, connected }: { list: List; connected: boolean }) {
  const [draft, setDraft] = useState("");

  // Category comes from the global reference table, which is why an item
  // added by one member shows up correctly grouped for everyone else.
  const { data: active } = useQuery<
    ListItem & { category_name: string | null }
  >(
    `SELECT i.*, c.name AS category_name
       FROM list_items i
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.list_id = ? AND i.status = 'active'
      ORDER BY COALESCE(c.sort_order, 999), i.name`,
    [list.id],
  );

  // Purchased rows are never deleted — they are the recent strip, the
  // autocomplete source and the category memory, all in one table.
  const { data: recent } = useQuery<ListItem>(
    `SELECT * FROM list_items
      WHERE list_id = ? AND status = 'purchased'
      ORDER BY purchase_count DESC, updated_at DESC
      LIMIT 20`,
    [list.id],
  );

  async function submit() {
    await addItem(list.id, draft);
    setDraft("");
  }

  return (
    <View className="flex-1 gap-3 bg-background p-6">
      <View className="flex-row items-baseline justify-between">
        <Text variant="h3">{list.name}</Text>
        <Text variant="muted">{connected ? "synced" : "offline"}</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Input
          className="flex-1"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void submit()}
          placeholder="Add an item"
          returnKeyType="done"
        />
        <Button onPress={() => void submit()}>
          <Text>Add</Text>
        </Button>
      </View>

      <ScrollView contentContainerClassName="gap-2 pb-6">
        {active.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => void setItemStatus(item.id, "purchased")}
          >
            <View className="flex-row justify-between py-2">
              <Text>{item.name}</Text>
              <Text variant="muted">
                {item.category_name ?? "Uncategorised"}
              </Text>
            </View>
          </Pressable>
        ))}

        {active.length === 0 ? (
          <Text variant="muted">Nothing on the list.</Text>
        ) : null}

        {recent.length > 0 ? (
          <>
            <Text variant="small" className="mt-6 font-semibold">
              Recent
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {recent.map((item) => (
                <Pressable
                  key={item.id}
                  className="rounded-full border border-border px-3 py-1.5"
                  onPress={() => void setItemStatus(item.id, "active")}
                >
                  <Text variant="small">{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
      {children}
    </View>
  );
}

/**
 * Both rows are written locally and sync together. The membership row is
 * what every RLS policy and sync stream keys off, so a list without one is
 * invisible even to the person who made it.
 */
async function createList(name: string, userId: string | undefined) {
  if (!userId) return;

  const listId = crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO lists (id, name, invite_code, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        listId,
        name,
        crypto.randomUUID().replace(/-/g, "").slice(0, 12),
        userId,
        now,
        now,
      ],
    );
    await tx.execute(
      `INSERT INTO list_members (id, list_id, user_id, joined_at) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), listId, userId, now],
    );
  });
}
