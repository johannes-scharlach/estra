import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { addItem, itemNameKey, setItemSpec } from "@/db/items";
import type { ListItem } from "@/db/schema";

export default function AddItemSheet() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [lastAdded, setLastAdded] = useState<{
    id: string;
    name: string;
    spec: string | null;
  } | null>(null);
  const [details, setDetails] = useState("");
  const primaryColor = useResolveClassNames("text-primary").color;
  const needle = itemNameKey(draft);

  const { data: matches } = useQuery<ListItem>(
    `SELECT * FROM list_items
      WHERE list_id = ? AND planned_meal_id IS NULL
        AND ? != '' AND instr(name_key, ?) > 0
      ORDER BY CASE WHEN name_key = ? THEN 0 ELSE 1 END,
               purchase_count DESC, updated_at DESC
      LIMIT 12`,
    [listId ?? "", needle, needle, needle],
  );
  const hasExactMatch = matches.some((item) => item.name_key === needle);

  usePreventRemove(
    !!lastAdded && details.trim() !== (lastAdded.spec ?? ""),
    ({ data }) => {
      void saveDetails()
        .then(() => navigation.dispatch(data.action))
        .catch(() =>
          Alert.alert(
            "Couldn't save details",
            "Your details are still here. Please try again.",
          ),
        );
    },
  );

  async function saveDetails() {
    if (lastAdded && details.trim() !== (lastAdded.spec ?? "")) {
      await setItemSpec(lastAdded.id, details);
      setLastAdded({ ...lastAdded, spec: details.trim() || null });
    }
  }

  async function add(name: string) {
    if (!listId || !name.trim() || busy.current) return;
    busy.current = true;
    setSaving(true);
    const submittedDraft = draft;
    try {
      await saveDetails();
      const item = await addItem(listId, name);
      if (!item) return;
      setLastAdded(item);
      setDetails(item.spec ?? "");
      setDraft((current) => (current === submittedDraft ? "" : current));
      inputRef.current?.focus();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert(
        "Couldn't add item",
        "Your entry is still here. Please try again.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function finish(close: boolean) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await saveDetails();
      if (close) router.back();
      else inputRef.current?.focus();
    } catch {
      Alert.alert("Couldn't save details", "Please try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => void finish(true)}
              disabled={saving}
              hitSlop={12}
              accessibilityRole="button"
              className="px-2 py-1"
            >
              <Text className="text-base font-semibold text-primary">Done</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="px-6 py-4"
      >
        {needle ? (
          <View>
            {matches.map((item) => (
              <Pressable
                key={item.id}
                disabled={saving}
                onPress={() => void add(item.name ?? "")}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.status === "active" ? "on the list, edit details" : "add to list"}`}
                className="min-h-12 flex-row items-center gap-3 border-b border-border py-3"
              >
                <View className="flex-1">
                  <Text className="font-medium">{item.name}</Text>
                  {item.spec ? <Text variant="muted">{item.spec}</Text> : null}
                </View>
                {item.status === "active" ? (
                  <Text variant="muted">On list</Text>
                ) : null}
                <SymbolView
                  name={
                    item.status === "active"
                      ? {
                          ios: "checkmark.circle.fill",
                          android: "check_circle",
                        }
                      : { ios: "plus.circle", android: "add_circle_outline" }
                  }
                  tintColor={primaryColor}
                  size={22}
                />
              </Pressable>
            ))}
            {!hasExactMatch ? (
              <Button
                disabled={saving || !listId}
                variant="ghost"
                className="mt-2 items-start"
                onPress={() => void add(draft)}
              >
                <Text>Add &ldquo;{draft.trim()}&rdquo;</Text>
              </Button>
            ) : null}
          </View>
        ) : lastAdded ? (
          <View className="gap-4">
            <View className="flex-row items-center gap-2">
              <SymbolView
                name={{ ios: "checkmark.circle.fill", android: "check_circle" }}
                tintColor={primaryColor}
                size={22}
              />
              <Text className="flex-1 text-lg font-semibold">
                {lastAdded.name}
              </Text>
            </View>
            <Text variant="muted">
              On your list. Add details, or type the next item below.
            </Text>
            <Input
              value={details}
              onChangeText={setDetails}
              editable={!saving}
              placeholder="Amount, brand, or a note..."
              accessibilityLabel={`Details for ${lastAdded.name}`}
              returnKeyType="done"
              onSubmitEditing={() => void finish(false)}
            />
            <Button
              variant="outline"
              disabled={saving}
              onPress={() => void finish(false)}
            >
              <Text>Save details</Text>
            </Button>
          </View>
        ) : (
          <Text variant="muted">Start typing to add an item.</Text>
        )}
      </ScrollView>
      <KeyboardStickyView>
        <View
          className="border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            editable={!!listId}
            placeholder={lastAdded ? "Next item..." : "Add an item..."}
            accessibilityLabel="Add an item"
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => void add(draft)}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}
