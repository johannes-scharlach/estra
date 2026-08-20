import { useQuery, useStatus } from "@powersync/react";
import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { addItem, setItemStatus } from "@/db/items";
import { useAuth } from "@/db/provider";
import type { List, ListItem } from "@/db/schema";
import { powersync } from "@/db/system";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { session, ready } = useAuth();

  if (!ready) return null;
  return session ? <Lists /> : <SignIn />;
}

function SignIn() {
  const [email, setEmail] = useState("dev@estra.local");
  const [password, setPassword] = useState("estra-dev");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    console.log("starting sign in");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("finished sign in, error?", error);
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Estra</ThemedText>
      <ThemedText type="small">Defaults match the local seed user.</ThemedText>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="password"
      />

      <Button
        title={busy ? "Signing in…" : "Sign in"}
        onPress={submit}
        disabled={busy}
      />
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
    </ThemedView>
  );
}

function Lists() {
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
        <ThemedText>No lists yet.</ThemedText>
        <Button
          title="Create one"
          onPress={() => void createList("Home", session?.user.id)}
        />
        <SyncFooter />
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
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">{list.name}</ThemedText>
        <ThemedText type="small">{connected ? "synced" : "offline"}</ThemedText>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.grow]}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void submit()}
          placeholder="Add an item"
          returnKeyType="done"
        />
        <Button title="Add" onPress={() => void submit()} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {active.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => void setItemStatus(item.id, "purchased")}
          >
            <View style={styles.itemRow}>
              <ThemedText>{item.name}</ThemedText>
              <ThemedText type="small">
                {item.category_name ?? "Uncategorised"}
              </ThemedText>
            </View>
          </Pressable>
        ))}

        {active.length === 0 ? (
          <ThemedText type="small">Nothing on the list.</ThemedText>
        ) : null}

        {recent.length > 0 ? (
          <>
            <ThemedText type="smallBold" style={styles.recentHeading}>
              Recent
            </ThemedText>
            <View style={styles.recentWrap}>
              {recent.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.chip}
                  onPress={() => void setItemStatus(item.id, "active")}
                >
                  <ThemedText type="small">{item.name}</ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <SyncFooter />
    </ThemedView>
  );
}

function SyncFooter() {
  const status = useStatus();
  return (
    <View style={styles.footer}>
      <ThemedText type="small">
        {status.hasSynced
          ? `Last synced ${status.lastSyncedAt?.toLocaleTimeString()}`
          : "Never synced"}
      </ThemedText>
      <Button title="Sign out" onPress={() => void supabase.auth.signOut()} />
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={[styles.container, styles.centered]}>
      {children}
    </ThemedView>
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  grow: { flex: 1 },
  scroll: { gap: 8, paddingBottom: 24 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  recentHeading: { marginTop: 24 },
  recentWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#888",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#888",
    borderRadius: 8,
    padding: 12,
    color: "#888",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
