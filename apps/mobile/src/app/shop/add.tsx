import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import {
  useHeaderHeight,
  usePreventRemove,
} from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { addItem, itemNameKey, setItemSpec } from "@/db/items";
import type { ListItem } from "@/db/schema";
import { categorizeItemAsync } from "@/features/shop/categorize";
import { capitalize } from "@/features/shop/text";

/** `existing`: it was already on the List, so this only touched it. */
type Added = {
  id: string;
  name: string;
  spec: string | null;
  existing: boolean;
};

/** Continuous entry: type, Return, type the next one. Everything sits
 *  bottom-up against the field, near the thumb. Items added this session
 *  stay visible, their details editable in place and saved on blur. */
export default function AddItemSheet() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  // Raw keyboard height, not KeyboardAvoidingView: inside a pageSheet it
  // measures its own frame wrong and leaves the field under the keyboard.
  // The sheet ends at the screen's bottom edge, so the full height is the
  // overlap; the home-indicator inset only applies while it's closed.
  const keyboard = useReanimatedKeyboardAnimation();
  const bottomInset = Math.max(insets.bottom, 12);
  const avoidKeyboard = useAnimatedStyle(() => ({
    paddingBottom:
      -keyboard.height.value +
      interpolate(keyboard.progress.value, [0, 1], [bottomInset, 8]),
  }));
  const inputRef = useRef<TextInput>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [added, setAdded] = useState<Added[]>([]);
  const [details, setDetails] = useState<Record<string, string>>({});
  const primaryColor = useResolveClassNames("text-primary").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
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

  const unsaved = added.filter(
    (item) =>
      (details[item.id] ?? item.spec ?? "").trim() !== (item.spec ?? ""),
  );

  usePreventRemove(unsaved.length > 0, ({ data }) => {
    void saveDetails()
      .then(() => navigation.dispatch(data.action))
      .catch(() =>
        Alert.alert(
          "Couldn't save details",
          "Your details are still here. Please try again.",
        ),
      );
  });

  async function saveDetails() {
    for (const item of unsaved) {
      const spec = details[item.id] ?? "";
      await setItemSpec(item.id, spec);
      setAdded((current) =>
        current.map((a) =>
          a.id === item.id ? { ...a, spec: spec.trim() || null } : a,
        ),
      );
    }
  }

  async function add(name: string) {
    if (!listId || !name.trim() || busy.current) return;
    busy.current = true;
    setSaving(true);
    const submittedDraft = draft;
    const existing = matches.some(
      (m) => m.name_key === itemNameKey(name) && m.status === "active",
    );
    try {
      await saveDetails();
      const item = await addItem(listId, name);
      if (!item) return;
      if (!item.categoryId) {
        void categorizeItemAsync(item.id, item.name);
      }
      // Newest last, next to the field; re-adding moves it down.
      setAdded((current) => [
        ...current.filter((a) => a.id !== item.id),
        { id: item.id, name: item.name, spec: item.spec, existing },
      ]);
      setDetails((current) => ({ ...current, [item.id]: item.spec ?? "" }));
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

  async function finish() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await saveDetails();
      router.back();
    } catch {
      Alert.alert("Couldn't save details", "Please try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Animated.View style={[{ flex: 1 }, avoidKeyboard]}>
      <Stack.Screen
        options={{
          // One surface: the bar floats over the sheet, only Done is glass.
          headerTransparent: true,
          headerRight: () => (
            <Pressable
              onPress={() => void finish()}
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
        // Padding, not content insets: insets push a bottom-anchored list
        // under the field.
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="grow justify-end pb-3"
        contentContainerStyle={{ paddingTop: headerHeight }}
      >
        {needle ? (
          <>
            {matches.map((item) => (
              <ItemRow
                key={item.id}
                status={item.status === "active" ? "onList" : "add"}
                title={capitalize(item.name ?? "")}
                subtitle={item.spec}
                disabled={saving}
                onPress={() => void add(item.name ?? "")}
              />
            ))}
            {!hasExactMatch ? (
              <ItemRow
                status="add"
                primary
                title={`Add “${draft.trim()}”`}
                disabled={saving || !listId}
                onPress={() => void add(draft)}
              />
            ) : null}
          </>
        ) : (
          <>
            {added.length > 0 ? (
              <>
                <SectionLabel>Added</SectionLabel>
                {added.map((item) => (
                  <View
                    key={item.id}
                    className="min-h-12 flex-row items-start gap-3 px-6 py-2.5"
                  >
                    <StatusIcon status={item.existing ? "onList" : "added"} />
                    <View className="flex-1">
                      <View className="flex-row items-baseline gap-3">
                        <Text className="flex-1 text-[17px]">
                          {capitalize(item.name)}
                        </Text>
                        {item.existing ? (
                          <Text className="text-[15px] text-muted-foreground">
                            On list
                          </Text>
                        ) : null}
                      </View>
                      <TextInput
                        value={details[item.id] ?? ""}
                        onChangeText={(text) =>
                          setDetails((current) => ({
                            ...current,
                            [item.id]: text,
                          }))
                        }
                        onEndEditing={() =>
                          void saveDetails().catch(() =>
                            Alert.alert(
                              "Couldn't save details",
                              "Please try again.",
                            ),
                          )
                        }
                        editable={!saving}
                        placeholder="Add details"
                        accessibilityLabel={`Details for ${item.name}`}
                        returnKeyType="done"
                        onSubmitEditing={() => inputRef.current?.focus()}
                        submitBehavior="submit"
                        selectionColor={primaryColor}
                        className="py-0.5 text-[15px] text-muted-foreground placeholder:text-muted-foreground/60"
                      />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <View className="px-4 pt-2">
        {/* Field text shares the row icons' leading edge. */}
        <View className="h-11 flex-row items-center rounded-full bg-muted pl-2 pr-1">
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            editable={!!listId}
            placeholder={added.length ? "Next item" : "Add an item"}
            accessibilityLabel="Add an item"
            autoFocus
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => void add(draft)}
            selectionColor={primaryColor}
            className="h-11 flex-1 pr-2 text-[17px] text-foreground placeholder:text-muted-foreground/70"
          />
          <Pressable
            onPress={() => void add(draft)}
            disabled={saving || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add"
            hitSlop={8}
          >
            <SymbolView
              name={{ ios: "plus.circle.fill", android: "add_circle" }}
              tintColor={draft.trim() ? primaryColor : mutedColor}
              size={32}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

type Status = "add" | "added" | "onList";

const statusSymbol = {
  add: { ios: "plus.circle", android: "add_circle_outline" },
  added: { ios: "checkmark", android: "check" },
  onList: { ios: "checkmark", android: "check" },
} as const;

/** One leading slot for status everywhere: a plain check means on the
 *  List, plum when this session put it there. Not Shop's filled check
 *  circle, which means bought. */
function StatusIcon({ status }: { status: Status }) {
  const primaryColor = useResolveClassNames("text-primary").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  return (
    <SymbolView
      name={statusSymbol[status]}
      tintColor={status === "onList" ? mutedColor : primaryColor}
      size={22}
      style={{ width: 22, height: 22 }}
    />
  );
}

function ItemRow({
  status,
  primary,
  title,
  subtitle,
  disabled,
  onPress,
}: {
  status: Status;
  primary?: boolean;
  title: string;
  subtitle?: string | null;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${status === "onList" ? ", on the list, edit details" : ""}`}
      className="min-h-12 flex-row items-center gap-3 px-6 py-2.5 active:bg-accent"
    >
      <StatusIcon status={status} />
      <View className="flex-1">
        <Text className={primary ? "text-[17px] text-primary" : "text-[17px]"}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[15px] text-muted-foreground">{subtitle}</Text>
        ) : null}
      </View>
      {status === "onList" ? (
        <Text className="text-[15px] text-muted-foreground">On list</Text>
      ) : null}
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-6 pb-1 pt-4 text-[13px] text-muted-foreground">
      {children}
    </Text>
  );
}
